import assert from 'node:assert';
import { describe, it, before } from 'node:test';
import { createAntAosLoader } from './utils.ts';
import {
  AO_LOADER_HANDLER_ENV,
  STUB_ADDRESS,
  DEFAULT_HANDLE_OPTIONS,
} from '../tools/constants.ts';
import { register } from 'node:module';

describe('ANT Registration Cases', async () => {
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

  it('should register an ant', async () => {
    const antId = ''.padEnd(43, 'register-test-ant-id');
    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
    });
    console.log(registerResult);
    const stateAction = registerResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(stateAction.value, 'State');

    // send the state back to the registry as the ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
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

    // if we have messages in this case we have errors

    assert.strictEqual(stateNoticeResult.Messages.length, 0);

    const allAntsResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      stateNoticeResult.Memory,
    );

    const ants = JSON.parse(allAntsResult.Messages[0].Data);
    assert.strictEqual(ants[0], antId);
  });

  it('should clean up dead registrations', async () => {
    const antId = ''.padEnd(43, 'dead-registration-ant-id');
    const currentTime = Date.now();

    // Register the ANT
    await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
      Timestamp: currentTime.toString(),
    });

    // Simulate a time delay to exceed the cleanup threshold
    const futureTime = currentTime + 1000 * 60 * 31; // 31 minutes later

    const cleanResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'Access-Control-List' }],
      Timestamp: futureTime.toString(),
    });

    const allAntsResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      cleanResult.Memory,
    );

    const ants = JSON.parse(allAntsResult.Messages[0].Data);
    assert.strictEqual(ants.length, 0);
  });

  it('should handle renounced ANTs', async () => {
    const antId = ''.padEnd(43, 'renounced-ant-id');
    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
    });

    // send the state back to the registry as the ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS, // Renounced ANT has no owner
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'RenouncedAnt',
      Ticker: 'RANT',
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

    assert.strictEqual(stateNoticeResult.Messages.length, 0);

    const allAntsResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      stateNoticeResult.Memory,
    );

    const ants = JSON.parse(allAntsResult.Messages[0].Data);
    assert.strictEqual(ants[0], antId);
  });

  it('should handle ANTs with no state', async () => {
    const antId = ''.padEnd(43, 'no-state-ant-id');
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

    // Simulate a state notice with no state data
    const stateNoticeResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: null,
        From: antId,
        Owner: antId,
      },
      registerResult.Memory,
    );

    assert.strictEqual(stateNoticeResult.Messages.length, 1);
    const failureNotice = stateNoticeResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(failureNotice.value, 'Invalid-State-Notice-Notice');
  });
});
