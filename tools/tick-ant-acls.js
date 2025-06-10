import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { ANTRegistry, AOProcess, ARIO } from '@ar.io/sdk';
import { pLimit } from 'plimit-lit';
import Arweave from 'arweave';
import { DockerComposeEnvironment, Wait } from 'testcontainers';

const projectRootPath = process.cwd();

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
const cuUrl = process.env.CU_URL ?? 'http://localhost:6363';
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
  let retries = 0;
  let result = null;
  while (retries < 5) {
    try {
      result = await ao.dryrun({
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
      break;
    } catch (error) {
      console.error(error);
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** retries));
    }
  }
  if (!result) {
    throw new Error(`Failed to fetch unregistered ANTs`);
  }
  const antRegistryAnts = JSON.parse(result.Output.data);
  return Array.from(antRegistryAnts);
};

async function main() {
  console.log('Spinning up ao-cu...');
  const compose = await new DockerComposeEnvironment(
    projectRootPath,
    'tools/docker-compose.test.yml',
  )
    .withWaitStrategy('ao-cu-1', Wait.forHttp(`/state/${registryId}`, 6363))
    .withWaitStrategy('ao-cu-1', Wait.forHttp(`/state/${arioProcessId}`, 6363))
    .withStartupTimeout(45 * 60_000) // 45 minutes - cu from scratch can take 15 minutes per process and we have 2.
    .up();

  console.log('Local CU ready!');

  try {
    const [processIdsForNames, processIdsInRegistry] = await Promise.all([
      fetchAllArNSProcessIds(),
      fetchAllProcessIdsInRegistry(),
    ]);

    const antsToRegister = processIdsForNames.filter(
      (antId) => !processIdsInRegistry.includes(antId),
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
  } catch (error) {
    await compose.down();
    console.error(error);
    process.exit(1);
  } finally {
    await compose.down();
    console.log('Done');
    process.exit(0);
  }
}

main();
