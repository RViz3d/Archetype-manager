/**
 * Test Suite for Features #1, #2, #3
 *
 * Feature #1: FoundryVTT module registration and initialization
 * Feature #2: JournalEntry database auto-created on first run
 * Feature #3: Data persists across page reload
 *
 * Uses mock FoundryVTT environment since no live Foundry instance is available.
 */

import { setupMockEnvironment, resetMockEnvironment, storage } from './foundry-mock.mjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

let passed = 0;
let failed = 0;
let totalTests = 0;

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

async function testAsync(name, fn) {
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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// =====================================================
// FEATURE #1: Module Registration and Initialization
// =====================================================
console.log('\n=== Feature #1: FoundryVTT module registration and initialization ===\n');

// Test 1.1: module.json exists with correct fields
test('module.json exists and is valid JSON', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson, 'module.json should parse to an object');
});

test('module.json has correct id', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assertEqual(moduleJson.id, 'archetype-manager');
});

test('module.json has correct title', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assertEqual(moduleJson.title, 'PF1e Archetype Manager');
});

test('module.json has version', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson.version, 'module.json should have a version field');
  assert(/^\d+\.\d+\.\d+/.test(moduleJson.version), 'Version should be semver format');
});

test('module.json has compatibility section', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson.compatibility, 'module.json should have compatibility');
  assert(moduleJson.compatibility.minimum, 'Should have minimum compatibility');
  assert(moduleJson.compatibility.verified, 'Should have verified compatibility');
});

test('module.json declares PF1e system dependency', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson.relationships?.systems, 'Should have system relationships');
  const pf1 = moduleJson.relationships.systems.find(s => s.id === 'pf1');
  assert(pf1, 'Should depend on pf1 system');
});

test('module.json declares pf1e-archetypes as optional', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  const optional = moduleJson.relationships?.optional || [];
  const pf1eArch = optional.find(m => m.id === 'pf1e-archetypes');
  assert(pf1eArch, 'Should declare pf1e-archetypes as optional dependency');
});

test('module.json declares esmodules entry point', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson.esmodules, 'Should have esmodules array');
  assert(moduleJson.esmodules.includes('scripts/module.mjs'), 'Should include scripts/module.mjs');
});

test('module.json declares CSS stylesheet', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson.styles, 'Should have styles array');
  assert(moduleJson.styles.includes('styles/archetype-manager.css'), 'Should include CSS file');
});

test('module.json declares language file', () => {
  const moduleJson = JSON.parse(readFileSync(resolve(projectRoot, 'module.json'), 'utf8'));
  assert(moduleJson.languages, 'Should have languages array');
  const en = moduleJson.languages.find(l => l.lang === 'en');
  assert(en, 'Should have English language');
  assertEqual(en.path, 'lang/en.json');
});

// Test 1.2: All referenced files exist
test('scripts/module.mjs exists', () => {
  const content = readFileSync(resolve(projectRoot, 'scripts/module.mjs'), 'utf8');
  assert(content.length > 0, 'module.mjs should not be empty');
});

test('styles/archetype-manager.css exists', () => {
  const content = readFileSync(resolve(projectRoot, 'styles/archetype-manager.css'), 'utf8');
  assert(content.length > 0, 'CSS file should not be empty');
});

test('lang/en.json exists and is valid JSON', () => {
  const content = readFileSync(resolve(projectRoot, 'lang/en.json'), 'utf8');
  const lang = JSON.parse(content);
  assert(lang.ARCHETYPE_MANAGER, 'Should have ARCHETYPE_MANAGER key');
});

// Test 1.3: Hooks registration - set up mock BEFORE importing module
// Important: We must set up globals before the import, because module.mjs
// registers Hooks.once at the top level during import.
{
  const { hooks, settings } = setupMockEnvironment();

  // Now import the module - this will register hooks on our mock Hooks
  await import('../scripts/module.mjs');

  await testAsync('Hooks.once(init) fires and registers settings', async () => {
    // Fire init hook
    await hooks.callAll('init');

    // Verify settings were registered
    assert(settings.isRegistered('archetype-manager', 'lastSelectedClass'),
      'lastSelectedClass setting should be registered');
    assert(settings.isRegistered('archetype-manager', 'showParseWarnings'),
      'showParseWarnings setting should be registered');
  });

  await testAsync('Hooks.once(ready) fires and sets up module API', async () => {
    // Fire ready hook (init already fired above)
    await hooks.callAll('ready');

    // Verify module API is set
    const module = game.modules.get('archetype-manager');
    assert(module, 'Module should exist in game.modules');
    assert(module.api, 'Module should have api property after ready');
    assert(typeof module.api.open === 'function', 'api.open should be a function');
    assertEqual(module.api.MODULE_ID, 'archetype-manager', 'api.MODULE_ID should match');
  });

  await testAsync('game.modules.get(archetype-manager) returns the module object', async () => {
    const module = game.modules.get('archetype-manager');
    assert(module, 'Module should be accessible via game.modules.get');
    assert(module.active, 'Module should be active');
  });
}

// =====================================================
// FEATURE #2: JournalEntry database auto-created
// =====================================================
console.log('\n=== Feature #2: JournalEntry database auto-created on first run ===\n');

await testAsync('JournalEntry DB is created during ready hook', async () => {
  // After ready hook fired above, JE should exist
  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'Archetype Manager DB JournalEntry should exist');
});

await testAsync('JournalEntry DB has 3 pages: fixes, missing, custom', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'JE should exist');

  const fixes = je.pages.getName('fixes');
  const missing = je.pages.getName('missing');
  const custom = je.pages.getName('custom');

  assert(fixes, 'fixes page should exist');
  assert(missing, 'missing page should exist');
  assert(custom, 'custom page should exist');
});

await testAsync('Each JE page contains valid empty JSON', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  for (const pageName of ['fixes', 'missing', 'custom']) {
    const page = je.pages.getName(pageName);
    assert(page, `${pageName} page should exist`);
    const data = JSON.parse(page.text.content);
    assertEqual(typeof data, 'object', `${pageName} should parse to an object`);
    assertEqual(Object.keys(data).length, 0, `${pageName} should be empty object`);
  }
});

await testAsync('No duplicate JournalEntries created on subsequent calls', async () => {
  // Count JEs named 'Archetype Manager DB'
  const count1 = game.journal.filter(j => j.name === 'Archetype Manager DB').length;
  assertEqual(count1, 1, 'Should have exactly 1 JE');

  // Call ensureDatabase again (simulating what ready hook does)
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  await JournalEntryDB.ensureDatabase();

  const count2 = game.journal.filter(j => j.name === 'Archetype Manager DB').length;
  assertEqual(count2, 1, 'Should still have exactly 1 JE after second ensureDatabase call');
});

// =====================================================
// FEATURE #3: Data persists across page reload
// =====================================================
console.log('\n=== Feature #3: Data persists across page reload ===\n');

await testAsync('Data written to JE fixes page can be read back', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');

  // Write test data
  const testData = { "test-archetype": { "class": "fighter", "features": {} } };
  await fixesPage.update({ 'text.content': JSON.stringify(testData) });

  // Read back
  const readBack = JSON.parse(fixesPage.text.content);
  assert(readBack['test-archetype'], 'test-archetype should exist after write');
  assertEqual(readBack['test-archetype'].class, 'fighter');
});

await testAsync('Data persists across simulated reload', async () => {
  // Write unique test data
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');
  const testData = { "persist-test": { "class": "wizard", "features": {} } };
  await fixesPage.update({ 'text.content': JSON.stringify(testData) });

  // Simulate reload (preserves journal data)
  const env2 = resetMockEnvironment();

  // Verify data persists
  const jeAfterReload = game.journal.getName('Archetype Manager DB');
  assert(jeAfterReload, 'JE should exist after reload');

  const fixesAfterReload = jeAfterReload.pages.getName('fixes');
  assert(fixesAfterReload, 'fixes page should exist after reload');

  const dataAfterReload = JSON.parse(fixesAfterReload.text.content);
  assert(dataAfterReload['persist-test'], 'persist-test should persist after reload');
  assertEqual(dataAfterReload['persist-test'].class, 'wizard', 'Data should be intact');
});

await testAsync('JournalEntryDB.readSection returns correct data after write', async () => {
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // Write through JournalEntryDB API
  const testData = { "api-test": { "class": "rogue", "features": { "sneak": { "level": 1 } } } };
  const success = await JournalEntryDB.writeSection('custom', testData);
  assert(success, 'writeSection should return true');

  // Read back through API
  const readBack = await JournalEntryDB.readSection('custom');
  assert(readBack['api-test'], 'api-test should exist');
  assertEqual(readBack['api-test'].class, 'rogue');
});

await testAsync('JournalEntryDB handles corrupted JSON gracefully', async () => {
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // Corrupt the fixes page directly
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');
  await fixesPage.update({ 'text.content': 'THIS IS NOT JSON!!!' });

  // Reading should recover gracefully
  const data = await JournalEntryDB.readSection('fixes');
  assertEqual(typeof data, 'object', 'Should return object');
  assertEqual(Object.keys(data).length, 0, 'Should return empty object after corruption recovery');

  // Page should be reset to valid JSON
  const resetContent = JSON.parse(fixesPage.text.content);
  assertEqual(typeof resetContent, 'object', 'Page should be reset to valid JSON');
});

await testAsync('JournalEntryDB.getArchetype follows priority chain', async () => {
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // Write same archetype to custom section
  await JournalEntryDB.setArchetype('custom', 'priority-test', {
    class: 'fighter', features: {}, source: 'custom'
  });

  // Should find it in custom
  let result = await JournalEntryDB.getArchetype('priority-test');
  assert(result, 'Should find archetype in custom');
  assertEqual(result._section, 'custom');

  // Now write to fixes (higher priority)
  await JournalEntryDB.setArchetype('fixes', 'priority-test', {
    class: 'fighter', features: {}, source: 'fixes'
  });

  // Should now return fixes version (higher priority)
  result = await JournalEntryDB.getArchetype('priority-test');
  assert(result, 'Should find archetype');
  assertEqual(result._section, 'fixes', 'fixes should take priority over custom');

  // Clean up
  await JournalEntryDB.deleteArchetype('fixes', 'priority-test');
  await JournalEntryDB.deleteArchetype('custom', 'priority-test');
});

await testAsync('Data in JE DB persists across full mock reload cycle', async () => {
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // Write unique test data
  const uniqueKey = `RESTART_TEST_${Date.now()}`;
  await JournalEntryDB.setArchetype('custom', uniqueKey, {
    class: 'rogue',
    features: { 'sneak-attack': { level: 1, replaces: null } }
  });

  // Verify it exists
  const before = await JournalEntryDB.getArchetype(uniqueKey);
  assert(before, 'Archetype should exist before reload');
  assertEqual(before.class, 'rogue');

  // Simulate reload
  resetMockEnvironment();

  // Verify persistence
  const after = await JournalEntryDB.getArchetype(uniqueKey);
  assert(after, `Archetype ${uniqueKey} should persist after reload`);
  assertEqual(after.class, 'rogue', 'Archetype class should be preserved');

  // Clean up
  await JournalEntryDB.deleteArchetype('custom', uniqueKey);
  const cleaned = await JournalEntryDB.getArchetype(uniqueKey);
  assert(!cleaned, 'Archetype should be deleted after cleanup');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
