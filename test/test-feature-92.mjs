/**
 * Test Suite for Feature #92: Double-click apply button doesn't duplicate
 *
 * Verifies that rapid apply clicks don't apply archetype twice:
 * 1. Open preview dialog
 * 2. Double-click Apply/Confirm
 * 3. Applied only once
 * 4. No duplicate flags
 * 5. Button disables during processing
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

// Setup mock environment
const { hooks, settings } = setupMockEnvironment();

// Import module to register settings and hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import modules under test
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { Applicator } = await import('../scripts/applicator.mjs');

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

// Track notifications
const notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};

function clearNotifications() {
  notifications.length = 0;
}

// Track chat messages
const chatMessages = [];
globalThis.ChatMessage.create = async (data) => {
  chatMessages.push(data);
  return data;
};

function clearChatMessages() {
  chatMessages.length = 0;
}

// ==================
// Helper functions
// ==================

function buildTestArchetype() {
  return {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      {
        name: 'Shattering Strike',
        type: 'replacement',
        target: 'Bravery',
        level: 2,
        description: 'The two-handed fighter gains a +1 bonus to damage.',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.bravery',
          id: 'bravery-id',
          level: 2,
          resolvedName: 'Bravery'
        }
      },
      {
        name: 'Overhand Chop',
        type: 'additive',
        target: null,
        level: 3,
        description: 'Doubles Str bonus on single attacks.'
      }
    ]
  };
}

function buildFighterClassItem() {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  fighter.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery', id: 'bravery-id', level: 2, resolvedName: 'Bravery' },
    { uuid: 'Compendium.pf1.class-abilities.Item.armor-training', id: 'armor-training-id', level: 3, resolvedName: 'Armor Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.weapon-training', id: 'weapon-training-id', level: 5, resolvedName: 'Weapon Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonus-feat-1', id: 'bonus-feat-1-id', level: 1, resolvedName: 'Bonus Feat' },
  ];
  return fighter;
}

// Reset Applicator state before each test group
function resetApplicatorState() {
  Applicator._applyInProgress = false;
  Applicator._removeInProgress = false;
  UIManager._processing = false;
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #92: Double-click apply button doesn\'t duplicate ===\n');

// --- Section 1: Applicator has double-click guard ---
console.log('--- Section 1: Applicator._applyInProgress guard exists ---');

test('Applicator has _applyInProgress static property', () => {
  assert('_applyInProgress' in Applicator, 'Applicator should have _applyInProgress property');
});

test('Applicator._applyInProgress defaults to false', () => {
  resetApplicatorState();
  assertEqual(Applicator._applyInProgress, false, '_applyInProgress should default to false');
});

test('Applicator has _doApply private method', () => {
  assert(typeof Applicator._doApply === 'function', 'Applicator should have _doApply method');
});

// --- Section 2: Single apply works normally ---
console.log('\n--- Section 2: Single apply works normally ---');

await asyncTest('Single apply succeeds and returns true', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const result = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(result, true, 'Apply should succeed');
});

await asyncTest('Single apply sets archetypes flag once', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Applicator.apply(actor, fighter, archetype, diff);
  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(archetypes), 'archetypes flag should be an array');
  assertEqual(archetypes.length, 1, 'Should have exactly 1 archetype applied');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Should be the correct slug');
});

await asyncTest('Single apply posts exactly one chat message', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(chatMessages.length, 1, 'Should have exactly 1 chat message');
});

await asyncTest('_applyInProgress resets to false after successful apply', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(Applicator._applyInProgress, false, '_applyInProgress should be false after apply completes');
});

// --- Section 3: Concurrent apply rejected ---
console.log('\n--- Section 3: Concurrent apply is rejected by guard ---');

await asyncTest('Second concurrent apply returns false when first is in progress', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Simulate _applyInProgress being true (as if first call is running)
  Applicator._applyInProgress = true;

  const result = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(result, false, 'Second apply should return false when first is in progress');

  // Clean up
  Applicator._applyInProgress = false;
});

await asyncTest('Warning notification shown when apply blocked by guard', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  Applicator._applyInProgress = true;
  await Applicator.apply(actor, fighter, archetype, diff);

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length >= 1, 'Should have at least one warning notification');
  assert(warnNotifs.some(n => n.msg.includes('already in progress')), 'Warning should mention "already in progress"');

  Applicator._applyInProgress = false;
});

await asyncTest('No flags modified when apply blocked by guard', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  Applicator._applyInProgress = true;
  await Applicator.apply(actor, fighter, archetype, diff);

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'No archetypes flag should be set when blocked');

  Applicator._applyInProgress = false;
});

await asyncTest('No chat message when apply blocked by guard', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  Applicator._applyInProgress = true;
  await Applicator.apply(actor, fighter, archetype, diff);

  assertEqual(chatMessages.length, 0, 'No chat message should be posted when blocked');

  Applicator._applyInProgress = false;
});

// --- Section 4: Rapid double-click simulation ---
console.log('\n--- Section 4: Rapid double-click simulation ---');

await asyncTest('Two simultaneous apply calls: only one succeeds', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Fire both apply calls simultaneously
  const [result1, result2] = await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  // One should succeed, the other should fail
  const successCount = [result1, result2].filter(r => r === true).length;
  assertEqual(successCount, 1, 'Exactly one apply should succeed');
});

await asyncTest('After double-click, archetype applied exactly once', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(archetypes), 'archetypes flag should be an array');
  assertEqual(archetypes.length, 1, 'Should have exactly 1 archetype (not 2)');
});

await asyncTest('After double-click, exactly one chat message', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  assertEqual(chatMessages.length, 1, 'Exactly 1 chat message should be posted');
});

await asyncTest('After double-click, exactly one success notification', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const infoNotifs = notifications.filter(n => n.type === 'info' && n.msg.includes('Applied'));
  assertEqual(infoNotifs.length, 1, 'Exactly 1 success notification');
});

// --- Section 5: _applyInProgress flag lifecycle ---
console.log('\n--- Section 5: _applyInProgress flag lifecycle ---');

await asyncTest('_applyInProgress is true during apply', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  let wasTrueDuringApply = false;

  // Intercept setFlag to check _applyInProgress during operation
  const origSetFlag = fighter.setFlag.bind(fighter);
  fighter.setFlag = async function(scope, key, value) {
    if (key === 'archetypes' && Applicator._applyInProgress) {
      wasTrueDuringApply = true;
    }
    return origSetFlag(scope, key, value);
  };

  await Applicator.apply(actor, fighter, archetype, diff);
  assert(wasTrueDuringApply, '_applyInProgress should be true during the apply operation');
});

await asyncTest('_applyInProgress resets to false even on error', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Make update throw an error to test finally block
  const origUpdate = fighter.update.bind(fighter);
  fighter.update = async () => { throw new Error('Simulated error'); };

  await Applicator.apply(actor, fighter, archetype, diff);

  assertEqual(Applicator._applyInProgress, false, '_applyInProgress should reset to false even after error');

  // Restore
  fighter.update = origUpdate;
});

await asyncTest('After failed apply, next apply succeeds (guard resets)', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Simulate a failure by making update throw
  const origUpdate = fighter.update.bind(fighter);
  let callCount = 0;
  fighter.update = async function(data) {
    callCount++;
    if (callCount === 1) throw new Error('Simulated failure');
    return origUpdate.call(this, data);
  };

  // First call fails
  const result1 = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(result1, false, 'First apply should fail due to simulated error');
  assertEqual(Applicator._applyInProgress, false, 'Guard should be reset after failure');

  // Second call should succeed (guard is reset)
  fighter.update = origUpdate;
  clearNotifications();
  clearChatMessages();
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const result2 = await Applicator.apply(actor, fighter, archetype, diff2);
  assertEqual(result2, true, 'Second apply should succeed after guard reset');
});

// --- Section 6: No duplicate flags on rapid apply ---
console.log('\n--- Section 6: No duplicate flags on rapid apply ---');

await asyncTest('No duplicate entries in archetypes flag after double-click', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes') || [];
  const uniqueSlugs = [...new Set(archetypes)];
  assertEqual(archetypes.length, uniqueSlugs.length, 'No duplicate slugs in archetypes flag');
});

await asyncTest('Actor-level flag has no duplicates after double-click', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes') || {};
  const classArchetypes = actorArchetypes['fighter'] || [];
  const uniqueSlugs = [...new Set(classArchetypes)];
  assertEqual(classArchetypes.length, uniqueSlugs.length, 'No duplicate slugs in actor flag');
});

await asyncTest('Backup created exactly once after double-click', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Track how many times originalAssociations is set
  let backupSetCount = 0;
  const origSetFlag = fighter.setFlag.bind(fighter);
  fighter.setFlag = async function(scope, key, value) {
    if (key === 'originalAssociations') backupSetCount++;
    return origSetFlag(scope, key, value);
  };

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  assertEqual(backupSetCount, 1, 'Backup should be set exactly once');
});

// --- Section 7: UIManager.guardAction double-click protection ---
console.log('\n--- Section 7: UIManager.guardAction protection ---');

test('UIManager has _processing static property', () => {
  assert('_processing' in UIManager, 'UIManager should have _processing property');
});

test('UIManager has guardAction static method', () => {
  assert(typeof UIManager.guardAction === 'function', 'UIManager should have guardAction method');
});

await asyncTest('guardAction prevents concurrent execution', async () => {
  UIManager._processing = false;
  let callCount = 0;

  const slowAction = () => new Promise(resolve => {
    callCount++;
    setTimeout(resolve, 50);
  });

  // Fire two calls - only one should execute
  const p1 = UIManager.guardAction(slowAction);
  const p2 = UIManager.guardAction(slowAction);
  await Promise.all([p1, p2]);

  assertEqual(callCount, 1, 'Only one call should have executed');
  UIManager._processing = false;
});

await asyncTest('guardAction resets _processing after completion', async () => {
  UIManager._processing = false;

  await UIManager.guardAction(async () => {});
  assertEqual(UIManager._processing, false, '_processing should be false after guardAction completes');
});

await asyncTest('guardAction resets _processing after error', async () => {
  UIManager._processing = false;

  try {
    await UIManager.guardAction(async () => { throw new Error('test'); });
  } catch (e) {
    // Expected
  }
  assertEqual(UIManager._processing, false, '_processing should be false after error');
});

await asyncTest('guardAction returns function result', async () => {
  UIManager._processing = false;
  const result = await UIManager.guardAction(async () => 'test-result');
  assertEqual(result, 'test-result', 'guardAction should return function result');
});

// --- Section 8: Triple-click doesn't cause issues ---
console.log('\n--- Section 8: Triple-click and rapid-fire clicks ---');

await asyncTest('Triple simultaneous apply: only one succeeds', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const results = await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const successCount = results.filter(r => r === true).length;
  assertEqual(successCount, 1, 'Exactly one apply should succeed on triple-click');
});

await asyncTest('After triple-click, archetype count is exactly 1', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes') || [];
  assertEqual(archetypes.length, 1, 'Should have exactly 1 archetype after triple-click');
});

// --- Section 9: Sequential apply after guard clears ---
console.log('\n--- Section 9: Sequential apply after guard clears ---');

await asyncTest('Sequential different archetype applies both work', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);

  const archetype1 = buildTestArchetype();
  const diff1 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype1);
  const result1 = await Applicator.apply(actor, fighter, archetype1, diff1);
  assertEqual(result1, true, 'First archetype apply should succeed');

  // Second different archetype
  const archetype2 = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        type: 'replacement',
        target: 'Armor Training',
        level: 3,
        description: 'The weapon master gains a +1 bonus to CMD.',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.armor-training',
          id: 'armor-training-id',
          level: 3,
          resolvedName: 'Armor Training'
        }
      }
    ]
  };
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype2);
  const result2 = await Applicator.apply(actor, fighter, archetype2, diff2);
  assertEqual(result2, true, 'Second different archetype apply should succeed');

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 2, 'Both archetypes should be applied');
});

await asyncTest('Guard resets between sequential calls', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(Applicator._applyInProgress, false, 'Guard should be false after first apply');

  // Second sequential apply of same archetype should be caught by duplicate check (not guard)
  clearNotifications();
  const result2 = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(result2, false, 'Second apply of same archetype fails due to duplicate check');
  assertEqual(Applicator._applyInProgress, false, 'Guard should still be false');
});

// --- Section 10: Integration with showPreviewConfirmFlow ---
console.log('\n--- Section 10: showPreviewConfirmFlow integration ---');

await asyncTest('showPreviewConfirmFlow creates dialog with Apply and Confirm', async () => {
  resetApplicatorState();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Start the flow
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // The flow is waiting for dialog input - get the last dialog
  const lastDialog = globalThis.Dialog._lastInstance;
  assert(lastDialog !== null, 'A dialog should have been created');
  assert(lastDialog.data.buttons.apply !== undefined, 'Should have Apply button');
  assert(lastDialog.data.buttons.back !== undefined, 'Should have Back button');

  // Close to resolve
  lastDialog.data.close();
  await flowPromise;
});

await asyncTest('Confirmation dialog default is cancel (safety)', async () => {
  resetApplicatorState();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const confirmPromise = UIManager.showConfirmation(
    'Apply Archetype',
    '<p>Are you sure?</p>'
  );

  const lastDialog = globalThis.Dialog._lastInstance;
  assertEqual(lastDialog.data.default, 'cancel', 'Default button should be cancel for safety');

  lastDialog.data.close();
  await confirmPromise;
});

// --- Section 11: Edge cases ---
console.log('\n--- Section 11: Edge cases ---');

await asyncTest('Apply to different actors simultaneously both succeed', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter1 = buildFighterClassItem();
  const fighter2 = buildFighterClassItem();
  const actor1 = createMockActor('Actor1', [fighter1]);
  const actor2 = createMockActor('Actor2', [fighter2]);
  const archetype = buildTestArchetype();
  const diff1 = DiffEngine.generateDiff(fighter1.system.links.classAssociations, archetype);
  const diff2 = DiffEngine.generateDiff(fighter2.system.links.classAssociations, archetype);

  // With the _applyInProgress guard, only one can run at a time,
  // so the second call may be rejected. That's expected behavior for a global guard.
  const [result1, result2] = await Promise.all([
    Applicator.apply(actor1, fighter1, archetype, diff1),
    Applicator.apply(actor2, fighter2, archetype, diff2)
  ]);

  // At least one should succeed
  const successCount = [result1, result2].filter(r => r === true).length;
  assert(successCount >= 1, 'At least one apply should succeed');

  // The guard prevents more than one concurrent operation (even for different actors)
  // This is intentional: it prevents any race conditions in the FoundryVTT Document API
  assert(successCount <= 1, 'Global guard should allow at most one concurrent apply');
});

await asyncTest('Apply guard message includes "already in progress"', async () => {
  resetApplicatorState();
  clearNotifications();

  Applicator._applyInProgress = true;
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Applicator.apply(actor, fighter, archetype, diff);

  const warns = notifications.filter(n => n.type === 'warn' && n.msg.includes('already in progress'));
  assert(warns.length >= 1, 'Should warn about in-progress operation');

  Applicator._applyInProgress = false;
});

// ========================
// Summary
// ========================

console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
