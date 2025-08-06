import assert from 'node:assert';
import { describe, it, before } from 'node:test';
import { assertPatchMessage, createAntAosLoader } from './utils.js';
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

  async function sendMessage(
    options = {},
    mem = startMemory,
    env = AO_LOADER_HANDLER_ENV,
  ) {
    return handle(
      mem,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...options,
      },
      env,
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

  it('should handle reference ordering correctly', async () => {
    const antId1 = ''.padEnd(43, 'reference-test-1');
    const antId2 = ''.padEnd(43, 'reference-test-2');

    // First state notice with initial reference
    const stateData1 = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Name: 'Ant1',
      Ticker: 'ANT1',
    });

    // initialize with a nil lastReference - migration purposes
    const result0 = await sendMessage({
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: `ANTS['${antId1}'] = { Owner = '${STUB_ADDRESS}', Controllers = { ['${STUB_ADDRESS}'] = true } }`,
      Reference: 0,
    });

    const result1 = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData1,
        From: antId1,
        Owner: antId1,
        Reference: 1000,
      },
      result0.Memory,
    );

    // Second state notice with later reference
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
        Reference: 2000,
      },
      result1.Memory,
    );

    // Try to update first ANT with an earlier reference (should fail)
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
        Reference: 500, // Earlier reference
      },
      result2.Memory,
    );

    // Should have an error message
    assert.strictEqual(failedUpdate.Messages.length, 1);
    const failureAction = failedUpdate.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(failureAction.value, 'Invalid-State-Notice-Notice');
  });

  it('should handle unregister functionality correctly', async () => {
    const antId = ''.padEnd(43, 'unregister-test-ant-id');

    // First, register an ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'UnregisterTest',
      Ticker: 'UNT',
      Records: {},
    });

    // Register the ANT
    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
    });

    // Send state notice to complete registration
    const stateNoticeResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData,
        From: antId,
        Owner: antId,
      },
      registerResult.Memory,
    );

    // Verify ANT is registered by checking affiliations
    const affiliationsBefore = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      stateNoticeResult.Memory,
    );

    const ownedAnts = JSON.parse(affiliationsBefore.Messages[0].Data);
    assert.strictEqual(ownedAnts.Owned[0], antId);

    // Test 1: Owner can unregister the ANT
    const unregisterResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Unregister' },
          { name: 'Process-Id', value: antId },
        ],
        From: STUB_ADDRESS,
      },
      stateNoticeResult.Memory,
    );

    // Should send Unregister-Notice
    assert.strictEqual(unregisterResult.Messages.length, 2);
    const unregisterNotice = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(unregisterNotice.value, 'Unregister-Notice');

    // Should also send HyperBEAM patch message
    const hbPatchMessage = unregisterResult.Messages[1];
    assert(
      hbPatchMessage && hbPatchMessage.Tags.find((t) => t.name === 'device'),
      'missing HyperBEAM acl update',
    );

    // Verify ANT is no longer in affiliations
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      unregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 0);
  });

  it('should allow ANT to unregister itself', async () => {
    const antId = ''.padEnd(43, 'ant-self-unregister-test');

    // Register an ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'SelfUnregisterTest',
      Ticker: 'SUT',
      Records: {},
    });

    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
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

    // ANT unregisters itself
    const unregisterResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Unregister' },
          { name: 'Process-Id', value: antId },
        ],
        From: antId, // ANT is unregistering itself
        Owner: antId,
      },
      stateNoticeResult.Memory,
    );

    // Should send Unregister-Notice
    assert.strictEqual(unregisterResult.Messages.length, 2);
    const unregisterNotice = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(unregisterNotice.value, 'Unregister-Notice');

    // Should also send HyperBEAM patch message
    const hbPatchMessage = unregisterResult.Messages[1];
    assert(
      hbPatchMessage && hbPatchMessage.Tags.find((t) => t.name === 'device'),
      'missing HyperBEAM acl update',
    );

    // Verify ANT is no longer in affiliations
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      unregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 0);
  });

  it('should fail to unregister non-existent ANT', async () => {
    const nonExistentAntId = ''.padEnd(43, 'non-existent-ant-id');

    const unregisterResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Unregister' },
        { name: 'Process-Id', value: nonExistentAntId },
      ],
      From: STUB_ADDRESS,
      Owner: STUB_ADDRESS,
    });

    // Should have an error message
    assert.strictEqual(unregisterResult.Messages.length, 1);
    const errorAction = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(errorAction.value, 'Invalid-Unregister-Notice');
  });

  it('should fail to unregister ANT by unauthorized user', async () => {
    const antId = ''.padEnd(43, 'unauthorized-unregister-test');
    const unauthorizedAddress = ''.padEnd(43, 'unauthorized-address');

    // Register an ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'UnauthorizedTest',
      Ticker: 'UAT',
      Records: {},
    });

    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
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

    // Try to unregister with unauthorized address
    const unregisterResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Unregister' },
          { name: 'Process-Id', value: antId },
        ],
        From: unauthorizedAddress,
        Owner: unauthorizedAddress,
      },
      stateNoticeResult.Memory,
    );

    // Should have an error message
    assert.strictEqual(unregisterResult.Messages.length, 1);
    const errorAction = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(errorAction.value, 'Invalid-Unregister-Notice');

    // Verify ANT is still registered
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      unregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned[0], antId);
  });

  it('should allow registry owner to unregister ANT', async () => {
    const antId = ''.padEnd(43, 'registry-owner-unregister-test');

    // Register an ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'RegistryOwnerTest',
      Ticker: 'ROT',
      Records: {},
    });

    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
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

    // Registry owner unregisters the ANT
    const unregisterResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Unregister' },
          { name: 'Process-Id', value: antId },
        ],
        From: AO_LOADER_HANDLER_ENV.Process.Owner, // Registry owner
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      stateNoticeResult.Memory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should send Unregister-Notice
    assert.strictEqual(unregisterResult.Messages.length, 2);
    const unregisterNotice = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(unregisterNotice.value, 'Unregister-Notice');

    // Verify ANT is no longer in affiliations
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      unregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 0);
  });

  it('should allow registry itself (ao.id) to unregister ANT', async () => {
    const antId = ''.padEnd(43, 'registry-self-unregister-test');

    // Register an ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
      Balances: {},
      Name: 'RegistrySelfTest',
      Ticker: 'RST',
      Records: {},
    });

    const registerResult = await sendMessage({
      Tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
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

    // Registry itself unregisters the ANT
    const unregisterResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Unregister' },
          { name: 'Process-Id', value: antId },
        ],
        From: AO_LOADER_HANDLER_ENV.Process.Id, // Registry itself (ao.id)
        Owner: AO_LOADER_HANDLER_ENV.Process.Id,
      },
      stateNoticeResult.Memory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should send Unregister-Notice
    assert.strictEqual(unregisterResult.Messages.length, 2);
    const unregisterNotice = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(unregisterNotice.value, 'Unregister-Notice');

    // Verify ANT is no longer in affiliations
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      unregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 0);
  });

  it('should fail to unregister ANT by controller (not owner)', async () => {
    const antId = ''.padEnd(43, 'controller-unregister-test');
    const controllerAddress = ''.padEnd(43, 'controller-address');

    // Register an ANT with a controller that is not the owner
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [controllerAddress],
      Balances: {},
      Name: 'ControllerTest',
      Ticker: 'CT',
      Records: {},
    });

    const stateNoticeResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'State-Notice' }],
      Data: stateData,
      From: antId,
      Owner: antId,
    });

    // Try to unregister with controller address (not owner)
    const unregisterResult = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Unregister' },
          { name: 'Process-Id', value: antId },
        ],
        From: controllerAddress,
        Owner: controllerAddress,
      },
      stateNoticeResult.Memory,
    );

    // Should have an error message
    assert.strictEqual(unregisterResult.Messages.length, 1);
    const errorAction = unregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(errorAction.value, 'Invalid-Unregister-Notice');

    // Verify ANT is still registered
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      unregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned[0], antId);
  });

  it('should handle batch unregister functionality correctly', async () => {
    const antIds = [
      ''.padEnd(43, 'batch-unregister-test-1'),
      ''.padEnd(43, 'batch-unregister-test-2'),
      ''.padEnd(43, 'batch-unregister-test-3'),
    ];

    // Register multiple ANTs
    let currentMemory = startMemory;

    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
    });

    // Send state notice to register the ANT
    const stateNoticeResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'State-Notice' }],
      Data: stateData,
      From: antIds[0],
      Owner: antIds[0],
    });

    const stateNoticeResult2 = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData,
        From: antIds[1],
        Owner: antIds[1],
      },
      stateNoticeResult.Memory,
    );

    const stateNoticeResult3 = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: stateData,
        From: antIds[2],
        Owner: antIds[2],
      },
      stateNoticeResult2.Memory,
    );

    // Verify all ANTs are registered
    const affiliationsBefore = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      stateNoticeResult3.Memory,
    );

    const ownedAntsBefore = JSON.parse(affiliationsBefore.Messages[0].Data);
    assert.strictEqual(ownedAntsBefore.Owned.length, 3);
    antIds.forEach((antId) => {
      assert(ownedAntsBefore.Owned.includes(antId));
    });

    // Batch unregister two of the ANTs
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify([antIds[0], antIds[1]]),
        From: AO_LOADER_HANDLER_ENV.Process.Owner, // Registry owner
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      affiliationsBefore.Memory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should send single Batch-Unregister-Notice and HyperBEAM patch message
    assert.strictEqual(batchUnregisterResult.Messages.length, 2);

    // Check success notice message
    const batchUnregisterNotice = batchUnregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(batchUnregisterNotice.value, 'Batch-Unregister-Notice');

    // Should also send HyperBEAM patch message
    assertPatchMessage(batchUnregisterResult);

    // Verify only the third ANT remains in affiliations
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      batchUnregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 1);
    assert.strictEqual(ownedAntsAfter.Owned[0], antIds[2]);
  });

  it('should fail batch unregister when called by non-owner', async () => {
    const antId = ''.padEnd(43, 'batch-unauthorized-test-1');
    const unauthorizedAddress = ''.padEnd(43, 'unauthorized-address');

    // Register one ANT for testing
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
    });

    const stateNoticeResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'State-Notice' }],
      Data: stateData,
      From: antId,
      Owner: antId,
    });

    // Try batch unregister with unauthorized address
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify([antId]),
        From: unauthorizedAddress,
        Owner: unauthorizedAddress,
      },
      stateNoticeResult.Memory,
    );

    // Should have an error message
    assert.strictEqual(batchUnregisterResult.Messages.length, 1);
    const errorMessage = batchUnregisterResult.Messages[0];
    assert(errorMessage.Tags.find((tag) => tag.name === 'Error'));

    // Verify ANTs are still registered
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      batchUnregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 1);
    assert.strictEqual(ownedAntsAfter.Owned[0], antId);
  });

  it('should fail batch unregister with invalid data format', async () => {
    // Try batch unregister with invalid data (not an array)
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify({ invalid: 'data' }),
        From: AO_LOADER_HANDLER_ENV.Process.Owner,
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      startMemory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should have an error message due to data validation failure
    assert.strictEqual(batchUnregisterResult.Messages.length, 1);
    const errorMessage = batchUnregisterResult.Messages[0].Tags.find(
      (tag) =>
        tag.name === 'Action' &&
        tag.value === 'Invalid-Batch-Unregister-Notice',
    );

    assert(errorMessage, 'should have Invalid-Batch-Unregister-Notice');
  });

  it('should fail batch unregister with invalid antId in array', async () => {
    // Try batch unregister with array containing invalid antId
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify(['valid-ant-id', 123, 'another-valid-id']),
        From: AO_LOADER_HANDLER_ENV.Process.Owner,
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      startMemory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should have an error message
    assert.strictEqual(batchUnregisterResult.Messages.length, 1);

    const errorMessage = batchUnregisterResult.Messages[0];
    assert(errorMessage.Tags.find((tag) => tag.name === 'Error'));
  });

  it('should handle empty array in batch unregister', async () => {
    // Try batch unregister with empty array
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify([]),
        From: AO_LOADER_HANDLER_ENV.Process.Owner,
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      startMemory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should complete successfully with only HyperBEAM patch message
    assert.strictEqual(batchUnregisterResult.Messages.length, 1);
  });

  it('should handle partial failures in batch unregister', async () => {
    const existingAntId = ''.padEnd(43, 'existing-batch-ant');
    const nonExistentAntId = ''.padEnd(43, 'non-existent-ant');

    // Register one ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
    });

    const stateNoticeResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'State-Notice' }],
      Data: stateData,
      From: existingAntId,
      Owner: existingAntId,
    });

    // Try to batch unregister existing + non-existing ANT
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify([existingAntId, nonExistentAntId]),
        From: AO_LOADER_HANDLER_ENV.Process.Owner,
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      stateNoticeResult.Memory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should have Invalid-Batch-Unregister-Notice due to partial failure
    assert.strictEqual(batchUnregisterResult.Messages.length, 2);
    const errorNotice = batchUnregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(errorNotice.value, 'Invalid-Batch-Unregister-Notice');

    // Should include error details
    const errorData = JSON.parse(batchUnregisterResult.Messages[0].Data);
    assert(
      errorData[nonExistentAntId],
      'Should have error for non-existent ANT',
    );

    assertPatchMessage(batchUnregisterResult);

    // Verify the existing ANT was unregistered
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      batchUnregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 0);
  });

  it('should handle duplicate ANT IDs in batch unregister', async () => {
    const antId = ''.padEnd(43, 'duplicate-test-ant');

    // Register one ANT
    const stateData = JSON.stringify({
      Owner: STUB_ADDRESS,
      Controllers: [STUB_ADDRESS],
    });

    const stateNoticeResult = await sendMessage({
      Tags: [{ name: 'Action', value: 'State-Notice' }],
      Data: stateData,
      From: antId,
      Owner: antId,
    });

    // Try to batch unregister with duplicate IDs
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify([antId, antId, antId]),
        From: AO_LOADER_HANDLER_ENV.Process.Owner,
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      stateNoticeResult.Memory,
      AO_LOADER_HANDLER_ENV,
    );

    // Should succeed with single success notice + patch
    assert.strictEqual(batchUnregisterResult.Messages.length, 2);
    const successNotice = batchUnregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );
    assert.strictEqual(successNotice.value, 'Batch-Unregister-Notice');

    assertPatchMessage(batchUnregisterResult);

    // Verify ANT was unregistered (only once, not multiple times)
    const affiliationsAfter = await sendMessage(
      {
        Tags: [
          { name: 'Action', value: 'Access-Control-List' },
          { name: 'Address', value: STUB_ADDRESS },
        ],
      },
      batchUnregisterResult.Memory,
    );

    const ownedAntsAfter = JSON.parse(affiliationsAfter.Messages[0].Data);
    assert.strictEqual(ownedAntsAfter.Owned.length, 0);
  });

  it('should handle all non-existent ANTs in batch unregister', async () => {
    const nonExistentAntIds = [
      ''.padEnd(43, 'non-existent-1'),
      ''.padEnd(43, 'non-existent-2'),
    ];

    // Try to batch unregister all non-existing ANTs
    const batchUnregisterResult = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Batch-Unregister' }],
        Data: JSON.stringify(nonExistentAntIds),
        From: AO_LOADER_HANDLER_ENV.Process.Owner,
        Owner: AO_LOADER_HANDLER_ENV.Process.Owner,
      },
      startMemory,
      AO_LOADER_HANDLER_ENV,
    );

    assert.strictEqual(batchUnregisterResult.Messages.length, 1);
    assert.throws(
      () => assertPatchMessage(batchUnregisterResult),
      'should not have patch message since all ANTs are non-existent and would result in an empty ACL',
    );
    const errorNotice = batchUnregisterResult.Messages[0].Tags.find(
      (tag) => tag.name === 'Action',
    );

    assert.strictEqual(errorNotice.value, 'Invalid-Batch-Unregister-Notice');

    // Should include error details for all ANTs
    const errorData = JSON.parse(batchUnregisterResult.Messages[0].Data);

    nonExistentAntIds.forEach((antId) => {
      assert(errorData[antId], `Should have error for ${antId}`);
    });
  });
});
