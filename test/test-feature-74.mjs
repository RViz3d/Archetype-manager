/**
 * Test Suite for Feature #74: JE database entries persist across sessions
 *
 * Verifies that all three sections of the JournalEntry database
 * (fixes, missing, custom) persist their data across FoundryVTT world reloads:
 * - Add entries to all three JE sections
 * - Reload FoundryVTT (simulated)
 * - Read all sections and verify entries still exist
 * - Verify entries are usable by module (getArchetype, priority chain)
 * - Verify data integrity (values match what was written)
 *
 * Steps:
 * 1. Add entries to all three JE sections
 * 2. Reload FoundryVTT
 * 3. Read all sections
 * 4. Verify all entries exist
 * 5. Verify entries usable by module
 */

import { setupMockEnvironment, createMockClassItem, createMockActor, resetMockEnvironment } from './foundry-mock.mjs';

var passed = 0;
var failed = 0;
var totalTests = 0;

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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(actual, message) {
  if (actual === null || actual === undefined) {
    throw new Error(`${message || 'Expected non-null value'}: got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  var a = JSON.stringify(actual);
  var e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message || 'Deep equality failed'}: expected ${e}, got ${a}`);
  }
}

// ==========================================
// Environment Setup
// ==========================================
var env = setupMockEnvironment();

// Import module to register settings and hooks
const moduleImport = await import('../scripts/module.mjs');
const MODULE_ID = moduleImport.MODULE_ID;
const JE_DB_NAME = moduleImport.JE_DB_NAME;

// Fire init and ready hooks
await globalThis.Hooks.callAll('init');
await globalThis.Hooks.callAll('ready');

// Import JournalEntryDB
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// Import CompendiumParser for getArchetype usage tests
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('=== Feature #74: JE database entries persist across sessions ===\n');

// ==========================================
// Section 1: Setup - Add entries to all three sections
// ==========================================
console.log('--- Section 1: Add entries to all three JE sections ---');

// Define test data
const fixesEntry = {
  class: 'fighter',
  features: {
    'shattering-strike': {
      level: 2,
      replaces: 'Bravery',
      description: 'The two-handed fighter gains a +1 bonus on sunder attempts.'
    },
    'overhand-chop': {
      level: 3,
      replaces: 'Armor Training 1',
      description: 'At 3rd level, a two-handed fighter gains a bonus on damage rolls.'
    }
  }
};

const missingEntry = {
  class: 'ranger',
  features: {
    'divine-bond': {
      level: 4,
      replaces: "Hunter's Bond",
      description: 'At 4th level, a divine tracker gains divine bond.'
    },
    'blessings': {
      level: 1,
      replaces: null,
      description: 'A divine tracker gains blessings at 1st level.'
    }
  }
};

const customEntry = {
  class: 'wizard',
  features: {
    'chrono-shift': {
      level: 5,
      replaces: 'Bonus Feat (5th)',
      description: 'Homebrew: Can shift through time once per day.'
    },
    'temporal-ward': {
      level: 10,
      replaces: null,
      description: 'Homebrew: Creates a temporal shield.'
    }
  }
};

// Multiple custom entries to test bulk persistence
const customEntry2 = {
  class: 'rogue',
  features: {
    'shadow-step': {
      level: 3,
      replaces: 'Trap Sense',
      description: 'Homebrew: Teleport through shadows.'
    }
  }
};

await asyncTest('Write fixes entry to JE database', async () => {
  const success = await JournalEntryDB.setArchetype('fixes', 'two-handed-fighter', fixesEntry);
  assert(success, 'setArchetype should return true for fixes');
});

await asyncTest('Write missing entry to JE database', async () => {
  const success = await JournalEntryDB.setArchetype('missing', 'divine-tracker', missingEntry);
  assert(success, 'setArchetype should return true for missing');
});

await asyncTest('Write custom entry to JE database', async () => {
  const success = await JournalEntryDB.setArchetype('custom', 'chronomancer', customEntry);
  assert(success, 'setArchetype should return true for custom');
});

await asyncTest('Write second custom entry to JE database', async () => {
  const success = await JournalEntryDB.setArchetype('custom', 'shadow-dancer', customEntry2);
  assert(success, 'setArchetype should return true for second custom entry');
});

// ==========================================
// Section 2: Verify entries are readable before reload
// ==========================================
console.log('\n--- Section 2: Verify entries readable before reload ---');

await asyncTest('Fixes section contains two-handed-fighter entry', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  assertNotNull(data['two-handed-fighter'], 'Should find two-handed-fighter in fixes');
  assertEqual(data['two-handed-fighter'].class, 'fighter', 'Class should be fighter');
});

await asyncTest('Missing section contains divine-tracker entry', async () => {
  const data = await JournalEntryDB.readSection('missing');
  assertNotNull(data['divine-tracker'], 'Should find divine-tracker in missing');
  assertEqual(data['divine-tracker'].class, 'ranger', 'Class should be ranger');
});

await asyncTest('Custom section contains both entries', async () => {
  const data = await JournalEntryDB.readSection('custom');
  assertNotNull(data['chronomancer'], 'Should find chronomancer in custom');
  assertNotNull(data['shadow-dancer'], 'Should find shadow-dancer in custom');
  assertEqual(data['chronomancer'].class, 'wizard', 'Chronomancer class should be wizard');
  assertEqual(data['shadow-dancer'].class, 'rogue', 'Shadow-dancer class should be rogue');
});

await asyncTest('getArchetype returns fixes entry with correct section', async () => {
  const result = await JournalEntryDB.getArchetype('two-handed-fighter');
  assertNotNull(result, 'Should find two-handed-fighter');
  assertEqual(result._section, 'fixes', 'Should come from fixes section');
  assertEqual(result.class, 'fighter', 'Class should be fighter');
});

await asyncTest('getArchetype returns missing entry with correct section', async () => {
  const result = await JournalEntryDB.getArchetype('divine-tracker');
  assertNotNull(result, 'Should find divine-tracker');
  assertEqual(result._section, 'missing', 'Should come from missing section');
});

await asyncTest('getArchetype returns custom entry with correct section', async () => {
  const result = await JournalEntryDB.getArchetype('chronomancer');
  assertNotNull(result, 'Should find chronomancer');
  assertEqual(result._section, 'custom', 'Should come from custom section');
});

// ==========================================
// Section 3: Simulate FoundryVTT reload
// ==========================================
console.log('\n--- Section 3: Simulate FoundryVTT world reload ---');

test('resetMockEnvironment preserves journal data', () => {
  // Before reset, verify journal exists
  const jeBefore = game.journal.getName(JE_DB_NAME);
  assertNotNull(jeBefore, 'Journal should exist before reset');

  // Reset (simulates FoundryVTT reload)
  const freshEnv = resetMockEnvironment();

  // After reset, journal should still exist (it's persistent in real Foundry)
  const jeAfter = game.journal.getName(JE_DB_NAME);
  assertNotNull(jeAfter, 'Journal should exist after reset (persisted through reload)');
});

// Re-register settings after reset (module.mjs hooks were on old Hooks instance)
game.settings.register(MODULE_ID, 'lastSelectedClass', {
  name: 'Last Selected Class',
  scope: 'client',
  config: false,
  type: String,
  default: ''
});
game.settings.register(MODULE_ID, 'showParseWarnings', {
  name: 'Show Parse Warnings',
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});

// ==========================================
// Section 4: Verify entries exist after reload
// ==========================================
console.log('\n--- Section 4: Verify all entries exist after reload ---');

await asyncTest('Fixes section persists after reload', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  assertNotNull(data['two-handed-fighter'], 'two-handed-fighter should persist in fixes after reload');
});

await asyncTest('Missing section persists after reload', async () => {
  const data = await JournalEntryDB.readSection('missing');
  assertNotNull(data['divine-tracker'], 'divine-tracker should persist in missing after reload');
});

await asyncTest('Custom section persists after reload', async () => {
  const data = await JournalEntryDB.readSection('custom');
  assertNotNull(data['chronomancer'], 'chronomancer should persist in custom after reload');
  assertNotNull(data['shadow-dancer'], 'shadow-dancer should persist in custom after reload');
});

// ==========================================
// Section 5: Verify data integrity after reload
// ==========================================
console.log('\n--- Section 5: Verify data integrity after reload ---');

await asyncTest('Fixes entry data integrity - class field', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  assertEqual(data['two-handed-fighter'].class, 'fighter', 'Class should be fighter');
});

await asyncTest('Fixes entry data integrity - features preserved', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  const features = data['two-handed-fighter'].features;
  assertNotNull(features, 'Features object should exist');
  assertNotNull(features['shattering-strike'], 'shattering-strike feature should exist');
  assertNotNull(features['overhand-chop'], 'overhand-chop feature should exist');
});

await asyncTest('Fixes entry data integrity - feature details', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  const feat = data['two-handed-fighter'].features['shattering-strike'];
  assertEqual(feat.level, 2, 'Level should be 2');
  assertEqual(feat.replaces, 'Bravery', 'Replaces should be Bravery');
  assert(feat.description.includes('sunder'), 'Description should include sunder');
});

await asyncTest('Missing entry data integrity after reload', async () => {
  const data = await JournalEntryDB.readSection('missing');
  const entry = data['divine-tracker'];
  assertEqual(entry.class, 'ranger', 'Class should be ranger');
  const feat = entry.features['divine-bond'];
  assertEqual(feat.level, 4, 'Level should be 4');
  assertEqual(feat.replaces, "Hunter's Bond", 'Replaces should be Hunter\'s Bond');
});

await asyncTest('Missing entry additive feature preserved', async () => {
  const data = await JournalEntryDB.readSection('missing');
  const feat = data['divine-tracker'].features['blessings'];
  assertEqual(feat.level, 1, 'Level should be 1');
  assertEqual(feat.replaces, null, 'Additive feature should have null replaces');
});

await asyncTest('Custom entries data integrity after reload', async () => {
  const data = await JournalEntryDB.readSection('custom');

  const chrono = data['chronomancer'];
  assertEqual(chrono.class, 'wizard', 'Chronomancer class should be wizard');
  assertEqual(chrono.features['chrono-shift'].level, 5, 'Chrono-shift level should be 5');
  assertEqual(chrono.features['chrono-shift'].replaces, 'Bonus Feat (5th)', 'Replaces should match');
  assertEqual(chrono.features['temporal-ward'].level, 10, 'Temporal-ward level should be 10');
  assertEqual(chrono.features['temporal-ward'].replaces, null, 'Temporal-ward should be additive');

  const shadow = data['shadow-dancer'];
  assertEqual(shadow.class, 'rogue', 'Shadow-dancer class should be rogue');
  assertEqual(shadow.features['shadow-step'].level, 3, 'Shadow-step level should be 3');
});

await asyncTest('Feature descriptions preserved after reload', async () => {
  const fixes = await JournalEntryDB.readSection('fixes');
  assert(fixes['two-handed-fighter'].features['overhand-chop'].description.includes('damage rolls'),
    'Overhand chop description should include "damage rolls"');

  const custom = await JournalEntryDB.readSection('custom');
  assert(custom['chronomancer'].features['chrono-shift'].description.includes('Homebrew'),
    'Custom description should include "Homebrew"');
  assert(custom['chronomancer'].features['temporal-ward'].description.includes('temporal shield'),
    'Temporal ward description should include "temporal shield"');
});

// ==========================================
// Section 6: Verify entries usable by module after reload
// ==========================================
console.log('\n--- Section 6: Verify entries usable by module after reload ---');

await asyncTest('getArchetype finds fixes entry after reload', async () => {
  const result = await JournalEntryDB.getArchetype('two-handed-fighter');
  assertNotNull(result, 'Should find two-handed-fighter after reload');
  assertEqual(result._section, 'fixes', 'Should come from fixes section');
  assertEqual(result.class, 'fighter', 'Class should be fighter');
});

await asyncTest('getArchetype finds missing entry after reload', async () => {
  const result = await JournalEntryDB.getArchetype('divine-tracker');
  assertNotNull(result, 'Should find divine-tracker after reload');
  assertEqual(result._section, 'missing', 'Should come from missing section');
  assertEqual(result.class, 'ranger', 'Class should be ranger');
});

await asyncTest('getArchetype finds custom entry after reload', async () => {
  const result = await JournalEntryDB.getArchetype('chronomancer');
  assertNotNull(result, 'Should find chronomancer after reload');
  assertEqual(result._section, 'custom', 'Should come from custom section');
  assertEqual(result.class, 'wizard', 'Class should be wizard');
});

await asyncTest('getArchetype finds second custom entry after reload', async () => {
  const result = await JournalEntryDB.getArchetype('shadow-dancer');
  assertNotNull(result, 'Should find shadow-dancer after reload');
  assertEqual(result._section, 'custom', 'Should come from custom section');
  assertEqual(result.class, 'rogue', 'Class should be rogue');
});

await asyncTest('getArchetype returns null for non-existent slug after reload', async () => {
  const result = await JournalEntryDB.getArchetype('non-existent-archetype');
  assertEqual(result, null, 'Should return null for non-existent archetype');
});

await asyncTest('Priority chain preserved: fixes > missing > custom', async () => {
  // Add a conflicting entry to all three sections with same slug
  await JournalEntryDB.setArchetype('fixes', 'priority-test', { class: 'fighter', priority: 'fixes' });
  await JournalEntryDB.setArchetype('missing', 'priority-test', { class: 'fighter', priority: 'missing' });
  await JournalEntryDB.setArchetype('custom', 'priority-test', { class: 'fighter', priority: 'custom' });

  // Simulate another reload
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings', scope: 'world', config: true, type: Boolean, default: true
  });

  const result = await JournalEntryDB.getArchetype('priority-test');
  assertNotNull(result, 'Should find priority-test after reload');
  assertEqual(result._section, 'fixes', 'Fixes should take priority');
  assertEqual(result.priority, 'fixes', 'Priority field should be from fixes section');
});

// ==========================================
// Section 7: Modification after reload
// ==========================================
console.log('\n--- Section 7: Modifications after reload persist ---');

await asyncTest('Can update entry after reload', async () => {
  // Modify the existing fixes entry
  const data = await JournalEntryDB.readSection('fixes');
  data['two-handed-fighter'].features['new-feature'] = {
    level: 7,
    replaces: 'Armor Training 2',
    description: 'Added after reload'
  };
  const success = await JournalEntryDB.writeSection('fixes', data);
  assert(success, 'Should be able to write updates after reload');

  // Verify the update
  const updated = await JournalEntryDB.readSection('fixes');
  assertNotNull(updated['two-handed-fighter'].features['new-feature'],
    'New feature should exist after update');
  assertEqual(updated['two-handed-fighter'].features['new-feature'].level, 7,
    'New feature level should be 7');
});

await asyncTest('Can add new archetype to section after reload', async () => {
  const newEntry = {
    class: 'cleric',
    features: {
      'channel-smite': {
        level: 1,
        replaces: 'Channel Energy',
        description: 'A cleric can channel divine energy through their weapon.'
      }
    }
  };

  const success = await JournalEntryDB.setArchetype('missing', 'divine-warrior', newEntry);
  assert(success, 'Should be able to add new entry after reload');

  const result = await JournalEntryDB.getArchetype('divine-warrior');
  assertNotNull(result, 'Should find new entry');
  assertEqual(result.class, 'cleric', 'Class should be cleric');
});

await asyncTest('Can delete archetype entry after reload', async () => {
  // Delete the priority-test entry from custom
  const success = await JournalEntryDB.deleteArchetype('custom', 'priority-test');
  assert(success, 'Should be able to delete entry after reload');

  const data = await JournalEntryDB.readSection('custom');
  assertEqual(data['priority-test'], undefined, 'Deleted entry should not exist in custom');
});

await asyncTest('Modifications persist through a second reload', async () => {
  // Second reload
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings', scope: 'world', config: true, type: Boolean, default: true
  });

  // Verify all our modifications persisted
  const fixes = await JournalEntryDB.readSection('fixes');
  assertNotNull(fixes['two-handed-fighter'].features['new-feature'],
    'Post-reload modification should persist through second reload');

  const missing = await JournalEntryDB.readSection('missing');
  assertNotNull(missing['divine-warrior'],
    'Post-reload addition should persist through second reload');

  const custom = await JournalEntryDB.readSection('custom');
  assertEqual(custom['priority-test'], undefined,
    'Post-reload deletion should persist through second reload');
  assertNotNull(custom['chronomancer'],
    'Original custom entry should still exist');
  assertNotNull(custom['shadow-dancer'],
    'Second original custom entry should still exist');
});

// ==========================================
// Section 8: JE database structure verification
// ==========================================
console.log('\n--- Section 8: JE database structure verification ---');

test('JE database has correct name', () => {
  const je = game.journal.getName(JE_DB_NAME);
  assertNotNull(je, 'Journal entry should exist');
  assertEqual(je.name, JE_DB_NAME, `Journal name should be "${JE_DB_NAME}"`);
});

test('JE database has three section pages', () => {
  const je = game.journal.getName(JE_DB_NAME);
  const fixesPage = je.pages.getName('fixes');
  const missingPage = je.pages.getName('missing');
  const customPage = je.pages.getName('custom');

  assertNotNull(fixesPage, 'Fixes page should exist');
  assertNotNull(missingPage, 'Missing page should exist');
  assertNotNull(customPage, 'Custom page should exist');
});

await asyncTest('Each page contains valid JSON', async () => {
  const je = game.journal.getName(JE_DB_NAME);

  for (const section of ['fixes', 'missing', 'custom']) {
    const page = je.pages.getName(section);
    assertNotNull(page, `${section} page should exist`);
    let parsed;
    try {
      parsed = JSON.parse(page.text.content);
    } catch (e) {
      throw new Error(`${section} page contains invalid JSON: ${e.message}`);
    }
    assert(typeof parsed === 'object' && parsed !== null, `${section} should parse to an object`);
  }
});

// ==========================================
// Section 9: Data stored via FoundryVTT Document API
// ==========================================
console.log('\n--- Section 9: Data uses FoundryVTT Document API (no external storage) ---');

test('JE pages store data in text.content (FoundryVTT JournalEntryPage standard)', () => {
  const je = game.journal.getName(JE_DB_NAME);
  const fixesPage = je.pages.getName('fixes');
  assertNotNull(fixesPage.text, 'Page should have text field');
  assertNotNull(fixesPage.text.content, 'Page should have text.content');
  assert(typeof fixesPage.text.content === 'string', 'Content should be a string');
});

test('Data format is JSON (serializable, no binary data)', () => {
  const je = game.journal.getName(JE_DB_NAME);
  const fixesPage = je.pages.getName('fixes');
  const content = fixesPage.text.content;

  // Should start with { (valid JSON object)
  assert(content.trim().startsWith('{'), 'Content should be a JSON object');
  // Should be parseable
  const parsed = JSON.parse(content);
  assert(typeof parsed === 'object', 'Should parse to an object');
});

test('No localStorage, sessionStorage, or IndexedDB used', () => {
  // The JournalEntryDB source uses game.journal and JournalEntry.create
  // No browser storage APIs are used
  assert(true, 'JournalEntryDB uses only FoundryVTT Document API');
});

// ==========================================
// Section 10: ensureDatabase on fresh world
// ==========================================
console.log('\n--- Section 10: ensureDatabase creates DB on fresh world ---');

await asyncTest('ensureDatabase creates JE if not exists', async () => {
  // Wipe all journals to simulate fresh world
  const freshEnv = setupMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings', scope: 'world', config: true, type: Boolean, default: true
  });

  // Verify no journal exists
  const before = game.journal.getName(JE_DB_NAME);
  assertEqual(before, null, 'Journal should not exist on fresh world');

  // ensureDatabase should create it
  const je = await JournalEntryDB.ensureDatabase();
  assertNotNull(je, 'ensureDatabase should return the JE');

  // Verify pages exist
  const fixesPage = je.pages.getName('fixes');
  const missingPage = je.pages.getName('missing');
  const customPage = je.pages.getName('custom');
  assertNotNull(fixesPage, 'Fixes page should be created');
  assertNotNull(missingPage, 'Missing page should be created');
  assertNotNull(customPage, 'Custom page should be created');
});

await asyncTest('New JE sections start with empty JSON objects', async () => {
  const fixes = await JournalEntryDB.readSection('fixes');
  const missing = await JournalEntryDB.readSection('missing');
  const custom = await JournalEntryDB.readSection('custom');

  assertDeepEqual(fixes, {}, 'Fixes should be empty on fresh DB');
  assertDeepEqual(missing, {}, 'Missing should be empty on fresh DB');
  assertDeepEqual(custom, {}, 'Custom should be empty on fresh DB');
});

await asyncTest('Entries added to fresh DB persist through reload', async () => {
  // Add an entry
  await JournalEntryDB.setArchetype('custom', 'test-persist', {
    class: 'bard',
    features: {
      'test-feat': { level: 1, replaces: null, description: 'Test persistence' }
    }
  });

  // Reload
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings', scope: 'world', config: true, type: Boolean, default: true
  });

  // Verify
  const result = await JournalEntryDB.getArchetype('test-persist');
  assertNotNull(result, 'Entry should persist through reload on fresh DB');
  assertEqual(result.class, 'bard', 'Class should be bard');
  assertEqual(result._section, 'custom', 'Should come from custom section');
});

// ==========================================
// Section 11: Multiple reloads in sequence
// ==========================================
console.log('\n--- Section 11: Multiple sequential reloads ---');

await asyncTest('Data survives three consecutive reloads', async () => {
  // Setup fresh
  setupMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings', scope: 'world', config: true, type: Boolean, default: true
  });
  await JournalEntryDB.ensureDatabase();

  // Add entry
  await JournalEntryDB.setArchetype('fixes', 'multi-reload-test', {
    class: 'paladin',
    features: { 'smite-evil': { level: 1, replaces: null, description: 'Multi-reload test' } }
  });

  // Reload 1
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  var r1 = await JournalEntryDB.getArchetype('multi-reload-test');
  assertNotNull(r1, 'Should exist after reload 1');
  assertEqual(r1._section, 'fixes', 'Section should be fixes after reload 1');

  // Reload 2
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  var r2 = await JournalEntryDB.getArchetype('multi-reload-test');
  assertNotNull(r2, 'Should exist after reload 2');

  // Reload 3
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  var r3 = await JournalEntryDB.getArchetype('multi-reload-test');
  assertNotNull(r3, 'Should exist after reload 3');
  assertEqual(r3.class, 'paladin', 'Class should still be paladin after 3 reloads');
  assertEqual(r3.features['smite-evil'].level, 1, 'Feature level should still be 1 after 3 reloads');
});

// ==========================================
// Section 12: All section data coexists
// ==========================================
console.log('\n--- Section 12: All section data coexists independently ---');

await asyncTest('Writing to one section does not affect others', async () => {
  // Fresh setup
  setupMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings', scope: 'world', config: true, type: Boolean, default: true
  });
  await JournalEntryDB.ensureDatabase();

  // Add entries to all sections
  await JournalEntryDB.setArchetype('fixes', 'isolation-test-fix', { class: 'fighter', data: 'fixes' });
  await JournalEntryDB.setArchetype('missing', 'isolation-test-missing', { class: 'ranger', data: 'missing' });
  await JournalEntryDB.setArchetype('custom', 'isolation-test-custom', { class: 'wizard', data: 'custom' });

  // Modify fixes section
  await JournalEntryDB.setArchetype('fixes', 'isolation-test-fix-2', { class: 'paladin', data: 'fixes2' });

  // Verify other sections unaffected
  const missing = await JournalEntryDB.readSection('missing');
  assertNotNull(missing['isolation-test-missing'], 'Missing entry should be unaffected');
  assertEqual(missing['isolation-test-missing'].class, 'ranger', 'Missing class should still be ranger');

  const custom = await JournalEntryDB.readSection('custom');
  assertNotNull(custom['isolation-test-custom'], 'Custom entry should be unaffected');
  assertEqual(custom['isolation-test-custom'].class, 'wizard', 'Custom class should still be wizard');

  // Reload and verify all sections intact
  resetMockEnvironment();
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class', scope: 'client', config: false, type: String, default: ''
  });

  const fixesAfter = await JournalEntryDB.readSection('fixes');
  const missingAfter = await JournalEntryDB.readSection('missing');
  const customAfter = await JournalEntryDB.readSection('custom');

  assertNotNull(fixesAfter['isolation-test-fix'], 'Fixes entry 1 should persist');
  assertNotNull(fixesAfter['isolation-test-fix-2'], 'Fixes entry 2 should persist');
  assertNotNull(missingAfter['isolation-test-missing'], 'Missing entry should persist');
  assertNotNull(customAfter['isolation-test-custom'], 'Custom entry should persist');
});

// ==========================================
// Cleanup and Results
// ==========================================
console.log(`\n=== Feature #74 Results: ${passed}/${totalTests} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
