/**
 * Test Suite for Feature #31: Multi-archetype stacking validation
 *
 * Verifies:
 * 1. Non-conflicting A+B -> passes
 * 2. Add C conflicting with B -> fails, B-C identified
 * 3. Remove C, add non-conflicting D -> A+B+D passes
 * 4. Cumulative replacement tracked correctly
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

console.log('\n=== Feature #31: Multi-archetype stacking validation ===\n');

// =====================================================
// Test Data Setup
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

// Archetype B: Custom archetype (replaces Weapon Training 1 + Weapon Training 2)
// No conflict with A (A targets Bravery+AT, B targets WT)
const archetypeB = {
  name: 'Weapon Specialist',
  slug: 'weapon-specialist',
  features: [
    {
      name: 'Focused Weapon',
      level: 5,
      type: 'replacement',
      target: 'Weapon Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    },
    {
      name: 'Greater Focus',
      level: 9,
      type: 'replacement',
      target: 'Weapon Training 2',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
      source: 'auto-parse'
    }
  ]
};

// Archetype C: Conflicts with B (replaces Weapon Training 1)
const archetypeC = {
  name: 'Weapon Guard',
  slug: 'weapon-guard',
  features: [
    {
      name: 'Shielded Weapon',
      level: 5,
      type: 'replacement',
      target: 'Weapon Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    },
    {
      name: 'Iron Will',
      level: 7,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    }
  ]
};

// Archetype D: Non-conflicting with A or B (replaces Armor Mastery + Weapon Mastery)
const archetypeD = {
  name: 'Master at Arms',
  slug: 'master-at-arms',
  features: [
    {
      name: 'Perfect Armor',
      level: 19,
      type: 'replacement',
      target: 'Armor Mastery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      source: 'auto-parse'
    },
    {
      name: 'Perfect Weapon',
      level: 20,
      type: 'replacement',
      target: 'Weapon Mastery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponMastery', level: 20 },
      source: 'auto-parse'
    }
  ]
};

// Archetype E: Conflicts with A (also replaces Bravery)
const archetypeE = {
  name: 'Fearless Warrior',
  slug: 'fearless-warrior',
  features: [
    {
      name: 'Unflinching',
      level: 2,
      type: 'replacement',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    }
  ]
};

// Archetype F: Purely additive (no conflicts possible)
const archetypeF = {
  name: 'Bonus Training',
  slug: 'bonus-training',
  features: [
    {
      name: 'Extra Combat Training',
      level: 1,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    },
    {
      name: 'Advanced Maneuvers',
      level: 10,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Non-conflicting A+B -> passes
// =====================================================
console.log('--- Step 1: Non-conflicting A+B -> passes ---');

test('A+B stack validates as valid', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB]);
  assertEqual(result.valid, true, 'A+B should be valid stack');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
});

test('DiffEngine.validateStack also passes for A+B', () => {
  const result = DiffEngine.validateStack([archetypeA, archetypeB]);
  assertEqual(result.valid, true, 'DiffEngine agrees A+B is valid');
});

test('validateAddToStack: adding B to [A] succeeds', () => {
  const result = ConflictChecker.validateAddToStack(archetypeB, [archetypeA]);
  assertEqual(result.valid, true, 'Adding B to stack of A should pass');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
});

test('validateAddToStack: adding A to [B] succeeds (order independent)', () => {
  const result = ConflictChecker.validateAddToStack(archetypeA, [archetypeB]);
  assertEqual(result.valid, true, 'Adding A to stack of B should pass');
});

test('A+B cumulative shows all replaced features', () => {
  const result = ConflictChecker.validateAddToStack(archetypeB, [archetypeA]);
  const cumul = result.cumulative;
  assertEqual(cumul.totalReplaced, 4, 'A replaces 2, B replaces 2 = 4 total');
  assert(cumul.replacements.has('bravery'), 'Bravery should be tracked');
  assert(cumul.replacements.has('armor training'), 'Armor Training should be tracked');
  assert(cumul.replacements.has('weapon training'), 'Weapon Training should be tracked');
});

// =====================================================
// Step 2: Add C conflicting with B -> fails, B-C identified
// =====================================================
console.log('\n--- Step 2: Add C conflicting with B -> fails, B-C identified ---');

test('A+B+C stack validates as invalid', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB, archetypeC]);
  assertEqual(result.valid, false, 'A+B+C should be invalid (B-C conflict)');
  assertGreaterThan(result.conflicts.length, 0, 'Should have conflicts');
});

test('validateAddToStack: adding C to [A,B] fails', () => {
  const result = ConflictChecker.validateAddToStack(archetypeC, [archetypeA, archetypeB]);
  assertEqual(result.valid, false, 'Adding C to [A,B] should fail');
  assertGreaterThan(result.conflicts.length, 0, 'Should have conflicts');
});

test('B-C conflict identified by feature name', () => {
  const result = ConflictChecker.validateAddToStack(archetypeC, [archetypeA, archetypeB]);
  // B replaces WT1, C replaces WT1 -> conflict on weapon training
  const wtConflict = result.conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'weapon training'
  );
  assert(wtConflict, 'Should find Weapon Training 1 conflict');
});

test('B-C conflict pair identified', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB, archetypeC]);
  // Should identify that B and C conflict
  const hasBCPair = result.conflictPairs.some(pair =>
    (pair.includes('Weapon Specialist') && pair.includes('Weapon Guard'))
  );
  assert(hasBCPair, 'Should identify B-C as a conflict pair');
});

test('A-C has no conflict (different targets)', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeC]);
  assertEqual(result.valid, true, 'A+C should be valid (different feature targets)');
});

test('checkCanApply: C blocked by B but not A', () => {
  // When A and B are applied, C should show conflicts only with B
  const result = ConflictChecker.checkCanApply(archetypeC, [archetypeA, archetypeB]);
  assertEqual(result.canApply, false, 'C should be blocked');
  // Check that conflicts only involve B, not A
  const conflictsWithA = result.conflicts.filter(c =>
    c.archetypeA === 'Two-Handed Fighter' || c.archetypeB === 'Two-Handed Fighter'
  );
  const conflictsWithB = result.conflicts.filter(c =>
    c.archetypeA === 'Weapon Specialist' || c.archetypeB === 'Weapon Specialist'
  );
  assertEqual(conflictsWithA.length, 0, 'Should have no conflicts with A');
  assertGreaterThan(conflictsWithB.length, 0, 'Should have conflicts with B');
});

// =====================================================
// Step 3: Remove C, add non-conflicting D -> A+B+D passes
// =====================================================
console.log('\n--- Step 3: Remove C, add non-conflicting D -> A+B+D passes ---');

test('validateRemoveFromStack: removing C from [A,B,C] leaves valid [A,B]', () => {
  const result = ConflictChecker.validateRemoveFromStack('weapon-guard', [archetypeA, archetypeB, archetypeC]);
  assertEqual(result.valid, true, 'Remaining [A,B] should be valid');
  assertEqual(result.remainingStack.length, 2, 'Should have 2 remaining archetypes');
  assert(!result.remainingStack.some(a => a.slug === 'weapon-guard'), 'C should be removed');
});

test('validateAddToStack: adding D to [A,B] succeeds', () => {
  const result = ConflictChecker.validateAddToStack(archetypeD, [archetypeA, archetypeB]);
  assertEqual(result.valid, true, 'Adding D to [A,B] should pass');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
});

test('A+B+D validates as valid', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB, archetypeD]);
  assertEqual(result.valid, true, 'A+B+D should be valid stack');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
});

test('A+B+D cumulative replacements correct', () => {
  const result = ConflictChecker.validateAddToStack(archetypeD, [archetypeA, archetypeB]);
  const cumul = result.cumulative;
  // A replaces Bravery + AT1 (2)
  // B replaces WT1 + WT2 (2)
  // D replaces Armor Mastery + Weapon Mastery (2)
  // Total: 6
  assertEqual(cumul.totalReplaced, 6, 'Should have 6 total replacements');
  assert(cumul.replacements.has('bravery'), 'Bravery tracked');
  assert(cumul.replacements.has('armor training'), 'Armor Training tracked');
  assert(cumul.replacements.has('weapon training'), 'Weapon Training tracked');
  assert(cumul.replacements.has('armor mastery'), 'Armor Mastery tracked');
  assert(cumul.replacements.has('weapon mastery'), 'Weapon Mastery tracked');
});

// =====================================================
// Step 4: Cumulative replacement tracked correctly
// =====================================================
console.log('\n--- Step 4: Cumulative replacement tracked correctly ---');

test('getCumulativeReplacements for single archetype', () => {
  const result = ConflictChecker.getCumulativeReplacements([archetypeA]);
  assertEqual(result.totalReplaced, 2, 'A has 2 replacements');
  assert(result.replacements.has('bravery'), 'Should track Bravery');
  assert(result.replacements.has('armor training'), 'Should track Armor Training');
});

test('getCumulativeReplacements shows which archetype replaces each feature', () => {
  const result = ConflictChecker.getCumulativeReplacements([archetypeA, archetypeB]);
  const braveryEntries = result.replacements.get('bravery');
  assertEqual(braveryEntries.length, 1, 'Only A replaces Bravery');
  assertEqual(braveryEntries[0].archetypeName, 'Two-Handed Fighter', 'A replaces Bravery');
  assertEqual(braveryEntries[0].featureName, 'Shattering Strike', 'Via Shattering Strike');
});

test('getCumulativeReplacements with empty array', () => {
  const result = ConflictChecker.getCumulativeReplacements([]);
  assertEqual(result.totalReplaced, 0, 'Empty stack = 0 replacements');
  assertEqual(result.replacements.size, 0, 'Empty replacement map');
});

test('getCumulativeReplacements includes additive features (no targets)', () => {
  const result = ConflictChecker.getCumulativeReplacements([archetypeF]);
  assertEqual(result.totalReplaced, 0, 'Additive features have no targets');
  assertEqual(result.replacements.size, 0, 'No replacements tracked');
});

test('getCumulativeReplacements with modification type', () => {
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
  const result = ConflictChecker.getCumulativeReplacements([modArchetype]);
  assertEqual(result.totalReplaced, 1, 'Modification counts as a replacement');
  const braveryEntries = result.replacements.get('bravery');
  assertEqual(braveryEntries[0].type, 'modification', 'Type should be modification');
});

test('getCumulativeReplacements detects double-replacement (conflict indicator)', () => {
  // Two archetypes both replacing Bravery should show up as 2 entries
  const result = ConflictChecker.getCumulativeReplacements([archetypeA, archetypeE]);
  const braveryEntries = result.replacements.get('bravery');
  assertEqual(braveryEntries.length, 2, 'Two archetypes replacing same feature');
  const names = braveryEntries.map(e => e.archetypeName);
  assert(names.includes('Two-Handed Fighter'), 'Should include A');
  assert(names.includes('Fearless Warrior'), 'Should include E');
});

// =====================================================
// Step 5: Complex stacking scenarios
// =====================================================
console.log('\n--- Step 5: Complex stacking scenarios ---');

test('Four non-conflicting archetypes stack validly', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB, archetypeD, archetypeF]);
  assertEqual(result.valid, true, 'A+B+D+F should all stack');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
});

test('Four archetypes cumulative replacements correct', () => {
  const cumul = ConflictChecker.getCumulativeReplacements([archetypeA, archetypeB, archetypeD, archetypeF]);
  // A: 2, B: 2, D: 2, F: 0 = 6
  assertEqual(cumul.totalReplaced, 6, 'Should have 6 total');
});

test('Adding E (conflicts with A) to [A,B,D] fails', () => {
  const result = ConflictChecker.validateAddToStack(archetypeE, [archetypeA, archetypeB, archetypeD]);
  assertEqual(result.valid, false, 'E conflicts with A over Bravery');
  const bravConflict = result.conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assert(bravConflict, 'Bravery conflict detected');
});

test('Removing A from [A,B,D,E-invalid] allows E to join [B,D]', () => {
  // After removing A, stack is [B,D] and E should pass
  const result = ConflictChecker.validateAddToStack(archetypeE, [archetypeB, archetypeD]);
  assertEqual(result.valid, true, 'E should pass against [B,D] (no Bravery conflict)');
});

test('validateRemoveFromStack tracks cumulative correctly after removal', () => {
  const result = ConflictChecker.validateRemoveFromStack('two-handed-fighter', [archetypeA, archetypeB, archetypeD]);
  assertEqual(result.remainingStack.length, 2, 'Should have 2 remaining');
  // After removing A: B replaces WT1+WT2, D replaces AM+WM = 4
  assertEqual(result.cumulative.totalReplaced, 4, 'Should have 4 replacements after removing A');
  assert(!result.cumulative.replacements.has('bravery'), 'Bravery no longer tracked');
  assert(!result.cumulative.replacements.has('armor training'), 'Armor Training no longer tracked');
});

// =====================================================
// Step 6: Incremental stacking (build up one at a time)
// =====================================================
console.log('\n--- Step 6: Incremental stacking simulation ---');

test('Step-by-step stacking: start empty, add A', () => {
  const result = ConflictChecker.validateAddToStack(archetypeA, []);
  assertEqual(result.valid, true, 'First archetype always valid');
  assertEqual(result.cumulative.totalReplaced, 2, 'A has 2 replacements');
});

test('Step-by-step stacking: add B to [A]', () => {
  const result = ConflictChecker.validateAddToStack(archetypeB, [archetypeA]);
  assertEqual(result.valid, true, 'B non-conflicting with A');
  assertEqual(result.cumulative.totalReplaced, 4, 'A+B = 4 replacements');
});

test('Step-by-step stacking: add D to [A,B]', () => {
  const result = ConflictChecker.validateAddToStack(archetypeD, [archetypeA, archetypeB]);
  assertEqual(result.valid, true, 'D non-conflicting with A or B');
  assertEqual(result.cumulative.totalReplaced, 6, 'A+B+D = 6 replacements');
});

test('Step-by-step stacking: add F (additive) to [A,B,D]', () => {
  const result = ConflictChecker.validateAddToStack(archetypeF, [archetypeA, archetypeB, archetypeD]);
  assertEqual(result.valid, true, 'Additive archetype always valid');
  assertEqual(result.cumulative.totalReplaced, 6, 'Still 6 (F is additive)');
});

test('Step-by-step stacking: try to add C to [A,B,D,F] -> fails', () => {
  const result = ConflictChecker.validateAddToStack(archetypeC, [archetypeA, archetypeB, archetypeD, archetypeF]);
  assertEqual(result.valid, false, 'C conflicts with B over WT1');
});

test('Step-by-step stacking: try to add E to [A,B,D,F] -> fails', () => {
  const result = ConflictChecker.validateAddToStack(archetypeE, [archetypeA, archetypeB, archetypeD, archetypeF]);
  assertEqual(result.valid, false, 'E conflicts with A over Bravery');
});

// =====================================================
// Step 7: Removal and restacking
// =====================================================
console.log('\n--- Step 7: Removal and restacking ---');

test('Remove B from [A,B,D] -> [A,D] still valid', () => {
  const result = ConflictChecker.validateRemoveFromStack('weapon-specialist', [archetypeA, archetypeB, archetypeD]);
  assertEqual(result.valid, true, '[A,D] should be valid');
  assertEqual(result.remainingStack.length, 2, 'Two remaining');
});

test('After removing B, can add C to [A,D]', () => {
  const result = ConflictChecker.validateAddToStack(archetypeC, [archetypeA, archetypeD]);
  assertEqual(result.valid, true, 'C non-conflicting with A or D');
  assertEqual(result.cumulative.totalReplaced, 5, 'A(2)+D(2)+C(1 replacement + 1 additive=1)=5');
});

test('After removing A, can add E to [B,D]', () => {
  const removeResult = ConflictChecker.validateRemoveFromStack('two-handed-fighter', [archetypeA, archetypeB, archetypeD]);
  assertEqual(removeResult.valid, true, '[B,D] valid');

  const addResult = ConflictChecker.validateAddToStack(archetypeE, removeResult.remainingStack);
  assertEqual(addResult.valid, true, 'E should pass against [B,D]');
  assertEqual(addResult.cumulative.totalReplaced, 5, 'B(2)+D(2)+E(1)=5');
});

// =====================================================
// Step 8: Edge cases
// =====================================================
console.log('\n--- Step 8: Edge cases ---');

test('validateStacking with duplicate archetype detects self-conflict', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeA]);
  assertEqual(result.valid, false, 'Duplicate should conflict with itself');
});

test('getCumulativeReplacements with archetype having features without targets', () => {
  // F is purely additive - no features have targets
  const result = ConflictChecker.getCumulativeReplacements([archetypeA, archetypeF]);
  assertEqual(result.totalReplaced, 2, 'Only A contributes replacements');
});

test('validateRemoveFromStack with non-existent slug returns full stack', () => {
  const result = ConflictChecker.validateRemoveFromStack('nonexistent', [archetypeA, archetypeB]);
  assertEqual(result.remainingStack.length, 2, 'Nothing removed');
  assertEqual(result.valid, true, 'Stack still valid');
});

test('Large stack validation (5 non-conflicting archetypes)', () => {
  // Create archetypes that all target unique features
  const arch1 = { name: 'Arch1', slug: 'arch1', features: [{ name: 'F1', type: 'replacement', target: 'Feature A', source: 'auto-parse' }] };
  const arch2 = { name: 'Arch2', slug: 'arch2', features: [{ name: 'F2', type: 'replacement', target: 'Feature B', source: 'auto-parse' }] };
  const arch3 = { name: 'Arch3', slug: 'arch3', features: [{ name: 'F3', type: 'replacement', target: 'Feature C', source: 'auto-parse' }] };
  const arch4 = { name: 'Arch4', slug: 'arch4', features: [{ name: 'F4', type: 'replacement', target: 'Feature D', source: 'auto-parse' }] };
  const arch5 = { name: 'Arch5', slug: 'arch5', features: [{ name: 'F5', type: 'replacement', target: 'Feature E', source: 'auto-parse' }] };

  const result = ConflictChecker.validateStacking([arch1, arch2, arch3, arch4, arch5]);
  assertEqual(result.valid, true, '5 non-conflicting should all stack');
  assertEqual(result.conflicts.length, 0, 'No conflicts');
  assertEqual(result.conflictPairs.length, 0, 'No pairs');
});

test('Cumulative replacement preserves original target name', () => {
  const result = ConflictChecker.getCumulativeReplacements([archetypeA]);
  const bravEntries = result.replacements.get('bravery');
  assertEqual(bravEntries[0].target, 'Bravery', 'Should preserve original casing');
  assertEqual(bravEntries[0].featureName, 'Shattering Strike', 'Feature name preserved');
  assertEqual(bravEntries[0].type, 'replacement', 'Type preserved');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #31 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #31 tests passed!\n');
  process.exit(0);
}
