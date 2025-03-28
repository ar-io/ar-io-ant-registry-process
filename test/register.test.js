import assert from 'node:assert';
import { describe, it, before } from 'node:test';
import { createAntAosLoader } from './utils.js';
import {
  AO_LOADER_HANDLER_ENV,
  STUB_ADDRESS,
  DEFAULT_HANDLE_OPTIONS,
} from '../tools/constants.js';

describe('ANT Registration Cases', async () => {
  let handle;
  let startMemory;

  before(async () => {
    const loader = await createAntAosLoader();
    handle = loader.handle;
    startMemory = loader.memory;
  });

  async function sendMessage(options = {}, mem = startMemory) {
    return handle(
      mem,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...options,
      },
      AO_LOADER_HANDLER_ENV,
    );
  }

  it('should handle a state notice correctly', async () => {
    const antId = ''.padEnd(43, 'register-test-ant-id');
    // send the state back to the registry as the ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'Ant1',
      Ticker: 'ANT1',
      Records: {},
    });

    const stateNoticeResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'State-Notice' }],
      Data: stateData,
      From: antId,
      Owner: antId,
    });

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

    const affiliations = JSON.parse(allAntsResult.Messages[0].Data);
    assert.strictEqual(affiliations.Owned[0], antId);
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

  it('should handle timestamp ordering correctly', async () => {
    const antId1 = ''.padEnd(43, 'timestamp-test-1');
    const antId2 = ''.padEnd(43, 'timestamp-test-2');

    // First state notice with initial timestamp
    const stateData1 = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Name: 'Ant1',
      Ticker: 'ANT1',
    });

    // initialize with a nil lastUpdatedAt timestamp - migration purposes
    const result0 = await sendMessage({
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: `ANTS['${antId1}'] = { Owner: '${STUB_ADDRESS}', Controllers: {'${STUB_ADDRESS}'} }`,
      Timestamp: 0,
    });

    const result1 = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData1,
        From: antId1,
        Owner: antId1,
        Timestamp: 1000,
      },
      result0.Memory,
    );

    // Second state notice with later timestamp
    const stateData2 = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Name: 'Ant2',
      Ticker: 'ANT2',
    });

    const result2 = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData2,
        From: antId2,
        Owner: antId2,
        Timestamp: 2000,
      },
      result1.Memory,
    );

    // Try to update first ANT with an earlier timestamp (should fail)
    const updatedStateData1 = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Name: 'Ant1Updated',
      Ticker: 'ANT1',
    });

    const failedUpdate = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: updatedStateData1,
        From: antId1,
        Owner: antId1,
        Timestamp: 500, // Earlier timestamp
      },
      result2.Memory,
    );

    // Should have an error message
    assert.strictEqual(failedUpdate.Messages.length, 1);
    const failureAction = failedUpdate.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(failureAction.value, 'Invalid-State-Notice-Notice');

    // Successful update with later timestamp
    const successUpdate = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: updatedStateData1,
        From: antId1,
        Owner: antId1,
        Timestamp: 3000, // Later timestamp
      },
      result2.Memory,
    );

    // Should not have any error messages
    assert.strictEqual(successUpdate.Messages.length, 0);
  });
});
