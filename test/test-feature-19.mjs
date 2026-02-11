/**
 * Test Suite for Feature #19: JE fixes override automatic parse results
 *
 * Verifies that JournalEntry fixes data takes priority over automatic parsing.
 * When a fix exists in the JE database for a specific archetype feature,
 * the fix data should be used instead of auto-parsed data.
 *
 * Steps:
 * 1. Set up JE fix for known bad parse
 * 2. Run parser on that archetype
 * 3. Verify JE fix data used instead of auto parse
 * 4. Verify priority chain: JE fixes > JE missing > auto parse > ask user
 * 5. Verify feature with no JE fix uses auto parse
 */

import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  return fn().then(() => {
    passed++;
    console.log(`  \u2713 ${name}`);
  }).catch((e) => {
    failed++;
    console.error(`  \u2717 ${name}`);
    console.error(`    ${e.message}`);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message || 'Assertion failed'}: expected ${b}, got ${a}`);
  }
}

// Set up environment
setupMockEnvironment();

// Import modules
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// Ensure database exists
await JournalEntryDB.ensureDatabase();

// Helper: Create a mock archetype document
function createMockArchetype(name) {
  return {
    name,
    system: {},
    _id: Math.random().toString(36).slice(2)
  };
}

// Helper: Create a mock feature document
function createMockFeature(name, description) {
  return {
    name,
    system: {
      description: {
        value: description
      }
    },
    _id: Math.random().toString(36).slice(2)
  };
}

// Helper: Create mock classAssociations with resolved names
function createMockAssociations(features) {
  return features.map(f => ({
    uuid: `Compendium.pf1.class-features.${Math.random().toString(36).slice(2)}`,
    level: f.level,
    resolvedName: f.name
  }));
}

console.log('\n=== Feature #19: JE fixes override automatic parse results ===\n');

// =====================================================
// Step 1: Set up JE fix for known bad parse
// =====================================================
console.log('--- Step 1: Set up JE fix for known bad parse ---');

await test('Can set up JE fix for shattering-strike feature', async () => {
  // Shattering Strike has a broken description in the module
  // We'll set up a fix in the JE database
  const fixData = {
    class: 'fighter',
    features: {
      'shattering-strike': {
        level: 2,
        replaces: 'Bravery',
        description: 'At 2nd level, a two-handed fighter gains shattering strike.'
      }
    }
  };

  const result = await JournalEntryDB.setArchetype('fixes', 'two-handed-fighter', fixData);
  assert(result !== false, 'setArchetype should succeed');
});

await test('JE fix data is retrievable', async () => {
  const fix = await JournalEntryDB.getArchetype('two-handed-fighter');
  assert(fix !== null, 'Should find the fix');
  assertEqual(fix._section, 'fixes', 'Should come from fixes section');
  assert(fix.features['shattering-strike'] !== undefined, 'Should have shattering-strike feature fix');
  assertEqual(fix.features['shattering-strike'].level, 2, 'Fix level should be 2');
  assertEqual(fix.features['shattering-strike'].replaces, 'Bravery', 'Fix should replace Bravery');
});

// =====================================================
// Step 2: Run parser on that archetype
// =====================================================
console.log('\n--- Step 2: Run parser on archetype with JE fix ---');

// Set up fromUuid mock for resolving classAssociations
globalThis.fromUuid = async (uuid) => {
  const names = {
    'uuid-bravery': { name: 'Bravery' },
    'uuid-armor-training-1': { name: 'Armor Training 1' },
    'uuid-armor-training-2': { name: 'Armor Training 2' },
    'uuid-weapon-training': { name: 'Weapon Training' },
    'uuid-bonus-feat': { name: 'Bonus Feat' }
  };
  return names[uuid] || null;
};

await test('parseArchetype runs on archetype with JE fix', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  const features = [
    createMockFeature('Shattering Strike', '<p>(<strong>Level</strong>: 2): Broken description with no replaces pattern.</p>'),
    createMockFeature('Overhand Chop', '<p>(<strong>Level</strong>: 3): This ability replaces Armor Training 1.</p>')
  ];

  const baseAssociations = [
    { uuid: 'uuid-bravery', level: 2 },
    { uuid: 'uuid-armor-training-1', level: 3 }
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);
  assert(result !== null, 'parseArchetype should return a result');
  assert(result.features.length === 2, 'Should have 2 features');
  assertEqual(result.slug, 'two-handed-fighter', 'Slug should be two-handed-fighter');
});

// =====================================================
// Step 3: Verify JE fix data used instead of auto parse
// =====================================================
console.log('\n--- Step 3: Verify JE fix data used instead of auto parse ---');

await test('Feature with JE fix uses fix data, not auto parse', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  // Shattering Strike has a broken description (no "replaces" pattern)
  // But we have a JE fix that says it replaces Bravery at level 2
  const features = [
    createMockFeature('Shattering Strike', '<p>(<strong>Level</strong>: 2): Broken description with no replaces pattern.</p>')
  ];

  const baseAssociations = [
    { uuid: 'uuid-bravery', level: 2 }
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);
  const shattering = result.features[0];

  // Should use JE fix data
  assertEqual(shattering.source, 'je-fix', 'Source should be je-fix');
  assertEqual(shattering.level, 2, 'Level should come from JE fix (2)');
  assertEqual(shattering.replaces, 'Bravery', 'Replaces should come from JE fix');
  assertEqual(shattering.name, 'Shattering Strike', 'Name should be preserved');
});

await test('JE fix description overrides auto-parsed description', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  const features = [
    createMockFeature('Shattering Strike', '<p>WRONG BROKEN DESCRIPTION</p>')
  ];

  const baseAssociations = [];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);
  const shattering = result.features[0];

  assertEqual(shattering.source, 'je-fix', 'Source should be je-fix');
  assertEqual(shattering.description, 'At 2nd level, a two-handed fighter gains shattering strike.',
    'Description should come from JE fix');
});

await test('JE fix feature data includes all fix fields', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  const features = [
    createMockFeature('Shattering Strike', '<p>Broken.</p>')
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, []);
  const shattering = result.features[0];

  // Should have level from fix
  assertEqual(shattering.level, 2, 'Level should come from JE fix');
  // Should have replaces from fix
  assertEqual(shattering.replaces, 'Bravery', 'Replaces should come from JE fix');
  // Should have source marker
  assertEqual(shattering.source, 'je-fix', 'Source should be je-fix');
});

// =====================================================
// Step 4: Verify priority chain: JE fixes > JE missing > auto parse > ask user
// =====================================================
console.log('\n--- Step 4: Verify priority chain ---');

await test('JE fixes takes priority over auto parse', async () => {
  // Set up a fix that contradicts what auto-parse would produce
  await JournalEntryDB.setArchetype('fixes', 'priority-test-archetype', {
    class: 'fighter',
    features: {
      'test-feature': {
        level: 10,
        replaces: 'Fixed Target',
        description: 'Fixed description'
      }
    }
  });

  const archetype = createMockArchetype('Priority Test Archetype');
  const features = [
    createMockFeature('Test Feature', '<p>(<strong>Level</strong>: 5): This ability replaces Auto Target.</p>')
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = result.features[0];

  // Should use JE fix (level 10, "Fixed Target") not auto-parse (level 5, "Auto Target")
  assertEqual(feature.source, 'je-fix', 'Source should be je-fix');
  assertEqual(feature.level, 10, 'Level should be from fix (10), not auto-parse (5)');
  assertEqual(feature.replaces, 'Fixed Target', 'Replaces should be from fix, not auto-parse');
});

await test('JE fixes section has priority over JE missing section', async () => {
  // getArchetype checks fixes first, then missing, then custom
  // Set up both a fix and a missing entry for the same archetype
  await JournalEntryDB.setArchetype('fixes', 'dual-entry-test', {
    class: 'fighter',
    features: {
      'test-feat': { level: 3, replaces: 'From Fixes' }
    }
  });

  await JournalEntryDB.setArchetype('missing', 'dual-entry-test', {
    class: 'fighter',
    features: {
      'test-feat': { level: 7, replaces: 'From Missing' }
    }
  });

  // getArchetype should return the fixes entry
  const entry = await JournalEntryDB.getArchetype('dual-entry-test');
  assertEqual(entry._section, 'fixes', 'Should return from fixes section');
  assertEqual(entry.features['test-feat'].level, 3, 'Should use fixes data (level 3)');
  assertEqual(entry.features['test-feat'].replaces, 'From Fixes', 'Should use fixes data');

  // Clean up
  await JournalEntryDB.deleteArchetype('fixes', 'dual-entry-test');
  await JournalEntryDB.deleteArchetype('missing', 'dual-entry-test');
});

await test('JE missing section used when no fixes entry exists', async () => {
  // Only set a missing entry (no fixes entry)
  await JournalEntryDB.setArchetype('missing', 'missing-only-test', {
    class: 'rogue',
    features: {
      'sneak-feature': { level: 1, replaces: 'Sneak Attack' }
    }
  });

  const entry = await JournalEntryDB.getArchetype('missing-only-test');
  assertEqual(entry._section, 'missing', 'Should return from missing section');
  assertEqual(entry.features['sneak-feature'].level, 1, 'Should use missing data');

  // Clean up
  await JournalEntryDB.deleteArchetype('missing', 'missing-only-test');
});

await test('Auto-parse used when no JE entry exists for archetype', async () => {
  // Make sure there's no JE entry for this archetype
  const entry = await JournalEntryDB.getArchetype('nonexistent-archetype');
  assertEqual(entry, null, 'Should return null for non-existent archetype');
});

await test('Features flagged as needsUserInput when auto-parse fails (ask user fallback)', async () => {
  const archetype = createMockArchetype('Nonexistent Archetype');

  // Feature with no parseable patterns (unknown type) = needs user input
  // Note: avoid words like "modifies" or "replaces" which would trigger the regex
  const features = [
    createMockFeature('Mystery Feature', '<p>This is a vague description with no useful classification data.</p>')
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = result.features[0];

  assertEqual(feature.source, 'auto-parse', 'Source should be auto-parse');
  assertEqual(feature.type, 'unknown', 'Type should be unknown');
  assertEqual(feature.needsUserInput, true, 'Should flag as needsUserInput');
});

await test('Replacement feature without match also flagged as needsUserInput', async () => {
  const archetype = createMockArchetype('Nonexistent Archetype 2');

  // Feature says it replaces something but we can't find a match in classAssociations
  const features = [
    createMockFeature('Unmatchable Feature', '<p>(<strong>Level</strong>: 3): This ability replaces Nonexistent Base Feature.</p>')
  ];

  // Empty associations = can't match
  const result = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = result.features[0];

  assertEqual(feature.source, 'auto-parse', 'Source should be auto-parse');
  assertEqual(feature.type, 'replacement', 'Type should be replacement');
  assertEqual(feature.needsUserInput, true, 'Should flag as needsUserInput when replacement can\'t match');
});

// =====================================================
// Step 5: Verify feature with no JE fix uses auto parse
// =====================================================
console.log('\n--- Step 5: Feature without JE fix uses auto parse ---');

await test('Feature NOT in JE fix uses auto-parse level', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  // Overhand Chop is NOT in the JE fix (only Shattering Strike is)
  const features = [
    createMockFeature('Overhand Chop', '<p>(<strong>Level</strong>: 3): This ability replaces Armor Training 1.</p>')
  ];

  const baseAssociations = [
    { uuid: 'uuid-armor-training-1', level: 3 }
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);
  const overhand = result.features[0];

  assertEqual(overhand.source, 'auto-parse', 'Source should be auto-parse');
  assertEqual(overhand.level, 3, 'Level should come from auto-parse (3)');
  assertEqual(overhand.type, 'replacement', 'Type should be replacement from auto-parse');
  assertEqual(overhand.target, 'Armor Training 1', 'Target should be from auto-parse');
});

await test('Auto-parsed feature has correct matchedAssociation', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  const features = [
    createMockFeature('Overhand Chop', '<p>(<strong>Level</strong>: 3): This ability replaces Armor Training 1.</p>')
  ];

  const baseAssociations = [
    { uuid: 'uuid-armor-training-1', level: 3 }
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);
  const overhand = result.features[0];

  assert(overhand.matchedAssociation !== null, 'Should have a matchedAssociation');
  assertEqual(overhand.matchedAssociation.uuid, 'uuid-armor-training-1', 'Should match Armor Training 1 UUID');
  assertEqual(overhand.matchedAssociation.level, 3, 'Association level should be 3');
});

await test('Auto-parsed additive feature has correct classification', async () => {
  // Clear any JE entries for a clean archetype
  const archetype = createMockArchetype('Clean Test Archetype');

  const features = [
    createMockFeature('Bonus Ability', '<p>(<strong>Level</strong>: 6): Grants a bonus ability.</p>')
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, []);
  const bonus = result.features[0];

  assertEqual(bonus.source, 'auto-parse', 'Source should be auto-parse');
  assertEqual(bonus.type, 'additive', 'Type should be additive');
  assertEqual(bonus.level, 6, 'Level should be 6');
  assertEqual(bonus.target, null, 'Target should be null for additive');
  assertEqual(bonus.needsUserInput, false, 'Additive features should NOT need user input');
});

await test('Auto-parsed modification feature classified correctly', async () => {
  const archetype = createMockArchetype('Clean Mod Archetype');

  const features = [
    createMockFeature('Modified Training', '<p>(<strong>Level</strong>: 5): This ability modifies Weapon Training.</p>')
  ];

  const baseAssociations = [
    { uuid: 'uuid-weapon-training', level: 5 }
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);
  const modified = result.features[0];

  assertEqual(modified.source, 'auto-parse', 'Source should be auto-parse');
  assertEqual(modified.type, 'modification', 'Type should be modification');
  assertEqual(modified.target, 'Weapon Training', 'Target should be Weapon Training');
});

await test('Mixed: some features from JE fix, others from auto-parse', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');

  const features = [
    // Shattering Strike - has JE fix (broken description in module)
    createMockFeature('Shattering Strike', '<p>BROKEN DESCRIPTION - no patterns</p>'),
    // Overhand Chop - no JE fix, will auto-parse
    createMockFeature('Overhand Chop', '<p>(<strong>Level</strong>: 3): This ability replaces Armor Training 1.</p>'),
    // Backswing - no JE fix, will auto-parse
    createMockFeature('Backswing', '<p>(<strong>Level</strong>: 7): This ability replaces Armor Training 2.</p>')
  ];

  const baseAssociations = [
    { uuid: 'uuid-bravery', level: 2 },
    { uuid: 'uuid-armor-training-1', level: 3 },
    { uuid: 'uuid-armor-training-2', level: 7 }
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, baseAssociations);

  // Shattering Strike should use JE fix
  assertEqual(result.features[0].source, 'je-fix', 'Shattering Strike should use JE fix');
  assertEqual(result.features[0].level, 2, 'Shattering Strike level from fix');
  assertEqual(result.features[0].replaces, 'Bravery', 'Shattering Strike replaces from fix');

  // Overhand Chop should use auto-parse
  assertEqual(result.features[1].source, 'auto-parse', 'Overhand Chop should use auto-parse');
  assertEqual(result.features[1].level, 3, 'Overhand Chop level from auto-parse');
  assertEqual(result.features[1].type, 'replacement', 'Overhand Chop type from auto-parse');

  // Backswing should use auto-parse
  assertEqual(result.features[2].source, 'auto-parse', 'Backswing should use auto-parse');
  assertEqual(result.features[2].level, 7, 'Backswing level from auto-parse');
  assertEqual(result.features[2].type, 'replacement', 'Backswing type from auto-parse');
});

await test('parseArchetype returns correct slug', async () => {
  const archetype = createMockArchetype('Two-Handed Fighter');
  const result = await CompendiumParser.parseArchetype(archetype, [], []);
  assertEqual(result.slug, 'two-handed-fighter', 'Slug should be slugified archetype name');
  assertEqual(result.name, 'Two-Handed Fighter', 'Name should be original name');
});

await test('parseArchetype with no features returns empty features array', async () => {
  const archetype = createMockArchetype('Empty Archetype');
  const result = await CompendiumParser.parseArchetype(archetype, [], []);
  assertEqual(result.features.length, 0, 'Should have empty features array');
});

await test('JE fix with additional fields are passed through', async () => {
  // Set up a fix with an extra field
  await JournalEntryDB.setArchetype('fixes', 'extra-field-test', {
    class: 'wizard',
    features: {
      'special-feature': {
        level: 4,
        replaces: 'Arcane Bond',
        description: 'A special feature',
        isAdditive: false,
        customNote: 'This was fixed by GM'
      }
    }
  });

  const archetype = createMockArchetype('Extra Field Test');
  const features = [
    createMockFeature('Special Feature', '<p>Bad description</p>')
  ];

  const result = await CompendiumParser.parseArchetype(archetype, features, []);
  const feature = result.features[0];

  assertEqual(feature.source, 'je-fix', 'Should use JE fix');
  assertEqual(feature.level, 4, 'Level from fix');
  assertEqual(feature.replaces, 'Arcane Bond', 'Replaces from fix');
  assertEqual(feature.customNote, 'This was fixed by GM', 'Extra fields should be passed through');

  // Clean up
  await JournalEntryDB.deleteArchetype('fixes', 'extra-field-test');
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  console.error(`FAIL: ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('SUCCESS: All tests passed!');
}
