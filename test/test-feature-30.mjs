/**
 * Test Suite for Feature #30: Conflict check against already-applied archetypes
 *
 * Verifies:
 * 1. Apply archetype A that replaces Bravery
 * 2. Open selection for same class
 * 3. Select archetype B also replacing Bravery -> conflict warning
 * 4. Verify application blocked
 * 5. Select non-conflicting C -> can proceed
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

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

function assertGreaterThan(actual, threshold, message) {
  if (!(actual > threshold)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${actual} > ${threshold}`);
  }
}

// Set up environment
setupMockEnvironment();

const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { ConflictChecker } = await import('../scripts/conflict-checker.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');

console.log('\n=== Feature #30: Conflict check against already-applied archetypes ===\n');

// =====================================================
// Test Data: Archetypes with known feature targets
// =====================================================

// Archetype A: Two-Handed Fighter (replaces Bravery + Armor Training 1)
const archetypeA = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'Armor Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      source: 'auto-parse'
    }
  ]
};

// Archetype B: Unbreakable (also replaces Bravery -> CONFLICTS with A)
const archetypeB = {
  name: 'Unbreakable',
  slug: 'unbreakable',
  features: [
    {
      name: 'Heroic Defiance',
      level: 2,
      type: 'replacement',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    },
    {
      name: 'Heroic Recovery',
      level: 5,
      type: 'replacement',
      target: 'Weapon Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    }
  ]
};

// Archetype C: Weapon Master (replaces Weapon Training only -> NO conflict with A)
const archetypeC = {
  name: 'Weapon Master',
  slug: 'weapon-master',
  features: [
    {
      name: 'Weapon Guard',
      level: 5,
      type: 'replacement',
      target: 'Weapon Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    },
    {
      name: 'Reliable Strike',
      level: 9,
      type: 'replacement',
      target: 'Weapon Training 2',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
      source: 'auto-parse'
    }
  ]
};

// Archetype D: Additive only -> NO conflict with anyone
const archetypeD = {
  name: 'Extra Feats',
  slug: 'extra-feats',
  features: [
    {
      name: 'Bonus Combat Feat',
      level: 1,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Setup - Apply archetype A (Two-Handed Fighter) to a class item
// =====================================================
console.log('--- Step 1: Apply archetype A that replaces Bravery ---');

test('Create class item with archetype A applied via flags', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  // Simulate that Two-Handed Fighter is already applied
  classItem.flags['archetype-manager'] = {
    archetypes: ['two-handed-fighter'],
    originalAssociations: [],
    appliedAt: new Date().toISOString()
  };

  const applied = classItem.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(applied), 'Applied archetypes should be an array');
  assertEqual(applied.length, 1, 'Should have 1 applied archetype');
  assertEqual(applied[0], 'two-handed-fighter', 'Applied archetype should be two-handed-fighter');
});

// =====================================================
// Step 2: ConflictChecker.checkAgainstApplied detects conflicts
// =====================================================
console.log('\n--- Step 2: Check archetype B against applied archetype A ---');

test('checkAgainstApplied detects Bravery conflict between B and applied A', () => {
  const conflicts = ConflictChecker.checkAgainstApplied(archetypeB, [archetypeA]);
  assertGreaterThan(conflicts.length, 0, 'Should detect at least one conflict');
});

test('Bravery conflict correctly identified', () => {
  // checkAgainstApplied calls detectConflicts(newArchetype, applied)
  // so archetypeA = new (Unbreakable), archetypeB = applied (Two-Handed Fighter)
  const conflicts = ConflictChecker.checkAgainstApplied(archetypeB, [archetypeA]);
  const braveryConflict = conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assert(braveryConflict, 'Should identify Bravery as conflicting feature');
  assertEqual(braveryConflict.archetypeA, 'Unbreakable', 'New archetype (first param) should be Unbreakable');
  assertEqual(braveryConflict.archetypeB, 'Two-Handed Fighter', 'Applied archetype (second param) should be Two-Handed Fighter');
});

test('Conflict features correctly named', () => {
  const conflicts = ConflictChecker.checkAgainstApplied(archetypeB, [archetypeA]);
  const braveryConflict = conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  // featureA = from new archetype (Unbreakable), featureB = from applied (Two-Handed Fighter)
  assertEqual(braveryConflict.featureA, 'Heroic Defiance', 'New archetype feature should be Heroic Defiance');
  assertEqual(braveryConflict.featureB, 'Shattering Strike', 'Applied feature should be Shattering Strike');
});

// =====================================================
// Step 3: checkCanApply blocks conflicting archetype
// =====================================================
console.log('\n--- Step 3: checkCanApply blocks conflicting archetype ---');

test('checkCanApply returns canApply=false for conflicting archetype B', () => {
  const result = ConflictChecker.checkCanApply(archetypeB, [archetypeA]);
  assertEqual(result.canApply, false, 'Should not be able to apply conflicting archetype');
  assertGreaterThan(result.conflicts.length, 0, 'Should have conflicts');
});

test('checkCanApply identifies blocking archetype', () => {
  const result = ConflictChecker.checkCanApply(archetypeB, [archetypeA]);
  assert(result.blockedBy.length > 0, 'Should have at least one blocking archetype');
  // The blocker should be either the new or applied archetype
  const allNames = result.blockedBy;
  assert(
    allNames.includes('Two-Handed Fighter') || allNames.includes('Unbreakable'),
    'Should identify archetype involved in conflict'
  );
});

test('checkCanApply returns canApply=true for non-conflicting archetype C', () => {
  const result = ConflictChecker.checkCanApply(archetypeC, [archetypeA]);
  assertEqual(result.canApply, true, 'Should be able to apply non-conflicting archetype');
  assertEqual(result.conflicts.length, 0, 'Should have no conflicts');
  assertEqual(result.blockedBy.length, 0, 'Should have no blockers');
});

test('checkCanApply returns canApply=true for additive archetype D', () => {
  const result = ConflictChecker.checkCanApply(archetypeD, [archetypeA]);
  assertEqual(result.canApply, true, 'Additive archetype should always be allowed');
  assertEqual(result.conflicts.length, 0, 'Additive should have no conflicts');
});

test('checkCanApply with empty applied list always returns canApply=true', () => {
  const result = ConflictChecker.checkCanApply(archetypeB, []);
  assertEqual(result.canApply, true, 'No conflicts with empty applied list');
});

// =====================================================
// Step 4: Verify application blocked for conflicting
// =====================================================
console.log('\n--- Step 4: Verify application blocked for conflicting archetype ---');

test('Application of B blocked when A is applied (Bravery conflict)', () => {
  const result = ConflictChecker.checkCanApply(archetypeB, [archetypeA]);
  assertEqual(result.canApply, false, 'Application should be blocked');
  // The Bravery conflict should be present
  const braveryConflict = result.conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assert(braveryConflict, 'Bravery conflict should be in the list');
});

test('Application blocked provides conflict details', () => {
  const result = ConflictChecker.checkCanApply(archetypeB, [archetypeA]);
  // Each conflict should have full details
  for (const conflict of result.conflicts) {
    assert(conflict.featureName, 'Conflict should have featureName');
    assert(conflict.archetypeA, 'Conflict should have archetypeA');
    assert(conflict.archetypeB, 'Conflict should have archetypeB');
    assert(conflict.featureA, 'Conflict should have featureA');
    assert(conflict.featureB, 'Conflict should have featureB');
  }
});

test('Reverse check: A against applied B also blocked', () => {
  const result = ConflictChecker.checkCanApply(archetypeA, [archetypeB]);
  assertEqual(result.canApply, false, 'Reverse conflict check should also block');
  assertGreaterThan(result.conflicts.length, 0, 'Should detect conflicts in reverse');
});

// =====================================================
// Step 5: Non-conflicting C can proceed
// =====================================================
console.log('\n--- Step 5: Non-conflicting C can proceed ---');

test('Archetype C (Weapon Master) passes check against applied A', () => {
  const result = ConflictChecker.checkCanApply(archetypeC, [archetypeA]);
  assertEqual(result.canApply, true, 'Weapon Master should pass (no Bravery/AT overlap)');
  assertEqual(result.conflicts.length, 0, 'Should have zero conflicts');
});

test('Archetype C passes even with A already applied to class item', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.flags['archetype-manager'] = {
    archetypes: ['two-handed-fighter']
  };
  const applied = classItem.getFlag('archetype-manager', 'archetypes');
  assert(applied.includes('two-handed-fighter'), 'A should be applied');

  // Now check C against applied archetypes
  const result = ConflictChecker.checkCanApply(archetypeC, [archetypeA]);
  assertEqual(result.canApply, true, 'C should pass against applied A');
});

// =====================================================
// Step 6: UI helper builds applied archetype data correctly
// =====================================================
console.log('\n--- Step 6: UI helper builds applied archetype data ---');

test('_buildAppliedArchetypeData returns empty for no applied', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  const archetypeList = [
    { slug: 'two-handed-fighter', name: 'Two-Handed Fighter', parsedData: archetypeA },
    { slug: 'weapon-master', name: 'Weapon Master', parsedData: archetypeC }
  ];
  const result = UIManager._buildAppliedArchetypeData(classItem, archetypeList);
  assertEqual(result.length, 0, 'Should return empty array for no applied archetypes');
});

test('_buildAppliedArchetypeData returns data for applied archetype', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.flags['archetype-manager'] = { archetypes: ['two-handed-fighter'] };
  const archetypeList = [
    { slug: 'two-handed-fighter', name: 'Two-Handed Fighter', parsedData: archetypeA },
    { slug: 'weapon-master', name: 'Weapon Master', parsedData: archetypeC }
  ];
  const result = UIManager._buildAppliedArchetypeData(classItem, archetypeList);
  assertEqual(result.length, 1, 'Should return 1 applied archetype data');
  assertEqual(result[0].name, 'Two-Handed Fighter', 'Should return correct archetype data');
  assertEqual(result[0].features.length, 2, 'Should include features');
});

test('_buildAppliedArchetypeData handles multiple applied archetypes', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.flags['archetype-manager'] = { archetypes: ['two-handed-fighter', 'weapon-master'] };
  const archetypeList = [
    { slug: 'two-handed-fighter', name: 'Two-Handed Fighter', parsedData: archetypeA },
    { slug: 'weapon-master', name: 'Weapon Master', parsedData: archetypeC }
  ];
  const result = UIManager._buildAppliedArchetypeData(classItem, archetypeList);
  assertEqual(result.length, 2, 'Should return 2 applied archetype data');
});

test('_buildAppliedArchetypeData handles unknown slug gracefully', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.flags['archetype-manager'] = { archetypes: ['unknown-archetype'] };
  const archetypeList = [
    { slug: 'two-handed-fighter', name: 'Two-Handed Fighter', parsedData: archetypeA }
  ];
  const result = UIManager._buildAppliedArchetypeData(classItem, archetypeList);
  assertEqual(result.length, 1, 'Should still return entry for unknown slug');
  assertEqual(result[0].slug, 'unknown-archetype', 'Should have the slug');
  assertEqual(result[0].name, 'Unknown Archetype', 'Should have generated display name');
  assertEqual(result[0].features.length, 0, 'Should have empty features for unknown');
});

test('_buildAppliedArchetypeData handles null classItem', () => {
  const result = UIManager._buildAppliedArchetypeData(null, []);
  assertEqual(result.length, 0, 'Should return empty for null classItem');
});

// =====================================================
// Step 7: Multiple applied archetypes conflict check
// =====================================================
console.log('\n--- Step 7: Multiple applied archetypes conflict check ---');

test('Check new archetype against multiple applied archetypes', () => {
  // A replaces Bravery+AT1, C replaces WT1+WT2
  // B replaces Bravery+WT1 -> conflicts with A (Bravery) and C (WT1)
  const result = ConflictChecker.checkCanApply(archetypeB, [archetypeA, archetypeC]);
  assertEqual(result.canApply, false, 'B should conflict with both A and C');
  assertGreaterThan(result.conflicts.length, 1, 'Should have multiple conflicts');
});

test('D (additive) passes even with multiple applied archetypes', () => {
  const result = ConflictChecker.checkCanApply(archetypeD, [archetypeA, archetypeC]);
  assertEqual(result.canApply, true, 'Additive should pass against multiple applied');
  assertEqual(result.conflicts.length, 0, 'Should have no conflicts');
});

// =====================================================
// Step 8: validateStacking method
// =====================================================
console.log('\n--- Step 8: validateStacking method ---');

test('validateStacking with non-conflicting set passes', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeC]);
  assertEqual(result.valid, true, 'A + C should be a valid stack');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
  assertEqual(result.conflictPairs.length, 0, 'No conflict pairs');
});

test('validateStacking with conflicting set fails', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB]);
  assertEqual(result.valid, false, 'A + B should be invalid stack');
  assertGreaterThan(result.conflicts.length, 0, 'Should have conflicts');
  assertGreaterThan(result.conflictPairs.length, 0, 'Should have conflict pairs');
});

test('validateStacking identifies unique conflict pairs', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB]);
  // Should have exactly one pair: [Two-Handed Fighter, Unbreakable]
  assertEqual(result.conflictPairs.length, 1, 'Should have 1 conflict pair');
  const pair = result.conflictPairs[0];
  assert(
    pair.includes('Two-Handed Fighter') && pair.includes('Unbreakable'),
    'Pair should contain both conflicting archetype names'
  );
});

test('validateStacking with 3 archetypes catches all pairwise conflicts', () => {
  // A+B conflict (Bravery), B+C conflict (WT1 via normalization)
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB, archetypeC]);
  assertEqual(result.valid, false, 'Should be invalid');
  assertGreaterThan(result.conflicts.length, 1, 'Should have multiple conflicts');
  assertGreaterThan(result.conflictPairs.length, 0, 'Should have conflict pairs');
});

test('validateStacking with single archetype always valid', () => {
  const result = ConflictChecker.validateStacking([archetypeA]);
  assertEqual(result.valid, true, 'Single archetype always valid');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
});

test('validateStacking with empty array always valid', () => {
  const result = ConflictChecker.validateStacking([]);
  assertEqual(result.valid, true, 'Empty stack always valid');
});

// =====================================================
// Step 9: Class validation
// =====================================================
console.log('\n--- Step 9: Class validation ---');

test('validateClass matches by tag', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  const result = ConflictChecker.validateClass({ class: 'fighter' }, classItem);
  assertEqual(result, true, 'Should match by tag');
});

test('validateClass matches by name', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  const result = ConflictChecker.validateClass({ class: 'Fighter' }, classItem);
  assertEqual(result, true, 'Should match by name (case-insensitive)');
});

test('validateClass rejects wrong class', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  const result = ConflictChecker.validateClass({ class: 'rogue' }, classItem);
  assertEqual(result, false, 'Should reject wrong class');
});

// =====================================================
// Step 10: Edge cases for conflict detection with applied
// =====================================================
console.log('\n--- Step 10: Edge cases ---');

test('Self-applied archetype is never checked for conflicts (already applied)', () => {
  // If A is applied and user tries to apply A again, that's duplicate detection, not conflict
  // But conflict-checking specifically should still work if asked
  const result = ConflictChecker.checkCanApply(archetypeA, [archetypeA]);
  assertEqual(result.canApply, false, 'Self-conflict should be detected');
  // Every feature with a target should conflict with itself
  assertGreaterThan(result.conflicts.length, 0, 'Should have self-conflicts');
});

test('Archetype with no features has no conflicts', () => {
  const emptyArch = { name: 'Empty', slug: 'empty', features: [] };
  const result = ConflictChecker.checkCanApply(emptyArch, [archetypeA]);
  assertEqual(result.canApply, true, 'Empty archetype should pass');
  assertEqual(result.conflicts.length, 0, 'No conflicts for empty');
});

test('Applied empty archetype does not block new archetypes', () => {
  const emptyArch = { name: 'Empty', slug: 'empty', features: [] };
  const result = ConflictChecker.checkCanApply(archetypeA, [emptyArch]);
  assertEqual(result.canApply, true, 'Empty applied should not block');
});

test('Mixed applied: one conflicting, one not', () => {
  // D is additive (no conflict), A conflicts with B
  const result = ConflictChecker.checkCanApply(archetypeB, [archetypeA, archetypeD]);
  assertEqual(result.canApply, false, 'Should still be blocked by A');
  // Conflicts should only be from A, not D
  const conflictsFromD = result.conflicts.filter(c =>
    c.archetypeA === 'Extra Feats' || c.archetypeB === 'Extra Feats'
  );
  assertEqual(conflictsFromD.length, 0, 'No conflicts should come from additive D');
});

test('Modification target conflicts with replacement target on same base feature', () => {
  // Archetype that modifies Bravery
  const modArchetype = {
    name: 'Bravery Modifier',
    slug: 'bravery-modifier',
    features: [{
      name: 'Enhanced Bravery',
      level: 2,
      type: 'modification',
      target: 'Bravery',
      source: 'auto-parse'
    }]
  };
  // A replaces Bravery, mod modifies Bravery -> conflict
  const result = ConflictChecker.checkCanApply(modArchetype, [archetypeA]);
  assertEqual(result.canApply, false, 'Modify and replace on same feature should conflict');
});

test('Two modification archetypes on different features no conflict', () => {
  const modA = {
    name: 'Mod A',
    slug: 'mod-a',
    features: [{
      name: 'Mod Bravery',
      type: 'modification',
      target: 'Bravery',
      source: 'auto-parse'
    }]
  };
  const modB = {
    name: 'Mod B',
    slug: 'mod-b',
    features: [{
      name: 'Mod WT',
      type: 'modification',
      target: 'Weapon Training 1',
      source: 'auto-parse'
    }]
  };
  const result = ConflictChecker.checkCanApply(modB, [modA]);
  assertEqual(result.canApply, true, 'Different modification targets should not conflict');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #30 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #30 tests passed!\n');
  process.exit(0);
}
