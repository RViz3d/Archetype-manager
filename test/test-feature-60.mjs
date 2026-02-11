/**
 * Test Suite for Feature #60: Duplicate archetype application prevention
 *
 * Verifies that the module prevents applying the same archetype twice to a class,
 * shows a clear warning message, and doesn't corrupt data on duplicate attempts.
 *
 * Uses mock FoundryVTT environment since no live Foundry instance is available.
 */

import { setupMockEnvironment, resetMockEnvironment, createMockActor, createMockClassItem } from './foundry-mock.mjs';

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

async function testAsync(name, fn) {
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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(str, substr, message) {
  if (!str || !str.includes(substr)) {
    throw new Error(message || `Expected "${str}" to include "${substr}"`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Deep equality failed.\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
  }
}

// =====================================================
// Setup
// =====================================================

setupMockEnvironment();

// Register settings
game.settings.register('archetype-manager', 'lastSelectedClass', {
  name: 'Last Selected Class',
  scope: 'client',
  config: false,
  type: String,
  default: ''
});
game.settings.register('archetype-manager', 'showParseWarnings', {
  name: 'Show Parse Warnings',
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});

// Import modules after mock is set up
const { Applicator } = await import('../scripts/applicator.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { MODULE_ID } = await import('../scripts/module.mjs');

// Notification tracking
let lastWarnMsg = null;
let lastInfoMsg = null;
let lastErrorMsg = null;
let warnCount = 0;
let errorCount = 0;
let infoCount = 0;
let chatMessages = [];

function resetNotificationTracking() {
  lastWarnMsg = null;
  lastInfoMsg = null;
  lastErrorMsg = null;
  warnCount = 0;
  errorCount = 0;
  infoCount = 0;
  chatMessages = [];

  ui.notifications.warn = (msg) => {
    lastWarnMsg = msg;
    warnCount++;
  };
  ui.notifications.info = (msg) => {
    lastInfoMsg = msg;
    infoCount++;
  };
  ui.notifications.error = (msg) => {
    lastErrorMsg = msg;
    errorCount++;
  };

  globalThis.ChatMessage.create = async (data) => {
    chatMessages.push(data);
    return data;
  };
}

// =====================================================
// Helper: Create a full test setup with Fighter + Two-Handed Fighter archetype
// =====================================================

function createTestSetup() {
  // Create base classAssociations (Fighter features)
  const baseAssociations = [
    { uuid: 'uuid-bonus-feat-1', level: 1, resolvedName: 'Bonus Feat' },
    { uuid: 'uuid-bravery', level: 2, resolvedName: 'Bravery' },
    { uuid: 'uuid-armor-training-1', level: 3, resolvedName: 'Armor Training 1' },
    { uuid: 'uuid-bonus-feat-2', level: 4, resolvedName: 'Bonus Feat' },
    { uuid: 'uuid-weapon-training-1', level: 5, resolvedName: 'Weapon Training 1' },
    { uuid: 'uuid-bonus-feat-3', level: 6, resolvedName: 'Bonus Feat' },
    { uuid: 'uuid-armor-training-2', level: 7, resolvedName: 'Armor Training 2' },
    { uuid: 'uuid-bonus-feat-4', level: 8, resolvedName: 'Bonus Feat' },
    { uuid: 'uuid-weapon-training-2', level: 9, resolvedName: 'Weapon Training 2' },
    { uuid: 'uuid-bonus-feat-5', level: 10, resolvedName: 'Bonus Feat' },
    { uuid: 'uuid-armor-training-3', level: 11, resolvedName: 'Armor Training 3' },
    { uuid: 'uuid-armor-training-4', level: 15, resolvedName: 'Armor Training 4' }
  ];

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(baseAssociations));

  const actor = createMockActor('Test Fighter', [classItem]);
  actor.isOwner = true;

  // Parsed archetype: Two-Handed Fighter (replaces Bravery + Armor Trainings)
  const parsedArchetype = {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      {
        name: 'Shattering Strike',
        type: 'replacement',
        target: 'Bravery',
        level: 2,
        matchedAssociation: { uuid: 'uuid-bravery', level: 2, resolvedName: 'Bravery' },
        description: 'Replaces Bravery.'
      },
      {
        name: 'Overhand Chop',
        type: 'replacement',
        target: 'Armor Training 1',
        level: 3,
        matchedAssociation: { uuid: 'uuid-armor-training-1', level: 3, resolvedName: 'Armor Training 1' },
        description: 'Replaces Armor Training 1.'
      },
      {
        name: 'Weapon Training',
        type: 'modification',
        target: 'Weapon Training 1',
        level: 5,
        matchedAssociation: { uuid: 'uuid-weapon-training-1', level: 5, resolvedName: 'Weapon Training 1' },
        description: 'Modifies Weapon Training.'
      }
    ]
  };

  const diff = DiffEngine.generateDiff(baseAssociations, parsedArchetype);

  return { classItem, actor, parsedArchetype, diff, baseAssociations };
}

// =====================================================
// FEATURE #60: Duplicate archetype application prevention
// =====================================================

console.log('\n=== Feature #60: Duplicate archetype application prevention ===\n');

// -----------------------------------------------------------
// Step 1: Apply archetype A to Fighter
// -----------------------------------------------------------

// Test 60.1: First application succeeds
await testAsync('60.1: First application of archetype to Fighter succeeds', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assertEqual(result, true, 'First application should succeed');
  assert(infoCount > 0, 'Success notification should be shown');
});

// Test 60.2: After first apply, archetype slug is in tracking flags
await testAsync('60.2: After apply, archetype slug appears in tracking flags', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(Array.isArray(archetypes), 'archetypes flag should be an array');
  assert(archetypes.includes('two-handed-fighter'), 'Should include the applied slug');
});

// -----------------------------------------------------------
// Step 2: Try to apply A again → blocked
// -----------------------------------------------------------

// Test 60.3: Second application returns false
await testAsync('60.3: Second application of same archetype returns false', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  // First apply
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  // Reset tracking for second attempt
  resetNotificationTracking();

  // Second apply - should be blocked
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assertEqual(result, false, 'Duplicate application should be blocked (return false)');
});

// Test 60.4: Second application shows warning notification
await testAsync('60.4: Duplicate application shows warning notification', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  resetNotificationTracking();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assert(lastWarnMsg !== null, 'Warning should be shown for duplicate');
});

// -----------------------------------------------------------
// Step 3: Verify clear message
// -----------------------------------------------------------

// Test 60.5: Warning message mentions "already applied"
await testAsync('60.5: Warning message mentions "already applied"', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  resetNotificationTracking();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assert(lastWarnMsg !== null, 'Warning should be shown');
  const lowerMsg = lastWarnMsg.toLowerCase();
  assert(
    lowerMsg.includes('already applied') || lowerMsg.includes('already been applied'),
    `Warning should say "already applied". Got: "${lastWarnMsg}"`
  );
});

// Test 60.6: Warning message includes archetype name
await testAsync('60.6: Warning message includes archetype name', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  resetNotificationTracking();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assert(lastWarnMsg !== null, 'Warning should be shown');
  assert(
    lastWarnMsg.includes('Two-Handed Fighter'),
    `Warning should include archetype name. Got: "${lastWarnMsg}"`
  );
});

// Test 60.7: Warning is warn-level (not error)
await testAsync('60.7: Duplicate prevention uses warn-level notification (not error)', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  resetNotificationTracking();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assertEqual(warnCount, 1, `Should show 1 warning, got ${warnCount}`);
  assertEqual(errorCount, 0, `Should show 0 errors, got ${errorCount}`);
});

// -----------------------------------------------------------
// Step 4: Verify no data corruption
// -----------------------------------------------------------

// Test 60.8: Archetypes flag unchanged after duplicate attempt
await testAsync('60.8: Archetypes flag unchanged after duplicate attempt', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const archetypesAfterFirst = JSON.parse(JSON.stringify(
    classItem.getFlag(MODULE_ID, 'archetypes')
  ));

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const archetypesAfterSecond = classItem.getFlag(MODULE_ID, 'archetypes');
  assertDeepEqual(archetypesAfterSecond, archetypesAfterFirst,
    'Archetypes flag should be unchanged after duplicate attempt');
});

// Test 60.9: classAssociations unchanged after duplicate attempt
await testAsync('60.9: classAssociations unchanged after duplicate attempt', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const associationsAfterFirst = JSON.parse(JSON.stringify(
    classItem.system.links.classAssociations
  ));

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const associationsAfterSecond = classItem.system.links.classAssociations;
  assertDeepEqual(associationsAfterSecond, associationsAfterFirst,
    'classAssociations should be unchanged after duplicate attempt');
});

// Test 60.10: originalAssociations backup unchanged after duplicate
await testAsync('60.10: originalAssociations backup unchanged after duplicate', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const backupAfterFirst = JSON.parse(JSON.stringify(
    classItem.getFlag(MODULE_ID, 'originalAssociations')
  ));

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const backupAfterSecond = classItem.getFlag(MODULE_ID, 'originalAssociations');
  assertDeepEqual(backupAfterSecond, backupAfterFirst,
    'originalAssociations backup should be unchanged after duplicate attempt');
});

// Test 60.11: appliedAt timestamp unchanged after duplicate
await testAsync('60.11: appliedAt timestamp unchanged after duplicate attempt', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const timestampAfterFirst = classItem.getFlag(MODULE_ID, 'appliedAt');

  // Small delay to ensure timestamp would differ if set again
  await new Promise(r => setTimeout(r, 10));

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const timestampAfterSecond = classItem.getFlag(MODULE_ID, 'appliedAt');
  assertEqual(timestampAfterSecond, timestampAfterFirst,
    'appliedAt should be unchanged after duplicate attempt');
});

// Test 60.12: Actor flags unchanged after duplicate attempt
await testAsync('60.12: Actor flags unchanged after duplicate attempt', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const actorFlagsAfterFirst = JSON.parse(JSON.stringify(
    actor.getFlag(MODULE_ID, 'appliedArchetypes')
  ));

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const actorFlagsAfterSecond = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assertDeepEqual(actorFlagsAfterSecond, actorFlagsAfterFirst,
    'Actor appliedArchetypes flag should be unchanged after duplicate attempt');
});

// Test 60.13: No chat message posted on duplicate attempt
await testAsync('60.13: No chat message posted on duplicate attempt', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assertEqual(chatMessages.length, 0, `No chat message should be posted on duplicate. Got ${chatMessages.length}`);
});

// Test 60.14: No item copies created on duplicate attempt
await testAsync('60.14: No item copies created on duplicate attempt', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  let createCalls = 0;
  actor.createEmbeddedDocuments = async (type, data) => {
    createCalls++;
    return data.map(d => ({ ...d, id: Math.random().toString(36).slice(2) }));
  };

  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const callsAfterFirst = createCalls;

  resetNotificationTracking();
  createCalls = 0;

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assertEqual(createCalls, 0, `No createEmbeddedDocuments calls on duplicate. Got ${createCalls}`);
});

// -----------------------------------------------------------
// Additional scenarios
// -----------------------------------------------------------

// Test 60.15: Different archetypes can be applied to same class (not blocked)
await testAsync('60.15: Different archetype can be applied after first (not blocked)', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  // Create a different archetype that doesn't conflict
  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        type: 'additive',
        target: null,
        level: 2,
        description: 'An additive feature.'
      }
    ]
  };

  resetNotificationTracking();
  const secondDiff = DiffEngine.generateDiff(classItem.system.links.classAssociations, secondArchetype);
  const result = await Applicator.apply(actor, classItem, secondArchetype, secondDiff);

  assertEqual(result, true, 'Different archetype should be applicable');

  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'First slug preserved');
  assert(archetypes.includes('weapon-master'), 'Second slug added');
  assertEqual(archetypes.length, 2, 'Should have exactly 2 applied archetypes');
});

// Test 60.16: Duplicate check is slug-based (not name-based)
await testAsync('60.16: Duplicate check uses slug, not display name', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  // Same slug = blocked
  const sameSlugDifferentName = { ...parsedArchetype, name: 'Two Handed Fighter Variant' };
  resetNotificationTracking();
  const result = await Applicator.apply(actor, classItem, sameSlugDifferentName, diff);

  assertEqual(result, false, 'Same slug should be blocked regardless of name');
  assert(lastWarnMsg !== null, 'Warning should be shown');
});

// Test 60.17: Duplicate check happens before class validation
await testAsync('60.17: Duplicate check happens early (before backup/modification)', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  // Manually set the archetype as applied (simulates first apply)
  await classItem.setFlag(MODULE_ID, 'archetypes', ['two-handed-fighter']);

  // Track if update was called (it shouldn't be for duplicate)
  let updateCalled = false;
  const origUpdate = classItem.update.bind(classItem);
  classItem.update = async (data) => {
    updateCalled = true;
    return origUpdate(data);
  };

  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);

  assertEqual(result, false, 'Should be blocked');
  assertEqual(updateCalled, false, 'classItem.update should NOT be called for duplicate');
});

// Test 60.18: Third application attempt also blocked
await testAsync('60.18: Third application attempt also blocked', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff } = createTestSetup();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  resetNotificationTracking();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assertEqual(lastWarnMsg !== null, true, 'Second attempt blocked');

  resetNotificationTracking();
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assertEqual(result, false, 'Third attempt also blocked');
  assert(lastWarnMsg !== null, 'Warning shown on third attempt too');
});

// Test 60.19: Apply → remove → re-apply succeeds (not a duplicate after removal)
await testAsync('60.19: Apply → remove → re-apply succeeds (slug cleared on removal)', async () => {
  resetNotificationTracking();
  const { actor, classItem, parsedArchetype, diff, baseAssociations } = createTestSetup();

  // Apply
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const archetypesAfterApply = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(archetypesAfterApply.includes('two-handed-fighter'), 'Applied');

  // Remove
  resetNotificationTracking();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const archetypesAfterRemove = classItem.getFlag(MODULE_ID, 'archetypes');
  assertEqual(archetypesAfterRemove, null, 'Should be null after removal of last archetype');

  // Re-apply (should work - not a duplicate since it was removed)
  resetNotificationTracking();
  // Need fresh diff since associations were restored
  const freshDiff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);
  const result = await Applicator.apply(actor, classItem, parsedArchetype, freshDiff);

  assertEqual(result, true, 'Re-application after removal should succeed');
  assertEqual(warnCount, 0, 'No duplicate warning on re-application');
});

// Test 60.20: Duplicate on one class doesn't affect another class
await testAsync('60.20: Duplicate on one class does not block application to different class', async () => {
  resetNotificationTracking();
  const { actor, parsedArchetype, diff, baseAssociations } = createTestSetup();

  // Create two separate class items on same actor
  const fighter1 = createMockClassItem('Fighter', 10, 'fighter');
  fighter1.system.links.classAssociations = JSON.parse(JSON.stringify(baseAssociations));

  const fighter2 = createMockClassItem('Fighter', 5, 'fighter-2');
  fighter2.system.links.classAssociations = JSON.parse(JSON.stringify(baseAssociations));

  const multiActor = createMockActor('Multi Fighter', [fighter1, fighter2]);
  multiActor.isOwner = true;

  // Apply to first class
  const diff1 = DiffEngine.generateDiff(fighter1.system.links.classAssociations, parsedArchetype);
  await Applicator.apply(multiActor, fighter1, parsedArchetype, diff1);

  // Apply same archetype to second class - should succeed since it's a different class item
  resetNotificationTracking();
  const diff2 = DiffEngine.generateDiff(fighter2.system.links.classAssociations, parsedArchetype);
  const result = await Applicator.apply(multiActor, fighter2, parsedArchetype, diff2);

  assertEqual(result, true, 'Same archetype on different class item should succeed');
  assertEqual(warnCount, 0, 'No duplicate warning for different class item');
});

// =====================================================
// RESULTS
// =====================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed}/${totalTests} tests passing (${failed} failed)`);
console.log('='.repeat(60));

console.log(`\nFeature #60 (Duplicate archetype application prevention): ${passed}/${totalTests}`);

if (failed > 0) {
  console.log(`\n${failed} tests failed!`);
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
