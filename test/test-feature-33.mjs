/**
 * Test Suite for Feature #33: Generate diff between base and archetype classAssociations
 *
 * Verifies that the DiffEngine correctly generates a comparison between
 * base Fighter classAssociations and Two-Handed Fighter archetype modifications.
 *
 * Steps:
 * 1. Get base Fighter classAssociations
 * 2. Parse Two-Handed Fighter archetype
 * 3. Generate diff
 * 4. Verify removed entries identified
 * 5. Verify added entries identified
 * 6. Verify unchanged preserved
 * 7. Verify diff structure has status, level, name
 */

import { setupMockEnvironment } from './foundry-mock.mjs';

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

function assertGreaterThan(actual, threshold, message) {
  if (!(actual > threshold)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${actual} > ${threshold}`);
  }
}

// Set up environment
setupMockEnvironment();

// Set up fromUuid to resolve Fighter base class features
const uuidMap = {
  'Compendium.pf1.class-abilities.BonusFeat1': { name: 'Bonus Feat' },
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
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #33: Generate diff between base and archetype classAssociations ===\n');

// =====================================================
// Step 1: Get base Fighter classAssociations
// =====================================================
console.log('--- Step 1: Base Fighter classAssociations ---');

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

// Resolve the associations to get resolvedName on each
let resolvedFighterAssociations;

await asyncTest('Resolve Fighter classAssociations with names', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
  assertEqual(resolvedFighterAssociations[0].resolvedName, 'Bonus Feat', 'First feature');
  assertEqual(resolvedFighterAssociations[1].resolvedName, 'Bravery', 'Second feature');
});

test('Fighter has 12 base classAssociations', () => {
  assertEqual(fighterClassAssociations.length, 12, 'Fighter should have 12 features');
});

// =====================================================
// Step 2: Parse Two-Handed Fighter archetype
// =====================================================
console.log('\n--- Step 2: Parse Two-Handed Fighter archetype ---');

// Two-Handed Fighter: 6 replacements + 1 additive
const twoHandedFighterParsed = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'armor training 2',
      matchedAssociation: resolvedFighterAssociations?.[4] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
      source: 'auto-parse'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'armor training 3',
      matchedAssociation: resolvedFighterAssociations?.[6] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
      source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'armor training 4',
      matchedAssociation: resolvedFighterAssociations?.[8] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
      source: 'auto-parse'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'armor mastery',
      matchedAssociation: resolvedFighterAssociations?.[10] || { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      source: 'auto-parse'
    }
  ]
};

test('Two-Handed Fighter has 7 features (6 replacements + 1 additive)', () => {
  assertEqual(twoHandedFighterParsed.features.length, 7, 'Should have 7 features');
  const replacements = twoHandedFighterParsed.features.filter(f => f.type === 'replacement');
  const additives = twoHandedFighterParsed.features.filter(f => f.type === 'additive');
  assertEqual(replacements.length, 6, 'Should have 6 replacements');
  assertEqual(additives.length, 1, 'Should have 1 additive');
});

// =====================================================
// Step 3: Generate diff
// =====================================================
console.log('\n--- Step 3: Generate diff ---');

let diff;

test('generateDiff produces a non-empty diff array', () => {
  diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  assert(Array.isArray(diff), 'Diff should be an array');
  assertGreaterThan(diff.length, 0, 'Diff should have entries');
});

test('generateDiff returns correct total count', () => {
  // 12 base features + 7 archetype features (6 replacement + 1 additive) = 19 entries
  // But 6 base features are replaced (removed), and 6 replacement features are added
  // So: 12 base entries + 7 added = 19 total entries
  assertEqual(diff.length, 19,
    'Should have 12 base + 7 archetype = 19 entries');
});

test('Diff is sorted by level', () => {
  let prevLevel = 0;
  for (const entry of diff) {
    const level = entry.level || 0;
    assert(level >= prevLevel,
      `Level ${level} should be >= previous ${prevLevel} (entry: ${entry.name})`);
    prevLevel = level;
  }
});

// =====================================================
// Step 4: Verify removed entries identified
// =====================================================
console.log('\n--- Step 4: Verify removed entries ---');

test('Bravery is marked as REMOVED', () => {
  const bravery = diff.find(d => d.name === 'Bravery');
  assertNotNull(bravery, 'Should find Bravery in diff');
  assertEqual(bravery.status, 'removed', 'Bravery should be REMOVED');
});

test('Armor Training 1 is marked as REMOVED', () => {
  const at1 = diff.find(d => d.name === 'Armor Training 1');
  assertNotNull(at1, 'Should find Armor Training 1 in diff');
  assertEqual(at1.status, 'removed', 'Armor Training 1 should be REMOVED');
});

test('Armor Training 2 is marked as REMOVED', () => {
  const at2 = diff.find(d => d.name === 'Armor Training 2');
  assertNotNull(at2, 'Should find Armor Training 2 in diff');
  assertEqual(at2.status, 'removed', 'Armor Training 2 should be REMOVED');
});

test('Armor Training 3 is marked as REMOVED', () => {
  const at3 = diff.find(d => d.name === 'Armor Training 3');
  assertNotNull(at3, 'Should find Armor Training 3 in diff');
  assertEqual(at3.status, 'removed', 'Armor Training 3 should be REMOVED');
});

test('Armor Training 4 is marked as REMOVED', () => {
  const at4 = diff.find(d => d.name === 'Armor Training 4');
  assertNotNull(at4, 'Should find Armor Training 4 in diff');
  assertEqual(at4.status, 'removed', 'Armor Training 4 should be REMOVED');
});

test('Armor Mastery is marked as REMOVED', () => {
  const am = diff.find(d => d.name === 'Armor Mastery');
  assertNotNull(am, 'Should find Armor Mastery in diff');
  assertEqual(am.status, 'removed', 'Armor Mastery should be REMOVED');
});

test('All 6 removed entries are from replaced base features', () => {
  const removed = diff.filter(d => d.status === 'removed');
  assertEqual(removed.length, 6, 'Should have exactly 6 removed entries');

  const removedNames = removed.map(d => d.name).sort();
  const expectedRemoved = [
    'Armor Mastery', 'Armor Training 1', 'Armor Training 2',
    'Armor Training 3', 'Armor Training 4', 'Bravery'
  ].sort();
  assertEqual(JSON.stringify(removedNames), JSON.stringify(expectedRemoved),
    'Removed names should match expected');
});

test('Removed entries have original association data', () => {
  const removed = diff.filter(d => d.status === 'removed');
  for (const entry of removed) {
    assertNotNull(entry.original, `${entry.name} should have "original" data`);
    assertNotNull(entry.original.uuid, `${entry.name} original should have UUID`);
  }
});

// =====================================================
// Step 5: Verify added entries identified
// =====================================================
console.log('\n--- Step 5: Verify added entries ---');

test('Shattering Strike is ADDED', () => {
  const ss = diff.find(d => d.name === 'Shattering Strike');
  assertNotNull(ss, 'Should find Shattering Strike in diff');
  assertEqual(ss.status, 'added', 'Shattering Strike should be ADDED');
});

test('Overhand Chop is ADDED', () => {
  const oc = diff.find(d => d.name === 'Overhand Chop');
  assertNotNull(oc, 'Should find Overhand Chop in diff');
  assertEqual(oc.status, 'added', 'Overhand Chop should be ADDED');
});

test('Backswing is ADDED', () => {
  const bs = diff.find(d => d.name === 'Backswing');
  assertNotNull(bs, 'Should find Backswing in diff');
  assertEqual(bs.status, 'added', 'Backswing should be ADDED');
});

test('Piledriver is ADDED', () => {
  const pd = diff.find(d => d.name === 'Piledriver');
  assertNotNull(pd, 'Should find Piledriver in diff');
  assertEqual(pd.status, 'added', 'Piledriver should be ADDED');
});

test('Greater Power Attack is ADDED', () => {
  const gpa = diff.find(d => d.name === 'Greater Power Attack');
  assertNotNull(gpa, 'Should find Greater Power Attack in diff');
  assertEqual(gpa.status, 'added', 'Greater Power Attack should be ADDED');
});

test('Devastating Blow is ADDED', () => {
  const db = diff.find(d => d.name === 'Devastating Blow');
  assertNotNull(db, 'Should find Devastating Blow in diff');
  assertEqual(db.status, 'added', 'Devastating Blow should be ADDED');
});

test('Weapon Training (additive) is ADDED', () => {
  const wt = diff.find(d => d.name === 'Weapon Training' && d.status === 'added');
  assertNotNull(wt, 'Should find additive Weapon Training as ADDED');
  assertEqual(wt.level, 5, 'Weapon Training should be at level 5');
});

test('All 7 added entries are archetype features', () => {
  const added = diff.filter(d => d.status === 'added');
  assertEqual(added.length, 7, 'Should have exactly 7 added entries');
});

test('Added entries have archetypeFeature data', () => {
  const added = diff.filter(d => d.status === 'added');
  for (const entry of added) {
    assertNotNull(entry.archetypeFeature, `${entry.name} should have "archetypeFeature" data`);
  }
});

// =====================================================
// Step 6: Verify unchanged entries preserved
// =====================================================
console.log('\n--- Step 6: Verify unchanged entries ---');

test('Bonus Feat is UNCHANGED', () => {
  const bf = diff.find(d => d.name === 'Bonus Feat');
  assertNotNull(bf, 'Should find Bonus Feat in diff');
  assertEqual(bf.status, 'unchanged', 'Bonus Feat should be UNCHANGED');
});

test('Weapon Training 1 (base) is UNCHANGED', () => {
  const wt1 = diff.find(d => d.name === 'Weapon Training 1' && d.status === 'unchanged');
  assertNotNull(wt1, 'Should find base Weapon Training 1 as UNCHANGED');
});

test('Weapon Training 2 (base) is UNCHANGED', () => {
  const wt2 = diff.find(d => d.name === 'Weapon Training 2');
  assertNotNull(wt2, 'Should find Weapon Training 2 in diff');
  assertEqual(wt2.status, 'unchanged', 'Weapon Training 2 should be UNCHANGED');
});

test('Weapon Training 3 (base) is UNCHANGED', () => {
  const wt3 = diff.find(d => d.name === 'Weapon Training 3');
  assertNotNull(wt3, 'Should find Weapon Training 3 in diff');
  assertEqual(wt3.status, 'unchanged', 'Weapon Training 3 should be UNCHANGED');
});

test('Weapon Training 4 (base) is UNCHANGED', () => {
  const wt4 = diff.find(d => d.name === 'Weapon Training 4');
  assertNotNull(wt4, 'Should find Weapon Training 4 in diff');
  assertEqual(wt4.status, 'unchanged', 'Weapon Training 4 should be UNCHANGED');
});

test('Weapon Mastery is UNCHANGED', () => {
  const wm = diff.find(d => d.name === 'Weapon Mastery');
  assertNotNull(wm, 'Should find Weapon Mastery in diff');
  assertEqual(wm.status, 'unchanged', 'Weapon Mastery should be UNCHANGED');
});

test('All 6 unchanged entries are non-replaced base features', () => {
  const unchanged = diff.filter(d => d.status === 'unchanged');
  assertEqual(unchanged.length, 6, 'Should have exactly 6 unchanged entries');

  const unchangedNames = unchanged.map(d => d.name).sort();
  const expectedUnchanged = [
    'Bonus Feat', 'Weapon Mastery',
    'Weapon Training 1', 'Weapon Training 2',
    'Weapon Training 3', 'Weapon Training 4'
  ].sort();
  assertEqual(JSON.stringify(unchangedNames), JSON.stringify(expectedUnchanged),
    'Unchanged names should match expected');
});

test('Unchanged entries have original association data', () => {
  const unchanged = diff.filter(d => d.status === 'unchanged');
  for (const entry of unchanged) {
    assertNotNull(entry.original, `${entry.name} should have "original" data`);
    assertNotNull(entry.original.uuid, `${entry.name} original should have UUID`);
  }
});

// =====================================================
// Step 7: Verify diff structure has status, level, name
// =====================================================
console.log('\n--- Step 7: Verify diff entry structure ---');

test('Every diff entry has "status" field', () => {
  for (const entry of diff) {
    assert('status' in entry, `Entry "${entry.name}" should have status field`);
    assert(
      ['added', 'removed', 'modified', 'unchanged'].includes(entry.status),
      `Entry "${entry.name}" has invalid status: ${entry.status}`
    );
  }
});

test('Every diff entry has "level" field', () => {
  for (const entry of diff) {
    assert('level' in entry, `Entry "${entry.name}" should have level field`);
  }
});

test('Every diff entry has "name" field', () => {
  for (const entry of diff) {
    assert('name' in entry, `Entry should have name field`);
    assert(typeof entry.name === 'string', `Entry name should be a string, got ${typeof entry.name}`);
    assertGreaterThan(entry.name.length, 0, 'Entry name should not be empty');
  }
});

test('STATUS constants match expected values', () => {
  assertEqual(DiffEngine.STATUS.UNCHANGED, 'unchanged', 'UNCHANGED constant');
  assertEqual(DiffEngine.STATUS.REMOVED, 'removed', 'REMOVED constant');
  assertEqual(DiffEngine.STATUS.ADDED, 'added', 'ADDED constant');
  assertEqual(DiffEngine.STATUS.MODIFIED, 'modified', 'MODIFIED constant');
});

// =====================================================
// Additional diff edge cases
// =====================================================
console.log('\n--- Additional diff edge cases ---');

test('Diff with modification type shows MODIFIED status', () => {
  const modArchetype = {
    name: 'Modifier',
    features: [
      {
        name: 'Modified Bravery',
        level: 2,
        type: 'modification',
        target: 'Bravery',
        matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
        source: 'auto-parse'
      }
    ]
  };
  const modDiff = DiffEngine.generateDiff(resolvedFighterAssociations, modArchetype);
  const modified = modDiff.find(d => d.name === 'Modified Bravery');
  assertNotNull(modified, 'Should find Modified Bravery');
  assertEqual(modified.status, 'modified', 'Should have MODIFIED status');
});

test('Diff with modification marks base as REMOVED', () => {
  const modArchetype = {
    name: 'Modifier',
    features: [
      {
        name: 'Modified Bravery',
        level: 2,
        type: 'modification',
        target: 'Bravery',
        matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
        source: 'auto-parse'
      }
    ]
  };
  const modDiff = DiffEngine.generateDiff(resolvedFighterAssociations, modArchetype);
  const bravery = modDiff.find(d => d.name === 'Bravery');
  assertNotNull(bravery, 'Should find Bravery base entry');
  assertEqual(bravery.status, 'removed', 'Modified base should be marked REMOVED');
});

test('Diff with only additive features has all base UNCHANGED', () => {
  const additiveArchetype = {
    name: 'Additive Only',
    features: [
      {
        name: 'Bonus Ability',
        level: 4,
        type: 'additive',
        target: null,
        matchedAssociation: null,
        source: 'auto-parse'
      }
    ]
  };
  const addDiff = DiffEngine.generateDiff(resolvedFighterAssociations, additiveArchetype);
  const unchanged = addDiff.filter(d => d.status === 'unchanged');
  assertEqual(unchanged.length, 12, 'All 12 base features should be UNCHANGED');
  const added = addDiff.filter(d => d.status === 'added');
  assertEqual(added.length, 1, 'Should have 1 added feature');
});

test('Diff with empty archetype features leaves all base UNCHANGED', () => {
  const emptyArchetype = { name: 'Empty', features: [] };
  const emptyDiff = DiffEngine.generateDiff(resolvedFighterAssociations, emptyArchetype);
  assertEqual(emptyDiff.length, 12, 'Should have only 12 base entries');
  const unchanged = emptyDiff.filter(d => d.status === 'unchanged');
  assertEqual(unchanged.length, 12, 'All should be UNCHANGED');
});

test('Diff with empty base associations shows only added', () => {
  const archetype = {
    name: 'New',
    features: [
      { name: 'New Feature', level: 1, type: 'additive', target: null, matchedAssociation: null }
    ]
  };
  const newDiff = DiffEngine.generateDiff([], archetype);
  assertEqual(newDiff.length, 1, 'Should have 1 entry');
  assertEqual(newDiff[0].status, 'added', 'Should be ADDED');
});

test('validateFinalState accepts valid associations', () => {
  const valid = [
    { uuid: 'test-uuid-1', level: 1 },
    { uuid: 'test-uuid-2', level: 5 }
  ];
  const result = DiffEngine.validateFinalState(valid);
  assertEqual(result.valid, true, 'Should be valid');
  assertEqual(result.errors.length, 0, 'Should have no errors');
});

test('validateFinalState rejects entries without UUID', () => {
  const invalid = [
    { level: 1 } // No uuid or id
  ];
  const result = DiffEngine.validateFinalState(invalid);
  assertEqual(result.valid, false, 'Should be invalid');
  assertGreaterThan(result.errors.length, 0, 'Should have errors');
});

test('validateFinalState rejects entries with invalid level', () => {
  const invalid = [
    { uuid: 'test-uuid', level: 0 },
    { uuid: 'test-uuid', level: -1 }
  ];
  const result = DiffEngine.validateFinalState(invalid);
  assertEqual(result.valid, false, 'Should be invalid');
  assertEqual(result.errors.length, 2, 'Should have 2 errors');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #33 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #33 tests passed!\n');
  process.exit(0);
}
