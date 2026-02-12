/**
 * Test Suite for Feature #109: Register default compendium source setting
 *
 * Verifies that a new module setting 'defaultCompendiumSource' (string, default 'pf1e-archetypes',
 * world-scoped, config: true) specifies which module's compendium packs to use as the primary
 * archetype data source. The compendium parser should use this setting value when constructing
 * pack keys (e.g., '{source}.pf-archetypes' and '{source}.pf-arch-features').
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

function assertIncludes(str, sub, message) {
  if (!str || !str.includes(sub)) {
    throw new Error(`${message || 'String inclusion failed'}: "${str && str.substring(0, 200)}" does not include "${sub}"`);
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

console.log('\n=== Feature #109: Register default compendium source setting ===\n');

// =====================================================
// Section 1: Setting registration in init hook
// =====================================================
console.log('--- Section 1: Setting registration in init hook ---');

const env = setupMockEnvironment();

// Import the module to register hooks
await import('../scripts/module.mjs');

// Fire init hook to register settings
await env.hooks.callAll('init');

test('defaultCompendiumSource setting is registered after init', () => {
  const isRegistered = game.settings.isRegistered('archetype-manager', 'defaultCompendiumSource');
  assert(isRegistered, 'defaultCompendiumSource setting should be registered');
});

test('defaultCompendiumSource setting has type String', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'defaultCompendiumSource');
  assertEqual(reg.type, String, 'type should be String');
});

test('defaultCompendiumSource setting has default value of pf1e-archetypes', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'defaultCompendiumSource');
  assertEqual(reg.default, 'pf1e-archetypes', 'default should be pf1e-archetypes');
});

test('defaultCompendiumSource setting has scope world', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'defaultCompendiumSource');
  assertEqual(reg.scope, 'world', 'scope should be world');
});

test('defaultCompendiumSource setting has config true', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'defaultCompendiumSource');
  assertEqual(reg.config, true, 'config should be true');
});

test('defaultCompendiumSource setting has descriptive name', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'defaultCompendiumSource');
  assert(reg.name && reg.name.length > 5, 'name should be descriptive');
  assertIncludes(reg.name, 'Compendium', 'name should mention compendium');
});

test('defaultCompendiumSource setting has descriptive hint', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'defaultCompendiumSource');
  assert(reg.hint && reg.hint.length > 20, 'hint should be descriptive');
  assertIncludes(reg.hint, 'module', 'hint should mention module');
});

test('Default value returned via game.settings.get', () => {
  const value = game.settings.get('archetype-manager', 'defaultCompendiumSource');
  assertEqual(value, 'pf1e-archetypes', 'should return default value');
});

// =====================================================
// Section 2: getCompendiumSource() helper method
// =====================================================
console.log('\n--- Section 2: getCompendiumSource() helper method ---');

const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

test('getCompendiumSource returns default value', () => {
  const source = CompendiumParser.getCompendiumSource();
  assertEqual(source, 'pf1e-archetypes', 'should return pf1e-archetypes by default');
});

test('getCompendiumSource returns updated value after setting change', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'custom-archetypes');
  const source = CompendiumParser.getCompendiumSource();
  assertEqual(source, 'custom-archetypes', 'should return the updated setting value');
  // Reset
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

test('getCompendiumSource falls back to pf1e-archetypes on empty string', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', '');
  const source = CompendiumParser.getCompendiumSource();
  assertEqual(source, 'pf1e-archetypes', 'should fallback to pf1e-archetypes for empty string');
  // Reset
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

// =====================================================
// Section 3: isModuleAvailable uses setting value
// =====================================================
console.log('\n--- Section 3: isModuleAvailable uses setting value ---');

test('isModuleAvailable checks the default source module', () => {
  // pf1e-archetypes not in modules map by default (only archetype-manager is)
  const available = CompendiumParser.isModuleAvailable();
  assertEqual(available, false, 'should be false when pf1e-archetypes module not in modules map');
});

test('isModuleAvailable returns true when default source module is active', () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true, title: 'PF1e Archetypes' });
  const available = CompendiumParser.isModuleAvailable();
  assertEqual(available, true, 'should be true when pf1e-archetypes is active');
  game.modules.delete('pf1e-archetypes');
});

test('isModuleAvailable checks custom source module when setting changed', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'custom-archetypes');
  // custom-archetypes not in modules map
  const available1 = CompendiumParser.isModuleAvailable();
  assertEqual(available1, false, 'should be false when custom-archetypes not available');

  // Add custom-archetypes module
  game.modules.set('custom-archetypes', { id: 'custom-archetypes', active: true, title: 'Custom Archetypes' });
  const available2 = CompendiumParser.isModuleAvailable();
  assertEqual(available2, true, 'should be true when custom-archetypes is active');

  // Cleanup
  game.modules.delete('custom-archetypes');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

test('isModuleAvailable returns false for inactive custom source module', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'custom-archetypes');
  game.modules.set('custom-archetypes', { id: 'custom-archetypes', active: false, title: 'Custom Archetypes' });
  const available = CompendiumParser.isModuleAvailable();
  assertEqual(available, false, 'should be false when custom-archetypes is inactive');

  // Cleanup
  game.modules.delete('custom-archetypes');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

// =====================================================
// Section 4: loadArchetypeList uses setting for pack key
// =====================================================
console.log('\n--- Section 4: loadArchetypeList uses setting for pack key ---');

// Notification capture
let notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', message: msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', message: msg }); },
  error: (msg) => { notifications.push({ type: 'error', message: msg }); }
};

await asyncTest('loadArchetypeList uses default pack key pf1e-archetypes.pf-archetypes', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true, title: 'PF1e Archetypes' });
  const archetypes = [
    { id: 'arch-1', name: 'Test Archetype 1' },
    { id: 'arch-2', name: 'Test Archetype 2' }
  ];
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => archetypes,
    size: archetypes.length
  });

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 2, 'should load 2 archetypes from default pack');

  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.modules.delete('pf1e-archetypes');
});

await asyncTest('loadArchetypeList uses custom pack key when setting changed', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'my-custom-mod');
  game.modules.set('my-custom-mod', { id: 'my-custom-mod', active: true, title: 'My Custom Mod' });
  const archetypes = [
    { id: 'custom-1', name: 'Custom Archetype 1' },
    { id: 'custom-2', name: 'Custom Archetype 2' },
    { id: 'custom-3', name: 'Custom Archetype 3' }
  ];
  game.packs.set('my-custom-mod.pf-archetypes', {
    getDocuments: async () => archetypes,
    size: archetypes.length
  });

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 3, 'should load 3 archetypes from custom pack');

  // Cleanup
  game.packs.delete('my-custom-mod.pf-archetypes');
  game.modules.delete('my-custom-mod');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

await asyncTest('loadArchetypeList returns empty when custom module not available', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'nonexistent-mod');
  notifications = [];
  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 0, 'should return empty array');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

await asyncTest('loadArchetypeList error message includes custom source module name', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'my-special-mod');
  game.modules.set('my-special-mod', { id: 'my-special-mod', active: true, title: 'Special Mod' });
  // No pack registered, so it should throw
  notifications = [];
  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 0, 'should return empty on pack error');
  // Check error notification mentions the source module
  const errorNotif = notifications.find(n => n.type === 'error');
  assert(errorNotif, 'should have error notification');
  assertIncludes(errorNotif.message, 'my-special-mod', 'error should mention custom source');

  // Cleanup
  game.modules.delete('my-special-mod');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

// =====================================================
// Section 5: loadArchetypeFeatures uses setting for pack key
// =====================================================
console.log('\n--- Section 5: loadArchetypeFeatures uses setting for pack key ---');

await asyncTest('loadArchetypeFeatures uses default pack key pf1e-archetypes.pf-arch-features', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true, title: 'PF1e Archetypes' });
  const features = [
    { id: 'feat-1', name: 'Feature 1', system: { description: { value: '' } } },
    { id: 'feat-2', name: 'Feature 2', system: { description: { value: '' } } }
  ];
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => features,
    size: features.length
  });

  const result = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(result.length, 2, 'should load 2 features from default pack');

  game.packs.delete('pf1e-archetypes.pf-arch-features');
  game.modules.delete('pf1e-archetypes');
});

await asyncTest('loadArchetypeFeatures uses custom pack key when setting changed', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'alt-archetype-mod');
  game.modules.set('alt-archetype-mod', { id: 'alt-archetype-mod', active: true, title: 'Alt Archetype Mod' });
  const features = [
    { id: 'alt-f1', name: 'Alt Feature 1', system: { description: { value: '' } } },
    { id: 'alt-f2', name: 'Alt Feature 2', system: { description: { value: '' } } },
    { id: 'alt-f3', name: 'Alt Feature 3', system: { description: { value: '' } } },
    { id: 'alt-f4', name: 'Alt Feature 4', system: { description: { value: '' } } }
  ];
  game.packs.set('alt-archetype-mod.pf-arch-features', {
    getDocuments: async () => features,
    size: features.length
  });

  const result = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(result.length, 4, 'should load 4 features from custom pack');

  // Cleanup
  game.packs.delete('alt-archetype-mod.pf-arch-features');
  game.modules.delete('alt-archetype-mod');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

await asyncTest('loadArchetypeFeatures returns empty when custom module not available', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'nonexistent-feature-mod');
  const result = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(result.length, 0, 'should return empty array');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

// =====================================================
// Section 6: parseArchetype uses setting for UUID construction
// =====================================================
console.log('\n--- Section 6: parseArchetype uses setting for UUID construction ---');

const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

await asyncTest('parseArchetype constructs UUID with default source', async () => {
  // Set up for parseArchetype - use String wrapper to allow slugify property
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
  const archName = new String('Test Archetype');
  archName.slugify = () => 'test-archetype';
  const archetype = { name: archName, id: 'arch-uuid-1' };
  const featName = new String('Test Feature');
  featName.slugify = () => 'test-feature';
  const features = [{
    name: featName,
    id: 'feat-uuid-1',
    system: { description: { value: '<p><strong>Level</strong>: 1</p>' } }
  }];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = parsed.features[0];
  assertIncludes(feature.uuid, 'Compendium.pf1e-archetypes.pf-arch-features.Item.feat-uuid-1',
    'UUID should include default source pf1e-archetypes');
});

await asyncTest('parseArchetype constructs UUID with custom source', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'my-homebrew');
  const archName = new String('Homebrew Archetype');
  archName.slugify = () => 'homebrew-archetype';
  const archetype = { name: archName, id: 'arch-hb-1' };
  const featName = new String('Homebrew Feature');
  featName.slugify = () => 'homebrew-feature';
  const features = [{
    name: featName,
    id: 'feat-hb-1',
    system: { description: { value: '<p><strong>Level</strong>: 3</p>' } }
  }];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = parsed.features[0];
  assertIncludes(feature.uuid, 'Compendium.my-homebrew.pf-arch-features.Item.feat-hb-1',
    'UUID should include custom source my-homebrew');

  // Cleanup
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

await asyncTest('parseArchetype UUID uses feature.uuid if available (overrides construction)', async () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
  const archName = new String('UUID Test');
  archName.slugify = () => 'uuid-test';
  const archetype = { name: archName, id: 'arch-ut-1' };
  const featName = new String('UUID Feature');
  featName.slugify = () => 'uuid-feature';
  const features = [{
    name: featName,
    id: 'feat-ut-1',
    uuid: 'Compendium.already-set.pf-arch-features.Item.feat-ut-1',
    system: { description: { value: '<p><strong>Level</strong>: 5</p>' } }
  }];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = parsed.features[0];
  assertEqual(feature.uuid, 'Compendium.already-set.pf-arch-features.Item.feat-ut-1',
    'Should use pre-existing uuid rather than constructing one');
});

// =====================================================
// Section 7: Default value backwards compatibility
// =====================================================
console.log('\n--- Section 7: Default value backwards compatibility ---');

await asyncTest('With default value, parser loads from pf1e-archetypes packs as before', async () => {
  // Ensure default setting
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true, title: 'PF1e Archetypes' });

  const archetypes = [
    { id: 'compat-1', name: 'Compat Archetype 1' },
    { id: 'compat-2', name: 'Compat Archetype 2' },
    { id: 'compat-3', name: 'Compat Archetype 3' },
    { id: 'compat-4', name: 'Compat Archetype 4' },
    { id: 'compat-5', name: 'Compat Archetype 5' }
  ];
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => archetypes,
    size: archetypes.length
  });

  const features = [
    { id: 'compat-f1', name: 'Compat Feature 1', system: { description: { value: '' } } }
  ];
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => features,
    size: features.length
  });

  const archResult = await CompendiumParser.loadArchetypeList();
  assertEqual(archResult.length, 5, 'should load 5 archetypes from default pack');

  const featResult = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(featResult.length, 1, 'should load 1 feature from default pack');

  // Cleanup
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.packs.delete('pf1e-archetypes.pf-arch-features');
  game.modules.delete('pf1e-archetypes');
});

// =====================================================
// Section 8: Changing setting to different module ID
// =====================================================
console.log('\n--- Section 8: Changing setting to different module ID ---');

await asyncTest('Changing setting causes parser to look for packs from that module', async () => {
  // Set custom source
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'community-archetypes');
  game.modules.set('community-archetypes', { id: 'community-archetypes', active: true, title: 'Community Archetypes' });

  const communityArchetypes = [
    { id: 'comm-1', name: 'Community Archetype 1' },
    { id: 'comm-2', name: 'Community Archetype 2' }
  ];
  game.packs.set('community-archetypes.pf-archetypes', {
    getDocuments: async () => communityArchetypes,
    size: communityArchetypes.length
  });

  const communityFeatures = [
    { id: 'comm-f1', name: 'Community Feature 1', system: { description: { value: '' } } }
  ];
  game.packs.set('community-archetypes.pf-arch-features', {
    getDocuments: async () => communityFeatures,
    size: communityFeatures.length
  });

  // Should load from community-archetypes packs
  const archResult = await CompendiumParser.loadArchetypeList();
  assertEqual(archResult.length, 2, 'should load from community-archetypes.pf-archetypes');

  const featResult = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(featResult.length, 1, 'should load from community-archetypes.pf-arch-features');

  // Verify it does NOT load from pf1e-archetypes even if those exist
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true, title: 'PF1e Archetypes' });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => [{ id: 'orig-1', name: 'Original 1' }],
    size: 1
  });

  const archResult2 = await CompendiumParser.loadArchetypeList();
  assertEqual(archResult2.length, 2, 'should still load from community-archetypes, not pf1e-archetypes');

  // Cleanup
  game.packs.delete('community-archetypes.pf-archetypes');
  game.packs.delete('community-archetypes.pf-arch-features');
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.modules.delete('community-archetypes');
  game.modules.delete('pf1e-archetypes');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

await asyncTest('Switching back to default restores normal behavior', async () => {
  // First set to custom
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'custom-test');
  // Then set back to default
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true, title: 'PF1e Archetypes' });
  const archetypes = [{ id: 'switch-1', name: 'Switched Archetype' }];
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => archetypes,
    size: archetypes.length
  });

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 1, 'should load from pf1e-archetypes after switching back');

  // Cleanup
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.modules.delete('pf1e-archetypes');
});

// =====================================================
// Section 9: Setting coexists with other settings
// =====================================================
console.log('\n--- Section 9: Setting coexists with other settings ---');

test('defaultCompendiumSource coexists with existing settings', () => {
  assert(game.settings.isRegistered('archetype-manager', 'lastSelectedClass'), 'lastSelectedClass should exist');
  assert(game.settings.isRegistered('archetype-manager', 'showParseWarnings'), 'showParseWarnings should exist');
  assert(game.settings.isRegistered('archetype-manager', 'autoCreateJEDB'), 'autoCreateJEDB should exist');
  assert(game.settings.isRegistered('archetype-manager', 'chatNotifications'), 'chatNotifications should exist');
  assert(game.settings.isRegistered('archetype-manager', 'defaultCompendiumSource'), 'defaultCompendiumSource should exist');
});

test('Module registers at least 5 settings after init', () => {
  // Count registered settings
  let count = 0;
  const settingKeys = ['lastSelectedClass', 'showParseWarnings', 'autoCreateJEDB', 'chatNotifications', 'defaultCompendiumSource'];
  for (const key of settingKeys) {
    if (game.settings.isRegistered('archetype-manager', key)) count++;
  }
  assert(count >= 5, `should have at least 5 settings registered, got ${count}`);
});

test('Changing defaultCompendiumSource does not affect other settings', () => {
  const origShowParseWarnings = game.settings.get('archetype-manager', 'showParseWarnings');
  const origAutoCreate = game.settings.get('archetype-manager', 'autoCreateJEDB');
  const origChat = game.settings.get('archetype-manager', 'chatNotifications');

  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'something-else');

  assertEqual(game.settings.get('archetype-manager', 'showParseWarnings'), origShowParseWarnings,
    'showParseWarnings should be unchanged');
  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), origAutoCreate,
    'autoCreateJEDB should be unchanged');
  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), origChat,
    'chatNotifications should be unchanged');

  // Reset
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

// =====================================================
// Section 10: Source code verification
// =====================================================
console.log('\n--- Section 10: Source code verification ---');

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('module.mjs contains defaultCompendiumSource registration', () => {
  const src = readFileSync(join(__dirname, '..', 'scripts', 'module.mjs'), 'utf-8');
  assertIncludes(src, 'defaultCompendiumSource', 'module.mjs should reference defaultCompendiumSource');
  assertIncludes(src, "type: String", 'should have String type');
  assertIncludes(src, "'pf1e-archetypes'", 'should have pf1e-archetypes default');
});

test('compendium-parser.mjs uses getCompendiumSource method', () => {
  const src = readFileSync(join(__dirname, '..', 'scripts', 'compendium-parser.mjs'), 'utf-8');
  assertIncludes(src, 'getCompendiumSource', 'should have getCompendiumSource method');
});

test('compendium-parser.mjs does not hardcode pf1e-archetypes in pack keys', () => {
  const src = readFileSync(join(__dirname, '..', 'scripts', 'compendium-parser.mjs'), 'utf-8');
  // Check that pack.get calls use template literals with source variable
  const packGetMatches = src.match(/game\.packs\.get\([^)]+\)/g) || [];
  for (const match of packGetMatches) {
    assert(!match.includes("'pf1e-archetypes."), `pack key should not be hardcoded: ${match}`);
  }
});

test('compendium-parser.mjs does not hardcode pf1e-archetypes in game.modules.get', () => {
  const src = readFileSync(join(__dirname, '..', 'scripts', 'compendium-parser.mjs'), 'utf-8');
  const moduleGetMatches = src.match(/game\.modules\.get\([^)]+\)/g) || [];
  for (const match of moduleGetMatches) {
    assert(!match.includes("'pf1e-archetypes'"), `module check should use setting, not hardcode: ${match}`);
  }
});

test('compendium-parser.mjs uses setting value for UUID construction', () => {
  const src = readFileSync(join(__dirname, '..', 'scripts', 'compendium-parser.mjs'), 'utf-8');
  // Should use template literal with source variable, not hardcoded pf1e-archetypes
  const uuidLines = src.split('\n').filter(l => l.includes('Compendium.') && l.includes('pf-arch-features'));
  for (const line of uuidLines) {
    assert(!line.includes("'Compendium.pf1e-archetypes."), `UUID should not hardcode source: ${line.trim()}`);
    assert(!line.includes('"Compendium.pf1e-archetypes.'), `UUID should not hardcode source: ${line.trim()}`);
  }
});

// =====================================================
// Section 11: Edge cases
// =====================================================
console.log('\n--- Section 11: Edge cases ---');

test('Setting value can be read immediately after set', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'edge-case-mod');
  assertEqual(game.settings.get('archetype-manager', 'defaultCompendiumSource'), 'edge-case-mod',
    'should return the value just set');
  // Reset
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

test('Setting value with hyphens works correctly', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'my-custom-archetype-mod');
  assertEqual(CompendiumParser.getCompendiumSource(), 'my-custom-archetype-mod');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

test('Setting value with underscores works correctly', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'my_custom_mod');
  assertEqual(CompendiumParser.getCompendiumSource(), 'my_custom_mod');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

test('Setting value with periods works correctly', () => {
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'my.custom.mod');
  assertEqual(CompendiumParser.getCompendiumSource(), 'my.custom.mod');
  game.settings.set('archetype-manager', 'defaultCompendiumSource', 'pf1e-archetypes');
});

await asyncTest('Multiple setting changes in sequence work correctly', async () => {
  const sources = ['mod-a', 'mod-b', 'mod-c', 'pf1e-archetypes'];
  for (const source of sources) {
    game.settings.set('archetype-manager', 'defaultCompendiumSource', source);
    assertEqual(CompendiumParser.getCompendiumSource(), source, `should return ${source}`);
  }
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
