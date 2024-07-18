import AoLoader from '@permaweb/ao-loader';
import {
  BUNDLED_AOS_LUA,
  AOS_WASM,
  AO_LOADER_OPTIONS,
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
} from './constants.ts';

async function main() {
  const testCases = [['Eval', { Module: ''.padEnd(43, '1') }, BUNDLED_AOS_LUA]];

  const handle = await AoLoader(AOS_WASM, AO_LOADER_OPTIONS);
  // memory dump of the evaluated program
  let programState = undefined;

  for (const [method, args, data] of testCases) {
    const tags = args
      ? Object.entries(args).map(([key, value]) => ({ name: key, value }))
      : [];
    // To spawn a process, pass null as the buffer
    const result = await handle(
      programState,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        Tags: [...tags, { name: 'Action', value: method }],
        Data: data,
      },
      AO_LOADER_HANDLER_ENV,
    );

    programState = result.Memory;
    console.dir({ method, result }, { depth: null });
  }
}
main();
