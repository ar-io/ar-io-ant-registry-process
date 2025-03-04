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

  async function addVersion({
    moduleId,
    luaSourceId,
    version,
    notes = '',
    from = STUB_ADDRESS,
    mem = startMemory,
  } = {}) {
    const addVersionRes = await sendMessage(
      {
        From: from,
        Tags: [
          { name: 'Action', value: 'Add-Version' },
          { name: 'Module-Id', value: moduleId },
          { name: 'Lua-Source-Id', value: luaSourceId },
          { name: 'Version', value: version },
          { name: 'Notes', value: notes },
        ].filter((t) => t.value !== undefined),
      },
      mem,
    );

    return addVersionRes;
  }

  async function removeVersion({
    version,
    from = STUB_ADDRESS,
    mem = startMemory,
  } = {}) {
    const removeVersionRes = await sendMessage(
      {
        From: from,
        Tags: [
          { name: 'Action', value: 'Remove-Version' },

          { name: 'Version', value: version },
        ].filter((t) => t.value !== undefined),
      },
      mem,
    );

    return removeVersionRes;
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
  const validVersions = [0, 1, 2, 10, 100];
  const validNotes = [
    '',
    'Test release',
    'Bug fixes and improvements',
    'Initial release',
  ];

  it('should reject version additions from non-owner address', async () => {
    const addVersionRes = await addVersion({
      moduleId: validModuleIds[0],
      luaSourceId: validSourceIds[0],
      version: validVersions[0],
      notes: 'Test notes',
      from: 'non-owner-address',
    });

    assert(
      !addVersionRes.Messages.find((m) =>
        m.Tags.find((t) => t.value === 'Add-Version-Notice'),
      ),
      'Version was added by non-owner',
    );
  });

  it('should remove a version', async () => {
    const addVersionRes = await addVersion({
      moduleId: validModuleIds[0],
      luaSourceId: validSourceIds[0],
      version: '1',
      notes: 'Test notes',
    });
    const previousVersionsRes = await getVersions(addVersionRes.Memory);
    const previousVersions = JSON.parse(previousVersionsRes.Messages[0].Data);
    assert(previousVersions['1'], 'did not add version');

    const removeVersionRes = await removeVersion({
      version: '1',
      mem: previousVersionsRes.Memory,
    });
    const currentVersionsRes = await getVersions(removeVersionRes.Memory);
    const currentVersions = JSON.parse(currentVersionsRes.Messages[0].Data);

    assert(!currentVersions['1'], 'failed to remove version');
  });

  it('should reject version removals from non-owner address', async () => {
    const addVersionRes = await addVersion({
      moduleId: validModuleIds[0],
      luaSourceId: validSourceIds[0],
      version: '1',
      notes: 'Test notes',
    });
    const previousVersionsRes = await getVersions(addVersionRes.Memory);
    const previousVersions = JSON.parse(previousVersionsRes.Messages[0].Data);
    assert(previousVersions['1'], 'did not add version');

    const removeVersionRes = await removeVersion({
      version: '1',
      from: 'non-owner-address',
    });

    assert(
      !removeVersionRes.Messages.find((m) =>
        m.Tags.find((t) => t.value === 'Remove-Version-Notice'),
      ),
      'Version was removed by non-owner',
    );
  });

  const testCaseMapping = validModuleIds.flatMap((moduleId) =>
    validSourceIds.flatMap((luaSourceId) =>
      validVersions.flatMap((version) =>
        validNotes.map((notes) => ({ moduleId, luaSourceId, version, notes })),
      ),
    ),
  );

  testCaseMapping.forEach((testCase) => {
    it('should reject version additions from non-owner address', async () => {
      const addVersionRes = await addVersion({
        moduleId: validModuleIds[0],
        luaSourceId: validSourceIds[0],
        version: validVersions[0],
        notes: 'Test notes',
        from: 'non-owner-address',
      });

      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Version was added by non-owner',
      );
    });

    it(`should add version correctly for module id: ${testCase.moduleId}, lua source id: ${testCase.luaSourceId}, version: ${testCase.version}, notes: "${testCase.notes}"`, async () => {
      // Update addVersion call to include notes
      const addVersionRes = await addVersion({
        moduleId: testCase.moduleId,
        luaSourceId: testCase.luaSourceId,
        version: testCase.version,
        notes: testCase.notes,
      });

      const addVersionNotice = addVersionRes.Messages.find((m) =>
        m.Tags.find((t) => t.value === 'Add-Version-Notice'),
      );
      assert(addVersionNotice, 'Did not receive add version notice');
      const getVersionsResAfter = await getVersions(addVersionRes.Memory);
      const versionsAfter = JSON.parse(getVersionsResAfter.Messages[0].Data);

      assert(
        versionsAfter[testCase.version],
        `Version ${testCase.version} was not added`,
      );
      assert.strictEqual(
        versionsAfter[testCase.version].moduleId,
        testCase.moduleId,
        'Module ID does not match',
      );
      assert.strictEqual(
        versionsAfter[testCase.version].luaSourceId,
        testCase.luaSourceId,
        'Lua Source ID does not match',
      );
      assert.strictEqual(
        versionsAfter[testCase.version].notes,
        testCase.notes,
        'Notes do not match',
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
      const addVersionRes = await addVersion({
        moduleId: invalidModuleId,
        luaSourceId: validSourceIds[0],
        version: validVersions[0],
        from: 'non-owner-address',
      });
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
      const addVersionRes = await addVersion({
        moduleId: validModuleIds[0],
        luaSourceId: invalidSourceId,
        version: validVersions[0],
        from: 'non-owner-address',
      });
      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Add version notice sent by non-process-owner',
      );
    });
  });

  const invalidVersions = [
    -1, // negative numbers
    1.5, // floating point numbers
    null, // null
    undefined, // undefined
  ];

  invalidVersions.forEach((invalidVersion) => {
    it(`should reject invalid version: ${invalidVersion}`, async () => {
      const addVersionRes = await addVersion({
        moduleId: validModuleIds[0],
        luaSourceId: validSourceIds[0],
        version: invalidVersion,
        from: 'non-owner-address',
      });
      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Non process owner added a version',
      );

      // Check that the version was not added
      const getVersionsRes = await getVersions(addVersionRes.Memory);
      assert(
        !JSON.parse(getVersionsRes.Messages[0].Data)[invalidVersion],
        `Version ${invalidVersion} was incorrectly added`,
      );
    });
  });

  const invalidNotes = [123, {}, []];

  invalidNotes.forEach((invalidNote) => {
    it(`should reject invalid notes: ${invalidNote}`, async () => {
      const addVersionRes = await addVersion({
        moduleId: validModuleIds[0],
        luaSourceId: validSourceIds[0],
        version: validVersions[0],
        notes: invalidNote,
      });

      assert(
        !addVersionRes.Messages.find((m) =>
          m.Tags.find((t) => t.value === 'Add-Version-Notice'),
        ),
        'Version was added with invalid notes',
      );
    });
  });
});
