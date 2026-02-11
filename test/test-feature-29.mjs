/**
 * Test Suite for Feature #29: Detect feature conflicts between two archetypes
 *
 * Verifies that the conflict checker identifies when two archetypes
 * replace/modify the same base feature.
 *
 * Steps:
 * 1. Two archetypes both replacing 'Bravery'
 * 2. Run conflict detection
 * 3. Verify conflict detected and reported
 * 4. Verify conflicting feature identified
 * 5. Non-conflicting archetypes -> no conflict
 * 6. Conflict between replaces and modifies on same feature detected
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

console.log('\n=== Feature #29: Detect feature conflicts between two archetypes ===\n');

// =====================================================
// Test Data: Two archetypes that BOTH replace Bravery
// =====================================================

// Archetype A: Two-Handed Fighter (replaces Bravery with Shattering Strike)
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

// Archetype B: Bravery-replacing archetype (also replaces Bravery)
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

// Archetype C: Non-conflicting (replaces Weapon Training features only)
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

// Archetype D: Modifies Bravery (instead of replacing)
const archetypeD = {
  name: 'Bravery Modifier',
  slug: 'bravery-modifier',
  features: [
    {
      name: 'Enhanced Bravery',
      level: 2,
      type: 'modification',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    }
  ]
};

// Archetype E: Only additive features (no conflicts possible)
const archetypeE = {
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
    },
    {
      name: 'Greater Combat Feat',
      level: 5,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Two archetypes both replacing 'Bravery'
// =====================================================
console.log('--- Step 1: Two archetypes both replacing "Bravery" ---');

test('Both archetypeA and archetypeB target Bravery', () => {
  const aTargetsBravery = archetypeA.features.some(
    f => f.target && CompendiumParser.normalizeName(f.target) === 'bravery'
  );
  const bTargetsBravery = archetypeB.features.some(
    f => f.target && CompendiumParser.normalizeName(f.target) === 'bravery'
  );
  assert(aTargetsBravery, 'Archetype A should target Bravery');
  assert(bTargetsBravery, 'Archetype B should target Bravery');
});

// =====================================================
// Step 2: Run conflict detection
// =====================================================
console.log('\n--- Step 2: Run conflict detection ---');

test('DiffEngine.detectConflicts finds conflicts between A and B', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeB);
  assertGreaterThan(conflicts.length, 0, 'Should detect at least one conflict');
});

test('ConflictChecker.checkAgainstApplied finds conflicts', () => {
  const conflicts = ConflictChecker.checkAgainstApplied(archetypeB, [archetypeA]);
  assertGreaterThan(conflicts.length, 0, 'Should detect conflict via ConflictChecker');
});

// =====================================================
// Step 3: Verify conflict detected and reported
// =====================================================
console.log('\n--- Step 3: Verify conflict detected and reported ---');

test('Conflict object has correct structure', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeB);
  const conflict = conflicts[0];

  assert('featureName' in conflict, 'Conflict should have featureName');
  assert('archetypeA' in conflict, 'Conflict should have archetypeA name');
  assert('featureA' in conflict, 'Conflict should have featureA name');
  assert('archetypeB' in conflict, 'Conflict should have archetypeB name');
  assert('featureB' in conflict, 'Conflict should have featureB name');
});

test('Conflict reports correct archetype names', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeB);
  const conflict = conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assert(conflict, 'Should find Bravery conflict');
  assertEqual(conflict.archetypeA, 'Two-Handed Fighter', 'Should name archetype A');
  assertEqual(conflict.archetypeB, 'Unbreakable', 'Should name archetype B');
});

test('Conflict count is correct (only Bravery conflicts)', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeB);
  // A replaces Bravery + Armor Training 1
  // B replaces Bravery + Weapon Training 1
  // Only Bravery conflicts
  assertEqual(conflicts.length, 1, 'Should have exactly 1 conflict (Bravery only)');
});

// =====================================================
// Step 4: Verify conflicting feature identified
// =====================================================
console.log('\n--- Step 4: Verify conflicting feature identified ---');

test('Conflict identifies Bravery as the conflicting feature', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeB);
  const braveryConflict = conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assert(braveryConflict, 'Should identify Bravery as conflicting feature');
});

test('Conflict identifies correct feature names from each archetype', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeB);
  const braveryConflict = conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assertEqual(braveryConflict.featureA, 'Shattering Strike',
    'Archetype A feature should be Shattering Strike');
  assertEqual(braveryConflict.featureB, 'Heroic Defiance',
    'Archetype B feature should be Heroic Defiance');
});

test('validateStack reports invalid for conflicting archetypes', () => {
  const result = DiffEngine.validateStack([archetypeA, archetypeB]);
  assertEqual(result.valid, false, 'Stack with conflicts should be invalid');
  assertGreaterThan(result.conflicts.length, 0, 'Should have conflicts array');
});

// =====================================================
// Step 5: Non-conflicting archetypes -> no conflict
// =====================================================
console.log('\n--- Step 5: Non-conflicting archetypes -> no conflict ---');

test('No conflict between A (Bravery+ArmorTraining) and C (WeaponTraining)', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeC);
  assertEqual(conflicts.length, 0, 'Should have no conflicts between A and C');
});

test('validateStack reports valid for non-conflicting archetypes', () => {
  const result = DiffEngine.validateStack([archetypeA, archetypeC]);
  assertEqual(result.valid, true, 'Stack without conflicts should be valid');
  assertEqual(result.conflicts.length, 0, 'Should have empty conflicts array');
});

test('No conflict between additive archetype and any other', () => {
  const conflictsAE = DiffEngine.detectConflicts(archetypeA, archetypeE);
  assertEqual(conflictsAE.length, 0, 'Additive archetype should not conflict with A');

  const conflictsBE = DiffEngine.detectConflicts(archetypeB, archetypeE);
  assertEqual(conflictsBE.length, 0, 'Additive archetype should not conflict with B');
});

test('No conflict between two purely additive archetypes', () => {
  const archetypeF = {
    name: 'More Extra Feats',
    features: [
      { name: 'Feat X', type: 'additive', target: null },
      { name: 'Feat Y', type: 'additive', target: null }
    ]
  };
  const conflicts = DiffEngine.detectConflicts(archetypeE, archetypeF);
  assertEqual(conflicts.length, 0, 'Two additive archetypes should never conflict');
});

test('CheckAgainstApplied with empty applied list returns no conflicts', () => {
  const conflicts = ConflictChecker.checkAgainstApplied(archetypeA, []);
  assertEqual(conflicts.length, 0, 'No conflicts with empty applied list');
});

// =====================================================
// Step 6: Conflict between replaces and modifies on same feature
// =====================================================
console.log('\n--- Step 6: Conflict between replaces and modifies on same feature ---');

test('Conflict detected between replace and modify on Bravery', () => {
  // archetypeA replaces Bravery, archetypeD modifies Bravery
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeD);
  assertEqual(conflicts.length, 1, 'Should detect conflict between replace and modify');
});

test('Replace-modify conflict identifies correct features', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeD);
  const conflict = conflicts[0];
  assertEqual(conflict.featureA, 'Shattering Strike',
    'Replace feature should be Shattering Strike');
  assertEqual(conflict.featureB, 'Enhanced Bravery',
    'Modify feature should be Enhanced Bravery');
});

test('Replace-modify conflict identifies Bravery as target', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeD);
  const conflict = conflicts[0];
  assert(
    CompendiumParser.normalizeName(conflict.featureName) === 'bravery',
    `Feature name "${conflict.featureName}" should normalize to "bravery"`
  );
});

test('Modify-replace conflict is symmetric', () => {
  // Order shouldn't matter - conflict should be detected either way
  const conflictsAD = DiffEngine.detectConflicts(archetypeA, archetypeD);
  const conflictsDA = DiffEngine.detectConflicts(archetypeD, archetypeA);
  assertEqual(conflictsAD.length, conflictsDA.length,
    'Conflict count should be same regardless of order');
  assertGreaterThan(conflictsAD.length, 0, 'Should detect conflict A->D');
  assertGreaterThan(conflictsDA.length, 0, 'Should detect conflict D->A');
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

test('Multi-archetype stack validation with 3+ archetypes', () => {
  // A conflicts with B (Bravery), B conflicts with C (Weapon Training)
  const result = DiffEngine.validateStack([archetypeA, archetypeB, archetypeC]);
  assertEqual(result.valid, false, 'Stack with any conflict should be invalid');
  // A-B: Bravery conflict (1)
  // A-C: no overlap (A targets Bravery + Armor Training, C targets Weapon Training) (0)
  // B-C: "Weapon Training 1" normalizes to "weapon training", matching both C features
  //       Heroic Recovery (WT1) vs Weapon Guard (WT1) = 1 conflict
  //       Heroic Recovery (WT1) vs Reliable Strike (WT2) = 1 conflict (both normalize to "weapon training")
  // Total: 3 conflicts
  assertGreaterThan(result.conflicts.length, 0, 'Should find conflicts');
  assertEqual(result.valid, false, 'Should be invalid with conflicts');
});

test('Empty archetype features -> no conflicts', () => {
  const emptyArchetype = { name: 'Empty', features: [] };
  const conflicts = DiffEngine.detectConflicts(archetypeA, emptyArchetype);
  assertEqual(conflicts.length, 0, 'Empty features should not conflict');
});

test('Same archetype against itself -> detects self-conflicts', () => {
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeA);
  // Both features have targets, so they should match against each other
  assertEqual(conflicts.length, 2,
    'Self-conflict should detect all features with targets');
});

test('validateStack with single archetype is always valid', () => {
  const result = DiffEngine.validateStack([archetypeA]);
  assertEqual(result.valid, true, 'Single archetype should always be valid');
  assertEqual(result.conflicts.length, 0, 'No conflicts with single archetype');
});

test('validateStack with empty array is valid', () => {
  const result = DiffEngine.validateStack([]);
  assertEqual(result.valid, true, 'Empty stack should be valid');
  assertEqual(result.conflicts.length, 0, 'No conflicts with empty stack');
});

test('Case-insensitive conflict detection via normalizeName', () => {
  // Create archetype with different casing for target
  const archetypeUpperCase = {
    name: 'Uppercase Target',
    features: [
      {
        name: 'UPPER REPLACE',
        type: 'replacement',
        target: 'BRAVERY',
        source: 'auto-parse'
      }
    ]
  };
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeUpperCase);
  assertEqual(conflicts.length, 1,
    'Should detect conflict regardless of target casing');
});

test('Conflict detection with tier numbers in targets', () => {
  // A replaces "Armor Training 1", this replaces "Armor Training 1" too
  const archetypeSameTier = {
    name: 'Same Tier',
    features: [
      {
        name: 'Other AT1 Replacement',
        type: 'replacement',
        target: 'Armor Training 1',
        source: 'auto-parse'
      }
    ]
  };
  const conflicts = DiffEngine.detectConflicts(archetypeA, archetypeSameTier);
  assertEqual(conflicts.length, 1,
    'Should detect conflict when same tier is targeted');
});

test('ConflictChecker.checkAgainstApplied with multiple applied archetypes', () => {
  // Check new archetype B against [A, C] already applied
  const conflicts = ConflictChecker.checkAgainstApplied(archetypeB, [archetypeA, archetypeC]);
  // B vs A: Bravery conflict (1)
  // B vs C: "Weapon Training 1" normalizes to "weapon training",
  //         matches both C's WT1 and WT2 (both normalize to "weapon training")
  // Total: 3 conflicts
  assertGreaterThan(conflicts.length, 1, 'Should find conflicts against multiple applied archetypes');
  // Verify both archetype names appear in conflicts
  const archetypeNames = new Set(conflicts.map(c => c.archetypeB));
  assert(archetypeNames.has('Two-Handed Fighter'), 'Should have conflict with Two-Handed Fighter');
  assert(archetypeNames.has('Weapon Master'), 'Should have conflict with Weapon Master');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #29 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #29 tests passed!\n');
  process.exit(0);
}
