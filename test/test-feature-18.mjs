/**
 * Test Suite for Feature #18: Matching engine links parsed text to classAssociations
 *
 * Verifies that the matching engine correctly links "replaces X" parsed text
 * to actual classAssociations entries via fuzzy matching (normalizeName).
 *
 * Steps:
 * 1. Parse feature that "replaces Bravery"
 * 2. Get Fighter classAssociations
 * 3. Run matching engine
 * 4. Verify Bravery entry identified
 * 5. Test with Two-Handed Fighter's 7 features
 * 6. Verify all match correctly
 * 7. Test unmatched feature -> flagged for user resolution
 */

import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        passed++;
        console.log(`  \u2713 ${name}`);
      }).catch(e => {
        failed++;
        console.error(`  \u2717 ${name}`);
        console.error(`    ${e.message}`);
      });
    }
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

// Set up environment
setupMockEnvironment();

// Set up fromUuid to resolve Fighter base class features
const uuidMap = {
  'Compendium.pf1.class-abilities.Bravery': { name: 'Bravery' },
  'Compendium.pf1.class-abilities.ArmorTraining1': { name: 'Armor Training 1' },
  'Compendium.pf1.class-abilities.ArmorTraining2': { name: 'Armor Training 2' },
  'Compendium.pf1.class-abilities.ArmorTraining3': { name: 'Armor Training 3' },
  'Compendium.pf1.class-abilities.ArmorTraining4': { name: 'Armor Training 4' },
  'Compendium.pf1.class-abilities.ArmorMastery': { name: 'Armor Mastery' },
  'Compendium.pf1.class-abilities.WeaponTraining1': { name: 'Weapon Training 1' },
  'Compendium.pf1.class-abilities.WeaponTraining2': { name: 'Weapon Training 2' },
  'Compendium.pf1.class-abilities.WeaponTraining3': { name: 'Weapon Training 3' },
  'Compendium.pf1.class-abilities.WeaponTraining4': { name: 'Weapon Training 4' },
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' },
  'Compendium.pf1.class-abilities.BonusFeat1': { name: 'Bonus Feat' },
  'Compendium.pf1.class-abilities.UncannyDodge': { name: 'Uncanny Dodge' },
  'Compendium.pf1.class-abilities.ImprovedUncannyDodge': { name: 'Improved Uncanny Dodge' },
  'Compendium.pf1.class-abilities.TrapSense1': { name: 'Trap Sense 1' },
  'Compendium.pf1.class-abilities.TrapSense2': { name: 'Trap Sense 2' },
  'Compendium.pf1.class-abilities.Evasion': { name: 'Evasion' },
  'Compendium.pf1.class-abilities.RagePowers': { name: 'Rage Powers' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

// Fighter classAssociations (base class features)
const fighterClassAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining3', level: 13 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining4', level: 17 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponMastery', level: 20 }
];

// Import CompendiumParser
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #18: Matching engine links parsed text to classAssociations ===\n');

// =====================================================
// Step 1: Parse feature that 'replaces Bravery'
// =====================================================
console.log('--- Step 1: Parse feature that "replaces Bravery" ---');

test('parseReplaces extracts "Bravery" target from description', () => {
  const desc = '<p><strong>Level</strong>: 2</p><p>This ability replaces Bravery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Bravery', 'Should extract "Bravery" as target');
});

test('classifyFeature identifies replacement type for "replaces Bravery"', () => {
  const desc = '<p><strong>Level</strong>: 2</p><p>This ability replaces Bravery.</p>';
  const classification = CompendiumParser.classifyFeature(desc);
  assertEqual(classification.type, 'replacement', 'Should classify as replacement');
  assertEqual(classification.target, 'Bravery', 'Target should be "Bravery"');
});

// =====================================================
// Step 2: Get Fighter classAssociations (resolved)
// =====================================================
console.log('\n--- Step 2: Resolve Fighter classAssociations ---');

let resolvedAssociations;

await asyncTest('resolveAssociations resolves all Fighter feature UUIDs', async () => {
  resolvedAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedAssociations.length, fighterClassAssociations.length,
    'Should resolve all associations');

  // Verify first few resolved names
  assertEqual(resolvedAssociations[0].resolvedName, 'Bonus Feat',
    'First should be Bonus Feat');
  assertEqual(resolvedAssociations[1].resolvedName, 'Bravery',
    'Second should be Bravery');
  assertEqual(resolvedAssociations[2].resolvedName, 'Armor Training 1',
    'Third should be Armor Training 1');
});

await asyncTest('resolvedAssociations preserves original uuid and level data', async () => {
  for (let i = 0; i < resolvedAssociations.length; i++) {
    assertNotNull(resolvedAssociations[i].uuid, `Entry ${i} should have uuid`);
    assertNotNull(resolvedAssociations[i].level, `Entry ${i} should have level`);
    assertNotNull(resolvedAssociations[i].resolvedName, `Entry ${i} should have resolvedName`);
  }
});

// =====================================================
// Step 3: Run matching engine (matchTarget)
// =====================================================
console.log('\n--- Step 3: Run matching engine ---');

test('matchTarget finds Bravery by exact match', () => {
  const result = CompendiumParser.matchTarget('Bravery', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "Bravery"');
  assertEqual(result.resolvedName, 'Bravery', 'Should match the Bravery entry');
  assertEqual(result.uuid, 'Compendium.pf1.class-abilities.Bravery', 'Should have correct UUID');
});

test('matchTarget finds Bravery by case-insensitive match', () => {
  const result = CompendiumParser.matchTarget('bravery', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "bravery" (lowercase)');
  assertEqual(result.resolvedName, 'Bravery', 'Should match the Bravery entry');
});

test('matchTarget finds Armor Training 1 by exact match', () => {
  const result = CompendiumParser.matchTarget('Armor Training 1', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "Armor Training 1"');
  assertEqual(result.resolvedName, 'Armor Training 1', 'Should match Armor Training 1');
  assertEqual(result.level, 3, 'Armor Training 1 is at level 3');
});

test('matchTarget finds armor training 1 by normalized match', () => {
  const result = CompendiumParser.matchTarget('armor training 1', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "armor training 1" (lowercase)');
  assertEqual(result.resolvedName, 'Armor Training 1', 'Should match Armor Training 1');
});

test('matchTarget finds Armor Mastery', () => {
  const result = CompendiumParser.matchTarget('Armor Mastery', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "Armor Mastery"');
  assertEqual(result.resolvedName, 'Armor Mastery', 'Should match Armor Mastery');
  assertEqual(result.level, 19, 'Armor Mastery is at level 19');
});

test('matchTarget finds armor mastery case-insensitive', () => {
  const result = CompendiumParser.matchTarget('armor mastery', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "armor mastery"');
  assertEqual(result.resolvedName, 'Armor Mastery', 'Should match Armor Mastery');
});

// =====================================================
// Step 4: Verify Bravery entry identified correctly
// =====================================================
console.log('\n--- Step 4: Verify Bravery entry identified correctly ---');

test('Bravery match has correct UUID', () => {
  const result = CompendiumParser.matchTarget('Bravery', resolvedAssociations);
  assertEqual(result.uuid, 'Compendium.pf1.class-abilities.Bravery', 'UUID should match');
});

test('Bravery match has correct level', () => {
  const result = CompendiumParser.matchTarget('Bravery', resolvedAssociations);
  assertEqual(result.level, 2, 'Level should be 2');
});

test('Bravery match returns full association entry', () => {
  const result = CompendiumParser.matchTarget('Bravery', resolvedAssociations);
  assert('uuid' in result, 'Should have uuid');
  assert('level' in result, 'Should have level');
  assert('resolvedName' in result, 'Should have resolvedName');
});

// =====================================================
// Step 5: Test with Two-Handed Fighter's features
// =====================================================
console.log('\n--- Step 5: Two-Handed Fighter archetype matching ---');

// Two-Handed Fighter archetype features (7 features, 6 replace + 1 additive)
const twoHandedFighterFeatures = [
  {
    name: 'Shattering Strike',
    description: '<p><strong>Level</strong>: 2</p><p>This ability replaces bravery.</p>',
    expectedTarget: 'bravery',
    expectedMatch: 'Bravery'
  },
  {
    name: 'Overhand Chop',
    description: '<p><strong>Level</strong>: 3</p><p>This ability replaces armor training 1.</p>',
    expectedTarget: 'armor training 1',
    expectedMatch: 'Armor Training 1'
  },
  {
    name: 'Backswing',
    description: '<p><strong>Level</strong>: 7</p><p>This ability replaces armor training 2.</p>',
    expectedTarget: 'armor training 2',
    expectedMatch: 'Armor Training 2'
  },
  {
    name: 'Piledriver',
    description: '<p><strong>Level</strong>: 11</p><p>This ability replaces armor training 3.</p>',
    expectedTarget: 'armor training 3',
    expectedMatch: 'Armor Training 3'
  },
  {
    name: 'Greater Power Attack',
    description: '<p><strong>Level</strong>: 15</p><p>This ability replaces armor training 4.</p>',
    expectedTarget: 'armor training 4',
    expectedMatch: 'Armor Training 4'
  },
  {
    name: 'Devastating Blow',
    description: '<p><strong>Level</strong>: 19</p><p>This ability replaces armor mastery.</p>',
    expectedTarget: 'armor mastery',
    expectedMatch: 'Armor Mastery'
  },
  {
    name: 'Weapon Training',
    description: '<p><strong>Level</strong>: 5</p><p>A two-handed fighter gains weapon training at 5th level.</p>',
    expectedTarget: null,
    expectedMatch: null,
    isAdditive: true
  }
];

// Step 5a: Test each feature individually
for (const feature of twoHandedFighterFeatures) {
  if (feature.isAdditive) {
    test(`Two-Handed Fighter: ${feature.name} classified as additive (no replaces)`, () => {
      const classification = CompendiumParser.classifyFeature(feature.description);
      assertEqual(classification.type, 'additive', `${feature.name} should be additive`);
      assertEqual(classification.target, null, `${feature.name} should have no target`);
    });
  } else {
    test(`Two-Handed Fighter: ${feature.name} parsed as replacing "${feature.expectedTarget}"`, () => {
      const target = CompendiumParser.parseReplaces(feature.description);
      assertEqual(target, feature.expectedTarget, `${feature.name} should replace "${feature.expectedTarget}"`);
    });

    test(`Two-Handed Fighter: ${feature.name} matched to "${feature.expectedMatch}" in classAssociations`, () => {
      const target = CompendiumParser.parseReplaces(feature.description);
      const match = CompendiumParser.matchTarget(target, resolvedAssociations);
      assertNotNull(match, `${feature.name} should find a match for "${target}"`);
      assertEqual(match.resolvedName, feature.expectedMatch,
        `${feature.name} should match "${feature.expectedMatch}"`);
    });
  }
}

// =====================================================
// Step 6: Verify all match correctly (full parseArchetype)
// =====================================================
console.log('\n--- Step 6: Full parseArchetype with Two-Handed Fighter ---');

await asyncTest('parseArchetype processes all Two-Handed Fighter features correctly', async () => {
  // Set up JE mock so parseArchetype doesn't crash
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  const archetype = { name: 'Two-Handed Fighter' };
  const features = twoHandedFighterFeatures.map(f => ({
    name: f.name,
    system: { description: { value: f.description } }
  }));

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  assertEqual(parsed.name, 'Two-Handed Fighter', 'Parsed name should match');
  assertEqual(parsed.slug, 'two-handed-fighter', 'Slug should be slugified');
  assertEqual(parsed.features.length, 7, 'Should have 7 features parsed');
});

await asyncTest('parseArchetype: all replacement features have matchedAssociation', async () => {
  const archetype = { name: 'Two-Handed Fighter' };
  const features = twoHandedFighterFeatures.map(f => ({
    name: f.name,
    system: { description: { value: f.description } }
  }));

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  // Check each replacement feature has a matched association
  const replacementFeatures = parsed.features.filter(f => f.type === 'replacement');
  assertEqual(replacementFeatures.length, 6, 'Should have 6 replacement features');

  for (const f of replacementFeatures) {
    assertNotNull(f.matchedAssociation, `${f.name} should have matchedAssociation`);
    assertNotNull(f.matchedAssociation.uuid, `${f.name} matched association should have UUID`);
    assertEqual(f.needsUserInput, false, `${f.name} should NOT need user input`);
    assertEqual(f.source, 'auto-parse', `${f.name} source should be "auto-parse"`);
  }
});

await asyncTest('parseArchetype: additive feature has no matchedAssociation', async () => {
  const archetype = { name: 'Two-Handed Fighter' };
  const features = twoHandedFighterFeatures.map(f => ({
    name: f.name,
    system: { description: { value: f.description } }
  }));

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  const additiveFeatures = parsed.features.filter(f => f.type === 'additive');
  assertEqual(additiveFeatures.length, 1, 'Should have 1 additive feature');
  assertEqual(additiveFeatures[0].name, 'Weapon Training', 'Additive should be Weapon Training');
  assertEqual(additiveFeatures[0].matchedAssociation, null, 'Additive should have null matchedAssociation');
  assertEqual(additiveFeatures[0].needsUserInput, false, 'Additive should not need user input');
});

await asyncTest('parseArchetype: Shattering Strike matched to Bravery UUID', async () => {
  const archetype = { name: 'Two-Handed Fighter' };
  const features = twoHandedFighterFeatures.map(f => ({
    name: f.name,
    system: { description: { value: f.description } }
  }));

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  const shattering = parsed.features.find(f => f.name === 'Shattering Strike');
  assertNotNull(shattering, 'Should find Shattering Strike');
  assertEqual(shattering.matchedAssociation.uuid, 'Compendium.pf1.class-abilities.Bravery',
    'Should match Bravery UUID');
  assertEqual(shattering.matchedAssociation.level, 2, 'Bravery is at level 2');
});

await asyncTest('parseArchetype: Overhand Chop matched to Armor Training 1 UUID', async () => {
  const archetype = { name: 'Two-Handed Fighter' };
  const features = twoHandedFighterFeatures.map(f => ({
    name: f.name,
    system: { description: { value: f.description } }
  }));

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  const overhand = parsed.features.find(f => f.name === 'Overhand Chop');
  assertNotNull(overhand, 'Should find Overhand Chop');
  assertEqual(overhand.matchedAssociation.uuid, 'Compendium.pf1.class-abilities.ArmorTraining1',
    'Should match Armor Training 1 UUID');
  assertEqual(overhand.matchedAssociation.level, 3, 'Armor Training 1 is at level 3');
});

await asyncTest('parseArchetype: Devastating Blow matched to Armor Mastery UUID', async () => {
  const archetype = { name: 'Two-Handed Fighter' };
  const features = twoHandedFighterFeatures.map(f => ({
    name: f.name,
    system: { description: { value: f.description } }
  }));

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  const devastating = parsed.features.find(f => f.name === 'Devastating Blow');
  assertNotNull(devastating, 'Should find Devastating Blow');
  assertEqual(devastating.matchedAssociation.uuid, 'Compendium.pf1.class-abilities.ArmorMastery',
    'Should match Armor Mastery UUID');
  assertEqual(devastating.matchedAssociation.level, 19, 'Armor Mastery is at level 19');
});

// =====================================================
// Step 7: Unmatched feature -> flagged for user resolution
// =====================================================
console.log('\n--- Step 7: Unmatched features flagged for user resolution ---');

test('matchTarget returns null for non-existent feature', () => {
  const result = CompendiumParser.matchTarget('Nonexistent Feature', resolvedAssociations);
  assertEqual(result, null, 'Should return null for non-existent feature');
});

test('matchTarget returns null for empty target', () => {
  const result = CompendiumParser.matchTarget('', resolvedAssociations);
  assertEqual(result, null, 'Should return null for empty target');
});

test('matchTarget returns null for null target', () => {
  const result = CompendiumParser.matchTarget(null, resolvedAssociations);
  assertEqual(result, null, 'Should return null for null target');
});

await asyncTest('parseArchetype flags unmatched replacement for user input', async () => {
  // Feature that replaces something that doesn't exist in base class
  const archetype = { name: 'Broken Archetype' };
  const features = [{
    name: 'Mystery Feature',
    system: {
      description: {
        value: '<p><strong>Level</strong>: 3</p><p>This ability replaces Nonexistent Ability.</p>'
      }
    }
  }];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  assertEqual(parsed.features.length, 1, 'Should have 1 feature');
  assertEqual(parsed.features[0].type, 'replacement', 'Should be classified as replacement');
  assertEqual(parsed.features[0].target, 'Nonexistent Ability', 'Target should be parsed');
  assertEqual(parsed.features[0].matchedAssociation, null, 'Should have null matchedAssociation');
  assertEqual(parsed.features[0].needsUserInput, true, 'Should be flagged for user input');
  assertEqual(parsed.features[0].source, 'auto-parse', 'Source should be auto-parse');
});

await asyncTest('parseArchetype flags unknown type features for user input', async () => {
  // Feature with no level, no replaces, no modifies pattern
  const archetype = { name: 'Vague Archetype' };
  const features = [{
    name: 'Mysterious Power',
    system: {
      description: {
        value: '<p>This is a vague description with no patterns.</p>'
      }
    }
  }];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  assertEqual(parsed.features.length, 1, 'Should have 1 feature');
  assertEqual(parsed.features[0].type, 'unknown', 'Should be classified as unknown');
  assertEqual(parsed.features[0].needsUserInput, true, 'Unknown type should need user input');
});

await asyncTest('parseArchetype: matched features do NOT need user input', async () => {
  const archetype = { name: 'Well-Parsed Archetype' };
  const features = [{
    name: 'Good Feature',
    system: {
      description: {
        value: '<p><strong>Level</strong>: 2</p><p>This ability replaces Bravery.</p>'
      }
    }
  }];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterClassAssociations);

  assertEqual(parsed.features[0].needsUserInput, false,
    'Matched replacement should not need user input');
});

// =====================================================
// Additional edge cases for matching engine
// =====================================================
console.log('\n--- Additional matching engine edge cases ---');

test('matchTarget handles "the X class feature" pattern via normalization', () => {
  // When parseReplaces extracts "the Bravery class feature", matchTarget should
  // still find a match via partial matching
  const result = CompendiumParser.matchTarget('the Bravery class feature', resolvedAssociations);
  assertNotNull(result, 'Should find partial match for "the Bravery class feature"');
  assertEqual(result.resolvedName, 'Bravery', 'Should match Bravery');
});

test('matchTarget handles "Armor Training" matching any Armor Training tier', () => {
  // "armor training" normalized should match any tier since normalizeName
  // strips trailing numbers
  const result = CompendiumParser.matchTarget('Armor Training', resolvedAssociations);
  assertNotNull(result, 'Should find a match for "Armor Training" (without number)');
  // Should match the first one found
  assert(result.resolvedName.startsWith('Armor Training'),
    `Match "${result.resolvedName}" should start with "Armor Training"`);
});

test('matchTarget with extra whitespace still matches', () => {
  const result = CompendiumParser.matchTarget('  Bravery  ', resolvedAssociations);
  assertNotNull(result, 'Should find match despite whitespace');
  assertEqual(result.resolvedName, 'Bravery', 'Should match Bravery');
});

test('matchTarget with different casing matches', () => {
  const result = CompendiumParser.matchTarget('ARMOR TRAINING 1', resolvedAssociations);
  assertNotNull(result, 'Should match "ARMOR TRAINING 1" (all caps)');
  assertEqual(result.resolvedName, 'Armor Training 1', 'Should match Armor Training 1');
});

test('matchTarget returns first exact match over partial', () => {
  // Exact normalized match should be preferred
  const result = CompendiumParser.matchTarget('Bravery', resolvedAssociations);
  assertEqual(result.resolvedName, 'Bravery', 'Should return exact match');
});

test('matchTarget with empty associations returns null', () => {
  const result = CompendiumParser.matchTarget('Bravery', []);
  assertEqual(result, null, 'Should return null for empty associations');
});

test('matchTarget with undefined resolvedName in associations doesnt crash', () => {
  const badAssociations = [
    { uuid: 'test-uuid', level: 1, resolvedName: null }
  ];
  // Should not throw
  const result = CompendiumParser.matchTarget('Bravery', badAssociations);
  assertEqual(result, null, 'Should return null when no names match');
});

// =====================================================
// Multi-class matching verification
// =====================================================
console.log('\n--- Multi-class matching (Rogue features) ---');

const rogueClassAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.UncannyDodge', level: 2 },
  { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3 },
  { uuid: 'Compendium.pf1.class-abilities.Evasion', level: 2 },
  { uuid: 'Compendium.pf1.class-abilities.ImprovedUncannyDodge', level: 8 }
];

await asyncTest('matchTarget works with Rogue classAssociations', async () => {
  const resolved = await CompendiumParser.resolveAssociations(rogueClassAssociations);

  const result = CompendiumParser.matchTarget('Uncanny Dodge', resolved);
  assertNotNull(result, 'Should find Uncanny Dodge in Rogue');
  assertEqual(result.resolvedName, 'Uncanny Dodge', 'Should match Uncanny Dodge');
});

await asyncTest('matchTarget finds Trap Sense in Rogue', async () => {
  const resolved = await CompendiumParser.resolveAssociations(rogueClassAssociations);

  const result = CompendiumParser.matchTarget('Trap Sense 1', resolved);
  assertNotNull(result, 'Should find Trap Sense 1 in Rogue');
  assertEqual(result.resolvedName, 'Trap Sense 1', 'Should match Trap Sense 1');
});

await asyncTest('matchTarget finds Evasion in Rogue', async () => {
  const resolved = await CompendiumParser.resolveAssociations(rogueClassAssociations);

  const result = CompendiumParser.matchTarget('Evasion', resolved);
  assertNotNull(result, 'Should find Evasion in Rogue');
  assertEqual(result.resolvedName, 'Evasion', 'Should match Evasion');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #18 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #18 tests passed!\n');
  process.exit(0);
}
