import assert from 'node:assert';
import { describe, it, before } from 'node:test';
import { createAntAosLoader } from './utils.ts';
import {
  AO_LOADER_HANDLER_ENV,
  STUB_ADDRESS,
  DEFAULT_HANDLE_OPTIONS,
} from '../tools/constants.ts';

describe('register', async () => {
  let handle: Function;
  let startMemory: WebAssembly.Memory;

  before(async () => {
    const loader = await createAntAosLoader();
    handle = loader.handle;
    startMemory = loader.memory;
  });

  async function sendMessage(
    options: Record<string, any> = {},
    mem = startMemory,
  ) {
    return handle(
      mem,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...options,
      },
      AO_LOADER_HANDLER_ENV,
    );
  }

  it('Should register an ant', async () => {
    const antId = ''.padEnd(43, 'register-test-ant-id');
    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
    });
    const stateAction = registerResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(stateAction.value, 'State');
    const registerNotice = registerResult.Messages[1].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(registerNotice.value, 'Register-Notice');

    // send the state back to the registry as the ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [],
      Balances: {},
      Name: 'Ant1',
      Ticker: 'ANT1',
      Records: {},
    });
    const stateNoticeResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData,
        From: antId,
        Owner: antId,
      },
      registerResult.Memory,
    );

    console.dir(stateNoticeResult, { depth: null });

    // if we have messages in this case we have errors
    assert.strictEqual(stateNoticeResult.Messages.length, 0);

    const allAntsResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Get-All-Ants' }],
      },
      stateNoticeResult.Memory,
    );

    const ants = JSON.parse(allAntsResult.Messages[0].Data);
    assert.strictEqual(ants.length, 1);
    assert.strictEqual(ants[0].ant_id, antId);
    assert.strictEqual(ants[0].owner, STUB_ADDRESS);
  });
});
