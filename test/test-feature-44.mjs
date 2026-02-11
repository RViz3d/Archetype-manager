/**
 * Test Suite for Feature #44: Removal deletes created item copies
 *
 * Verifies that Applicator.remove() deletes item copies for modified features:
 * 1. Apply archetype creating item copies
 * 2. Verify copies exist
 * 3. Remove archetype
 * 4. Verify copies deleted
 * 5. Other items untouched
 */

import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

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
  'Compendium.pf1.class-abilities.SneakAttack1': { name: 'Sneak Attack' },
  'Compendium.pf1.class-abilities.Trapfinding': { name: 'Trapfinding' },
  'Compendium.pf1.class-abilities.TrapSense1': { name: 'Trap Sense' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

var { Applicator } = await import('../scripts/applicator.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #44: Removal deletes created item copies ===\n');

// =====================================================
// Enhanced mock actor that properly tracks created/deleted items
// =====================================================

function createEnhancedMockActor(name, classItems) {
  var flags = {};
  var items = [...classItems];
  var id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  var deleteEmbeddedCalls = [];

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
        items.push(item);
        return item;
      });
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      deleteEmbeddedCalls.push({ type, ids: [...ids] });
      for (var delId of ids) {
        var idx = items.findIndex(i => i.id === delId);
        if (idx >= 0) items.splice(idx, 1);
      }
      return ids;
    },
    _items: items,
    _deleteEmbeddedCalls: deleteEmbeddedCalls
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

var resolvedFighterAssociations;
await asyncTest('Resolve Fighter classAssociations', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
});

// Two-Handed Fighter archetype (has 1 modification that creates a copy)
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
      description: '<p>Replaces Bravery.</p>',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      description: '<p>Replaces Armor Training 1.</p>',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'modification',
      target: 'weapon training 1',
      description: '<p>At 5th level, a two-handed fighter gains weapon training as normal, but bonuses apply only to two-handed weapons. This modifies Weapon Training.</p>',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
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

// =====================================================
// Step 1: Apply archetype creating item copies
// =====================================================
console.log('--- Step 1: Apply archetype creating item copies ---');

var classItem = createMockClassItem('Fighter', 10, 'fighter');
classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var originalAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));

var actor = createEnhancedMockActor('Test Fighter', [classItem]);

var diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);

await asyncTest('Apply Two-Handed Fighter succeeds', async () => {
  var result = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff);
  assertEqual(result, true, 'Apply should return true');
});

// =====================================================
// Step 2: Verify copies exist
// =====================================================
console.log('\n--- Step 2: Verify copies exist ---');

test('Modified feature copy exists on actor', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 1, 'Should have 1 modified copy');
});

test('Copy is for Weapon Training (Two-Handed Fighter)', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies[0].name, 'Weapon Training (Two-Handed Fighter)', 'Copy name correct');
});

test('Copy has createdByArchetype = two-handed-fighter', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies[0].getFlag('archetype-manager', 'createdByArchetype'), 'two-handed-fighter', 'Flag correct');
});

var copyId;
test('Copy has a valid ID', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  copyId = copies[0].id;
  assertNotNull(copyId, 'Copy should have an ID');
});

test('Total actor items: class item + 1 copy = 2', () => {
  assertEqual(actor._items.length, 2, 'Should have 2 items total');
});

// =====================================================
// Step 3: Remove archetype
// =====================================================
console.log('\n--- Step 3: Remove archetype ---');

await asyncTest('Remove Two-Handed Fighter succeeds', async () => {
  var result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should return true');
});

// =====================================================
// Step 4: Verify copies deleted
// =====================================================
console.log('\n--- Step 4: Verify copies deleted ---');

test('Modified feature copy deleted from actor items', () => {
  var copies = actor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 0, 'No modified copies should remain');
});

test('Copy ID no longer findable in actor items', () => {
  var found = actor.items.find(i => i.id === copyId);
  assertEqual(found, undefined, 'Copy should not be findable by ID');
});

test('deleteEmbeddedDocuments was called for Item type', () => {
  var deleteCalls = actor._deleteEmbeddedCalls.filter(c => c.type === 'Item');
  assert(deleteCalls.length >= 1, 'Should have at least 1 delete call for Items');
});

test('deleteEmbeddedDocuments called with correct copy ID', () => {
  var deleteCalls = actor._deleteEmbeddedCalls.filter(c => c.type === 'Item');
  var allDeletedIds = deleteCalls.flatMap(c => c.ids);
  assert(allDeletedIds.includes(copyId), 'Deleted IDs should include the copy ID');
});

// =====================================================
// Step 5: Other items untouched
// =====================================================
console.log('\n--- Step 5: Other items untouched ---');

test('Class item still exists on actor', () => {
  var classItems = actor._items.filter(i => i.type === 'class');
  assertEqual(classItems.length, 1, 'Class item should still exist');
});

test('Class item ID unchanged', () => {
  assertEqual(actor._items[0].id, classItem.id, 'Class item ID should be unchanged');
});

test('Only 1 item remains (the class item)', () => {
  assertEqual(actor._items.length, 1, 'Should have only class item remaining');
});

test('classAssociations restored to original', () => {
  var restored = classItem.system.links.classAssociations;
  assertEqual(restored.length, originalAssociations.length, 'Should have same count as original');
});

test('Archetype flags cleaned up on class item', () => {
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Archetypes flag should be null');
});

test('Original associations backup cleaned up', () => {
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'Backup flag should be null');
});

test('Actor archetype flags cleaned up', () => {
  var actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorArchetypes, null, 'Actor archetype flags should be null');
});

// =====================================================
// Scenario: Multiple copies from multiple modifications
// =====================================================
console.log('\n--- Scenario: Multiple copies deleted on removal ---');

var rogueAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
  { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1, resolvedName: 'Trapfinding' },
  { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3, resolvedName: 'Trap Sense' }
];

var classItem2 = createMockClassItem('Rogue', 10, 'rogue');
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
      description: '<p>Modified sneak attack for acrobat.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
      source: 'auto-parse'
    },
    {
      name: 'Trap Sense (Acrobat)',
      level: 3,
      type: 'modification',
      target: 'trap sense',
      description: '<p>Modified trap sense for acrobat.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3, resolvedName: 'Trap Sense' },
      source: 'auto-parse'
    }
  ]
};

var diff2 = DiffEngine.generateDiff(rogueAssociations, multiModArchetype);

await asyncTest('Apply multi-modification archetype', async () => {
  var result = await Applicator.apply(actor2, classItem2, multiModArchetype, diff2);
  assertEqual(result, true, 'Apply should succeed');
});

test('Two copies exist before removal', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'acrobat'
  );
  assertEqual(copies.length, 2, 'Should have 2 copies');
});

var copyIds2 = [];
test('Record copy IDs for verification', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'acrobat'
  );
  copyIds2 = copies.map(c => c.id);
  assertEqual(copyIds2.length, 2, 'Should have 2 copy IDs');
});

test('Total items: class + 2 copies = 3', () => {
  assertEqual(actor2._items.length, 3, 'Should have 3 items');
});

await asyncTest('Remove multi-modification archetype', async () => {
  var result = await Applicator.remove(actor2, classItem2, 'acrobat');
  assertEqual(result, true, 'Remove should succeed');
});

test('Both copies deleted after removal', () => {
  var copies = actor2.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'acrobat'
  );
  assertEqual(copies.length, 0, 'No copies should remain');
});

test('Both copy IDs no longer findable', () => {
  for (var cId of copyIds2) {
    var found = actor2.items.find(i => i.id === cId);
    assertEqual(found, undefined, 'Copy should not be findable');
  }
});

test('Only class item remains', () => {
  assertEqual(actor2._items.length, 1, 'Should have only class item');
});

test('Class item still has correct name', () => {
  assertEqual(actor2._items[0].name, 'Rogue', 'Class item name unchanged');
});

// =====================================================
// Scenario: Removal when no copies exist (replacement-only)
// =====================================================
console.log('\n--- Scenario: Removal with no copies (replacement-only) ---');

var classItem3 = createMockClassItem('Fighter', 5, 'fighter3');
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
      description: '<p>Replaces Bravery.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2, resolvedName: 'Bravery' },
      source: 'auto-parse'
    }
  ]
};

var diff3 = DiffEngine.generateDiff(simpleAssociations, replaceOnlyArchetype);

await asyncTest('Apply replacement-only archetype', async () => {
  var result = await Applicator.apply(actor3, classItem3, replaceOnlyArchetype, diff3);
  assertEqual(result, true, 'Apply should succeed');
});

test('No copies created for replacement-only', () => {
  var copies = actor3.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 0, 'No copies should exist');
});

await asyncTest('Remove replacement-only archetype succeeds cleanly', async () => {
  var result = await Applicator.remove(actor3, classItem3, 'simple-archetype');
  assertEqual(result, true, 'Remove should succeed');
});

test('Actor still has only class item after removal', () => {
  assertEqual(actor3._items.length, 1, 'Only class item should remain');
});

test('No delete calls for copies (nothing to delete)', () => {
  // When no copies exist, _deleteCreatedCopies should not call deleteEmbeddedDocuments
  // (or call it with empty array — both are acceptable)
  var deleteCalls = actor3._deleteEmbeddedCalls.filter(c => c.type === 'Item');
  if (deleteCalls.length > 0) {
    // If called, it should have been with no IDs or empty array
    assertEqual(deleteCalls[0].ids.length, 0, 'Should not have deleted any items');
  }
  // Either 0 calls or 0 IDs is fine
  assert(true, 'No copies to delete');
});

// =====================================================
// Scenario: Two archetypes with copies - only one removed
// =====================================================
console.log('\n--- Scenario: Selective removal (only target archetype copies deleted) ---');

var rogueAssociations2 = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
  { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1, resolvedName: 'Trapfinding' },
  { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3, resolvedName: 'Trap Sense' }
];

var classItem4 = createMockClassItem('Rogue', 10, 'rogue2');
classItem4.system.links.classAssociations = JSON.parse(JSON.stringify(rogueAssociations2));

var actor4 = createEnhancedMockActor('Rogue Multi-Arch', [classItem4]);

// First archetype: modifies Sneak Attack
var archA = {
  name: 'Archetype A',
  slug: 'archetype-a',
  class: 'Rogue',
  features: [
    {
      name: 'Modified Sneak Attack A',
      level: 1,
      type: 'modification',
      target: 'sneak attack',
      description: '<p>Archetype A modifies Sneak Attack.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
      source: 'auto-parse'
    }
  ]
};

// Second archetype: modifies Trap Sense (no conflict with archA)
var archB = {
  name: 'Archetype B',
  slug: 'archetype-b',
  class: 'Rogue',
  features: [
    {
      name: 'Modified Trap Sense B',
      level: 3,
      type: 'modification',
      target: 'trap sense',
      description: '<p>Archetype B modifies Trap Sense.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.TrapSense1', level: 3, resolvedName: 'Trap Sense' },
      source: 'auto-parse'
    }
  ]
};

// Apply both archetypes
var diffA = DiffEngine.generateDiff(rogueAssociations2, archA);
await asyncTest('Apply Archetype A (modifies Sneak Attack)', async () => {
  var result = await Applicator.apply(actor4, classItem4, archA, diffA);
  assertEqual(result, true, 'Apply A should succeed');
});

// Need to update associations for second archetype diff
var updatedAssocs4 = classItem4.system.links.classAssociations;
var diffB = DiffEngine.generateDiff(updatedAssocs4, archB);
await asyncTest('Apply Archetype B (modifies Trap Sense)', async () => {
  var result = await Applicator.apply(actor4, classItem4, archB, diffB);
  assertEqual(result, true, 'Apply B should succeed');
});

test('Two copies exist (one from each archetype)', () => {
  var copiesA = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'archetype-a'
  );
  var copiesB = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'archetype-b'
  );
  assertEqual(copiesA.length, 1, 'Should have 1 copy from Archetype A');
  assertEqual(copiesB.length, 1, 'Should have 1 copy from Archetype B');
});

test('Total items: class + 2 copies = 3', () => {
  assertEqual(actor4._items.length, 3, 'Should have 3 items');
});

// Remove only Archetype B
// Note: with 2 archetypes, remove goes through selective removal path
// The current implementation handles last-archetype and multi-archetype differently
// For the last archetype it restores from backup; for non-last it just removes the slug

await asyncTest('Remove only Archetype B', async () => {
  var result = await Applicator.remove(actor4, classItem4, 'archetype-b');
  assertEqual(result, true, 'Remove B should succeed');
});

test('Archetype B copy deleted', () => {
  var copiesB = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'archetype-b'
  );
  assertEqual(copiesB.length, 0, 'Archetype B copies should be deleted');
});

test('Archetype A copy still exists (untouched)', () => {
  var copiesA = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'archetype-a'
  );
  assertEqual(copiesA.length, 1, 'Archetype A copy should remain');
});

test('Archetype A copy name unchanged', () => {
  var copiesA = actor4.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'archetype-a'
  );
  assertEqual(copiesA[0].name, 'Modified Sneak Attack A (Archetype A)', 'Name should be unchanged');
});

test('Class item still exists', () => {
  var classItems = actor4._items.filter(i => i.type === 'class');
  assertEqual(classItems.length, 1, 'Class item should still exist');
});

test('Total items after removing B: class + 1 copy from A = 2', () => {
  assertEqual(actor4._items.length, 2, 'Should have 2 items');
});

// =====================================================
// Direct _deleteCreatedCopies testing
// =====================================================
console.log('\n--- Direct _deleteCreatedCopies testing ---');

await asyncTest('_deleteCreatedCopies with matching slug deletes copies', async () => {
  var testClassItem = createMockClassItem('Test', 5, 'test');
  var testActor = createEnhancedMockActor('Direct Test', [testClassItem]);

  // Manually add items that simulate created copies
  var mockCopy1 = {
    id: 'copy-1',
    name: 'Copy 1',
    flags: { 'archetype-manager': { createdByArchetype: 'target-slug', isModifiedCopy: true } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
  };
  var mockCopy2 = {
    id: 'copy-2',
    name: 'Copy 2',
    flags: { 'archetype-manager': { createdByArchetype: 'other-slug', isModifiedCopy: true } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
  };
  testActor._items.push(mockCopy1, mockCopy2);

  assertEqual(testActor._items.length, 3, 'Should start with 3 items');

  await Applicator._deleteCreatedCopies(testActor, 'target-slug');

  assertEqual(testActor._items.length, 2, 'Should have 2 items after delete');

  var remaining = testActor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'target-slug'
  );
  assertEqual(remaining.length, 0, 'Target slug copies should be gone');

  var otherRemaining = testActor.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'other-slug'
  );
  assertEqual(otherRemaining.length, 1, 'Other slug copies should remain');
});

await asyncTest('_deleteCreatedCopies with no matching copies does nothing', async () => {
  var testActor = createEnhancedMockActor('Empty Test', []);
  var mockItem = {
    id: 'non-copy',
    name: 'Regular Item',
    flags: {},
    getFlag(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
  };
  testActor._items.push(mockItem);

  await Applicator._deleteCreatedCopies(testActor, 'nonexistent-slug');

  assertEqual(testActor._items.length, 1, 'Regular item should remain');
  assertEqual(testActor._items[0].id, 'non-copy', 'Regular item ID unchanged');
});

await asyncTest('_deleteCreatedCopies on actor with no items does not throw', async () => {
  var testActor = createEnhancedMockActor('No Items', []);
  // Should not throw
  await Applicator._deleteCreatedCopies(testActor, 'any-slug');
  assertEqual(testActor._items.length, 0, 'Still empty');
});

// =====================================================
// Scenario: Apply and remove cycle is repeatable
// =====================================================
console.log('\n--- Scenario: Apply-remove-apply-remove cycle ---');

var classItem5 = createMockClassItem('Fighter', 10, 'fighter5');
classItem5.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actor5 = createEnhancedMockActor('Cycle Fighter', [classItem5]);

// Cycle 1: Apply
var diff5 = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
await asyncTest('Cycle 1: Apply creates copy', async () => {
  var result = await Applicator.apply(actor5, classItem5, twoHandedFighterParsed, diff5);
  assertEqual(result, true, 'Apply should succeed');
  var copies = actor5.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 1, 'Should have 1 copy');
});

// Cycle 1: Remove
await asyncTest('Cycle 1: Remove deletes copy', async () => {
  var result = await Applicator.remove(actor5, classItem5, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
  var copies = actor5.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 0, 'No copies should remain');
});

// Cycle 2: Re-apply (should work cleanly)
var resolvedAfterRestore = classItem5.system.links.classAssociations;
var diff5b = DiffEngine.generateDiff(resolvedAfterRestore, twoHandedFighterParsed);
await asyncTest('Cycle 2: Re-apply creates new copy', async () => {
  var result = await Applicator.apply(actor5, classItem5, twoHandedFighterParsed, diff5b);
  assertEqual(result, true, 'Re-apply should succeed');
  var copies = actor5.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 1, 'Should have 1 new copy');
});

// Cycle 2: Remove again
await asyncTest('Cycle 2: Remove deletes new copy', async () => {
  var result = await Applicator.remove(actor5, classItem5, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
  var copies = actor5.items.filter(
    i => i.getFlag && i.getFlag('archetype-manager', 'isModifiedCopy') === true
  );
  assertEqual(copies.length, 0, 'No copies after second removal');
});

test('Only class item remains after full cycle', () => {
  assertEqual(actor5._items.length, 1, 'Should have only class item');
  assertEqual(actor5._items[0].type, 'class', 'Remaining item should be class');
});

// =====================================================
// Summary
// =====================================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #44 Results: ${passed}/${totalTests} tests passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
