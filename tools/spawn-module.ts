import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

const ao = connect({
  GATEWAY_URL: 'https://arweave.net',
});
const moduleId = 'ZUEIijxJlV3UgZS9c7to5cgW5EhyPdAndHqVZxig7vE';
const scheduler = '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';

async function main() {
  const wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
  const signer = createDataItemSigner(JSON.parse(wallet));

  const processId = await ao.spawn({
    module: moduleId,
    scheduler,
    signer,
  });

  //---------------
  console.log('Process ID:', processId);
  console.log('Waiting 20 seconds to ensure process is readied.');
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  console.log('Continuing...');

  const testCases = [['Info', {}]];

  for (const [method, args] of testCases) {
    const tags: { name: string; value: any }[] = args
      ? Object.entries(args).map(([key, value]) => ({ name: key, value }))
      : [];
    const result = await ao.dryrun({
      process: processId,
      tags: [...tags, { name: 'Action', value: method }],
      signer,
    });

    console.dir({ method, result }, { depth: null });
  }
}

main();
