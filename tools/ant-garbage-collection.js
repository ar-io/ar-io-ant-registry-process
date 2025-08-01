import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { AOProcess, ARIO } from '@ar.io/sdk';
import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

const jwk = process.env.WALLET
  ? JSON.parse(process.env.WALLET)
  : await arweave.wallets.generate();
const registryId =
  process.env.REGISTRY_ID ?? 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';
const vaotId =
  process.env.VAOT_ID ?? '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM';
const arioProcessId =
  process.env.ARIO_PROCESS_ID ?? 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE';
// const cuUrl = process.env.CU_URL ?? 'http://localhost:6363';
const cuUrl = process.env.CU_URL ?? 'https://cu.ardrive.io';
const graphqlUrl = process.env.GRAPHQL_URL ?? 'https://arweave.net/graphql';

const ao = connect({
  CU_URL: cuUrl,
  GRAPHQL_URL: graphqlUrl,
});
const ario = ARIO.init({
  process: new AOProcess({
    processId: arioProcessId,
    ao,
  }),
  signer: createDataItemSigner(jwk),
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

    const antsToUnregister = Array.from(processIdsForNames).filter((antId) =>
      processIdsInRegistry.includes(antId),
    );
    console.log(`Found ${antsToUnregister.length} ANTs to unregister`);

    function createUnregisterLuaTemplate(antId) {
      return `
    Send({
      Target = '${registryId}',
      Action = 'Unregister',
      ['Process-Id'] = '${antId}',
    })\n\n
    `;
    }

    const unregisterLua = antsToUnregister
      .map(createUnregisterLuaTemplate)
      .join('');

    const vaotProcess = new AOProcess({
      processId: vaotId,
      ao,
    });

    const proposalRes = await vaotProcess.send({
      tags: [
        {
          name: 'Action',
          value: 'Propose',
        },
        { name: 'Proposal-Type', value: 'Eval' },
        { name: 'Vote', value: 'yay' },
        { name: 'Process-Id', value: registryId },
      ],
      data: unregisterLua,
    });

    console.log(proposalRes);
  } catch (error) {
    console.error(error); 
    process.exit(1);
  } finally {
    console.log('Done garbage collecting ANTs');
    process.exit(0);
  }
}

main();
