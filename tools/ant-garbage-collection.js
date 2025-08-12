import { connect } from '@permaweb/aoconnect';
import { AOProcess, ARIO, ArweaveSigner, createAoSigner } from '@ar.io/sdk';
import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

const jwk = process.env.WALLET
  ? JSON.parse(process.env.WALLET)
  : await arweave.wallets.generate();

const signer = new ArweaveSigner(jwk);
const aoSigner = createAoSigner(signer);

const registryId =
  process.env.REGISTRY_ID ?? 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';
const vaotId =
  process.env.VAOT_ID ?? '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM';
const arioProcessId =
  process.env.ARIO_PROCESS_ID ?? 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE';
// const cuUrl = process.env.CU_URL ?? 'http://localhost:6363';
const cuUrl = process.env.CU_URL ?? 'https://cu.ardrive.io';
const graphqlUrl = process.env.GRAPHQL_URL ?? 'https://arweave.net/graphql';

const dryRun = process.argv.includes('--dry-run') ? true : false;
// the ant registry has a max batch size of 1000 at the moment
const limit = Math.max(
  process.argv.includes('--limit')
    ? parseInt(process.argv[process.argv.indexOf('--limit') + 1])
    : 1000,
  1000,
);

const ao = connect({
  CU_URL: cuUrl,
  GRAPHQL_URL: graphqlUrl,
});
const ario = ARIO.init({
  process: new AOProcess({
    processId: arioProcessId,
    ao,
  }),
  signer: aoSigner,
});

const fetchAllArNSProcessIds = async () => {
  const antIds = new Set();
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching ANTs from cursor ${cursor}`);
    const result = await ario.getArNSRecords({
      cursor,
      limit: 1000,
    });
    cursor = result.nextCursor;
    hasMore = result.hasMore;
    for (const item of result.items) {
      antIds.add(item.processId);
    }
  }
  console.log(`Found ${antIds.size} ANTs`);
  return antIds;
};

const fetchAllProcessIdsInRegistry = async () => {
  console.log('Fetching unregistered ants from registry...');
  const antRegistryAntsRes = await ao.dryrun({
    process: registryId,
    From: vaotId,
    Owner: vaotId,
    data: "print(require('json').encode(require('.utils').keys(ANTS)))",
    tags: [
      {
        name: 'Action',
        value: 'Eval',
      },
    ],
  });
  const antRegistryAnts = JSON.parse(antRegistryAntsRes.Output.data);
  console.log(`Found ${antRegistryAnts.length} ANTs in registry`);
  return Array.from(antRegistryAnts);
};

async function main() {
  console.log('Performing garbage collection on ANT registry...');

  try {
    const [processIdsForNames, processIdsInRegistry] = await Promise.all([
      fetchAllArNSProcessIds(),
      fetchAllProcessIdsInRegistry(),
    ]);

    const antsToUnregister = Array.from(processIdsInRegistry).filter(
      (antId) => !Array.from(processIdsForNames).includes(antId),
    );
    console.log(`Found ${antsToUnregister.length} ANTs to unregister`);

    function createUnregisterLuaTemplate(antIds) {
      return `
        Send({
          Target = '${registryId}',
          Action = 'Batch-Unregister',
          Data = '${JSON.stringify(antIds)}',
        })\n
    `;
    }
    function createUnregisterProposals(antIds) {
      const proposals = [];
      // if there is more than 1000 ants to unregister, we need to split the unregister into multiple proposals
      if (antIds.length > 1000) {
        for (let i = 0; i < antIds.length; i += limit) {
          proposals.push(
            createUnregisterLuaTemplate(antIds.slice(i, i + limit)),
          );
        }
      } else {
        proposals.push(createUnregisterLuaTemplate(antIds));
      }
      return proposals;
    }

    const unregisterProposals = createUnregisterProposals(antsToUnregister);

    if (dryRun) {
      console.log('Dry run enabled, skipping unregistration');
      console.log('Unregister Lua preview:');
      unregisterProposals.forEach((proposal, index) => {
        console.log('\n'.padStart(33, '='));
        console.log(`Proposal ${index + 1}: ${proposal}`);
      });
      process.exit(0);
    }

    const vaotProcess = new AOProcess({
      processId: vaotId,
      ao,
    });

    for (const [index, unregisterLua] of unregisterProposals.entries()) {
      const proposalRes = await vaotProcess.send({
        tags: [
          {
            name: 'Action',
            value: 'Propose',
          },
          { name: 'Proposal-Type', value: 'Eval' },
          { name: 'Vote', value: 'yay' },
          { name: 'Process-Id', value: vaotId },
        ],
        data: unregisterLua,
        signer: aoSigner,
      });

      console.log('\n'.padStart(33, '='));
      console.log(
        `Proposal ${proposalRes.proposalNumber} | Proposal Message ID: ${proposalRes.msgId} | For batch ${index + 1} of ${unregisterProposals.length}`,
      );
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    console.log('Done garbage collecting ANTs');
    process.exit(0);
  }
}

main();
