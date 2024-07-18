import fs from 'fs';
import path from 'path';
import { createDataItemSigner, connect } from '@permaweb/aoconnect';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ao = connect({
  GATEWAY_URL: 'https://arweave.net',
});
const moduleId = 'cbn0KKrBZH7hdNkNokuXLtGryrWM--PjSTBqIzw9Kkk';
const scheduler = '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';

async function main() {
  const luaCode = fs.readFileSync(
    path.join(__dirname, '../dist/aos-bundled.lua'),
    'utf-8',
  );

  const wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
  const signer = createDataItemSigner(JSON.parse(wallet));

  const processId = await ao.spawn({
    module: moduleId,
    scheduler,
    signer,
  });

  console.log('Process ID:', processId);
  console.log('Waiting 20 seconds to ensure process is readied.');
  await new Promise((resolve) => setTimeout(resolve, 20_000));
  console.log('Loading ANT Lua code...');

  const testCases: any = [['Eval', {}, luaCode]];

  for (const [method, args, data] of testCases) {
    const tags: { name: string; value: any }[] = args
      ? Object.entries(args).map(([key, value]) => ({ name: key, value }))
      : [];
    const result = await ao
      .message({
        process: processId,
        tags: [...tags, { name: 'Action', value: method }],
        data,
        signer,
      })
      .catch((e) => e);

    console.dir({ method, result }, { depth: null });
  }
}

main();
