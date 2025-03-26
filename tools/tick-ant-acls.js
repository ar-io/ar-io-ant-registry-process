import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { ANTRegistry, AOProcess, ARIO } from '@ar.io/sdk';
import { pLimit } from 'plimit-lit';

async function main() {
  const jwk = JSON.parse(process.env.WALLET);
  const registryId = process.env.REGISTRY_ID;
  const vaotId = process.env.VAOT_ID;
  const arioProcessId = process.env.ARIO_PROCESS_ID;
  const cuUrl = process.env.CU_URL;
  const graphqlUrl = process.env.GRAPHQL_URL;

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
