import AoLoader from '@permaweb/ao-loader';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ao READ-ONLY Env Variables */
const env = {
  Process: {
    Id: '2',
    Tags: [{ name: 'Authority', value: 'XXXXXX' }],
  },
  Module: {
    Id: '1',
    Tags: [{ name: 'Authority', value: 'YYYYYY' }],
  },
};

async function main() {
  const wasmBinary = fs.readFileSync(
    path.join(__dirname, '../src/process.wasm'),
  );
  // Create the handle function that executes the Wasm
  const handle = await AoLoader(wasmBinary, {
    format: 'wasm32-unknown-emscripten',
    inputEncoding: 'JSON-1',
    outputEncoding: 'JSON-1',
    memoryLimit: '524288000', // in bytes
    computeLimit: (9e12).toString(),
    extensions: [],
  });

  const testCases = [['Info', {}]];

  for (const [method, args] of testCases) {
    const tags = args
      ? Object.entries(args).map(([key, value]) => ({ name: key, value }))
      : [];
    // To spawn a process, pass null as the buffer
    const result = await handle(
      null,
      {
        Id: '3',
        ['Block-Height']: '1',
        // TEST INDICATES NOT TO RUN AUTHORITY CHECKS
        Owner: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
        Target: 'XXXXX',
        From: '7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk',
        Tags: [...tags, { name: 'Action', value: method }],
      },
      env,
    );
    delete result.Memory;
    delete result.Assignments;
    delete result.Spawns;
    console.log(method);
    console.dir(result, { depth: null });
  }
}
main();
