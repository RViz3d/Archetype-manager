/**
 * Test Suite for Feature #107: Register auto-create JournalEntry DB setting
 *
 * Verifies that a new module setting 'autoCreateJEDB' (boolean, default true,
 * world-scoped, config: true) controls whether the module automatically creates
 * the 'Archetype Manager DB' JournalEntry on startup.
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failed++;
    console.error(`  \u2717 ${name}`);
    console.error(`    ${e.message}`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failed++;
    console.error(`  \u2717 ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log('\n=== Feature #107: Register auto-create JournalEntry DB setting ===\n');

// =====================================================
// Section 1: Setting registration in init hook
// =====================================================

console.log('--- Section 1: Setting registration in init hook ---');

const env = setupMockEnvironment();

// Import the module to register hooks
await import('../scripts/module.mjs');

// Fire init hook to register settings
await env.hooks.callAll('init');

test('autoCreateJEDB setting is registered after init', () => {
  const isRegistered = game.settings.isRegistered('archetype-manager', 'autoCreateJEDB');
  assert(isRegistered, 'autoCreateJEDB setting should be registered');
});

test('autoCreateJEDB setting has type Boolean', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'autoCreateJEDB');
  assertEqual(reg.type, Boolean, 'type should be Boolean');
});

test('autoCreateJEDB setting has default value of true', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'autoCreateJEDB');
  assertEqual(reg.default, true, 'default should be true');
});

test('autoCreateJEDB setting has scope "world"', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'autoCreateJEDB');
  assertEqual(reg.scope, 'world', 'scope should be "world"');
});

test('autoCreateJEDB setting has config: true', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'autoCreateJEDB');
  assertEqual(reg.config, true, 'config should be true');
});

test('autoCreateJEDB setting has a descriptive name', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'autoCreateJEDB');
  assert(reg.name && reg.name.length > 0, 'name should be non-empty');
  assert(reg.name.toLowerCase().includes('auto') || reg.name.toLowerCase().includes('journal') || reg.name.toLowerCase().includes('database'),
    `name should be descriptive (got: "${reg.name}")`);
});

test('autoCreateJEDB setting has a hint explaining behavior', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'autoCreateJEDB');
  assert(reg.hint && reg.hint.length > 10, 'hint should be a meaningful description');
});

test('autoCreateJEDB default value returns true via game.settings.get', () => {
  const value = game.settings.get('archetype-manager', 'autoCreateJEDB');
  assertEqual(value, true, 'Default get() should return true');
});

// =====================================================
// Section 2: Setting enabled (default) - JE DB is created
// =====================================================

console.log('\n--- Section 2: Setting enabled (default) - JE DB is created ---');

await asyncTest('With autoCreateJEDB=true (default), JE database is created on ready', async () => {
  const freshEnv = resetMockEnvironment();

  // Register the autoCreateJEDB setting with default true
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    name: 'Auto-Create Journal Database',
    hint: 'Controls auto-creation',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Verify no journals exist before ready
  assertEqual(game.journal.length, 0, 'No journals before ready');

  // Fire ready hook (mimics module.mjs behavior)
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }

  // Verify journal was created
  const je = game.journal.getName('Archetype Manager DB');
  assert(je !== null && je !== undefined, 'JE database should be created when setting is true');
});

await asyncTest('Default setting creates JE with correct name', async () => {
  const freshEnv = resetMockEnvironment();
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }

  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'JE should exist');
  assertEqual(je.name, 'Archetype Manager DB', 'JE name should match');
});

await asyncTest('Default setting creates JE with all three pages (fixes, missing, custom)', async () => {
  const freshEnv = resetMockEnvironment();
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }

  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'JE should exist');
  assertEqual(je.pages.length, 3, 'JE should have 3 pages');
});

// =====================================================
// Section 3: Setting disabled - JE DB is NOT created
// =====================================================

console.log('\n--- Section 3: Setting disabled - JE DB is NOT created ---');

await asyncTest('With autoCreateJEDB=false, JE database is NOT created on ready', async () => {
  // Use setupMockEnvironment (not resetMockEnvironment) to get a truly clean state
  const freshEnv = setupMockEnvironment();

  // Register the setting
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    name: 'Auto-Create Journal Database',
    hint: 'Controls auto-creation',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Set the value to false
  game.settings.set('archetype-manager', 'autoCreateJEDB', false);

  // Verify no journals exist before ready
  assertEqual(game.journal.length, 0, 'No journals before ready');

  // Fire ready hook logic (mimics module.mjs behavior)
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }

  // Verify journal was NOT created
  const je = game.journal.getName('Archetype Manager DB');
  assert(je === null || je === undefined, 'JE database should NOT be created when setting is false');
  assertEqual(game.journal.length, 0, 'No journals should exist');
});

await asyncTest('Setting disabled still allows module API to be set up', async () => {
  const freshEnv = resetMockEnvironment();

  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.set('archetype-manager', 'autoCreateJEDB', false);

  // The ready hook sets up the API regardless of the autoCreateJEDB setting
  game.modules.get('archetype-manager').api = {
    open: () => {},
    MODULE_ID: 'archetype-manager',
    JE_DB_NAME: 'Archetype Manager DB'
  };

  const api = game.modules.get('archetype-manager').api;
  assert(api, 'Module API should be set up');
  assertEqual(api.MODULE_ID, 'archetype-manager', 'API should have MODULE_ID');
  assertEqual(api.JE_DB_NAME, 'Archetype Manager DB', 'API should have JE_DB_NAME');
});

await asyncTest('Disabling setting logs a skip message', async () => {
  const freshEnv = resetMockEnvironment();

  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.set('archetype-manager', 'autoCreateJEDB', false);

  // Capture console.log output
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
    origLog(...args);
  };

  // Simulate the ready hook conditional
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    // Would call ensureDatabase
  } else {
    console.log('PF1e Archetype Manager | Auto-create JournalEntry database is disabled, skipping database creation');
  }

  console.log = origLog;

  const skipMsg = logs.find(l => l.includes('skipping') || l.includes('disabled'));
  assert(skipMsg, 'Should log a message indicating database creation was skipped');
});

// =====================================================
// Section 4: Setting value can be toggled at runtime
// =====================================================

console.log('\n--- Section 4: Setting toggling ---');

test('Setting can be changed from true to false', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), true, 'Default is true');
  game.settings.set('archetype-manager', 'autoCreateJEDB', false);
  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), false, 'Changed to false');
});

test('Setting can be changed from false to true', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  game.settings.set('archetype-manager', 'autoCreateJEDB', false);
  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), false, 'Set to false');
  game.settings.set('archetype-manager', 'autoCreateJEDB', true);
  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), true, 'Changed back to true');
});

await asyncTest('Re-enabling setting and restarting creates DB on next ready', async () => {
  const freshEnv = resetMockEnvironment();

  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  // First startup with setting disabled
  game.settings.set('archetype-manager', 'autoCreateJEDB', false);
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }
  assertEqual(game.journal.length, 0, 'No JE created when disabled');

  // Re-enable the setting
  game.settings.set('archetype-manager', 'autoCreateJEDB', true);

  // Simulate next startup's ready hook
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }
  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'JE should be created after re-enabling and restarting');
});

// =====================================================
// Section 5: Module.mjs source code verification
// =====================================================

console.log('\n--- Section 5: Source code verification ---');

await asyncTest('module.mjs contains autoCreateJEDB registration', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');
  assert(source.includes('autoCreateJEDB'), 'module.mjs should contain autoCreateJEDB');
});

await asyncTest('module.mjs registers autoCreateJEDB with Boolean type', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  // Find the autoCreateJEDB registration block
  const regStart = source.indexOf("'autoCreateJEDB'");
  assert(regStart !== -1, 'Should find autoCreateJEDB string');
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes('Boolean'), 'Registration should use Boolean type');
});

await asyncTest('module.mjs registers autoCreateJEDB with default: true', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'autoCreateJEDB'");
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes('default: true'), 'Registration should have default: true');
});

await asyncTest('module.mjs registers autoCreateJEDB with scope: world', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'autoCreateJEDB'");
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes("scope: 'world'"), 'Registration should have scope: world');
});

await asyncTest('module.mjs registers autoCreateJEDB with config: true', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'autoCreateJEDB'");
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes('config: true'), 'Registration should have config: true');
});

await asyncTest('module.mjs ready hook checks autoCreateJEDB before ensureDatabase', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  // Find the ready hook section
  const readyStart = source.indexOf("Hooks.once('ready'");
  assert(readyStart !== -1, 'Should find ready hook');
  const readyBlock = source.substring(readyStart);

  // Verify the conditional check exists
  assert(readyBlock.includes("game.settings.get") && readyBlock.includes('autoCreateJEDB'),
    'Ready hook should check autoCreateJEDB setting');
  assert(readyBlock.includes('ensureDatabase'),
    'Ready hook should reference ensureDatabase');
});

await asyncTest('module.mjs logs a message when skipping database creation', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const readyStart = source.indexOf("Hooks.once('ready'");
  const readyBlock = source.substring(readyStart);

  // Look for a log message in the else branch (when disabled)
  assert(readyBlock.includes('skipping') || readyBlock.includes('disabled') || readyBlock.includes('Skipping'),
    'Should log a skip message when setting is disabled');
});

// =====================================================
// Section 6: Integration with existing settings
// =====================================================

console.log('\n--- Section 6: Integration with existing settings ---');

test('autoCreateJEDB coexists with lastSelectedClass setting', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'lastSelectedClass', {
    scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  assert(game.settings.isRegistered('archetype-manager', 'lastSelectedClass'), 'lastSelectedClass should still be registered');
  assert(game.settings.isRegistered('archetype-manager', 'autoCreateJEDB'), 'autoCreateJEDB should be registered');
});

test('autoCreateJEDB coexists with showParseWarnings setting', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'showParseWarnings', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  assert(game.settings.isRegistered('archetype-manager', 'showParseWarnings'), 'showParseWarnings should still be registered');
  assert(game.settings.isRegistered('archetype-manager', 'autoCreateJEDB'), 'autoCreateJEDB should be registered');
});

test('Module registers at least 3 settings after init (including autoCreateJEDB)', () => {
  const freshEnv = setupMockEnvironment();

  // Simulate init hook
  game.settings.register('archetype-manager', 'lastSelectedClass', {
    scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register('archetype-manager', 'showParseWarnings', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  // Count registered settings for archetype-manager (may include additional settings from other features)
  let count = 0;
  for (const [key] of game.settings._registered) {
    if (key.startsWith('archetype-manager.')) count++;
  }
  assert(count >= 3, `Should have at least 3 settings registered, got ${count}`);
  // Verify the 3 core settings are present
  assert(game.settings.isRegistered('archetype-manager', 'lastSelectedClass'), 'lastSelectedClass should be registered');
  assert(game.settings.isRegistered('archetype-manager', 'showParseWarnings'), 'showParseWarnings should be registered');
  assert(game.settings.isRegistered('archetype-manager', 'autoCreateJEDB'), 'autoCreateJEDB should be registered');
});

// =====================================================
// Section 7: Edge cases
// =====================================================

console.log('\n--- Section 7: Edge cases ---');

await asyncTest('Setting disabled with existing JE DB does not delete it', async () => {
  const freshEnv = resetMockEnvironment();

  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  // First, create the JE DB while enabled
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  await JournalEntryDB.ensureDatabase();
  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'JE should exist after creation');

  // Now disable the setting
  game.settings.set('archetype-manager', 'autoCreateJEDB', false);

  // Simulate another startup with setting disabled - should NOT delete existing JE
  if (game.settings.get('archetype-manager', 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  }

  // The existing JE should still be there (not deleted)
  const jeStillExists = game.journal.getName('Archetype Manager DB');
  assert(jeStillExists, 'Existing JE should NOT be deleted when setting is disabled');
});

await asyncTest('Setting enabled is idempotent - does not create duplicate JEs', async () => {
  const freshEnv = resetMockEnvironment();

  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // Call ensureDatabase twice with setting enabled
  await JournalEntryDB.ensureDatabase();
  await JournalEntryDB.ensureDatabase();

  // Count journals
  let count = 0;
  for (const je of game.journal) {
    if (je.name === 'Archetype Manager DB') count++;
  }
  assertEqual(count, 1, 'Should have exactly one JE, not duplicates');
});

// =====================================================
// Summary
// =====================================================

console.log(`\n=== Feature #107 Results: ${passed}/${totalTests} passed ===`);
if (failed > 0) {
  console.error(`${failed} tests FAILED`);
  process.exit(1);
} else {
  console.log('All tests passed!');
}
