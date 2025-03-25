import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import {
  ANTRegistry,
  AOProcess,
  ANT_REGISTRY_ID,
  ARIO,
  ARIO_MAINNET_PROCESS_ID,
} from '@ar.io/sdk';
import { pLimit } from 'plimit-lit';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

async function main() {
  const jwk = await arweave.wallets.generate();

  const ao = connect({
    CU_URL: 'https://cu.ardrive.io',
    GRAPHQL_URL: 'https://arweave.net/graphql',
  });
  const ario = ARIO.init({
    process: new AOProcess({
      processId: ARIO_MAINNET_PROCESS_ID,
      ao,
    }),
    signer: createDataItemSigner(jwk),
  });
  const antRegistry = ANTRegistry.init({
    process: new AOProcess({
      processId: ANT_REGISTRY_ID,
      ao,
    }),
    signer: createDataItemSigner(jwk),
  });

  const antIds = new Set();
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await ario.getArNSRecords({
      cursor,
      limit: 1000,
    });
    cursor = result.cursor;
    hasMore = result.hasMore;
    result.items.forEach((item) => {
      antIds.add(item.processId);
    });
  }

  const antRegistryAntsRes = await ao.dryrun({
    process: ANT_REGISTRY_ID,
    From: '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM',
    Owner: '4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM',
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
}

main();
