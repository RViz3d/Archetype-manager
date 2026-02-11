/**
 * Test Suite for Feature #40: Tracking flags written on application
 *
 * Verifies that Applicator.apply() correctly writes tracking flags on both
 * the class item and the actor after archetype application.
 *
 * Steps:
 * 1. Apply archetype
 * 2. Verify classItem archetypes flag has slug
 * 3. Verify appliedAt flag has timestamp
 * 4. Verify actor appliedArchetypes flag correct
 * 5. Apply second -> both slugs present
 * 6. Verify flags readable
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

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

// Set up environment
setupMockEnvironment();

// UUID resolution map - includes both base class features and archetype features
var uuidMap = {
  // Base Fighter class features
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
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' },
  // Two-Handed Fighter archetype features
  'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike': { name: 'Shattering Strike' },
  'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop': { name: 'Overhand Chop' },
  'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining': { name: 'Weapon Training (Two-Handed Fighter)' },
  'Compendium.pf1e-archetypes.pf-arch-features.Backswing': { name: 'Backswing' },
  'Compendium.pf1e-archetypes.pf-arch-features.Piledriver': { name: 'Piledriver' },
  'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack': { name: 'Greater Power Attack' },
  'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow': { name: 'Devastating Blow' },
  // Weapon Master archetype features (second archetype for stacking test)
  'Compendium.pf1e-archetypes.pf-arch-features.WeaponGuard': { name: 'Weapon Guard' },
  'Compendium.pf1e-archetypes.pf-arch-features.ReliableStrike': { name: 'Reliable Strike' },
  'Compendium.pf1e-archetypes.pf-arch-features.MirrorMove': { name: 'Mirror Move' },
  'Compendium.pf1e-archetypes.pf-arch-features.DeadlyC': { name: 'Deadly Critical' },
  'Compendium.pf1e-archetypes.pf-arch-features.CritSpec': { name: 'Critical Specialist' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

var { Applicator } = await import('../scripts/applicator.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #40: Tracking flags written on application ===\n');

// =====================================================
// Fighter base classAssociations
// =====================================================
var fighterClassAssociations = [
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

// Resolve associations
var resolvedFighterAssociations;
await asyncTest('Resolve Fighter classAssociations', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
});

// Two-Handed Fighter archetype definition
var twoHandedFighterParsed = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'Fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike',
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop',
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'modification',
      target: 'weapon training 1',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining',
      source: 'auto-parse'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'armor training 2',
      matchedAssociation: resolvedFighterAssociations?.[4] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Backswing',
      source: 'auto-parse'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'armor training 3',
      matchedAssociation: resolvedFighterAssociations?.[6] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Piledriver',
      source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'armor training 4',
      matchedAssociation: resolvedFighterAssociations?.[8] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack',
      source: 'auto-parse'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'armor mastery',
      matchedAssociation: resolvedFighterAssociations?.[10] || { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow',
      source: 'auto-parse'
    }
  ]
};

// Weapon Master archetype (different features, no AT conflict - replaces Bravery only, plus modifies WT)
// This is a simplified archetype for stacking testing
var weaponMasterParsed = {
  name: 'Weapon Master',
  slug: 'weapon-master',
  class: 'Fighter',
  features: [
    {
      name: 'Weapon Guard',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.WeaponGuard',
      source: 'auto-parse'
    },
    {
      name: 'Reliable Strike',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ReliableStrike',
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Apply archetype - verify tracking flags
// =====================================================
console.log('--- Step 1: Apply archetype and verify tracking flags ---');

var classItem1 = createMockClassItem('Fighter', 10, 'fighter');
classItem1.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actor1 = createMockActor('Test Fighter 1', [classItem1]);
actor1.isOwner = true;

var diff1;
test('Generate diff for Two-Handed Fighter', () => {
  diff1 = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  assert(Array.isArray(diff1), 'Diff should be an array');
  assert(diff1.length > 0, 'Diff should not be empty');
});

var applyResult1;
await asyncTest('Apply Two-Handed Fighter succeeds', async () => {
  applyResult1 = await Applicator.apply(actor1, classItem1, twoHandedFighterParsed, diff1);
  assertEqual(applyResult1, true, 'Apply should return true');
});

// =====================================================
// Step 2: Verify classItem archetypes flag has slug
// =====================================================
console.log('\n--- Step 2: Verify classItem archetypes flag has slug ---');

test('classItem archetypes flag exists', () => {
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'archetypes flag should not be null');
});

test('classItem archetypes flag is an array', () => {
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(archetypes), 'archetypes flag should be an array');
});

test('classItem archetypes flag has one entry', () => {
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 1, 'Should have exactly one archetype');
});

test('classItem archetypes flag contains the correct slug', () => {
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Should be two-handed-fighter slug');
});

test('classItem archetypes flag slug matches parsedArchetype.slug', () => {
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes[0], twoHandedFighterParsed.slug, 'Slug should match parsed archetype');
});

// =====================================================
// Step 3: Verify appliedAt flag has timestamp
// =====================================================
console.log('\n--- Step 3: Verify appliedAt flag has timestamp ---');

test('appliedAt flag exists', () => {
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'appliedAt flag should not be null');
});

test('appliedAt flag is a string', () => {
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  assertEqual(typeof appliedAt, 'string', 'appliedAt should be a string');
});

test('appliedAt flag is a valid ISO 8601 timestamp', () => {
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  var parsed = new Date(appliedAt);
  assert(!isNaN(parsed.getTime()), 'appliedAt should be a valid date');
});

test('appliedAt timestamp is recent (within last 10 seconds)', () => {
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  var parsed = new Date(appliedAt);
  var now = new Date();
  var diffMs = now - parsed;
  assert(diffMs >= 0 && diffMs < 10000, `appliedAt should be recent, diff was ${diffMs}ms`);
});

test('appliedAt timestamp includes date and time components', () => {
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  assert(appliedAt.includes('T'), 'ISO format should include T separator');
  assert(appliedAt.includes(':'), 'ISO format should include time with colons');
});

// =====================================================
// Step 4: Verify actor appliedArchetypes flag correct
// =====================================================
console.log('\n--- Step 4: Verify actor appliedArchetypes flag ---');

test('actor appliedArchetypes flag exists', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'appliedArchetypes flag should not be null');
});

test('actor appliedArchetypes flag is an object', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(typeof actorFlags, 'object', 'Should be an object');
  assert(!Array.isArray(actorFlags), 'Should not be an array');
});

test('actor appliedArchetypes has entry for fighter class tag', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags['fighter'], 'Should have fighter class tag entry');
});

test('actor appliedArchetypes fighter entry is an array', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assert(Array.isArray(actorFlags['fighter']), 'fighter entry should be an array');
});

test('actor appliedArchetypes fighter entry has one slug', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags['fighter'].length, 1, 'Should have exactly one slug');
});

test('actor appliedArchetypes fighter entry contains correct slug', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags['fighter'][0], 'two-handed-fighter', 'Should contain two-handed-fighter');
});

test('actor appliedArchetypes uses classItem.system.tag for class key', () => {
  // The class tag is 'fighter' from createMockClassItem('Fighter', 10, 'fighter')
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  var keys = Object.keys(actorFlags);
  assertEqual(keys.length, 1, 'Should have exactly one class key');
  assertEqual(keys[0], 'fighter', 'Key should be the class tag');
});

// =====================================================
// Step 5: Apply second archetype -> both slugs present
// =====================================================
console.log('\n--- Step 5: Apply second archetype -> both slugs present ---');

// We'll create a fresh setup for this test to apply two archetypes sequentially
var classItem2 = createMockClassItem('Fighter', 10, 'fighter');
classItem2.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actor2 = createMockActor('Test Fighter 2', [classItem2]);
actor2.isOwner = true;

// Apply first archetype
await asyncTest('Apply first archetype (Two-Handed Fighter) to second actor', async () => {
  var d = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actor2, classItem2, twoHandedFighterParsed, d);
  assertEqual(result, true, 'First apply should succeed');
});

// Capture timestamp of first application
var firstAppliedAt = classItem2.getFlag('archetype-manager', 'appliedAt');

// Apply second archetype - generate diff from current state
await asyncTest('Apply second archetype (Weapon Master) to same class item', async () => {
  var currentAssociations = classItem2.system.links.classAssociations;
  var d = DiffEngine.generateDiff(currentAssociations, weaponMasterParsed);
  var result = await Applicator.apply(actor2, classItem2, weaponMasterParsed, d);
  assertEqual(result, true, 'Second apply should succeed');
});

test('classItem archetypes flag has two entries after second apply', () => {
  var archetypes = classItem2.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 2, 'Should have exactly two archetypes');
});

test('classItem archetypes flag contains first slug', () => {
  var archetypes = classItem2.getFlag('archetype-manager', 'archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Should include two-handed-fighter');
});

test('classItem archetypes flag contains second slug', () => {
  var archetypes = classItem2.getFlag('archetype-manager', 'archetypes');
  assert(archetypes.includes('weapon-master'), 'Should include weapon-master');
});

test('classItem archetypes slugs are in application order', () => {
  var archetypes = classItem2.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes[0], 'two-handed-fighter', 'First applied should be first in array');
  assertEqual(archetypes[1], 'weapon-master', 'Second applied should be second in array');
});

test('actor appliedArchetypes fighter entry has two slugs', () => {
  var actorFlags = actor2.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags['fighter'].length, 2, 'Should have two slugs for fighter');
});

test('actor appliedArchetypes fighter entry contains both slugs', () => {
  var actorFlags = actor2.getFlag('archetype-manager', 'appliedArchetypes');
  assert(actorFlags['fighter'].includes('two-handed-fighter'), 'Should include two-handed-fighter');
  assert(actorFlags['fighter'].includes('weapon-master'), 'Should include weapon-master');
});

test('actor appliedArchetypes actor-level slugs match class-item-level', () => {
  var actorFlags = actor2.getFlag('archetype-manager', 'appliedArchetypes');
  var classFlags = classItem2.getFlag('archetype-manager', 'archetypes');
  assertDeepEqual(actorFlags['fighter'], classFlags, 'Actor flags should match class item flags');
});

test('appliedAt updated to second application timestamp', () => {
  var appliedAt = classItem2.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'appliedAt should still exist');
  // The appliedAt is overwritten on each apply, so it should be >= firstAppliedAt
  var second = new Date(appliedAt);
  var first = new Date(firstAppliedAt);
  assert(second >= first, 'Second appliedAt should be >= first appliedAt');
});

// =====================================================
// Step 6: Verify flags readable (re-read and verify)
// =====================================================
console.log('\n--- Step 6: Verify flags are readable ---');

test('classItem archetypes flag re-readable after application', () => {
  // Read again to verify consistency
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Should be readable');
  assertEqual(archetypes.length, 1, 'Should still have one entry');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Should still contain correct slug');
});

test('classItem appliedAt flag re-readable after application', () => {
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'Should be readable');
  var parsed = new Date(appliedAt);
  assert(!isNaN(parsed.getTime()), 'Should still be valid date');
});

test('actor appliedArchetypes flag re-readable after application', () => {
  var actorFlags = actor1.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Should be readable');
  assertNotNull(actorFlags['fighter'], 'Should have fighter entry');
  assertEqual(actorFlags['fighter'].length, 1, 'Should still have one slug');
});

test('All three flags readable simultaneously from classItem', () => {
  var archetypes = classItem1.getFlag('archetype-manager', 'archetypes');
  var appliedAt = classItem1.getFlag('archetype-manager', 'appliedAt');
  var originalAssociations = classItem1.getFlag('archetype-manager', 'originalAssociations');

  assertNotNull(archetypes, 'archetypes should be readable');
  assertNotNull(appliedAt, 'appliedAt should be readable');
  assertNotNull(originalAssociations, 'originalAssociations should be readable');
});

// =====================================================
// Additional tests: Edge cases and robustness
// =====================================================
console.log('\n--- Additional: Edge cases and robustness ---');

test('classItem flags scoped to archetype-manager module', () => {
  // Verify flags are under the correct module scope
  assert(classItem1.flags['archetype-manager'] !== undefined, 'Should have archetype-manager scope');
  assert(classItem1.flags['archetype-manager']['archetypes'] !== undefined, 'Should have archetypes in scope');
  assert(classItem1.flags['archetype-manager']['appliedAt'] !== undefined, 'Should have appliedAt in scope');
});

test('actor flags scoped to archetype-manager module', () => {
  assert(actor1.flags['archetype-manager'] !== undefined, 'Should have archetype-manager scope');
  assert(actor1.flags['archetype-manager']['appliedArchetypes'] !== undefined, 'Should have appliedArchetypes in scope');
});

// Test with a different class (Rogue) to verify class tag isolation
console.log('\n--- Additional: Multi-class actor flags ---');

var rogueClassItem = createMockClassItem('Rogue', 5, 'rogue');
rogueClassItem.system.links.classAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
  { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1, resolvedName: 'Trapfinding' },
  { uuid: 'Compendium.pf1.class-abilities.Evasion', level: 2, resolvedName: 'Evasion' }
];

var multiClassActor = createMockActor('Multi-Class Hero', [classItem1, rogueClassItem]);
multiClassActor.isOwner = true;

// First apply fighter archetype
await asyncTest('Apply Two-Handed Fighter to multi-class actor', async () => {
  var d = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  // Create a fresh classItem for this actor
  var freshFighter = createMockClassItem('Fighter', 10, 'fighter');
  freshFighter.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
  var result = await Applicator.apply(multiClassActor, freshFighter, twoHandedFighterParsed, d);
  assertEqual(result, true, 'Apply should succeed');
});

test('Multi-class actor has fighter entry in appliedArchetypes', () => {
  var actorFlags = multiClassActor.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'appliedArchetypes should exist');
  assertNotNull(actorFlags['fighter'], 'Should have fighter entry');
  assert(actorFlags['fighter'].includes('two-handed-fighter'), 'Fighter should have THF');
});

// Now simulate applying a rogue archetype to the same actor
var rogueArchetype = {
  name: 'Scout',
  slug: 'scout',
  class: 'Rogue',
  features: [
    {
      name: 'Scout\'s Charge',
      level: 2,
      type: 'replacement',
      target: 'evasion',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Evasion', level: 2, resolvedName: 'Evasion' },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ScoutsCharge',
      source: 'auto-parse'
    }
  ]
};

await asyncTest('Apply Scout archetype to Rogue on same actor', async () => {
  var d = DiffEngine.generateDiff(rogueClassItem.system.links.classAssociations, rogueArchetype);
  var result = await Applicator.apply(multiClassActor, rogueClassItem, rogueArchetype, d);
  assertEqual(result, true, 'Apply should succeed');
});

test('Multi-class actor now has both fighter and rogue entries', () => {
  var actorFlags = multiClassActor.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'appliedArchetypes should exist');
  assertNotNull(actorFlags['fighter'], 'Should have fighter entry');
  assertNotNull(actorFlags['rogue'], 'Should have rogue entry');
});

test('Fighter class entry preserved when rogue archetype applied', () => {
  var actorFlags = multiClassActor.getFlag('archetype-manager', 'appliedArchetypes');
  assert(actorFlags['fighter'].includes('two-handed-fighter'), 'Fighter should still have THF');
});

test('Rogue class entry has correct slug', () => {
  var actorFlags = multiClassActor.getFlag('archetype-manager', 'appliedArchetypes');
  assert(actorFlags['rogue'].includes('scout'), 'Rogue should have scout');
});

test('Each class item has independent archetypes flag', () => {
  var rogueArchetypes = rogueClassItem.getFlag('archetype-manager', 'archetypes');
  assertNotNull(rogueArchetypes, 'Rogue class item should have archetypes flag');
  assertEqual(rogueArchetypes.length, 1, 'Rogue should have one archetype');
  assertEqual(rogueArchetypes[0], 'scout', 'Rogue archetype should be scout');
});

test('Each class item has independent appliedAt flag', () => {
  var rogueAppliedAt = rogueClassItem.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(rogueAppliedAt, 'Rogue class item should have appliedAt flag');
  var parsed = new Date(rogueAppliedAt);
  assert(!isNaN(parsed.getTime()), 'Should be valid date');
});

// Test flags on fresh item with no prior archetypes
console.log('\n--- Additional: Flag state on fresh class item ---');

test('Fresh class item has no archetypes flag', () => {
  var freshItem = createMockClassItem('Wizard', 5, 'wizard');
  var archetypes = freshItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Should be null on fresh item');
});

test('Fresh class item has no appliedAt flag', () => {
  var freshItem = createMockClassItem('Wizard', 5, 'wizard');
  var appliedAt = freshItem.getFlag('archetype-manager', 'appliedAt');
  assertEqual(appliedAt, null, 'Should be null on fresh item');
});

test('Fresh actor has no appliedArchetypes flag', () => {
  var freshActor = createMockActor('Fresh Actor', []);
  var flags = freshActor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(flags, null, 'Should be null on fresh actor');
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Feature #40 Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
