import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { ANTRegistry, AOProcess, ARIO } from '@ar.io/sdk';
import { pLimit } from 'plimit-lit';
import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

async function main() {
  const jwk = process.env.WALLET
    ? JSON.parse(process.env.WALLET)
    : await arweave.wallets.generate();
  const registryId =
    process.env.REGISTRY_ID ?? 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';
  const vaotId =
    process.env.VAOT_ID ?? '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM';
  const arioProcessId =
    process.env.ARIO_PROCESS_ID ??
    'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE';
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
  const antRegistry = ANTRegistry.init({
    process: new AOProcess({
      processId: registryId,
      ao,
    }),
    signer: createDataItemSigner(jwk),
  });

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
    result.items.forEach((item) => {
      antIds.add(item.processId);
    });
  }

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

  const antsToRegister = Array.from(antIds).filter(
    (antId) => !antRegistryAnts.includes(antId),
  );
  console.log(`Found ${antsToRegister.length} ANTs to register`);
  const throttle = pLimit(50);

  await Promise.all(
    antsToRegister.map((antId) =>
      throttle(() =>
        antRegistry
          .register({ processId: antId })
          .catch((e) => console.error(e)),
      ),
    ),
  );
  console.log('Done');
  process.exit(0);
}

main();
