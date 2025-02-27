import assert from 'node:assert';
import { describe, it, before } from 'node:test';
import { createAntAosLoader } from './utils.js';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.js';

describe('ANT Versions', async () => {
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

  async function addVersion(
    moduleId,
    luaSourceId,
    semver,
    from = STUB_ADDRESS,
    mem = startMemory,
  ) {
    const addVersionRes = await sendMessage(
      {
        From: from, // process owner or non-owner
        Tags: [
          { name: 'Action', value: 'Add-Version' },
          { name: 'Module-Id', value: moduleId },
          { name: 'Lua-Source-Id', value: luaSourceId },
          { name: 'Version', value: semver },
        ],
      },
      mem,
    );

    return addVersionRes;
  }

  async function getVersions(mem) {
    return await sendMessage(
      {
        Tags: [{ name: 'Action', value: 'Get-Versions' }],
      },
      mem,
    );
  }

  const validModuleIds = [
    'module-id-'.padEnd(43, '1'),
    'another-module-id-'.padEnd(43, '1'),
  ];
  const validSourceIds = [
    'lua-source-id-'.padEnd(43, '1'),
    'another-lua-source-id-'.padEnd(43, '1'),
    undefined,
  ];
  const validSemvers = [
    '1.0.1',
    '2.0.0',
    '0.1.0',
    '1.2.3',
    '10.20.30',
    '1.0.0-alpha',
    '1.0.0-beta.2',
    '9223372036854775807.0.0',
  ];

  const testCaseMapping = validModuleIds.flatMap((moduleId) =>
    validSourceIds.flatMap((luaSourceId) =>
      validSemvers.map((semver) => ({ moduleId, luaSourceId, semver })),
    ),
  );

  testCaseMapping.forEach((testCase) => {
    it(`should add version correctly for module id: ${testCase.moduleId}, lua source id: ${testCase.luaSourceId}, semver: ${testCase.semver}`, async () => {
      const getVersionsResBefore = await getVersions();
      const versionsBefore = JSON.parse(getVersionsResBefore.Messages[0].Data);
      const addVersionRes = await addVersion(
        testCase.moduleId,
        testCase.luaSourceId,
        testCase.semver,
      );
      const addVersionNotice = addVersionRes.Messages.find((m) =>
        m.Tags.find((t) => t.value === 'Add-Version-Notice'),
      );
      assert(addVersionNotice, 'Did not recieve add version notice');
      const getVersionsResAfter = await getVersions(addVersionRes.Memory);
      const versionsAfter = JSON.parse(getVersionsResAfter.Messages[0].Data);

      assert(
        versionsAfter[testCase.semver],
        `Version ${testCase.semver} was not added`,
      );
      assert.strictEqual(
        versionsAfter[testCase.semver].module,
        testCase.moduleId,
        'Module ID does not match',
      );
      assert.strictEqual(
        versionsAfter[testCase.semver].luaSource,
        testCase.luaSourceId,
        'Lua Source ID does not match',
      );
      const versionsAfterExcludingAdded = { ...versionsAfter };
      delete versionsAfterExcludingAdded[testCase.semver];
      assert.deepStrictEqual(
        versionsAfterExcludingAdded,
        versionsBefore,
        'Pre-existing versions were changed',
      );
    });
  });

  const invalidModuleIds = [
    'invalid-module-id', // too short
    'module-id-too-long-'.padEnd(44, '1'), // too long
    'module-id-with-invalid-characters-'.padEnd(43, '1'), // contains invalid characters
  ];

  invalidModuleIds.forEach((invalidModuleId) => {
    it(`should reject invalid module id: ${invalidModuleId}`, async () => {
      const addVersionRes = await addVersion(
        invalidModuleId,
        validSourceIds[0],
        validSemvers[0],
        'non-owner-address',
      );
      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Add version notice sent by non-process-owner',
      );
    });
  });
  const invalidSourceIds = [
    'invalid-lua-source-id', // too short
    'lua-source-id-too-long-'.padEnd(44, '1'), // too long
    'lua-source-id-with-invalid-characters-'.padEnd(43, '1'), // contains invalid characters
  ];

  invalidSourceIds.forEach((invalidSourceId) => {
    it(`should reject invalid lua source id: ${invalidSourceId}`, async () => {
      const addVersionRes = await addVersion(
        validModuleIds[0],
        invalidSourceId,
        validSemvers[0],
        'non-owner-address',
      );
      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Add version notice sent by non-process-owner',
      );
    });
  });

  const invalidSemvers = [
    '1.0', // missing patch
    '1', // missing minor and patch
    '1.0.0.0', // too many segments
    'v1.0.0', // contains invalid prefix
    '1.0.0+build', // build metadata not supported
    'not.a.version', // invalid format
    '', // empty string
    123, // non-string input
    null, // null input
  ];

  invalidSemvers.forEach((invalidSemver) => {
    it(`should reject invalid semver: ${invalidSemver}`, async () => {
      const addVersionRes = await addVersion(
        validModuleIds[0],
        validSourceIds[0],
        invalidSemver,
        'non-owner-address',
      );
      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Non process owner added a version',
      );

      // Check that the version was not added
      const getVersionsRes = await getVersions(
        invalidSemver,
        addVersionRes.Memory,
      );
      assert(
        !JSON.parse(getVersionsRes.Messages[0].Data)[invalidSemver],
        `Version ${invalidSemver} was incorrectly added`,
      );
    });
  });
});
