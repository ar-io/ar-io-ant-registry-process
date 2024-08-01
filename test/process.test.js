import assert from 'node:assert';
import { describe, it } from 'node:test';
import { createAntAosLoader } from './utils.ts';
import {
  AO_LOADER_HANDLER_ENV,
  STUB_ADDRESS,
  DEFAULT_HANDLE_OPTIONS,
} from '../tools/constants.ts';

describe('aos', async () => {
  const { handle: originalHandle, memory: startMemory } =
    await createAntAosLoader();

  async function handle(options = {}, mem = startMemory) {
    return originalHandle(
      mem,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...options,
      },
      AO_LOADER_HANDLER_ENV,
    );
  }

  it('Should return process info', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Info' }],
    });

    const info = JSON.parse(result.Messages[0].Data);
    assert(info.Owner);
    assert(info.Name);
  });
});
