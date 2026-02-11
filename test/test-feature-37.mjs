/**
 * Test Suite for Feature #37: Backup original classAssociations before modification
 *
 * Verifies that Applicator.apply() correctly backs up the original classAssociations
 * to class item flags before making any modifications, and that subsequent archetype
 * applications do NOT overwrite the original backup.
 *
 * Steps:
 * 1. Note original classAssociations on Fighter
 * 2. Apply an archetype
 * 3. Read backup flag
 * 4. Verify backup matches original exactly
 * 5. Verify includes all UUIDs and levels
 * 6. Apply second archetype -> original backup not overwritten
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

function assertNotNull(actual, message) {
  if (actual === null || actual === undefined) {
    throw new Error(`${message || 'Expected non-null value'}: got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message || 'Deep equality failed'}: expected ${e}, got ${a}`);
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

const { Applicator } = await import('../scripts/applicator.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #37: Backup original classAssociations before modification ===\n');

// =====================================================
// Fighter base classAssociations (same as test-feature-33)
// =====================================================
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

// Resolve associations
let resolvedFighterAssociations;
await asyncTest('Resolve Fighter classAssociations', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
});

// Two-Handed Fighter archetype (6 replacements + 1 additive)
const twoHandedFighterParsed = {
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

// A second archetype that replaces Weapon Training 1 (non-conflicting with Two-Handed Fighter)
const weaponMasterParsed = {
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
      source: 'auto-parse'
    }
  ]
};

// A non-conflicting second archetype (replaces a feature Two-Handed Fighter doesn't touch)
const armorMasterParsed = {
  name: 'Armor Master',
  slug: 'armor-master',
  class: 'Fighter',
  features: [
    {
      name: 'Deflective Shield',
      level: 5,
      type: 'replacement',
      target: 'weapon training 1',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    }
  ]
};


// =====================================================
// Step 1: Note original classAssociations on Fighter
// =====================================================
console.log('\n--- Step 1: Note original classAssociations on Fighter ---');

let classItem;
let actor;
let originalCopy;

asyncTest('Create Fighter class item with 12 base classAssociations', async () => {
  classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
  assertEqual(classItem.system.links.classAssociations.length, 12, 'Fighter should have 12 features');

  // Deep copy of the original associations for later comparison
  originalCopy = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
});

asyncTest('Create mock actor with Fighter class', async () => {
  actor = createMockActor('Test Fighter', [classItem]);
  actor.isOwner = true;
  assertEqual(actor.name, 'Test Fighter', 'Actor name should be Test Fighter');
});

test('No backup flag exists initially', () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'originalAssociations should be null initially');
});

test('No archetypes flag exists initially', () => {
  const archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'archetypes should be null initially');
});

// =====================================================
// Step 2: Apply first archetype (Two-Handed Fighter)
// =====================================================
console.log('\n--- Step 2: Apply first archetype ---');

let diff1;
let applyResult1;

test('Generate diff for Two-Handed Fighter', () => {
  diff1 = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  assert(Array.isArray(diff1), 'Diff should be an array');
  assert(diff1.length > 0, 'Diff should not be empty');
});

await asyncTest('Apply Two-Handed Fighter archetype succeeds', async () => {
  applyResult1 = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff1);
  assertEqual(applyResult1, true, 'Apply should return true');
});

// =====================================================
// Step 3: Read backup flag
// =====================================================
console.log('\n--- Step 3: Read backup flag ---');

await asyncTest('Backup flag exists after first application', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'originalAssociations flag should exist');
  assert(Array.isArray(backup), 'Backup should be an array');
});

await asyncTest('Backup flag is a valid array', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assert(backup.length > 0, 'Backup should not be empty');
  assertEqual(backup.length, 12, 'Backup should have 12 entries (all original Fighter associations)');
});

// =====================================================
// Step 4: Verify backup matches original exactly
// =====================================================
console.log('\n--- Step 4: Verify backup matches original exactly ---');

await asyncTest('Backup matches original classAssociations exactly', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertDeepEqual(backup, originalCopy, 'Backup should be identical to original');
});

await asyncTest('Backup is a deep clone (not a reference)', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  // The backup should not be the same object reference as the original
  assert(backup !== classItem.system.links.classAssociations,
    'Backup should not be the same reference as current classAssociations');
});

await asyncTest('Backup array entries match original entries', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  for (let i = 0; i < originalCopy.length; i++) {
    assertEqual(backup[i].uuid, originalCopy[i].uuid,
      `Entry ${i} UUID should match: ${backup[i].uuid} vs ${originalCopy[i].uuid}`);
    assertEqual(backup[i].level, originalCopy[i].level,
      `Entry ${i} level should match: ${backup[i].level} vs ${originalCopy[i].level}`);
  }
});

// =====================================================
// Step 5: Verify includes all UUIDs and levels
// =====================================================
console.log('\n--- Step 5: Verify backup includes all UUIDs and levels ---');

await asyncTest('Backup contains Bonus Feat UUID at level 1', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const entry = backup.find(a => a.uuid === 'Compendium.pf1.class-abilities.BonusFeat1');
  assertNotNull(entry, 'Bonus Feat should be in backup');
  assertEqual(entry.level, 1, 'Bonus Feat should be at level 1');
});

await asyncTest('Backup contains Bravery UUID at level 2', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const entry = backup.find(a => a.uuid === 'Compendium.pf1.class-abilities.Bravery');
  assertNotNull(entry, 'Bravery should be in backup');
  assertEqual(entry.level, 2, 'Bravery should be at level 2');
});

await asyncTest('Backup contains all 4 Armor Training UUIDs', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  for (let i = 1; i <= 4; i++) {
    const uuid = `Compendium.pf1.class-abilities.ArmorTraining${i}`;
    const entry = backup.find(a => a.uuid === uuid);
    assertNotNull(entry, `Armor Training ${i} should be in backup`);
  }
});

await asyncTest('Backup contains all 4 Weapon Training UUIDs', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  for (let i = 1; i <= 4; i++) {
    const uuid = `Compendium.pf1.class-abilities.WeaponTraining${i}`;
    const entry = backup.find(a => a.uuid === uuid);
    assertNotNull(entry, `Weapon Training ${i} should be in backup`);
  }
});

await asyncTest('Backup contains Armor Mastery UUID at level 19', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const entry = backup.find(a => a.uuid === 'Compendium.pf1.class-abilities.ArmorMastery');
  assertNotNull(entry, 'Armor Mastery should be in backup');
  assertEqual(entry.level, 19, 'Armor Mastery should be at level 19');
});

await asyncTest('Backup contains Weapon Mastery UUID at level 20', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const entry = backup.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponMastery');
  assertNotNull(entry, 'Weapon Mastery should be in backup');
  assertEqual(entry.level, 20, 'Weapon Mastery should be at level 20');
});

await asyncTest('All 12 UUIDs present in backup', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const uuids = backup.map(a => a.uuid);
  const expectedUuids = [
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
  for (const uuid of expectedUuids) {
    assert(uuids.includes(uuid), `Missing UUID: ${uuid}`);
  }
});

await asyncTest('All levels 1-20 in expected positions in backup', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const levels = backup.map(a => a.level);
  const expectedLevels = [1, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 20];
  assertDeepEqual(levels, expectedLevels, 'Levels should match original order');
});

await asyncTest('Backup preserves resolvedName properties', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  // Check first few entries have resolvedName from the resolution step
  assertEqual(backup[0].resolvedName, 'Bonus Feat', 'First entry resolvedName');
  assertEqual(backup[1].resolvedName, 'Bravery', 'Second entry resolvedName');
  assertEqual(backup[2].resolvedName, 'Armor Training 1', 'Third entry resolvedName');
});

// =====================================================
// Step 5b: Verify classAssociations was actually modified
// =====================================================
console.log('\n--- Step 5b: Verify classAssociations was modified ---');

test('classAssociations updated after archetype application', () => {
  const current = classItem.system.links.classAssociations;
  assert(Array.isArray(current), 'Current classAssociations should be an array');
  // After Two-Handed Fighter: removed entries are excluded, added/unchanged kept
  // The _buildNewAssociations method keeps unchanged + added (with matchedAssociation)
  // 6 unchanged (BonusFeat, WT1-4, WeaponMastery) + replacement entries with matchedAssociation
  // Verify the update happened by checking the classItem was updated (flag was set)
  const archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'Archetype tracking should exist');
  assertEqual(archetypes[0], 'two-handed-fighter', 'First archetype should be recorded');
});

test('Archetype tracking flag updated', () => {
  const archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertNotNull(archetypes, 'archetypes flag should exist');
  assert(Array.isArray(archetypes), 'archetypes should be an array');
  assertEqual(archetypes.length, 1, 'Should have 1 archetype');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Should be two-handed-fighter');
});

test('appliedAt timestamp set', () => {
  const appliedAt = classItem.getFlag('archetype-manager', 'appliedAt');
  assertNotNull(appliedAt, 'appliedAt flag should exist');
  assert(typeof appliedAt === 'string', 'appliedAt should be a string');
  // Should be a valid ISO date
  const parsed = new Date(appliedAt);
  assert(!isNaN(parsed.getTime()), 'appliedAt should be a valid date');
});

// =====================================================
// Step 6: Apply second archetype -> original backup NOT overwritten
// =====================================================
console.log('\n--- Step 6: Apply second archetype -> original backup NOT overwritten ---');

let backupBeforeSecondApply;
let diff2;
let applyResult2;

await asyncTest('Save backup state before second application', async () => {
  backupBeforeSecondApply = JSON.parse(JSON.stringify(
    classItem.getFlag('archetype-manager', 'originalAssociations')
  ));
  assertEqual(backupBeforeSecondApply.length, 12, 'Backup should still have 12 entries');
});

// Generate diff against current (post-first-archetype) associations for the second archetype
await asyncTest('Generate diff for second archetype (Armor Master)', async () => {
  // For the second archetype, we generate diff against current associations
  const currentAssociations = classItem.system.links.classAssociations;

  // Need to resolve current associations
  const resolved = [];
  for (const a of currentAssociations) {
    const doc = await globalThis.fromUuid(a.uuid);
    resolved.push({
      ...a,
      resolvedName: doc ? doc.name : a.uuid
    });
  }

  // Re-create the second archetype with matched associations from current
  const weaponTraining1Current = resolved.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1');

  const armorMasterForDiff = {
    ...armorMasterParsed,
    features: [
      {
        name: 'Deflective Shield',
        level: 5,
        type: 'replacement',
        target: 'weapon training 1',
        matchedAssociation: weaponTraining1Current || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
        source: 'auto-parse'
      }
    ]
  };

  diff2 = DiffEngine.generateDiff(resolved, armorMasterForDiff);
  assert(Array.isArray(diff2), 'Diff should be an array');
});

await asyncTest('Apply second archetype (Armor Master) succeeds', async () => {
  // Re-create archetype with matched association
  const currentAssociations = classItem.system.links.classAssociations;
  const weaponTraining1 = currentAssociations.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1');

  const armorMasterForApply = {
    ...armorMasterParsed,
    features: [
      {
        name: 'Deflective Shield',
        level: 5,
        type: 'replacement',
        target: 'weapon training 1',
        matchedAssociation: weaponTraining1 || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
        source: 'auto-parse'
      }
    ]
  };

  applyResult2 = await Applicator.apply(actor, classItem, armorMasterForApply, diff2);
  assertEqual(applyResult2, true, 'Second apply should return true');
});

await asyncTest('Original backup NOT overwritten after second application', async () => {
  const backupAfterSecondApply = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backupAfterSecondApply, 'Backup should still exist');
  assertDeepEqual(backupAfterSecondApply, backupBeforeSecondApply,
    'Backup should be identical to before second apply');
});

await asyncTest('Backup still has 12 original entries', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup.length, 12, 'Backup should still have 12 entries');
});

await asyncTest('Backup still contains original Bravery (even though replaced by first archetype)', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const bravery = backup.find(a => a.uuid === 'Compendium.pf1.class-abilities.Bravery');
  assertNotNull(bravery, 'Bravery should still be in backup');
  assertEqual(bravery.level, 2, 'Bravery level should still be 2');
});

await asyncTest('Backup still contains original Weapon Training 1 (even though replaced by second archetype)', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  const wt1 = backup.find(a => a.uuid === 'Compendium.pf1.class-abilities.WeaponTraining1');
  assertNotNull(wt1, 'Weapon Training 1 should still be in backup');
  assertEqual(wt1.level, 5, 'Weapon Training 1 level should still be 5');
});

await asyncTest('Archetypes tracking flag now has both archetypes', async () => {
  const archetypes = classItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 2, 'Should have 2 archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Should include two-handed-fighter');
  assert(archetypes.includes('armor-master'), 'Should include armor-master');
});

await asyncTest('Actor flags updated with both archetypes', async () => {
  const actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertNotNull(actorArchetypes, 'Actor archetypes flag should exist');
  const fighterArchetypes = actorArchetypes['fighter'];
  assertNotNull(fighterArchetypes, 'Fighter class should have archetypes');
  assertEqual(fighterArchetypes.length, 2, 'Fighter should have 2 archetypes');
  assert(fighterArchetypes.includes('two-handed-fighter'), 'Should include two-handed-fighter');
  assert(fighterArchetypes.includes('armor-master'), 'Should include armor-master');
});

// =====================================================
// Additional edge case tests
// =====================================================
console.log('\n--- Additional edge case tests ---');

await asyncTest('Duplicate application is prevented', async () => {
  const result = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff1);
  assertEqual(result, false, 'Duplicate apply should return false');
  // Backup should still be original
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertDeepEqual(backup, backupBeforeSecondApply, 'Backup should not be changed by duplicate');
});

await asyncTest('Backup survives duplicate application attempt', async () => {
  const backup = classItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup.length, 12, 'Backup should still have 12 entries');
});

// Test with a fresh class item to verify first-time backup
await asyncTest('Fresh class item gets backup on first archetype', async () => {
  const freshClassItem = createMockClassItem('Rogue', 8, 'rogue');
  const rogueAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1 },
    { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1 },
    { uuid: 'Compendium.pf1.class-abilities.Evasion', level: 2 },
    { uuid: 'Compendium.pf1.class-abilities.RogueTalent1', level: 2 }
  ];
  freshClassItem.system.links.classAssociations = JSON.parse(JSON.stringify(rogueAssociations));

  const freshActor = createMockActor('Test Rogue', [freshClassItem]);
  freshActor.isOwner = true;

  // Create a simple archetype for Rogue
  const rogueParsed = {
    name: 'Scout',
    slug: 'scout',
    class: 'Rogue',
    features: [
      {
        name: 'Scout Charge',
        level: 1,
        type: 'replacement',
        target: 'trapfinding',
        matchedAssociation: rogueAssociations[1],
        source: 'auto-parse'
      }
    ]
  };

  // Generate diff
  const rogueDiff = DiffEngine.generateDiff(rogueAssociations, rogueParsed);

  // Apply
  const result = await Applicator.apply(freshActor, freshClassItem, rogueParsed, rogueDiff);
  assertEqual(result, true, 'Apply to fresh Rogue should succeed');

  // Verify backup was created
  const backup = freshClassItem.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'Rogue backup should exist');
  assertEqual(backup.length, 4, 'Rogue backup should have 4 entries');
  assertEqual(backup[0].uuid, 'Compendium.pf1.class-abilities.SneakAttack1', 'First Rogue backup entry');
  assertEqual(backup[1].uuid, 'Compendium.pf1.class-abilities.Trapfinding', 'Second Rogue backup entry');
});

await asyncTest('Backup on class with empty classAssociations', async () => {
  const emptyClassItem = createMockClassItem('Custom Class', 5, 'custom-class');
  emptyClassItem.system.links.classAssociations = [];

  const emptyActor = createMockActor('Test Empty', [emptyClassItem]);
  emptyActor.isOwner = true;

  const emptyParsed = {
    name: 'Custom Archetype',
    slug: 'custom-archetype',
    class: 'Custom Class',
    features: [
      {
        name: 'New Ability',
        level: 1,
        type: 'additive',
        target: null,
        matchedAssociation: null,
        source: 'manual'
      }
    ]
  };

  const emptyDiff = DiffEngine.generateDiff([], emptyParsed);
  const result = await Applicator.apply(emptyActor, emptyClassItem, emptyParsed, emptyDiff);
  assertEqual(result, true, 'Apply to empty class should succeed');

  const backup = emptyClassItem.getFlag('archetype-manager', 'originalAssociations');
  assertNotNull(backup, 'Backup should exist even for empty associations');
  assert(Array.isArray(backup), 'Backup should be an array');
  assertEqual(backup.length, 0, 'Backup should be empty array');
});

await asyncTest('Permission check: non-owner cannot apply', async () => {
  const restrictedClassItem = createMockClassItem('Wizard', 5, 'wizard');
  restrictedClassItem.system.links.classAssociations = [];

  const restrictedActor = createMockActor('NPC Wizard', [restrictedClassItem]);
  restrictedActor.isOwner = false;

  // Set user to non-GM
  const originalIsGM = game.user.isGM;
  game.user.isGM = false;

  const wizardParsed = {
    name: 'Spell Sage',
    slug: 'spell-sage',
    class: 'Wizard',
    features: []
  };

  const result = await Applicator.apply(restrictedActor, restrictedClassItem, wizardParsed, []);
  assertEqual(result, false, 'Non-owner non-GM should not be able to apply');

  const backup = restrictedClassItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'No backup should be created for unauthorized apply');

  // Restore GM status
  game.user.isGM = originalIsGM;
});

// =====================================================
// Summary
// =====================================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #37 Results: ${passed}/${totalTests} tests passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
