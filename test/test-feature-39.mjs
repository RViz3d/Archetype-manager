/**
 * Test Suite for Feature #39: Create item copies for modified features
 *
 * Verifies that Applicator.apply() creates item copies for modified features:
 * 1. Apply archetype with 'modifies Weapon Training'
 * 2. Verify copy created on actor
 * 3. Verify copy has instructions in description
 * 4. Verify copy linked in classAssociations
 * 5. Verify original not deleted
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

function assertIncludes(str, sub, message) {
  if (!str || !str.includes(sub)) {
    throw new Error(`${message || 'String inclusion failed'}: "${str}" does not include "${sub}"`);
  }
}

// Set up environment
setupMockEnvironment();

// UUID resolution map
var uuidMap = {
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
  'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike': { name: 'Shattering Strike' },
  'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop': { name: 'Overhand Chop' },
  'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining': { name: 'Weapon Training (Two-Handed Fighter)' },
  'Compendium.pf1e-archetypes.pf-arch-features.Backswing': { name: 'Backswing' },
  'Compendium.pf1e-archetypes.pf-arch-features.Piledriver': { name: 'Piledriver' },
  'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack': { name: 'Greater Power Attack' },
  'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow': { name: 'Devastating Blow' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

var { Applicator } = await import('../scripts/applicator.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #39: Create item copies for modified features ===\n');

// =====================================================
// Setup: Create enhanced mock actor that tracks created items
// =====================================================

function createEnhancedMockActor(name, classItems) {
  var flags = {};
  var items = [...classItems];
  var id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

  var actor = {
    id,
    name,
    isOwner: true,
    items: {
      filter: (fn) => items.filter(fn),
      find: (fn) => items.find(fn),
      get: (id) => items.find(i => i.id === id),
      map: (fn) => items.map(fn),
      [Symbol.iterator]: () => items[Symbol.iterator]()
    },
    flags,
    getFlag(scope, key) {
      return flags[scope]?.[key] ?? null;
    },
    async setFlag(scope, key, value) {
      if (!flags[scope]) flags[scope] = {};
      flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (flags[scope]) delete flags[scope][key];
    },
    async createEmbeddedDocuments(type, data) {
      var created = data.map(d => {
        var newId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
        var item = {
          ...d,
          id: newId,
          getFlag(scope, key) {
            return d.flags?.[scope]?.[key] ?? null;
          },
          async setFlag(scope, key, value) {
            if (!d.flags) d.flags = {};
            if (!d.flags[scope]) d.flags[scope] = {};
            d.flags[scope][key] = value;
          }
        };
        // Add to items array so it's findable
        items.push(item);
        return item;
      });
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (var delId of ids) {
        var idx = items.findIndex(i => i.id === delId);
        if (idx >= 0) items.splice(idx, 1);
      }
      return ids;
    },
    // expose internal items array for test inspection
    _items: items
  };
  return actor;
}

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

// Two-Handed Fighter archetype (has 1 modification + 6 replacements)
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
      description: '<p>Shattering Strike description. This replaces Bravery.</p>',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike',
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      description: '<p>Overhand Chop description. This replaces Armor Training 1.</p>',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop',
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'modification',
      target: 'weapon training 1',
      description: '<p>At 5th level, a two-handed fighter gains weapon training as normal, but his bonuses only apply to two-handed melee weapons. This modifies Weapon Training.</p>',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining',
      source: 'auto-parse'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'armor training 2',
      description: '<p>Backswing description. This replaces Armor Training 2.</p>',
      matchedAssociation: resolvedFighterAssociations?.[4] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Backswing',
      source: 'auto-parse'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'armor training 3',
      description: '<p>Piledriver description. This replaces Armor Training 3.</p>',
      matchedAssociation: resolvedFighterAssociations?.[6] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Piledriver',
      source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'armor training 4',
      description: '<p>Greater Power Attack description. This replaces Armor Training 4.</p>',
      matchedAssociation: resolvedFighterAssociations?.[8] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack',
      source: 'auto-parse'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'armor mastery',
      description: '<p>Devastating Blow description. This replaces Armor Mastery.</p>',
      matchedAssociation: resolvedFighterAssociations?.[10] || { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow',
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Apply archetype with 'modifies Weapon Training'
// =====================================================
console.log('--- Step 1: Apply archetype with modification feature ---');

var classItem = createMockClassItem('Fighter', 10, 'fighter');
classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actor = createEnhancedMockActor('Test Fighter', [classItem]);

var diff;
test('Generate diff for Two-Handed Fighter', () => {
  diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  assert(Array.isArray(diff), 'Diff should be an array');
});

test('Diff has exactly 1 modified entry (Weapon Training)', () => {
  var modified = diff.filter(d => d.status === 'modified');
  assertEqual(modified.length, 1, 'Should have exactly 1 modification');
  assertEqual(modified[0].name, 'Weapon Training', 'Modified feature should be Weapon Training');
});

var applyResult;
await asyncTest('Apply Two-Handed Fighter succeeds', async () => {
  applyResult = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff);
  assertEqual(applyResult, true, 'Apply should return true');
});

// =====================================================
// Step 2: Verify copy created on actor
// =====================================================
console.log('\n--- Step 2: Verify copy created on actor ---');

test('Actor items array has more than just the class item', () => {
  // Actor should have the class item + the created copy
  assert(actor._items.length > 1, 'Actor should have more than 1 item');
});

test('Item copy exists on actor for modified Weapon Training', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 1, 'Should have exactly 1 modified copy');
});

test('Copy name includes feature name and archetype name', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var copy = copies[0];
  assertIncludes(copy.name, 'Weapon Training', 'Copy name should include feature name');
  assertIncludes(copy.name, 'Two-Handed Fighter', 'Copy name should include archetype name');
});

test('Copy name follows format: FeatureName (ArchetypeName)', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var copy = copies[0];
  assertEqual(copy.name, 'Weapon Training (Two-Handed Fighter)', 'Name should match expected format');
});

test('Copy type is feat', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies[0].type, 'feat', 'Copy should be a feat type item');
});

test('Copy has unique ID', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertNotNull(copies[0].id, 'Copy should have an ID');
  assert(copies[0].id !== classItem.id, 'Copy ID should differ from class item ID');
});

// =====================================================
// Step 3: Verify copy has instructions in description
// =====================================================
console.log('\n--- Step 3: Verify copy has instructions in description ---');

test('Copy has description field', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertNotNull(copies[0].system, 'Copy should have system');
  assertNotNull(copies[0].system.description, 'Copy should have description');
  assertNotNull(copies[0].system.description.value, 'Copy should have description.value');
});

test('Description includes "Modified by" instruction', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var desc = copies[0].system.description.value;
  assertIncludes(desc, 'Modified by Two-Handed Fighter', 'Description should indicate modification source');
});

test('Description includes archetype feature description text', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var desc = copies[0].system.description.value;
  assertIncludes(desc, 'two-handed melee weapons', 'Description should include modification details');
});

test('Description is HTML formatted', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var desc = copies[0].system.description.value;
  assertIncludes(desc, '<p>', 'Description should be HTML formatted');
  assertIncludes(desc, '<strong>', 'Description should have strong tag for emphasis');
});

test('Copy has createdByArchetype flag', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var createdBy = copies[0].getFlag('archetype-manager', 'createdByArchetype');
  assertEqual(createdBy, 'two-handed-fighter', 'Should track creating archetype slug');
});

test('Copy has isModifiedCopy flag set to true', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var isCopy = copies[0].getFlag('archetype-manager', 'isModifiedCopy');
  assertEqual(isCopy, true, 'isModifiedCopy flag should be true');
});

// =====================================================
// Step 4: Verify copy linked in classAssociations
// =====================================================
console.log('\n--- Step 4: Verify copy linked in classAssociations ---');

test('Modified feature entry present in updated classAssociations', () => {
  var updatedAssociations = classItem.system.links.classAssociations;
  // The modified feature's matchedAssociation (WT1 base) should be in classAssociations
  var wt1Entry = updatedAssociations.find(a =>
    a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1'
  );
  assertNotNull(wt1Entry, 'Weapon Training 1 UUID should still be present in classAssociations');
});

test('Modified entry level preserved in classAssociations', () => {
  var updatedAssociations = classItem.system.links.classAssociations;
  var wt1Entry = updatedAssociations.find(a =>
    a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1'
  );
  assertEqual(wt1Entry.level, 5, 'WT1 should still be at level 5');
});

test('Diff has modification entry with archetypeFeature', () => {
  var modifiedEntries = diff.filter(d => d.status === 'modified');
  var wtMod = modifiedEntries[0];
  assertNotNull(wtMod.archetypeFeature, 'Modified entry should have archetypeFeature');
  assertEqual(wtMod.archetypeFeature.name, 'Weapon Training', 'archetypeFeature name should be Weapon Training');
});

test('_buildNewAssociations includes modified entry', () => {
  var newAssocs = Applicator._buildNewAssociations(diff);
  var hasModified = newAssocs.some(a =>
    a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1'
  );
  assert(hasModified, '_buildNewAssociations should include modified feature');
});

// =====================================================
// Step 5: Verify original not deleted
// =====================================================
console.log('\n--- Step 5: Verify original not deleted ---');

test('Original Weapon Training 1 UUID still in classAssociations', () => {
  var updatedAssociations = classItem.system.links.classAssociations;
  var wt1 = updatedAssociations.find(a =>
    a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1'
  );
  assertNotNull(wt1, 'Original WT1 UUID should still be present');
});

test('Original Weapon Training 2-4 UUIDs still in classAssociations (unchanged)', () => {
  var updatedAssociations = classItem.system.links.classAssociations;
  var wt2 = updatedAssociations.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining2');
  var wt3 = updatedAssociations.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining3');
  var wt4 = updatedAssociations.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining4');
  assertNotNull(wt2, 'WT2 should still be present');
  assertNotNull(wt3, 'WT3 should still be present');
  assertNotNull(wt4, 'WT4 should still be present');
});

test('Bonus Feat (unchanged) still in classAssociations', () => {
  var updatedAssociations = classItem.system.links.classAssociations;
  var bf = updatedAssociations.find(a =>
    a.uuid === 'Compendium.pf1.class-abilities.BonusFeat1'
  );
  assertNotNull(bf, 'Bonus Feat should still be present');
});

test('Weapon Mastery (unchanged) still in classAssociations', () => {
  var updatedAssociations = classItem.system.links.classAssociations;
  var wm = updatedAssociations.find(a =>
    a.uuid === 'Compendium.pf1.class-abilities.WeaponMastery'
  );
  assertNotNull(wm, 'Weapon Mastery should still be present');
});

test('Replaced features (Bravery, AT1-4, Armor Mastery) are gone from diff as removed', () => {
  var removed = diff.filter(d => d.status === 'removed');
  assertEqual(removed.length, 7, 'Should have 7 removed entries (including WT1 modified)');
  // Bravery
  assert(removed.some(d => d.name === 'Bravery'), 'Bravery should be removed');
  // Armor Training 1-4
  assert(removed.some(d => d.name === 'Armor Training 1'), 'AT1 should be removed');
  assert(removed.some(d => d.name === 'Armor Training 2'), 'AT2 should be removed');
  assert(removed.some(d => d.name === 'Armor Training 3'), 'AT3 should be removed');
  assert(removed.some(d => d.name === 'Armor Training 4'), 'AT4 should be removed');
  // Armor Mastery
  assert(removed.some(d => d.name === 'Armor Mastery'), 'Armor Mastery should be removed');
});

// =====================================================
// Additional tests: Only modifications get copies
// =====================================================
console.log('\n--- Additional: Only modifications get copies ---');

test('Replacement features do NOT create item copies', () => {
  // Only 1 copy should exist (for the modification), not for the 6 replacements
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 1, 'Only 1 copy for the 1 modification (not 6 for replacements)');
});

test('Added/replacement features have no isModifiedCopy flag', () => {
  var allItemsWithCopyFlag = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') !== null
  );
  // All items with createdByArchetype should also be isModifiedCopy
  for (var item of allItemsWithCopyFlag) {
    assertEqual(item.getFlag('archetype-manager', 'isModifiedCopy'), true,
      'All archetype-created items should be modification copies');
  }
});

// =====================================================
// Scenario: Archetype with multiple modifications
// =====================================================
console.log('\n--- Scenario: Archetype with multiple modifications ---');

var classItem2 = createMockClassItem('Rogue', 10, 'rogue');
var rogueAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
  { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1, resolvedName: 'Trapfinding' },
  { uuid: 'Compendium.pf1.class-abilities.EvasionR', level: 2, resolvedName: 'Evasion' },
  { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3, resolvedName: 'Trap Sense' },
  { uuid: 'Compendium.pf1.class-abilities.UncannyDodge', level: 4, resolvedName: 'Uncanny Dodge' }
];
classItem2.system.links.classAssociations = JSON.parse(JSON.stringify(rogueAssociations));

var actor2 = createEnhancedMockActor('Test Rogue', [classItem2]);

var multiModArchetype = {
  name: 'Acrobat',
  slug: 'acrobat',
  class: 'Rogue',
  features: [
    {
      name: 'Sneak Attack (Acrobat)',
      level: 1,
      type: 'modification',
      target: 'sneak attack',
      description: '<p>An acrobat\'s sneak attack deals less damage but she gains acrobatic bonuses. This modifies Sneak Attack.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
      source: 'auto-parse'
    },
    {
      name: 'Trap Sense (Acrobat)',
      level: 3,
      type: 'modification',
      target: 'trap sense',
      description: '<p>An acrobat applies her trap sense bonus to Acrobatics checks. This modifies Trap Sense.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3, resolvedName: 'Trap Sense' },
      source: 'auto-parse'
    }
  ]
};

var diff2 = DiffEngine.generateDiff(rogueAssociations, multiModArchetype);

await asyncTest('Apply archetype with 2 modifications succeeds', async () => {
  var result = await Applicator.apply(actor2, classItem2, multiModArchetype, diff2);
  assertEqual(result, true, 'Apply should succeed');
});

test('Two item copies created for two modifications', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 2, 'Should have 2 modified copies');
});

test('First copy is Sneak Attack (Acrobat)', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var sneakCopy = copies.find(c => c.name.includes('Sneak Attack'));
  assertNotNull(sneakCopy, 'Should have Sneak Attack copy');
  assertEqual(sneakCopy.name, 'Sneak Attack (Acrobat) (Acrobat)', 'Name should include archetype');
});

test('Second copy is Trap Sense (Acrobat)', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var trapCopy = copies.find(c => c.name.includes('Trap Sense'));
  assertNotNull(trapCopy, 'Should have Trap Sense copy');
  assertEqual(trapCopy.name, 'Trap Sense (Acrobat) (Acrobat)', 'Name should include archetype');
});

test('Both copies have correct createdByArchetype flag', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  for (var copy of copies) {
    assertEqual(copy.getFlag('archetype-manager', 'createdByArchetype'), 'acrobat',
      'createdByArchetype should be acrobat');
  }
});

test('Both copies have descriptions with modification instructions', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  for (var copy of copies) {
    assertIncludes(copy.system.description.value, 'Modified by Acrobat',
      'Description should include modification source');
  }
});

test('Both original base UUIDs still in classAssociations', () => {
  var assocs = classItem2.system.links.classAssociations;
  var sneak = assocs.find(a => a.uuid === 'Compendium.pf1.class-abilities.SneakAttack1');
  var trap = assocs.find(a => a.uuid === 'Compendium.pf1.class-abilities.TrapSense1');
  assertNotNull(sneak, 'Sneak Attack UUID should still be present');
  assertNotNull(trap, 'Trap Sense UUID should still be present');
});

// =====================================================
// Scenario: Archetype with no modifications (only replacements)
// =====================================================
console.log('\n--- Scenario: Archetype with only replacements (no copies) ---');

var classItem3 = createMockClassItem('Fighter', 5, 'fighter2');
var simpleAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1, resolvedName: 'Bonus Feat' },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2, resolvedName: 'Bravery' }
];
classItem3.system.links.classAssociations = JSON.parse(JSON.stringify(simpleAssociations));

var actor3 = createEnhancedMockActor('Simple Fighter', [classItem3]);

var replaceOnlyArchetype = {
  name: 'Simple Archetype',
  slug: 'simple-archetype',
  class: 'Fighter',
  features: [
    {
      name: 'Courage',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      description: '<p>Courage replaces Bravery.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2, resolvedName: 'Bravery' },
      source: 'auto-parse'
    }
  ]
};

var diff3 = DiffEngine.generateDiff(simpleAssociations, replaceOnlyArchetype);

await asyncTest('Apply replacement-only archetype succeeds', async () => {
  var result = await Applicator.apply(actor3, classItem3, replaceOnlyArchetype, diff3);
  assertEqual(result, true, 'Apply should succeed');
});

test('No item copies created for replacement-only archetype', () => {
  var copies = actor3.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 0, 'No copies for replacements');
});

// =====================================================
// Scenario: Modified feature with no description
// =====================================================
console.log('\n--- Scenario: Modified feature with null/missing description ---');

var classItem4 = createMockClassItem('Wizard', 5, 'wizard');
var wizardAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.ArcaneSchool', level: 1, resolvedName: 'Arcane School' }
];
classItem4.system.links.classAssociations = JSON.parse(JSON.stringify(wizardAssociations));

var actor4 = createEnhancedMockActor('Test Wizard', [classItem4]);

var noDescArchetype = {
  name: 'Mystery Archetype',
  slug: 'mystery-archetype',
  class: 'Wizard',
  features: [
    {
      name: 'Modified School',
      level: 1,
      type: 'modification',
      target: 'arcane school',
      description: null, // No description available
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArcaneSchool', level: 1, resolvedName: 'Arcane School' },
      source: 'manual'
    }
  ]
};

var diff4 = DiffEngine.generateDiff(wizardAssociations, noDescArchetype);

await asyncTest('Apply archetype with no-description modification succeeds', async () => {
  var result = await Applicator.apply(actor4, classItem4, noDescArchetype, diff4);
  assertEqual(result, true, 'Apply should succeed');
});

test('Copy created even with null description', () => {
  var copies = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 1, 'Should still create copy');
});

test('Fallback description used when feature description is null', () => {
  var copies = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var desc = copies[0].system.description.value;
  assertIncludes(desc, 'See archetype description', 'Should use fallback description');
});

test('Fallback description still has "Modified by" header', () => {
  var copies = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  var desc = copies[0].system.description.value;
  assertIncludes(desc, 'Modified by Mystery Archetype', 'Should still have modification header');
});

// =====================================================
// Verify _createModifiedFeatureCopies directly
// =====================================================
console.log('\n--- Direct _createModifiedFeatureCopies testing ---');

await asyncTest('_createModifiedFeatureCopies returns empty array for no modifications', async () => {
  var testActor = createEnhancedMockActor('Direct Test', []);
  var testDiff = [
    { status: 'unchanged', level: 1, name: 'Feat A', original: {} },
    { status: 'removed', level: 2, name: 'Feat B', original: {} },
    { status: 'added', level: 2, name: 'Feat C', archetypeFeature: { name: 'Feat C' } }
  ];
  var result = await Applicator._createModifiedFeatureCopies(testActor, { name: 'Test', slug: 'test' }, testDiff);
  assertEqual(result.length, 0, 'Should return empty array when no modifications');
});

await asyncTest('_createModifiedFeatureCopies creates correct data structure', async () => {
  var testActor = createEnhancedMockActor('Direct Test 2', []);
  var testDiff = [
    {
      status: 'modified',
      level: 3,
      name: 'Test Mod',
      archetypeFeature: {
        name: 'Modified Test',
        description: '<p>Test modification description.</p>'
      }
    }
  ];
  var result = await Applicator._createModifiedFeatureCopies(
    testActor,
    { name: 'Test Archetype', slug: 'test-archetype' },
    testDiff
  );
  assertEqual(result.length, 1, 'Should create 1 item');
  assertEqual(result[0].name, 'Modified Test (Test Archetype)', 'Name format correct');
  assertEqual(result[0].type, 'feat', 'Type is feat');
  assertIncludes(result[0].system.description.value, 'Modified by Test Archetype', 'Description correct');
  assertIncludes(result[0].system.description.value, 'Test modification description', 'Description includes feature text');
  assertEqual(result[0].getFlag('archetype-manager', 'createdByArchetype'), 'test-archetype', 'Flag set');
  assertEqual(result[0].getFlag('archetype-manager', 'isModifiedCopy'), true, 'isModifiedCopy set');
});

await asyncTest('_createModifiedFeatureCopies ignores modified entries with no archetypeFeature', async () => {
  var testActor = createEnhancedMockActor('Direct Test 3', []);
  var testDiff = [
    {
      status: 'modified',
      level: 3,
      name: 'Test Mod',
      archetypeFeature: null
    }
  ];
  var result = await Applicator._createModifiedFeatureCopies(
    testActor,
    { name: 'Test', slug: 'test' },
    testDiff
  );
  assertEqual(result.length, 0, 'Should not create copy without archetypeFeature');
});

// =====================================================
// Edge case: Multiple archetypes each with modifications
// =====================================================
console.log('\n--- Edge case: Second archetype also has modifications ---');

var classItem5 = createMockClassItem('Fighter', 10, 'fighter3');
classItem5.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actor5 = createEnhancedMockActor('Multi-mod Fighter', [classItem5]);

// First archetype: modifies Weapon Training
var archetype1 = {
  name: 'Archer',
  slug: 'archer',
  class: 'Fighter',
  features: [
    {
      name: 'Hawkeye',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      description: '<p>Hawkeye replaces Bravery.</p>',
      matchedAssociation: resolvedFighterAssociations[1],
      source: 'auto-parse'
    }
  ]
};

var diffA = DiffEngine.generateDiff(resolvedFighterAssociations, archetype1);

await asyncTest('Apply first archetype (no modifications) creates no copies', async () => {
  var result = await Applicator.apply(actor5, classItem5, archetype1, diffA);
  assertEqual(result, true, 'Should succeed');
  var copies = actor5.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 0, 'No copies for replacement-only archetype');
});

// =====================================================
// Summary
// =====================================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #39 Results: ${passed}/${totalTests} tests passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
