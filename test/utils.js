import AoLoader from '@permaweb/ao-loader';
import {
  AOS_WASM,
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  BUNDLED_AOS_LUA,
  DEFAULT_HANDLE_OPTIONS,
} from '../tools/constants.js';
import assert from 'node:assert';

/**
 * Loads the aos wasm binary and returns the handle function with program memory
 * @returns {Promise<{handle: Function, memory: WebAssembly.Memory}>}
 */
export async function createAntAosLoader() {
  const handle = await AoLoader(AOS_WASM, AO_LOADER_OPTIONS);

  const evalRes = await handle(
    null,
    {
      ...DEFAULT_HANDLE_OPTIONS,
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: BUNDLED_AOS_LUA,
    },
    AO_LOADER_HANDLER_ENV,
  );
  return {
    handle,
    memory: evalRes.Memory,
  };
}

export function assertPatchMessage(result) {
  const hbPatchMessage = result.Messages.find((m) =>
    m.Tags.find((t) => t.name === 'device' && t.value === 'patch@1.0'),
  );
  assert(hbPatchMessage, 'missing HyperBEAM acl update');
}
