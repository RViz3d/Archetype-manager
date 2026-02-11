/**
 * Test Suite for Feature #32: Validate archetype applies to correct class
 *
 * Verifies that applying an archetype to the wrong class is blocked:
 * 1. Select Fighter archetype
 * 2. Attempt to apply to Wizard -> blocked
 * 3. Verify clear error message
 * 4. Apply to Fighter -> works
 * 5. ConflictChecker.validateClass matching logic
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

function assertIncludes(haystack, needle, message) {
  if (!haystack || !haystack.includes(needle)) {
    throw new Error(`${message || 'Expected inclusion'}: "${needle}" not found in "${haystack}"`);
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
  // Base Wizard class features
  'Compendium.pf1.class-abilities.ArcaneSchool': { name: 'Arcane School' },
  'Compendium.pf1.class-abilities.ArcaneBond': { name: 'Arcane Bond' },
  'Compendium.pf1.class-abilities.Cantrips': { name: 'Cantrips' },
  'Compendium.pf1.class-abilities.ScribeScroll': { name: 'Scribe Scroll' },
  'Compendium.pf1.class-abilities.BonusWizardFeat': { name: 'Bonus Feat (Wizard)' },
  // Base Rogue class features
  'Compendium.pf1.class-abilities.SneakAttack': { name: 'Sneak Attack' },
  'Compendium.pf1.class-abilities.Trapfinding': { name: 'Trapfinding' },
  'Compendium.pf1.class-abilities.EvasionRogue': { name: 'Evasion' },
  // Two-Handed Fighter archetype features
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
var { ConflictChecker } = await import('../scripts/conflict-checker.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #32: Validate archetype applies to correct class ===\n');

// =====================================================
// Test Data Setup
// =====================================================

// Fighter base classAssociations
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

// Wizard base classAssociations
var wizardClassAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.ArcaneSchool', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.ArcaneBond', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.Cantrips', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.ScribeScroll', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.BonusWizardFeat', level: 5 }
];

// Rogue base classAssociations
var rogueClassAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.EvasionRogue', level: 2 }
];

// Two-Handed Fighter archetype (a Fighter archetype)
var twoHandedFighterArchetype = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'Fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike', level: 2 },
      description: '<p><strong>Level</strong>: 2</p><p>This replaces Bravery.</p>'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'Armor Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop', level: 3 },
      description: '<p><strong>Level</strong>: 3</p><p>This replaces Armor Training 1.</p>'
    },
    {
      name: 'Weapon Training (Two-Handed Fighter)',
      level: 5,
      type: 'modification',
      target: 'Weapon Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining', level: 5 },
      description: '<p><strong>Level</strong>: 5</p><p>This modifies Weapon Training.</p>'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'Armor Training 2',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.Backswing', level: 7 },
      description: '<p><strong>Level</strong>: 7</p><p>This replaces Armor Training 2.</p>'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'Armor Training 3',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.Piledriver', level: 11 },
      description: '<p><strong>Level</strong>: 11</p><p>This replaces Armor Training 3.</p>'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'Armor Training 4',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack', level: 15 },
      description: '<p><strong>Level</strong>: 15</p><p>This replaces Armor Training 4.</p>'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'Armor Mastery',
      matchedAssociation: { uuid: 'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow', level: 19 },
      description: '<p><strong>Level</strong>: 19</p><p>This replaces Armor Mastery.</p>'
    }
  ]
};

// =====================================================
// Helper: generate diff for Two-Handed Fighter applied to Fighter
// =====================================================
async function generateFighterDiff() {
  var resolvedAssoc = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  return DiffEngine.generateDiff(resolvedAssoc, twoHandedFighterArchetype);
}

// =====================================================
// Capture error/warn notifications
// =====================================================
var capturedNotifications = [];
var origError = ui.notifications.error;
var origWarn = ui.notifications.warn;
var origInfo = ui.notifications.info;

function resetNotifications() {
  capturedNotifications = [];
  ui.notifications.error = (msg) => {
    capturedNotifications.push({ level: 'error', msg });
    origError(msg);
  };
  ui.notifications.warn = (msg) => {
    capturedNotifications.push({ level: 'warn', msg });
    origWarn(msg);
  };
  ui.notifications.info = (msg) => {
    capturedNotifications.push({ level: 'info', msg });
    origInfo(msg);
  };
}

// =====================================================
// Section 1: ConflictChecker.validateClass tests
// =====================================================

console.log('--- ConflictChecker.validateClass ---');

test('validateClass matches by tag (lowercase)', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({ class: 'fighter' }, classItem);
  assert(result === true, 'Should match by tag');
});

test('validateClass matches by name (case-insensitive)', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({ class: 'Fighter' }, classItem);
  assert(result === true, 'Should match by name case-insensitively');
});

test('validateClass rejects wrong class', () => {
  var classItem = createMockClassItem('Wizard', 5, 'wizard');
  var result = ConflictChecker.validateClass({ class: 'fighter' }, classItem);
  assert(result === false, 'Should reject wrong class');
});

test('validateClass rejects wrong class (Rogue vs Fighter)', () => {
  var classItem = createMockClassItem('Rogue', 5, 'rogue');
  var result = ConflictChecker.validateClass({ class: 'Fighter' }, classItem);
  assert(result === false, 'Fighter archetype should not match Rogue');
});

test('validateClass matches by name when tag differs', () => {
  var classItem = createMockClassItem('Fighter', 5, 'ftr');
  var result = ConflictChecker.validateClass({ class: 'Fighter' }, classItem);
  assert(result === true, 'Should match by name even if tag differs');
});

test('validateClass handles mixed case', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({ class: 'FIGHTER' }, classItem);
  assert(result === true, 'Should handle uppercase');
});

test('validateClass handles extra whitespace', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({ class: ' Fighter ' }, classItem);
  assert(result === true, 'Should trim whitespace');
});

test('validateClass returns false for empty class field', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({ class: '' }, classItem);
  assert(result === false, 'Empty class should not match');
});

test('validateClass returns false for null class field', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({ class: null }, classItem);
  assert(result === false, 'Null class should not match');
});

test('validateClass returns false for undefined class field', () => {
  var classItem = createMockClassItem('Fighter', 5, 'fighter');
  var result = ConflictChecker.validateClass({}, classItem);
  assert(result === false, 'Undefined class should not match');
});

// =====================================================
// Section 2: Applicator.apply blocks wrong class
// =====================================================

console.log('\n--- Applicator.apply blocks wrong class ---');

await asyncTest('Fighter archetype blocked when applied to Wizard', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  var diff = []; // diff doesn't matter since we should be blocked before it's used
  var result = await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, diff);

  assertEqual(result, false, 'Should return false when applying to wrong class');
});

await asyncTest('Error notification shown when applying to wrong class', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  assert(errors.length > 0, 'Should have at least one error notification');
});

await asyncTest('Error message mentions archetype name', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  assert(errors.length > 0, 'Error notification should exist');
  assertIncludes(errors[0].msg, 'Two-Handed Fighter', 'Error should mention archetype name');
});

await asyncTest('Error message mentions wrong class name', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  assertIncludes(errors[0].msg, 'Wizard', 'Error should mention the target class name');
});

await asyncTest('Error message mentions archetype class (Fighter)', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  assertIncludes(errors[0].msg, 'Fighter', 'Error should mention the archetype class');
});

await asyncTest('No classAssociations modified when wrong class', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  var originalAssoc = [...wizardClassAssociations];
  wizardItem.system.links.classAssociations = [...originalAssoc];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  // Verify classAssociations not changed
  assertEqual(
    wizardItem.system.links.classAssociations.length,
    originalAssoc.length,
    'ClassAssociations count should not change'
  );
});

await asyncTest('No backup flags created when wrong class', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var backup = wizardItem.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'No backup should exist for wrong class');
});

await asyncTest('No archetype tracking flags created when wrong class', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var archetypes = wizardItem.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'No archetypes flag should be set for wrong class');
});

await asyncTest('Fighter archetype blocked when applied to Rogue', async () => {
  resetNotifications();
  var rogueItem = createMockClassItem('Rogue', 5, 'rogue');
  rogueItem.system.links.classAssociations = [...rogueClassAssociations];
  var actor = createMockActor('TestPC', [rogueItem]);
  actor.isOwner = true;

  var result = await Applicator.apply(actor, rogueItem, twoHandedFighterArchetype, []);

  assertEqual(result, false, 'Should return false when applying Fighter archetype to Rogue');
  var errors = capturedNotifications.filter(n => n.level === 'error');
  assert(errors.length > 0, 'Error notification should exist for Rogue');
  assertIncludes(errors[0].msg, 'Rogue', 'Error should mention Rogue');
});

// =====================================================
// Section 3: Applicator.apply works for correct class
// =====================================================

console.log('\n--- Applicator.apply succeeds for correct class ---');

await asyncTest('Fighter archetype applies successfully to Fighter', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var diff = await generateFighterDiff();
  var result = await Applicator.apply(actor, fighterItem, twoHandedFighterArchetype, diff);

  assertEqual(result, true, 'Should return true when applying to correct class');
});

await asyncTest('No error notification when applying to correct class', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var diff = await generateFighterDiff();
  await Applicator.apply(actor, fighterItem, twoHandedFighterArchetype, diff);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  assertEqual(errors.length, 0, 'No error notifications for correct class');
});

await asyncTest('Backup flags created on successful apply', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var diff = await generateFighterDiff();
  await Applicator.apply(actor, fighterItem, twoHandedFighterArchetype, diff);

  var backup = fighterItem.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should be created on successful apply');
  assertEqual(backup.length, fighterClassAssociations.length, 'Backup should have original association count');
});

await asyncTest('Archetype tracking flag set on successful apply', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var diff = await generateFighterDiff();
  await Applicator.apply(actor, fighterItem, twoHandedFighterArchetype, diff);

  var archetypes = fighterItem.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(archetypes), 'Archetypes flag should be an array');
  assert(archetypes.includes('two-handed-fighter'), 'Should include two-handed-fighter slug');
});

// =====================================================
// Section 4: Archetype without class field (skip validation)
// =====================================================

console.log('\n--- Archetype without class field (legacy/JE custom) ---');

await asyncTest('Archetype without class field is not class-validated (allowed on any class)', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = JSON.parse(JSON.stringify(wizardClassAssociations));
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  // Create archetype data WITHOUT class field
  var noClassArchetype = {
    name: 'Custom Archetype',
    slug: 'custom-archetype',
    // No 'class' field
    features: []
  };

  var result = await Applicator.apply(actor, wizardItem, noClassArchetype, []);

  assertEqual(result, true, 'Archetype without class field should be allowed');
  var errors = capturedNotifications.filter(n => n.level === 'error');
  assertEqual(errors.length, 0, 'No error for archetype without class');
});

await asyncTest('Archetype with empty class field is not class-validated', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = JSON.parse(JSON.stringify(wizardClassAssociations));
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  var emptyClassArchetype = {
    name: 'Empty Class Archetype',
    slug: 'empty-class-archetype',
    class: '',
    features: []
  };

  var result = await Applicator.apply(actor, wizardItem, emptyClassArchetype, []);

  // Empty string is falsy, so class validation is skipped
  assertEqual(result, true, 'Archetype with empty class should be allowed');
});

// =====================================================
// Section 5: Multiple class validation scenarios
// =====================================================

console.log('\n--- Multiple class scenarios ---');

await asyncTest('Wizard archetype blocked on Fighter', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var wizardArchetype = {
    name: 'Arcane Trickster',
    slug: 'arcane-trickster',
    class: 'Wizard',
    features: []
  };

  var result = await Applicator.apply(actor, fighterItem, wizardArchetype, []);

  assertEqual(result, false, 'Wizard archetype should be blocked on Fighter');
  var errors = capturedNotifications.filter(n => n.level === 'error');
  assert(errors.length > 0, 'Should have error notification');
  assertIncludes(errors[0].msg, 'Wizard', 'Error should mention Wizard');
  assertIncludes(errors[0].msg, 'Fighter', 'Error should mention Fighter');
});

await asyncTest('Rogue archetype blocked on Wizard', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = JSON.parse(JSON.stringify(wizardClassAssociations));
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  var rogueArchetype = {
    name: 'Knife Master',
    slug: 'knife-master',
    class: 'Rogue',
    features: []
  };

  var result = await Applicator.apply(actor, wizardItem, rogueArchetype, []);

  assertEqual(result, false, 'Rogue archetype should be blocked on Wizard');
});

await asyncTest('Rogue archetype works on Rogue', async () => {
  resetNotifications();
  var rogueItem = createMockClassItem('Rogue', 5, 'rogue');
  rogueItem.system.links.classAssociations = JSON.parse(JSON.stringify(rogueClassAssociations));
  var actor = createMockActor('TestPC', [rogueItem]);
  actor.isOwner = true;

  var rogueArchetype = {
    name: 'Knife Master',
    slug: 'knife-master',
    class: 'Rogue',
    features: []
  };

  var result = await Applicator.apply(actor, rogueItem, rogueArchetype, []);

  assertEqual(result, true, 'Rogue archetype should work on Rogue');
});

// =====================================================
// Section 6: Edge cases
// =====================================================

console.log('\n--- Edge cases ---');

await asyncTest('Case-insensitive class validation allows application', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var upperCaseArchetype = {
    name: 'Uppercase Fighter Archetype',
    slug: 'uppercase-fighter-archetype',
    class: 'FIGHTER',
    features: []
  };

  var result = await Applicator.apply(actor, fighterItem, upperCaseArchetype, []);

  assertEqual(result, true, 'Should match case-insensitively');
});

await asyncTest('Whitespace in class field still matches', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [fighterItem]);
  actor.isOwner = true;

  var spacedArchetype = {
    name: 'Spaced Fighter Archetype',
    slug: 'spaced-fighter-archetype',
    class: '  Fighter  ',
    features: []
  };

  var result = await Applicator.apply(actor, fighterItem, spacedArchetype, []);

  assertEqual(result, true, 'Whitespace in class field should be trimmed');
});

await asyncTest('Class validation happens before backup creation', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  // Track if setFlag was called
  var setFlagCalls = [];
  var origSetFlag = wizardItem.setFlag.bind(wizardItem);
  wizardItem.setFlag = async (scope, key, value) => {
    setFlagCalls.push({ scope, key });
    return origSetFlag(scope, key, value);
  };

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  // No flags should have been set since validation fails first
  var backupFlags = setFlagCalls.filter(f => f.key === 'originalAssociations');
  assertEqual(backupFlags.length, 0, 'No backup should be created when class validation fails');
});

await asyncTest('Class validation happens before archetype flag', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  var setFlagCalls = [];
  var origSetFlag = wizardItem.setFlag.bind(wizardItem);
  wizardItem.setFlag = async (scope, key, value) => {
    setFlagCalls.push({ scope, key });
    return origSetFlag(scope, key, value);
  };

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var archetypeFlags = setFlagCalls.filter(f => f.key === 'archetypes');
  assertEqual(archetypeFlags.length, 0, 'No archetype flag should be set when class validation fails');
});

await asyncTest('No chat message posted when wrong class', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  var chatCreated = false;
  var origChatCreate = globalThis.ChatMessage.create;
  globalThis.ChatMessage.create = async (data) => {
    chatCreated = true;
    return data;
  };

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  assertEqual(chatCreated, false, 'No chat message should be posted on class mismatch');
  globalThis.ChatMessage.create = origChatCreate;
});

await asyncTest('No actor flags set when wrong class', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorArchetypes, null, 'No actor flags should be set on class mismatch');
});

// =====================================================
// Section 7: Class matching by tag vs name
// =====================================================

console.log('\n--- Class matching by tag vs name ---');

await asyncTest('Matches class by system.tag when name differs', async () => {
  resetNotifications();
  // Class with display name "My Custom Fighter" but tag "fighter"
  var customFighter = createMockClassItem('My Custom Fighter', 5, 'fighter');
  customFighter.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var actor = createMockActor('TestPC', [customFighter]);
  actor.isOwner = true;

  var result = await Applicator.apply(actor, customFighter, twoHandedFighterArchetype, []);

  // validateClass checks: archetypeClass === classTag || archetypeClass === className
  // 'fighter' === 'fighter' -> true
  assertEqual(result, true, 'Should match by tag even when name is different');
});

await asyncTest('Blocks when neither tag nor name match', async () => {
  resetNotifications();
  var clericItem = createMockClassItem('Cleric', 5, 'cleric');
  clericItem.system.links.classAssociations = [];
  var actor = createMockActor('TestPC', [clericItem]);
  actor.isOwner = true;

  var result = await Applicator.apply(actor, clericItem, twoHandedFighterArchetype, []);

  assertEqual(result, false, 'Should block when neither tag nor name match');
});

// =====================================================
// Section 8: Multi-class actor scenarios
// =====================================================

console.log('\n--- Multi-class actor scenarios ---');

await asyncTest('Fighter archetype blocked on Wizard class of multi-class actor', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var wizardItem = createMockClassItem('Wizard', 3, 'wizard');
  wizardItem.system.links.classAssociations = JSON.parse(JSON.stringify(wizardClassAssociations));
  var actor = createMockActor('MultiClassPC', [fighterItem, wizardItem]);
  actor.isOwner = true;

  // Try to apply Fighter archetype to the Wizard class
  var result = await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  assertEqual(result, false, 'Fighter archetype should be blocked on Wizard class of multi-class actor');
});

await asyncTest('Fighter archetype works on Fighter class of multi-class actor', async () => {
  resetNotifications();
  var fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  fighterItem.system.links.classAssociations = JSON.parse(JSON.stringify(fighterClassAssociations));
  var wizardItem = createMockClassItem('Wizard', 3, 'wizard');
  wizardItem.system.links.classAssociations = JSON.parse(JSON.stringify(wizardClassAssociations));
  var actor = createMockActor('MultiClassPC', [fighterItem, wizardItem]);
  actor.isOwner = true;

  var diff = await generateFighterDiff();
  var result = await Applicator.apply(actor, fighterItem, twoHandedFighterArchetype, diff);

  assertEqual(result, true, 'Fighter archetype should work on Fighter class of multi-class actor');
});

// =====================================================
// Section 9: Error message format and clarity
// =====================================================

console.log('\n--- Error message clarity ---');

await asyncTest('Error message format: "ArchName is a Class archetype and cannot be applied to ClassName"', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  assert(errors.length === 1, 'Exactly one error notification expected');
  var msg = errors[0].msg;

  // Verify it contains key information
  assertIncludes(msg, 'Two-Handed Fighter', 'Should mention archetype name');
  assertIncludes(msg, 'Fighter', 'Should mention archetype class');
  assertIncludes(msg, 'Wizard', 'Should mention target class name');
  assertIncludes(msg, 'cannot be applied', 'Should say cannot be applied');
});

await asyncTest('Error message is an error-level notification (not warn)', async () => {
  resetNotifications();
  var wizardItem = createMockClassItem('Wizard', 5, 'wizard');
  wizardItem.system.links.classAssociations = [...wizardClassAssociations];
  var actor = createMockActor('TestPC', [wizardItem]);
  actor.isOwner = true;

  await Applicator.apply(actor, wizardItem, twoHandedFighterArchetype, []);

  var errors = capturedNotifications.filter(n => n.level === 'error');
  var warns = capturedNotifications.filter(n => n.level === 'warn');
  assert(errors.length > 0, 'Should be an error-level notification');
  assertEqual(warns.length, 0, 'Should not be a warning-level notification');
});

// =====================================================
// Summary
// =====================================================

console.log('\n' + '='.repeat(60));
console.log(`Feature #32: ${passed}/${totalTests} tests passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
