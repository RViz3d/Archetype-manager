/**
 * Test Suite for Feature #43: Full removal restores original classAssociations
 *
 * Verifies that Applicator.remove() correctly restores classAssociations from backup.
 *
 * Steps:
 * 1. Note original classAssociations
 * 2. Apply Two-Handed Fighter
 * 3. Verify modified
 * 4. Remove archetype
 * 5. Verify classAssociations match original
 * 6. All archetype UUIDs gone
 * 7. All base UUIDs restored
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

var { Applicator } = await import('../scripts/applicator.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #43: Full removal restores original classAssociations ===\n');

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

// Two-Handed Fighter archetype
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
      type: 'modification',
      target: 'weapon training 1',
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
// Step 1: Note original classAssociations
// =====================================================
console.log('--- Step 1: Note original classAssociations ---');

var classItem;
var actor;
var originalAssociations;

await asyncTest('Create Fighter with original classAssociations', async () => {
  classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
  originalAssociations = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  assertEqual(originalAssociations.length, 12, 'Should have 12 original associations');
});

await asyncTest('Create mock actor', async () => {
  // Create actor with item tracking for _deleteCreatedCopies
  var items = [classItem];
  actor = {
    id: 'actor-1',
    name: 'Test Fighter',
    isOwner: true,
    items: {
      filter: (fn) => items.filter(fn),
      find: (fn) => items.find(fn),
      get: (id) => items.find(i => i.id === id),
      map: (fn) => items.map(fn),
      [Symbol.iterator]: () => items[Symbol.iterator]()
    },
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key] ?? null; },
    async setFlag(scope, key, value) {
      if (!this.flags[scope]) this.flags[scope] = {};
      this.flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (this.flags[scope]) delete this.flags[scope][key];
    },
    async createEmbeddedDocuments(type, data) {
      var created = data.map(d => {
        var newItem = {
          ...d,
          id: Math.random().toString(36).slice(2),
          getFlag(scope, key) { return d.flags?.[scope]?.[key] ?? null; }
        };
        items.push(newItem);
        return newItem;
      });
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (var delId of ids) {
        var idx = items.findIndex(i => i.id === delId);
        if (idx >= 0) items.splice(idx, 1);
      }
      return ids;
    }
  };
  assertEqual(actor.name, 'Test Fighter');
});

test('Verify original UUIDs present', () => {
  var uuids = originalAssociations.map(a => a.uuid);
  assert(uuids.includes('Compendium.pf1.class-abilities.BonusFeat1'), 'BonusFeat1');
  assert(uuids.includes('Compendium.pf1.class-abilities.Bravery'), 'Bravery');
  assert(uuids.includes('Compendium.pf1.class-abilities.ArmorTraining1'), 'AT1');
  assert(uuids.includes('Compendium.pf1.class-abilities.ArmorTraining2'), 'AT2');
  assert(uuids.includes('Compendium.pf1.class-abilities.ArmorTraining3'), 'AT3');
  assert(uuids.includes('Compendium.pf1.class-abilities.ArmorTraining4'), 'AT4');
  assert(uuids.includes('Compendium.pf1.class-abilities.ArmorMastery'), 'ArmorMastery');
  assert(uuids.includes('Compendium.pf1.class-abilities.WeaponTraining1'), 'WT1');
  assert(uuids.includes('Compendium.pf1.class-abilities.WeaponTraining2'), 'WT2');
  assert(uuids.includes('Compendium.pf1.class-abilities.WeaponTraining3'), 'WT3');
  assert(uuids.includes('Compendium.pf1.class-abilities.WeaponTraining4'), 'WT4');
  assert(uuids.includes('Compendium.pf1.class-abilities.WeaponMastery'), 'WeaponMastery');
});

// =====================================================
// Step 2: Apply Two-Handed Fighter
// =====================================================
console.log('\n--- Step 2: Apply Two-Handed Fighter ---');

var diff;
await asyncTest('Generate diff and apply archetype', async () => {
  diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var result = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff);
  assertEqual(result, true, 'Apply should succeed');
});

test('Archetype tracking flag set', () => {
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Archetypes flag should exist');
  assert(archetypes.includes('two-handed-fighter'), 'Should have two-handed-fighter');
});

test('Backup stored in flags', () => {
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'Backup should exist');
  assertEqual(backup.length, 12, 'Backup should have 12 entries');
});

// =====================================================
// Step 3: Verify modified
// =====================================================
console.log('\n--- Step 3: Verify classAssociations were modified ---');

test('classAssociations was updated by Applicator', () => {
  var current = classItem.system.links.classAssociations;
  assert(Array.isArray(current), 'Should be array');
  // Verify archetype tracking confirms modification happened
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 1, 'One archetype applied');
});

test('appliedAt timestamp exists', () => {
  var appliedAt = classItem.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'appliedAt should exist');
});

test('Actor flag tracks applied archetype', () => {
  var actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorArchetypes, 'Actor archetypes should exist');
  assertNotNull(actorArchetypes['fighter'], 'Fighter class entry should exist');
  assert(actorArchetypes['fighter'].includes('two-handed-fighter'), 'Should include THF');
});

test('Item copies created for modified features', () => {
  // The modification creates a copy item
  var copies = actor.items.filter(i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'two-handed-fighter');
  assertEqual(copies.length, 1, 'Should have 1 modified feature copy');
});

// =====================================================
// Step 4: Remove archetype
// =====================================================
console.log('\n--- Step 4: Remove archetype ---');

var removeResult;
await asyncTest('Remove Two-Handed Fighter archetype', async () => {
  removeResult = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assertEqual(removeResult, true, 'Remove should succeed');
});

// =====================================================
// Step 5: Verify classAssociations match original
// =====================================================
console.log('\n--- Step 5: Verify classAssociations match original ---');

await asyncTest('classAssociations restored to original', async () => {
  var restored = classItem.system.links.classAssociations;
  assertDeepEqual(restored, originalAssociations,
    'Restored classAssociations should match original exactly');
});

await asyncTest('Restored associations have same count as original', async () => {
  var restored = classItem.system.links.classAssociations;
  assertEqual(restored.length, 12, 'Should have 12 entries again');
});

await asyncTest('Restored associations have same order as original', async () => {
  var restored = classItem.system.links.classAssociations;
  for (var i = 0; i < originalAssociations.length; i++) {
    assertEqual(restored[i].uuid, originalAssociations[i].uuid,
      `Entry ${i} UUID should match: ${restored[i].uuid} vs ${originalAssociations[i].uuid}`);
    assertEqual(restored[i].level, originalAssociations[i].level,
      `Entry ${i} level should match: ${restored[i].level} vs ${originalAssociations[i].level}`);
  }
});

// =====================================================
// Step 6: All archetype UUIDs gone
// =====================================================
console.log('\n--- Step 6: All archetype tracking removed ---');

test('Archetypes flag cleared', () => {
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Archetypes flag should be null (unset)');
});

test('originalAssociations flag cleared', () => {
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'Backup flag should be null (unset)');
});

test('appliedAt flag cleared', () => {
  var appliedAt = classItem.getFlag('archetype-manager', 'appliedAt');
  assertEqual(appliedAt, null, 'appliedAt flag should be null (unset)');
});

test('Actor archetype flags cleaned up', () => {
  var actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  // After removal of last archetype, the actor flags should be cleaned up
  // The remove method sets to null when no more archetypes
  assertEqual(actorArchetypes, null, 'Actor archetypes should be null');
});

test('Item copies deleted', () => {
  var copies = actor.items.filter(i => i.getFlag && i.getFlag('archetype-manager', 'createdByArchetype') === 'two-handed-fighter');
  assertEqual(copies.length, 0, 'No modified feature copies should remain');
});

// =====================================================
// Step 7: All base UUIDs restored
// =====================================================
console.log('\n--- Step 7: All base UUIDs restored ---');

test('Bonus Feat UUID restored at level 1', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.BonusFeat1');
  assertNotNull(entry, 'Bonus Feat should be restored');
  assertEqual(entry.level, 1, 'Bonus Feat at level 1');
});

test('Bravery UUID restored at level 2', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.Bravery');
  assertNotNull(entry, 'Bravery should be restored');
  assertEqual(entry.level, 2, 'Bravery at level 2');
});

test('Armor Training 1 UUID restored at level 3', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.ArmorTraining1');
  assertNotNull(entry, 'AT1 should be restored');
  assertEqual(entry.level, 3, 'AT1 at level 3');
});

test('Weapon Training 1 UUID restored at level 5', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1');
  assertNotNull(entry, 'WT1 should be restored');
  assertEqual(entry.level, 5, 'WT1 at level 5');
});

test('Armor Training 2 UUID restored at level 7', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.ArmorTraining2');
  assertNotNull(entry, 'AT2 should be restored');
  assertEqual(entry.level, 7, 'AT2 at level 7');
});

test('Weapon Training 2 UUID restored at level 9', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining2');
  assertNotNull(entry, 'WT2 should be restored');
  assertEqual(entry.level, 9, 'WT2 at level 9');
});

test('Armor Training 3 UUID restored at level 11', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.ArmorTraining3');
  assertNotNull(entry, 'AT3 should be restored');
  assertEqual(entry.level, 11, 'AT3 at level 11');
});

test('Weapon Training 3 UUID restored at level 13', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining3');
  assertNotNull(entry, 'WT3 should be restored');
  assertEqual(entry.level, 13, 'WT3 at level 13');
});

test('Armor Training 4 UUID restored at level 15', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.ArmorTraining4');
  assertNotNull(entry, 'AT4 should be restored');
  assertEqual(entry.level, 15, 'AT4 at level 15');
});

test('Weapon Training 4 UUID restored at level 17', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining4');
  assertNotNull(entry, 'WT4 should be restored');
  assertEqual(entry.level, 17, 'WT4 at level 17');
});

test('Armor Mastery UUID restored at level 19', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.ArmorMastery');
  assertNotNull(entry, 'Armor Mastery should be restored');
  assertEqual(entry.level, 19, 'Armor Mastery at level 19');
});

test('Weapon Mastery UUID restored at level 20', () => {
  var restored = classItem.system.links.classAssociations;
  var entry = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponMastery');
  assertNotNull(entry, 'Weapon Mastery should be restored');
  assertEqual(entry.level, 20, 'Weapon Mastery at level 20');
});

test('All 12 base UUIDs present in restored associations', () => {
  var restored = classItem.system.links.classAssociations;
  var uuids = restored.map(a => a.uuid);
  var expectedUuids = [
    'Compendium.pf1.class-abilities.BonusFeat1',
    'Compendium.pf1.class-abilities.Bravery',
    'Compendium.pf1.class-abilities.ArmorTraining1',
    'Compendium.pf1.class-abilities.WeaponTraining1',
    'Compendium.pf1.class-abilities.ArmorTraining2',
    'Compendium.pf1.class-abilities.WeaponTraining2',
    'Compendium.pf1.class-abilities.ArmorTraining3',
    'Compendium.pf1.class-abilities.WeaponTraining3',
    'Compendium.pf1.class-abilities.ArmorTraining4',
    'Compendium.pf1.class-abilities.WeaponTraining4',
    'Compendium.pf1.class-abilities.ArmorMastery',
    'Compendium.pf1.class-abilities.WeaponMastery'
  ];
  for (var uuid of expectedUuids) {
    assert(uuids.includes(uuid), 'Missing UUID: ' + uuid);
  }
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

await asyncTest('Remove non-existent archetype fails gracefully', async () => {
  var result = await Applicator.remove(actor, classItem, 'nonexistent-archetype');
  assertEqual(result, false, 'Should return false for non-existent archetype');
});

await asyncTest('Apply + remove cycle is idempotent (can repeat)', async () => {
  // Apply again
  var diff2 = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  var applyResult = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff2);
  assertEqual(applyResult, true, 'Second apply should succeed');

  // Verify modified
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Archetype should be applied');

  // Remove again
  var removeResult2 = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assertEqual(removeResult2, true, 'Second remove should succeed');

  // Verify restored
  var restored = classItem.system.links.classAssociations;
  assertDeepEqual(restored, originalAssociations, 'Should match original after second cycle');
});

await asyncTest('Removal cleans up actor flags completely', async () => {
  var actorArch = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorArch, null, 'Actor archetypes should be null after full removal');
});

await asyncTest('Removal with non-owner non-GM fails', async () => {
  // First apply so we have something to remove
  var diff3 = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff3);

  // Switch to non-GM
  var origGM = game.user.isGM;
  game.user.isGM = false;
  var origOwner = actor.isOwner;
  actor.isOwner = false;

  var result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assertEqual(result, false, 'Non-owner non-GM should not be able to remove');

  // Restore
  game.user.isGM = origGM;
  actor.isOwner = origOwner;

  // Clean up - remove the applied archetype
  await Applicator.remove(actor, classItem, 'two-handed-fighter');
});

await asyncTest('Empty class item removal works', async () => {
  var emptyClass = createMockClassItem('Custom', 5, 'custom');
  emptyClass.system.links.classAssociations = [];
  var emptyActor = createMockActor('Empty Actor', [emptyClass]);
  emptyActor.isOwner = true;

  // Apply an additive-only archetype
  var additiveParsed = {
    name: 'Additive Archetype',
    slug: 'additive-archetype',
    features: [{
      name: 'New Ability',
      level: 1,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'manual'
    }]
  };
  var emptyDiff = DiffEngine.generateDiff([], additiveParsed);
  await Applicator.apply(emptyActor, emptyClass, additiveParsed, emptyDiff);

  // Now remove
  var result = await Applicator.remove(emptyActor, emptyClass, 'additive-archetype');
  assertEqual(result, true, 'Should succeed');

  var restored = emptyClass.system.links.classAssociations;
  assertEqual(restored.length, 0, 'Should restore to empty array');
  assertEqual(emptyClass.getFlag('archetype-manager', 'archetypes'), null, 'Flags cleared');
  assertEqual(emptyClass.getFlag('archetype-manager', 'originalAssociations'), null, 'Backup cleared');
});

await asyncTest('Chat message posted on removal', async () => {
  // Apply and remove to test chat message
  var diff4 = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  // Need to re-set classAssociations since they may have been modified
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
  await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff4);

  var chatCreated = false;
  var origCreate = globalThis.ChatMessage.create;
  globalThis.ChatMessage.create = async (data) => {
    chatCreated = true;
    assert(data.content.includes('two-handed-fighter'), 'Chat should mention archetype');
    assert(data.content.includes('Test Fighter'), 'Chat should mention actor');
    return data;
  };

  await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(chatCreated, 'Chat message should have been created on removal');

  globalThis.ChatMessage.create = origCreate;
});

await asyncTest('Restored resolvedName properties preserved', async () => {
  // The restored associations should have the same resolvedName as the original backup
  var restored = classItem.system.links.classAssociations;
  var bravery = restored.find(a => a.uuid === 'Compendium.pf1.class-abilities.Bravery');
  assertNotNull(bravery, 'Bravery should be in restored');
  // resolvedName should still be there from the backup
  assertEqual(bravery.resolvedName, 'Bravery', 'resolvedName should be preserved');
});

// =====================================================
// Summary
// =====================================================
console.log('\n' + '='.repeat(60));
console.log('Feature #43 Results: ' + passed + '/' + totalTests + ' tests passed, ' + failed + ' failed');
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
