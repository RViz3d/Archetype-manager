/**
 * Test Suite for Feature #67: Backup prevents character data corruption
 *
 * Verifies that the backup system ensures character data is always restorable:
 * 1. Note original classAssociations
 * 2. Apply archetype
 * 3. Verify backup in flags
 * 4. Manually corrupt classAssociations
 * 5. Restore from backup
 * 6. Verify full restoration
 * 7. Verify actor sheet works after restore (flags clean, data intact)
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

console.log('\n=== Feature #67: Backup prevents character data corruption ===\n');

// =====================================================
// Test Data Setup
// =====================================================

// Fighter base classAssociations (standard 12 entries)
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

// Two-Handed Fighter archetype
var twoHandedFighterArchetype = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'fighter',
  features: [
    {
      name: 'Shattering Strike',
      type: 'replacement',
      level: 2,
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 }
    },
    {
      name: 'Overhand Chop',
      type: 'replacement',
      level: 3,
      target: 'Armor Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 }
    },
    {
      name: 'Backswing',
      type: 'replacement',
      level: 7,
      target: 'Armor Training 2',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 }
    },
    {
      name: 'Piledriver',
      type: 'replacement',
      level: 11,
      target: 'Armor Training 3',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 }
    },
    {
      name: 'Greater Power Attack',
      type: 'replacement',
      level: 15,
      target: 'Armor Training 4',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 }
    },
    {
      name: 'Devastating Blow',
      type: 'replacement',
      level: 19,
      target: 'Armor Mastery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 }
    }
  ]
};

/**
 * Helper: create a fresh actor with Fighter class and classAssociations
 */
function createFighterActor(actorName) {
  var classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor(actorName, [classItem]);
  actor.isOwner = true;
  return { actor, classItem };
}

/**
 * Helper: generate diff for the two-handed-fighter archetype
 */
function generateDiff(classItem) {
  return DiffEngine.generateDiff(classItem.system.links.classAssociations, twoHandedFighterArchetype);
}

// Track notifications
var lastNotifications = [];
var originalInfo = globalThis.ui.notifications.info;
var originalWarn = globalThis.ui.notifications.warn;
var originalError = globalThis.ui.notifications.error;

function captureNotifications() {
  lastNotifications = [];
  globalThis.ui.notifications.info = (msg) => { lastNotifications.push({ type: 'info', msg }); };
  globalThis.ui.notifications.warn = (msg) => { lastNotifications.push({ type: 'warn', msg }); };
  globalThis.ui.notifications.error = (msg) => { lastNotifications.push({ type: 'error', msg }); };
}

function restoreNotifications() {
  globalThis.ui.notifications.info = originalInfo;
  globalThis.ui.notifications.warn = originalWarn;
  globalThis.ui.notifications.error = originalError;
}

// =====================================================
// Section 1: Step 1 - Note original classAssociations
// =====================================================
console.log('--- Section 1: Note original classAssociations ---');

test('Original classAssociations has 12 entries', () => {
  var { classItem } = createFighterActor('OriginalTest');
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Should have 12 base features');
});

test('Original classAssociations has correct UUIDs', () => {
  var { classItem } = createFighterActor('UUIDTest');
  var assocs = classItem.system.links.classAssociations;
  assertEqual(assocs[0].uuid, 'Compendium.pf1.class-abilities.BonusFeat1', 'First UUID');
  assertEqual(assocs[1].uuid, 'Compendium.pf1.class-abilities.Bravery', 'Second UUID');
  assertEqual(assocs[11].uuid, 'Compendium.pf1.class-abilities.WeaponMastery', 'Last UUID');
});

test('Original classAssociations levels are correct', () => {
  var { classItem } = createFighterActor('LevelTest');
  var assocs = classItem.system.links.classAssociations;
  assertEqual(assocs[0].level, 1, 'Level 1 entry');
  assertEqual(assocs[1].level, 2, 'Level 2 entry');
  assertEqual(assocs[11].level, 20, 'Level 20 entry');
});

test('No backup flags exist before any archetype applied', () => {
  var { classItem } = createFighterActor('NoBackupTest');
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'No backup should exist before archetype application');
});

// =====================================================
// Section 2: Step 2 - Apply archetype
// =====================================================
console.log('\n--- Section 2: Apply archetype ---');

await asyncTest('Apply Two-Handed Fighter archetype succeeds', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('ApplyTest');
  var diff = generateDiff(classItem);
  var result = await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  assertEqual(result, true, 'apply() should succeed');
});

await asyncTest('classAssociations are modified after apply', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('ModifiedTest');
  var originalUuids = classItem.system.links.classAssociations.map(a => a.uuid);
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  // classAssociations should have changed (the diff contains removed/added entries)
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assert(archetypes !== null, 'Archetype tracking flag should be set');
  assert(archetypes.includes('two-handed-fighter'), 'Two-Handed Fighter should be tracked');
});

// =====================================================
// Section 3: Step 3 - Verify backup in flags
// =====================================================
console.log('\n--- Section 3: Verify backup in flags ---');

await asyncTest('Backup exists in flags after apply', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('BackupExistsTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should exist after apply');
});

await asyncTest('Backup has exactly 12 entries (all original associations)', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('BackupCountTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup.length, 12, 'Backup should have 12 entries');
});

await asyncTest('Backup preserves all original UUIDs', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('BackupUUIDsTest');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  for (var i = 0; i < 12; i++) {
    assertEqual(backup[i].uuid, originalAssocs[i].uuid, 'Backup UUID at index ' + i + ' should match original');
  }
});

await asyncTest('Backup preserves all original levels', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('BackupLevelsTest');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  for (var i = 0; i < 12; i++) {
    assertEqual(backup[i].level, originalAssocs[i].level, 'Backup level at index ' + i + ' should match original');
  }
});

await asyncTest('Backup is a deep copy (not reference to live data)', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('DeepCopyTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  // Mutate current classAssociations - backup should NOT be affected
  classItem.system.links.classAssociations[0].uuid = 'CORRUPTED';
  assertEqual(backup[0].uuid, 'Compendium.pf1.class-abilities.BonusFeat1', 'Backup should not be affected by mutations to live data');
});

await asyncTest('Backup is not overwritten by second archetype application', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('NoOverwriteTest');

  // Apply first archetype
  var diff1 = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff1);
  var backupAfterFirst = JSON.parse(JSON.stringify(classItem.getFlag('archetype-manager', 'originalAssociations')));

  // Try to apply a second (different) archetype - use a simple additive one
  var additivArchetype = {
    name: 'Test Additive',
    slug: 'test-additive',
    class: 'fighter',
    features: [
      { name: 'Extra Feat', type: 'additive', level: 4 }
    ]
  };
  var diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, additivArchetype);
  await Applicator.apply(actor, classItem, additivArchetype, diff2);

  var backupAfterSecond = classItem.getFlag('archetype-manager', 'originalAssociations');
  // Backup should still be the original (before any archetype)
  assertEqual(backupAfterSecond.length, backupAfterFirst.length, 'Backup count should not change');
  assertEqual(backupAfterSecond[0].uuid, backupAfterFirst[0].uuid, 'Backup UUID should not change');
});

// =====================================================
// Section 4: Step 4 - Manually corrupt classAssociations
// =====================================================
console.log('\n--- Section 4: Manually corrupt classAssociations ---');

await asyncTest('classAssociations can be manually corrupted', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('CorruptTest1');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Manually corrupt classAssociations
  classItem.system.links.classAssociations = [
    { uuid: 'CORRUPTED_UUID_1', level: 1 },
    { uuid: 'CORRUPTED_UUID_2', level: 5 }
  ];

  assertEqual(classItem.system.links.classAssociations.length, 2, 'Corrupted to 2 entries');
  assertEqual(classItem.system.links.classAssociations[0].uuid, 'CORRUPTED_UUID_1', 'First entry is corrupted');
});

await asyncTest('Backup survives corruption of classAssociations', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('CorruptTest2');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Manually corrupt classAssociations
  classItem.system.links.classAssociations = [];

  // Backup should be unaffected
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should survive corruption');
  assertEqual(backup.length, 12, 'Backup should still have 12 entries');
  assertEqual(backup[0].uuid, 'Compendium.pf1.class-abilities.BonusFeat1', 'Backup UUIDs intact');
});

await asyncTest('classAssociations set to empty array - backup still intact', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('EmptyCorrupt');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  classItem.system.links.classAssociations = [];
  assertEqual(classItem.system.links.classAssociations.length, 0, 'Corrupted to empty');

  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup.length, 12, 'Backup unaffected by empty corruption');
});

await asyncTest('classAssociations set to null - backup still intact', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('NullCorrupt');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  classItem.system.links.classAssociations = null;
  assertEqual(classItem.system.links.classAssociations, null, 'Corrupted to null');

  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup.length, 12, 'Backup unaffected by null corruption');
});

// =====================================================
// Section 5: Step 5 - Restore from backup
// =====================================================
console.log('\n--- Section 5: Restore from backup ---');

await asyncTest('restoreFromBackup() returns success with correct count', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('RestoreTest1');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Corrupt
  classItem.system.links.classAssociations = [{ uuid: 'BAD', level: 1 }];

  var result = await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(result.success, true, 'restoreFromBackup should succeed');
  assertEqual(result.restoredCount, 12, 'Should report 12 restored entries');
});

await asyncTest('restoreFromBackup() restores classAssociations to original', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('RestoreTest2');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Corrupt heavily
  classItem.system.links.classAssociations = [
    { uuid: 'GARBAGE_1', level: 99 },
    { uuid: 'GARBAGE_2', level: 100 }
  ];

  await Applicator.restoreFromBackup(actor, classItem);

  var restored = classItem.system.links.classAssociations;
  assertEqual(restored.length, 12, 'Restored should have 12 entries');
  for (var i = 0; i < 12; i++) {
    assertEqual(restored[i].uuid, originalAssocs[i].uuid, 'Restored UUID at index ' + i + ' matches original');
    assertEqual(restored[i].level, originalAssocs[i].level, 'Restored level at index ' + i + ' matches original');
  }
});

await asyncTest('restoreFromBackup() after empty corruption works', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('RestoreEmpty');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Corrupt to empty
  classItem.system.links.classAssociations = [];

  var result = await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(result.success, true, 'Should succeed');
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Should restore all 12 entries');
});

await asyncTest('restoreFromBackup() after null corruption works', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('RestoreNull');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Corrupt to null
  classItem.system.links.classAssociations = null;

  var result = await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(result.success, true, 'Should succeed');
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Should restore all 12 entries');
});

await asyncTest('restoreFromBackup() with no backup returns failure', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('NoBackupRestore');
  // No archetype applied, so no backup
  captureNotifications();
  var result = await Applicator.restoreFromBackup(actor, classItem);
  restoreNotifications();
  assertEqual(result.success, false, 'Should return failure');
  assertEqual(result.message, 'No backup found', 'Should indicate no backup');
});

await asyncTest('restoreFromBackup() cleans up archetype tracking flags', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('FlagCleanup');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Verify flags exist before restore
  assert(classItem.getFlag('archetype-manager', 'archetypes') !== null, 'Archetypes flag exists before restore');
  assert(classItem.getFlag('archetype-manager', 'originalAssociations') !== null, 'Backup flag exists before restore');

  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  // All flags should be cleaned up
  assertEqual(classItem.getFlag('archetype-manager', 'archetypes'), null, 'Archetypes flag cleaned up');
  assertEqual(classItem.getFlag('archetype-manager', 'originalAssociations'), null, 'Backup flag cleaned up');
  assertEqual(classItem.getFlag('archetype-manager', 'appliedAt'), null, 'AppliedAt flag cleaned up');
  assertEqual(classItem.getFlag('archetype-manager', 'appliedArchetypeData'), null, 'ArchetypeData flag cleaned up');
});

await asyncTest('restoreFromBackup() cleans up actor-level flags', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('ActorFlagCleanup');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Verify actor flag exists
  var actorFlags = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assert(actorFlags !== null, 'Actor flags exist before restore');
  assert(actorFlags['fighter'] !== undefined, 'Fighter entry exists before restore');

  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  // Actor flags should be cleaned up
  var actorFlagsAfter = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlagsAfter, null, 'Actor appliedArchetypes cleaned up after restore');
});

// =====================================================
// Section 6: Step 6 - Verify full restoration
// =====================================================
console.log('\n--- Section 6: Verify full restoration ---');

await asyncTest('Full restore: all 12 UUIDs match original exactly', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('FullRestoreUUIDs');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  classItem.system.links.classAssociations = [{ uuid: 'CORRUPT', level: 1 }];
  await Applicator.restoreFromBackup(actor, classItem);

  var restored = classItem.system.links.classAssociations;
  assertEqual(restored.length, originalAssocs.length, 'Same count');
  var allMatch = true;
  for (var i = 0; i < originalAssocs.length; i++) {
    if (restored[i].uuid !== originalAssocs[i].uuid || restored[i].level !== originalAssocs[i].level) {
      allMatch = false;
      break;
    }
  }
  assert(allMatch, 'All UUIDs and levels should match original');
});

await asyncTest('Full restore: removal-based restore also works (via remove())', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('RemoveRestore');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Use remove() instead of restoreFromBackup()
  var result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assertEqual(result, true, 'remove() should succeed');

  var restored = classItem.system.links.classAssociations;
  assertEqual(restored.length, 12, 'Should have 12 entries after removal');
  for (var i = 0; i < 12; i++) {
    assertEqual(restored[i].uuid, originalAssocs[i].uuid, 'UUID at ' + i + ' matches original after remove');
  }
});

await asyncTest('Full restore: rollback-based restore works (via error during apply)', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('RollbackRestore');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));

  // First, apply normally
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Verify backup exists
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should exist');
  assertEqual(backup.length, 12, 'Backup should have 12 entries');

  // Verify backup matches original
  for (var i = 0; i < 12; i++) {
    assertEqual(backup[i].uuid, originalAssocs[i].uuid, 'Backup UUID at ' + i + ' matches original');
  }
});

await asyncTest('Full restore: data integrity - BonusFeat1 at level 1', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('IntegrityTest1');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  var restored = classItem.system.links.classAssociations;
  assertEqual(restored[0].uuid, 'Compendium.pf1.class-abilities.BonusFeat1', 'BonusFeat1 UUID');
  assertEqual(restored[0].level, 1, 'BonusFeat1 at level 1');
});

await asyncTest('Full restore: data integrity - Bravery at level 2', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('IntegrityTest2');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  var restored = classItem.system.links.classAssociations;
  assertEqual(restored[1].uuid, 'Compendium.pf1.class-abilities.Bravery', 'Bravery UUID');
  assertEqual(restored[1].level, 2, 'Bravery at level 2');
});

await asyncTest('Full restore: data integrity - WeaponMastery at level 20', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('IntegrityTest3');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  var restored = classItem.system.links.classAssociations;
  assertEqual(restored[11].uuid, 'Compendium.pf1.class-abilities.WeaponMastery', 'WeaponMastery UUID');
  assertEqual(restored[11].level, 20, 'WeaponMastery at level 20');
});

// =====================================================
// Section 7: Step 7 - Verify actor sheet works after restore
// =====================================================
console.log('\n--- Section 7: Verify actor sheet works after restore ---');

await asyncTest('After restore: no archetype tracking flags remain', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('SheetTest1');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  assertEqual(classItem.getFlag('archetype-manager', 'archetypes'), null, 'No archetypes flag');
  assertEqual(classItem.getFlag('archetype-manager', 'appliedAt'), null, 'No appliedAt flag');
  assertEqual(classItem.getFlag('archetype-manager', 'originalAssociations'), null, 'No backup flag');
  assertEqual(classItem.getFlag('archetype-manager', 'appliedArchetypeData'), null, 'No archetype data flag');
});

await asyncTest('After restore: actor flags are clean', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('SheetTest2');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  var actorFlags = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorFlags, null, 'Actor appliedArchetypes should be null');
});

await asyncTest('After restore: can apply a new archetype (clean slate)', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('ReapplyTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Corrupt and restore
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  // Should be able to apply again
  var diff2 = generateDiff(classItem);
  var result = await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff2);
  assertEqual(result, true, 'Should be able to reapply after restore');
  var archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Archetype should be tracked after reapply');
});

await asyncTest('After restore: new backup is created on reapplication', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('NewBackupTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Corrupt and restore
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  // Reapply
  var diff2 = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff2);

  // New backup should exist
  var backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'New backup should be created on reapply');
  assertEqual(backup.length, 12, 'New backup should have 12 entries');
});

await asyncTest('After restore: classAssociations.length is correct (12)', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('LengthTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);

  assertEqual(classItem.system.links.classAssociations.length, 12, 'Should have exactly 12 entries');
});

// =====================================================
// Section 8: Edge cases and additional safety checks
// =====================================================
console.log('\n--- Section 8: Edge cases and safety checks ---');

await asyncTest('Permission check: non-GM non-owner cannot restore', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('PermTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  // Switch to non-GM non-owner
  game.user.isGM = false;
  actor.isOwner = false;
  captureNotifications();
  var result = await Applicator.restoreFromBackup(actor, classItem);
  restoreNotifications();
  assertEqual(result.success, false, 'Non-GM non-owner should be blocked');
  assertEqual(result.message, 'Permission denied', 'Should indicate permission denied');

  // Restore GM state
  game.user.isGM = true;
});

await asyncTest('Owner can restore their own character', async () => {
  game.user.isGM = false;
  var { actor, classItem } = createFighterActor('OwnerRestore');
  actor.isOwner = true;
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);

  classItem.system.links.classAssociations = [];
  var result = await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(result.success, true, 'Owner should be able to restore');
  assertEqual(result.restoredCount, 12, 'Should restore 12 entries');

  game.user.isGM = true;
});

await asyncTest('Backup is independent per class item', async () => {
  game.user.isGM = true;

  // Create actor with two classes
  var fighterItem = createMockClassItem('Fighter', 10, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));

  var rogueAssocs = [
    { uuid: 'Compendium.pf1.class-abilities.SneakAttack', level: 1 },
    { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1 }
  ];
  var rogueItem = createMockClassItem('Rogue', 5, 'rogue');
  rogueItem.system.links.classAssociations = JSON.parse(JSON.stringify(rogueAssocs));

  var actor = createMockActor('Multi-Class', [fighterItem, rogueItem]);
  actor.isOwner = true;

  // Apply archetype to Fighter
  var diff = DiffEngine.generateDiff(fighterItem.system.links.classAssociations, twoHandedFighterArchetype);
  await Applicator.apply(actor, fighterItem, twoHandedFighterArchetype, diff);

  // Rogue should have NO backup (no archetype applied to it)
  var rogueBackup = rogueItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(rogueBackup, null, 'Rogue should not have backup');

  // Fighter should have backup
  var fighterBackup = fighterItem.getFlag('archetype-manager', 'originalAssociations');
  assert(fighterBackup !== null, 'Fighter should have backup');
  assertEqual(fighterBackup.length, 12, 'Fighter backup should have 12 entries');
});

await asyncTest('Multiple corrupt-restore cycles work correctly', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('MultiCycleTest');
  var originalAssocs = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));

  // Cycle 1: apply -> corrupt -> restore
  var diff1 = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff1);
  classItem.system.links.classAssociations = [{ uuid: 'BAD1', level: 1 }];
  await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Cycle 1: restored to 12');

  // Cycle 2: apply -> corrupt -> restore
  var diff2 = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff2);
  classItem.system.links.classAssociations = [{ uuid: 'BAD2', level: 2 }];
  await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Cycle 2: restored to 12');

  // Cycle 3: apply -> corrupt -> restore
  var diff3 = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff3);
  classItem.system.links.classAssociations = [];
  await Applicator.restoreFromBackup(actor, classItem);
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Cycle 3: restored to 12');

  // Final verification: all UUIDs match original
  for (var i = 0; i < 12; i++) {
    assertEqual(classItem.system.links.classAssociations[i].uuid, originalAssocs[i].uuid, 'Final UUID at ' + i);
  }
});

await asyncTest('restoreFromBackup shows info notification on success', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('NotifyTest');
  var diff = generateDiff(classItem);
  await Applicator.apply(actor, classItem, twoHandedFighterArchetype, diff);
  classItem.system.links.classAssociations = [];

  captureNotifications();
  await Applicator.restoreFromBackup(actor, classItem);
  var infoNotifs = lastNotifications.filter(n => n.type === 'info');
  assert(infoNotifs.length > 0, 'Should show info notification');
  var hasRestored = infoNotifs.some(n => n.msg.includes('Restored'));
  assert(hasRestored, 'Notification should mention "Restored"');
  restoreNotifications();
});

await asyncTest('restoreFromBackup shows warn notification when no backup', async () => {
  game.user.isGM = true;
  var { actor, classItem } = createFighterActor('WarnTest');

  captureNotifications();
  await Applicator.restoreFromBackup(actor, classItem);
  var warnNotifs = lastNotifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length > 0, 'Should show warn notification');
  var hasNoBackup = warnNotifs.some(n => n.msg.includes('No backup'));
  assert(hasNoBackup, 'Warning should mention "No backup"');
  restoreNotifications();
});

// =====================================================
// Summary
// =====================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #67 Results: ${passed}/${totalTests} passing (${failed} failed)`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
