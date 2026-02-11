/**
 * Test Suite for Feature #45: Removal cleans up all tracking flags
 *
 * Verifies that Applicator.remove() correctly cleans up all tracking flags
 * on both class item and actor after archetype removal.
 *
 * Steps:
 * 1. Apply archetype, verify flags
 * 2. Remove archetype
 * 3. Verify classItem archetypes flag updated
 * 4. Verify originalAssociations cleaned if no more archetypes
 * 5. Verify actor flags updated
 * 6. No orphaned flag data
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

// UUID resolution map
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
  // Weapon Master archetype features
  'Compendium.pf1e-archetypes.pf-arch-features.WeaponGuard': { name: 'Weapon Guard' },
  'Compendium.pf1e-archetypes.pf-arch-features.ReliableStrike': { name: 'Reliable Strike' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

var { Applicator } = await import('../scripts/applicator.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #45: Removal cleans up all tracking flags ===\n');

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

// Two-Handed Fighter archetype
var twoHandedFighterParsed = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'Fighter',
  features: [
    {
      name: 'Shattering Strike', level: 2, type: 'replacement', target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike', source: 'auto-parse'
    },
    {
      name: 'Overhand Chop', level: 3, type: 'replacement', target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop', source: 'auto-parse'
    },
    {
      name: 'Weapon Training', level: 5, type: 'modification', target: 'weapon training 1',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining', source: 'auto-parse'
    },
    {
      name: 'Backswing', level: 7, type: 'replacement', target: 'armor training 2',
      matchedAssociation: resolvedFighterAssociations?.[4] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Backswing', source: 'auto-parse'
    },
    {
      name: 'Piledriver', level: 11, type: 'replacement', target: 'armor training 3',
      matchedAssociation: resolvedFighterAssociations?.[6] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Piledriver', source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack', level: 15, type: 'replacement', target: 'armor training 4',
      matchedAssociation: resolvedFighterAssociations?.[8] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack', source: 'auto-parse'
    },
    {
      name: 'Devastating Blow', level: 19, type: 'replacement', target: 'armor mastery',
      matchedAssociation: resolvedFighterAssociations?.[10] || { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow', source: 'auto-parse'
    }
  ]
};

// Second archetype for stacking tests
var weaponMasterParsed = {
  name: 'Weapon Master',
  slug: 'weapon-master',
  class: 'Fighter',
  features: [
    {
      name: 'Weapon Guard', level: 2, type: 'replacement', target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.WeaponGuard', source: 'auto-parse'
    },
    {
      name: 'Reliable Strike', level: 3, type: 'replacement', target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ReliableStrike', source: 'auto-parse'
    }
  ]
};

// Helper to create actor with item copy tracking
function createTrackedActor(name, classItems) {
  var actor = createMockActor(name, classItems);
  actor.isOwner = true;
  var createdCopies = [];

  // Override items.filter to include created copies
  var origFilter = actor.items.filter;
  actor.items.filter = function(fn) {
    return [...classItems, ...createdCopies].filter(fn);
  };

  actor.createEmbeddedDocuments = async function(type, data) {
    var results = data.map(function(d) {
      var id = Math.random().toString(36).slice(2);
      var flags = d.flags || {};
      return {
        ...d,
        id: id,
        flags: flags,
        getFlag: function(scope, key) {
          return this.flags[scope]?.[key] ?? null;
        },
        setFlag: async function(scope, key, value) {
          if (!this.flags[scope]) this.flags[scope] = {};
          this.flags[scope][key] = value;
        },
        unsetFlag: async function(scope, key) {
          if (this.flags[scope]) delete this.flags[scope][key];
        }
      };
    });
    results.forEach(function(r) {
      createdCopies.push(r);
    });
    return results;
  };

  actor.deleteEmbeddedDocuments = async function(type, ids) {
    // Remove from createdCopies
    for (var i = createdCopies.length - 1; i >= 0; i--) {
      if (ids.includes(createdCopies[i].id)) {
        createdCopies.splice(i, 1);
      }
    }
    return ids;
  };

  actor._createdCopies = createdCopies;
  return actor;
}

// =====================================================
// SCENARIO A: Apply single archetype, then remove - complete cleanup
// =====================================================
console.log('--- Scenario A: Apply single archetype then remove ---');

var classItemA = createMockClassItem('Fighter', 10, 'fighter');
classItemA.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actorA = createTrackedActor('Fighter A', [classItemA]);

// Step 1: Apply archetype and verify flags
var diffA;
await asyncTest('Apply Two-Handed Fighter', async () => {
  diffA = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actorA, classItemA, twoHandedFighterParsed, diffA);
  assertEqual(result, true, 'Apply should succeed');
});

test('Pre-removal: classItem archetypes flag has slug', () => {
  var archetypes = classItemA.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Should exist');
  assert(archetypes.includes('two-handed-fighter'), 'Should have two-handed-fighter');
});

test('Pre-removal: classItem appliedAt flag has timestamp', () => {
  var appliedAt = classItemA.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'Should exist');
  assert(!isNaN(new Date(appliedAt).getTime()), 'Should be valid date');
});

test('Pre-removal: classItem originalAssociations flag has backup', () => {
  var backup = classItemA.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'Should exist');
  assertEqual(backup.length, 12, 'Should have 12 original entries');
});

test('Pre-removal: actor appliedArchetypes flag has entry', () => {
  var actorFlags = actorA.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Should exist');
  assertNotNull(actorFlags['fighter'], 'Should have fighter entry');
  assert(actorFlags['fighter'].includes('two-handed-fighter'), 'Should have THF');
});

// Step 2: Remove archetype
await asyncTest('Remove Two-Handed Fighter succeeds', async () => {
  var result = await Applicator.remove(actorA, classItemA, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
});

// Step 3: Verify classItem archetypes flag updated
console.log('\n--- Step 3: Verify classItem archetypes flag updated ---');

test('classItem archetypes flag is null after last archetype removed', () => {
  var archetypes = classItemA.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Should be null (unset) when no archetypes remain');
});

test('classItem archetypes flag does not contain removed slug', () => {
  // Double-check: even if not null, shouldn't contain the slug
  var archetypes = classItemA.getFlag('archetype-manager', 'archetypes');
  if (archetypes !== null) {
    assert(!archetypes.includes('two-handed-fighter'), 'Should not contain removed slug');
  }
  // If null, test passes automatically
  assert(true, 'Slug check passed');
});

// Step 4: Verify originalAssociations cleaned if no more archetypes
console.log('\n--- Step 4: Verify originalAssociations cleaned ---');

test('classItem originalAssociations flag is null after last archetype removed', () => {
  var backup = classItemA.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'Should be null (unset) when no archetypes remain');
});

test('classItem appliedAt flag is null after last archetype removed', () => {
  var appliedAt = classItemA.getFlag('archetype-manager', 'appliedAt');
  assertEqual(appliedAt, null, 'Should be null (unset) when no archetypes remain');
});

// Step 5: Verify actor flags updated
console.log('\n--- Step 5: Verify actor flags updated ---');

test('actor appliedArchetypes flag is null after last archetype removed', () => {
  var actorFlags = actorA.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags, null, 'Should be null when no archetypes remain');
});

test('actor appliedArchetypes does not have fighter entry', () => {
  var actorFlags = actorA.getFlag('archetype-manager', 'appliedArchetypes');
  if (actorFlags !== null) {
    assertEqual(actorFlags['fighter'], undefined, 'Fighter entry should be removed');
  }
  assert(true, 'Fighter entry check passed');
});

// Step 6: No orphaned flag data
console.log('\n--- Step 6: No orphaned flag data ---');

test('No archetype-manager flags remain on classItem', () => {
  var moduleFlags = classItemA.flags['archetype-manager'];
  // All flags should have been unset, so the module scope should be empty or undefined
  if (moduleFlags) {
    var keys = Object.keys(moduleFlags);
    assertEqual(keys.length, 0, `Expected no keys, found: ${keys.join(', ')}`);
  }
});

test('No archetype-manager flags remain on actor', () => {
  var moduleFlags = actorA.flags['archetype-manager'];
  if (moduleFlags) {
    // appliedArchetypes should have been set to null via setFlag
    // In our mock, setFlag with null still creates the key
    // The key test is: value must be null or the object must be empty/clean
    var actorArchetypes = actorA.getFlag('archetype-manager', 'appliedArchetypes');
    assertEqual(actorArchetypes, null, 'appliedArchetypes should be null');
  }
});

// =====================================================
// SCENARIO B: Apply two archetypes, remove one - partial cleanup
// =====================================================
console.log('\n--- Scenario B: Apply two archetypes, remove one ---');

var classItemB = createMockClassItem('Fighter', 10, 'fighter');
classItemB.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actorB = createTrackedActor('Fighter B', [classItemB]);

// Apply first archetype
await asyncTest('Apply Two-Handed Fighter to Fighter B', async () => {
  var d = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actorB, classItemB, twoHandedFighterParsed, d);
  assertEqual(result, true, 'First apply should succeed');
});

// Apply second archetype
await asyncTest('Apply Weapon Master to Fighter B', async () => {
  var currentAssoc = classItemB.system.links.classAssociations;
  var d = DiffEngine.generateDiff(currentAssoc, weaponMasterParsed);
  var result = await Applicator.apply(actorB, classItemB, weaponMasterParsed, d);
  assertEqual(result, true, 'Second apply should succeed');
});

test('Pre-removal: classItem has both archetypes', () => {
  var archetypes = classItemB.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 2, 'Should have 2 archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Should have THF');
  assert(archetypes.includes('weapon-master'), 'Should have WM');
});

test('Pre-removal: actor has both archetypes for fighter', () => {
  var actorFlags = actorB.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags['fighter'].length, 2, 'Fighter should have 2 archetypes');
});

// Remove only one archetype (weapon-master)
await asyncTest('Remove Weapon Master from Fighter B', async () => {
  var result = await Applicator.remove(actorB, classItemB, 'weapon-master');
  assertEqual(result, true, 'Remove should succeed');
});

test('classItem archetypes flag has remaining archetype only', () => {
  var archetypes = classItemB.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Should not be null (one archetype remains)');
  assertEqual(archetypes.length, 1, 'Should have exactly one');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Should be the remaining archetype');
});

test('classItem archetypes flag does NOT contain removed archetype', () => {
  var archetypes = classItemB.getFlag('archetype-manager', 'archetypes');
  assert(!archetypes.includes('weapon-master'), 'Should not contain weapon-master');
});

test('originalAssociations preserved when archetypes remain', () => {
  var backup = classItemB.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'Backup should still exist (one archetype remains)');
  assertEqual(backup.length, 12, 'Backup should still have all 12 original entries');
});

test('appliedAt preserved when archetypes remain', () => {
  var appliedAt = classItemB.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'appliedAt should still exist');
});

test('actor appliedArchetypes updated - only remaining slug', () => {
  var actorFlags = actorB.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Should not be null (one archetype remains)');
  assertNotNull(actorFlags['fighter'], 'Fighter entry should still exist');
  assertEqual(actorFlags['fighter'].length, 1, 'Should have one slug');
  assert(actorFlags['fighter'].includes('two-handed-fighter'), 'Should have remaining slug');
  assert(!actorFlags['fighter'].includes('weapon-master'), 'Should NOT have removed slug');
});

// Now remove the last one to test full cleanup
await asyncTest('Remove last archetype (Two-Handed Fighter) from Fighter B', async () => {
  var result = await Applicator.remove(actorB, classItemB, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
});

test('classItem fully cleaned after last archetype removed', () => {
  var archetypes = classItemB.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'archetypes should be null');
  var backup = classItemB.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'originalAssociations should be null');
  var appliedAt = classItemB.getFlag('archetype-manager', 'appliedAt');
  assertEqual(appliedAt, null, 'appliedAt should be null');
});

test('actor fully cleaned after all archetypes removed from Fighter B', () => {
  var actorFlags = actorB.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags, null, 'Actor archetypes should be null');
});

// =====================================================
// SCENARIO C: Multi-class actor - removing from one class doesn't affect other
// =====================================================
console.log('\n--- Scenario C: Multi-class actor isolation ---');

var fighterItemC = createMockClassItem('Fighter', 10, 'fighter');
fighterItemC.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));

var rogueItemC = createMockClassItem('Rogue', 5, 'rogue');
rogueItemC.system.links.classAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack', level: 1, resolvedName: 'Sneak Attack' },
  { uuid: 'Compendium.pf1.class-abilities.Evasion', level: 2, resolvedName: 'Evasion' }
];

var actorC = createTrackedActor('Multi-Class Hero', [fighterItemC, rogueItemC]);

var rogueArchetype = {
  name: 'Scout',
  slug: 'scout',
  class: 'Rogue',
  features: [{
    name: 'Scout\'s Charge', level: 2, type: 'replacement', target: 'evasion',
    matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Evasion', level: 2, resolvedName: 'Evasion' },
    archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ScoutsCharge', source: 'auto-parse'
  }]
};

// Apply archetype to both classes
await asyncTest('Apply THF to Fighter on multi-class actor', async () => {
  var d = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actorC, fighterItemC, twoHandedFighterParsed, d);
  assertEqual(result, true, 'Apply to fighter should succeed');
});

await asyncTest('Apply Scout to Rogue on multi-class actor', async () => {
  var d = DiffEngine.generateDiff(rogueItemC.system.links.classAssociations, rogueArchetype);
  var result = await Applicator.apply(actorC, rogueItemC, rogueArchetype, d);
  assertEqual(result, true, 'Apply to rogue should succeed');
});

test('Both classes have archetypes in actor flags', () => {
  var actorFlags = actorC.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags['fighter'], 'Fighter entry should exist');
  assertNotNull(actorFlags['rogue'], 'Rogue entry should exist');
});

// Remove fighter archetype
await asyncTest('Remove THF from fighter on multi-class actor', async () => {
  var result = await Applicator.remove(actorC, fighterItemC, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
});

test('Fighter entry removed from actor flags', () => {
  var actorFlags = actorC.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Actor flags should still exist (rogue has archetype)');
  // Fighter entry should be removed
  if (actorFlags['fighter']) {
    assertEqual(actorFlags['fighter'].length, 0, 'Fighter should have no archetypes');
  }
});

test('Rogue entry preserved in actor flags after fighter removal', () => {
  var actorFlags = actorC.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Actor flags should exist');
  assertNotNull(actorFlags['rogue'], 'Rogue entry should still exist');
  assert(actorFlags['rogue'].includes('scout'), 'Rogue should still have scout');
});

test('Fighter classItem flags cleaned', () => {
  var archetypes = fighterItemC.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Fighter archetypes should be null');
  var backup = fighterItemC.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'Fighter backup should be null');
  var appliedAt = fighterItemC.getFlag('archetype-manager', 'appliedAt');
  assertEqual(appliedAt, null, 'Fighter appliedAt should be null');
});

test('Rogue classItem flags preserved', () => {
  var archetypes = rogueItemC.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Rogue archetypes should still exist');
  assertEqual(archetypes[0], 'scout', 'Rogue should still have scout');
  var appliedAt = rogueItemC.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'Rogue appliedAt should still exist');
});

// =====================================================
// SCENARIO D: Removal of non-existent archetype doesn't corrupt flags
// =====================================================
console.log('\n--- Scenario D: Non-existent archetype removal ---');

var classItemD = createMockClassItem('Fighter', 10, 'fighter');
classItemD.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actorD = createTrackedActor('Fighter D', [classItemD]);

// Apply archetype
await asyncTest('Apply THF to Fighter D', async () => {
  var d = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actorD, classItemD, twoHandedFighterParsed, d);
  assertEqual(result, true, 'Apply should succeed');
});

// Try to remove non-existent archetype
await asyncTest('Remove non-existent archetype fails gracefully', async () => {
  var result = await Applicator.remove(actorD, classItemD, 'non-existent-archetype');
  assertEqual(result, false, 'Should return false for non-existent');
});

test('Flags unchanged after failed removal attempt', () => {
  var archetypes = classItemD.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Archetypes should still exist');
  assertEqual(archetypes.length, 1, 'Should still have one archetype');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Should still be THF');
});

test('Actor flags unchanged after failed removal attempt', () => {
  var actorFlags = actorD.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Should still exist');
  assertNotNull(actorFlags['fighter'], 'Fighter entry should still exist');
  assert(actorFlags['fighter'].includes('two-handed-fighter'), 'Should still have THF');
});

test('originalAssociations unchanged after failed removal', () => {
  var backup = classItemD.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'Backup should still exist');
  assertEqual(backup.length, 12, 'Should still have 12 entries');
});

test('appliedAt unchanged after failed removal', () => {
  var appliedAt = classItemD.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'Should still exist');
});

// =====================================================
// SCENARIO E: Apply and remove cycle - flags fully reset
// =====================================================
console.log('\n--- Scenario E: Apply-remove-apply cycle ---');

var classItemE = createMockClassItem('Fighter', 10, 'fighter');
classItemE.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actorE = createTrackedActor('Fighter E', [classItemE]);

// Apply
await asyncTest('First apply on Fighter E', async () => {
  var d = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actorE, classItemE, twoHandedFighterParsed, d);
  assertEqual(result, true, 'First apply should succeed');
});

// Remove
await asyncTest('Remove from Fighter E', async () => {
  var result = await Applicator.remove(actorE, classItemE, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
});

test('All flags cleared after removal', () => {
  assertEqual(classItemE.getFlag('archetype-manager', 'archetypes'), null, 'archetypes null');
  assertEqual(classItemE.getFlag('archetype-manager', 'originalAssociations'), null, 'backup null');
  assertEqual(classItemE.getFlag('archetype-manager', 'appliedAt'), null, 'appliedAt null');
  assertEqual(actorE.getFlag('archetype-manager', 'appliedArchetypes'), null, 'actor flags null');
});

// Re-apply (flags should be created fresh)
await asyncTest('Re-apply Weapon Master to Fighter E', async () => {
  // Use current associations (should be restored original)
  var currentAssoc = classItemE.system.links.classAssociations;
  var d = DiffEngine.generateDiff(currentAssoc, weaponMasterParsed);
  var result = await Applicator.apply(actorE, classItemE, weaponMasterParsed, d);
  assertEqual(result, true, 'Re-apply should succeed');
});

test('Fresh flags created after re-apply', () => {
  var archetypes = classItemE.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'archetypes should exist');
  assertEqual(archetypes.length, 1, 'Should have one archetype');
  assertEqual(archetypes[0], 'weapon-master', 'Should be weapon-master (not THF from previous)');
});

test('Fresh appliedAt after re-apply', () => {
  var appliedAt = classItemE.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'appliedAt should exist');
  assert(!isNaN(new Date(appliedAt).getTime()), 'Should be valid date');
});

test('Fresh actor flags after re-apply', () => {
  var actorFlags = actorE.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorFlags, 'Should exist');
  assertNotNull(actorFlags['fighter'], 'Should have fighter entry');
  assertEqual(actorFlags['fighter'].length, 1, 'Should have one slug');
  assertEqual(actorFlags['fighter'][0], 'weapon-master', 'Should be weapon-master');
});

test('Fresh backup created on re-apply', () => {
  var backup = classItemE.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'New backup should be created');
  // The backup should reflect the state before re-application
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Feature #45 Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
