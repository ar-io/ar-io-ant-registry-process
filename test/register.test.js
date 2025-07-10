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
    const hbPatchMessage = stateNoticeResult.Messages.at(0);
    assert(
      hbPatchMessage && hbPatchMessage.Tags.find((t) => t.name === 'device'),
      'missing HyperBEAM acl update',
    );

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

    // Successful update with later reference
    const successUpdate = await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'State-Notice' }],
        Data: updatedStateData1,
        From: antId1,
        Owner: antId1,
        Reference: 3000, // Later reference
      },
      failedUpdate.Memory,
    );

    // should have a hb patch message
    const hbPatchMessage = successUpdate.Messages.at(0);
    assert(
      hbPatchMessage && hbPatchMessage.Tags.find((t) => t.name === 'device'),
      'missing HyperBEAM acl update',
    );
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
});
