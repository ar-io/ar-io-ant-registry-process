import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { ANTRegistry, AOProcess, ARIO } from '@ar.io/sdk';
import { pLimit } from 'plimit-lit';
import Arweave from 'arweave';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import fs from 'node:fs';

const stateCheckCuUrl = 'https://cu.ao-testnet.xyz';

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
const antRegistry = ANTRegistry.init({
  process: new AOProcess({
    processId: registryId,
    ao,
  }),
  signer: createDataItemSigner(jwk),
});

const fetchAllArNSProcessIds = async () => {
  const antMap = new Map(); // processId -> arnsName
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
      antMap.set(item.processId, item.name);
    }
  }
  console.log(`Found ${antMap.size} ANTs`);
  return antMap;
};

const extractCuNumber = (url) => {
  const match = url.match(/cu(\d+)\.ao-testnet\.xyz/);
  return match ? match[1] : 'unknown';
};

const checkProcessState = async (processId, arnsName) => {
  const url = `${stateCheckCuUrl}/state/${processId}`;
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    const finalUrl = response.url;
    const cuNumber = extractCuNumber(finalUrl);

    if (!response.ok) {
      console.error(
        `HEAD request failed | ArNS: ${arnsName} | ProcessId: ${processId} | CU: cu${cuNumber} | Status: ${response.status}`,
      );
      return { processId, arnsName, success: false, cuNumber, status: response.status };
    }

    return { processId, arnsName, success: true, cuNumber, status: response.status };
  } catch (error) {
    console.error(
      `HEAD request error | ArNS: ${arnsName} | ProcessId: ${processId} | Error: ${error.message}`,
    );
    return { processId, arnsName, success: false, cuNumber: 'unknown', status: 'error' };
  }
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
  console.log('Spinning up ao-cu...');
  // const compose = await new DockerComposeEnvironment(
  //   projectRootPath,
  //   'tools/docker-compose.test.yml',
  // )
  //   .withWaitStrategy('ao-cu-1', Wait.forHttp(`/state/${registryId}`, 6363))
  //   .withWaitStrategy('ao-cu-1', Wait.forHttp(`/state/${arioProcessId}`, 6363))
  //   .withStartupTimeout(30 * 60_000) // 30 minutes
  //   .up();

  console.log('Local CU ready!');

  try {
    const [processIdToNameMap, processIdsInRegistry] = await Promise.all([
      fetchAllArNSProcessIds(),
      fetchAllProcessIdsInRegistry(),
    ]);

    const antsToRegister = Array.from(processIdToNameMap.entries()).filter(
      ([antId]) => !processIdsInRegistry.includes(antId),
    );
    console.log(`Found ${antsToRegister.length} ANTs to register`);

    // Check process state with HEAD requests (limit concurrency to 5)
    console.log('Checking process states via HEAD requests...');
    const stateCheckThrottle = pLimit(5);
    const stateCheckResults = await Promise.all(
      antsToRegister.map(([processId, arnsName]) =>
        stateCheckThrottle(() => checkProcessState(processId, arnsName)),
      ),
    );

    const validAnts = stateCheckResults.filter((result) => result.success);
    const failedAnts = stateCheckResults.filter((result) => !result.success);

    console.log(
      `State check complete: ${validAnts.length} valid, ${failedAnts.length} failed`,
    );

    if (failedAnts.length > 0) {
      console.log('\n--- Failed ANTs Summary ---');
      const sortedFailedAnts = [...failedAnts].sort((a, b) => {
        const aNum = a.cuNumber === 'unknown' ? Infinity : parseInt(a.cuNumber, 10);
        const bNum = b.cuNumber === 'unknown' ? Infinity : parseInt(b.cuNumber, 10);
        return aNum - bNum;
      });
      const failedAntLines = [];
      for (const ant of sortedFailedAnts) {
        const line = `ArNS: ${ant.arnsName} | ANT Process ID: ${ant.processId} | CU: cu${ant.cuNumber} | HTTP Status: ${ant.status}`;
        console.log(line);
        failedAntLines.push(line);
      }
      console.log('----------------------------\n');

      // Write failed ANTs summary to file for CI reporting
      const summaryContent = failedAntLines.join('\n');
      fs.writeFileSync('failed-ants-summary.txt', summaryContent);
    } else {
      // Clean up file if no failures
      if (fs.existsSync('failed-ants-summary.txt')) {
        fs.unlinkSync('failed-ants-summary.txt');
      }
    }

    // Register only valid ANTs
    console.log(`Registering ${validAnts.length} valid ANTs...`);
    const registerThrottle = pLimit(50);

    await Promise.all(
      validAnts.map((ant) =>
        registerThrottle(() =>
          antRegistry
            .register({ processId: ant.processId })
            .catch((e) => console.error(e)),
        ),
      ),
    );
  } catch (error) {
    // await compose.down();
    console.error(error);
    process.exit(1);
  } finally {
    //  await compose.down();
    console.log('Done');
    process.exit(0);
  }
}

main();
