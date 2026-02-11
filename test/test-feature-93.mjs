/**
 * Test Suite for Feature #93: Double-click remove doesn't corrupt data
 *
 * Verifies that rapid remove clicks don't cause errors:
 * 1. Apply archetype
 * 2. Trigger removal
 * 3. Rapidly click confirm twice
 * 4. Removed cleanly once
 * 5. No errors or corruption
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

function buildSecondArchetype() {
  return {
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
}

// Reset Applicator state before each test group
function resetApplicatorState() {
  Applicator._applyInProgress = false;
  Applicator._removeInProgress = false;
  UIManager._processing = false;
}

/**
 * Helper: Apply an archetype to a fresh actor setup (returns actor, classItem with archetype applied)
 */
async function setupAppliedArchetype() {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const result = await Applicator.apply(actor, fighter, archetype, diff);
  if (!result) throw new Error('Setup failed: archetype not applied');

  clearNotifications();
  clearChatMessages();

  return { actor, fighter, archetype };
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #93: Double-click remove doesn\'t corrupt data ===\n');

// --- Section 1: Applicator has remove guard ---
console.log('--- Section 1: Applicator._removeInProgress guard exists ---');

test('Applicator has _removeInProgress static property', () => {
  assert('_removeInProgress' in Applicator, 'Applicator should have _removeInProgress property');
});

test('Applicator._removeInProgress defaults to false', () => {
  resetApplicatorState();
  assertEqual(Applicator._removeInProgress, false, '_removeInProgress should default to false');
});

test('Applicator has _doRemove private method', () => {
  assert(typeof Applicator._doRemove === 'function', 'Applicator should have _doRemove method');
});

// --- Section 2: Single remove works normally ---
console.log('\n--- Section 2: Single remove works normally ---');

await asyncTest('Single remove succeeds and returns true', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  const result = await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
});

await asyncTest('Single remove clears archetypes flag', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  await Applicator.remove(actor, fighter, 'two-handed-fighter');
  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'archetypes flag should be cleared after removal');
});

await asyncTest('Single remove posts exactly one chat message', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearChatMessages();

  await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(chatMessages.length, 1, 'Should have exactly 1 chat message');
});

await asyncTest('_removeInProgress resets to false after successful remove', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(Applicator._removeInProgress, false, '_removeInProgress should be false after remove completes');
});

await asyncTest('Single remove restores original classAssociations', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  const backup = fighter.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should exist before removal');

  await Applicator.remove(actor, fighter, 'two-handed-fighter');
  const currentAssociations = fighter.system.links.classAssociations;
  assertEqual(currentAssociations.length, backup.length, 'Should have same number of associations as backup');
});

// --- Section 3: Concurrent remove rejected ---
console.log('\n--- Section 3: Concurrent remove is rejected by guard ---');

await asyncTest('Second concurrent remove returns false when first is in progress', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();

  // Simulate _removeInProgress being true
  Applicator._removeInProgress = true;

  const result = await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(result, false, 'Second remove should return false when first is in progress');

  Applicator._removeInProgress = false;
});

await asyncTest('Warning notification shown when remove blocked by guard', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();

  Applicator._removeInProgress = true;
  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length >= 1, 'Should have at least one warning notification');
  assert(warnNotifs.some(n => n.msg.includes('already in progress')), 'Warning should mention "already in progress"');

  Applicator._removeInProgress = false;
});

await asyncTest('No flags modified when remove blocked by guard', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();

  // Record current state
  const archetypesBefore = fighter.getFlag('archetype-manager', 'archetypes');
  assert(archetypesBefore !== null, 'Archetypes should exist before blocked remove');

  Applicator._removeInProgress = true;
  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  // Flags should be unchanged
  const archetypesAfter = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(JSON.stringify(archetypesAfter), JSON.stringify(archetypesBefore), 'Flags should be unchanged when blocked');

  Applicator._removeInProgress = false;
});

await asyncTest('No chat message when remove blocked by guard', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearChatMessages();

  Applicator._removeInProgress = true;
  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  assertEqual(chatMessages.length, 0, 'No chat message should be posted when blocked');

  Applicator._removeInProgress = false;
});

// --- Section 4: Rapid double-click removal simulation ---
console.log('\n--- Section 4: Rapid double-click removal simulation ---');

await asyncTest('Two simultaneous remove calls: only one succeeds', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  const [result1, result2] = await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const successCount = [result1, result2].filter(r => r === true).length;
  assertEqual(successCount, 1, 'Exactly one remove should succeed');
});

await asyncTest('After double-click remove, archetype fully removed (no partial state)', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  // Archetype should be fully removed
  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'archetypes flag should be null (fully cleared)');
});

await asyncTest('After double-click remove, exactly one chat message', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  assertEqual(chatMessages.length, 1, 'Exactly 1 chat message should be posted');
});

await asyncTest('After double-click remove, exactly one success notification', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const infoNotifs = notifications.filter(n => n.type === 'info' && n.msg.includes('Removed'));
  assertEqual(infoNotifs.length, 1, 'Exactly 1 success notification');
});

// --- Section 5: No data corruption ---
console.log('\n--- Section 5: No data corruption after rapid remove ---');

await asyncTest('classAssociations restored correctly after double-click remove', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter = buildFighterClassItem();
  const originalAssociations = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Applicator.apply(actor, fighter, archetype, diff);
  clearNotifications();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  // Original associations should be fully restored
  const currentAssociations = fighter.system.links.classAssociations;
  assertEqual(currentAssociations.length, originalAssociations.length, 'Should have original number of associations');
  for (let i = 0; i < originalAssociations.length; i++) {
    assertEqual(currentAssociations[i].uuid, originalAssociations[i].uuid, `UUID at index ${i} should match original`);
  }
});

await asyncTest('No orphan flags after double-click remove', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  // All archetype-manager flags should be cleaned up
  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  const originalAssociations = fighter.getFlag('archetype-manager', 'originalAssociations');
  const appliedAt = fighter.getFlag('archetype-manager', 'appliedAt');
  const appliedArchetypeData = fighter.getFlag('archetype-manager', 'appliedArchetypeData');

  assertEqual(archetypes, null, 'archetypes flag should be null');
  assertEqual(originalAssociations, null, 'originalAssociations flag should be null');
  assertEqual(appliedAt, null, 'appliedAt flag should be null');
  assertEqual(appliedArchetypeData, null, 'appliedArchetypeData flag should be null');
});

await asyncTest('Actor-level flags cleaned after double-click remove', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assertEqual(actorArchetypes, null, 'Actor-level flag should be null after removal');
});

// --- Section 6: _removeInProgress flag lifecycle ---
console.log('\n--- Section 6: _removeInProgress flag lifecycle ---');

await asyncTest('_removeInProgress is true during remove', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  let wasTrueDuringRemove = false;

  // Intercept unsetFlag to check _removeInProgress during operation
  const origUnsetFlag = fighter.unsetFlag.bind(fighter);
  fighter.unsetFlag = async function(scope, key) {
    if (key === 'archetypes' && Applicator._removeInProgress) {
      wasTrueDuringRemove = true;
    }
    return origUnsetFlag(scope, key);
  };

  await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assert(wasTrueDuringRemove, '_removeInProgress should be true during the remove operation');
});

await asyncTest('_removeInProgress resets to false even on error', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  // Make update throw an error to test finally block
  const origUpdate = fighter.update.bind(fighter);
  fighter.update = async () => { throw new Error('Simulated error'); };

  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  assertEqual(Applicator._removeInProgress, false, '_removeInProgress should reset to false even after error');

  fighter.update = origUpdate;
});

await asyncTest('After failed remove, next remove succeeds (guard resets)', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  await Applicator.apply(actor, fighter, archetype, diff);
  clearNotifications();
  clearChatMessages();

  // Simulate a failure by making update throw
  const origUpdate = fighter.update.bind(fighter);
  let callCount = 0;
  fighter.update = async function(data) {
    callCount++;
    if (callCount === 1) throw new Error('Simulated failure');
    return origUpdate.call(this, data);
  };

  // First call fails
  const result1 = await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(result1, false, 'First remove should fail due to simulated error');
  assertEqual(Applicator._removeInProgress, false, 'Guard should be reset after failure');

  // Second call should succeed (guard is reset)
  fighter.update = origUpdate;
  clearNotifications();
  clearChatMessages();
  const result2 = await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(result2, true, 'Second remove should succeed after guard reset');
});

// --- Section 7: Triple-click doesn't cause issues ---
console.log('\n--- Section 7: Triple-click and rapid-fire clicks ---');

await asyncTest('Triple simultaneous remove: only one succeeds', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  const results = await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const successCount = results.filter(r => r === true).length;
  assertEqual(successCount, 1, 'Exactly one remove should succeed on triple-click');
});

await asyncTest('After triple-click remove, no flags remain', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'No archetypes flag should remain');
});

await asyncTest('No errors in notifications after triple-click remove', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assertEqual(errorNotifs.length, 0, 'No error notifications should be shown');
});

// --- Section 8: Multi-archetype selective removal with double-click ---
console.log('\n--- Section 8: Multi-archetype selective removal with double-click ---');

await asyncTest('Double-click remove of one archetype from stack: correct one removed', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype1 = buildTestArchetype();
  const diff1 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype1);
  await Applicator.apply(actor, fighter, archetype1, diff1);

  const archetype2 = buildSecondArchetype();
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype2);
  await Applicator.apply(actor, fighter, archetype2, diff2);
  clearNotifications();
  clearChatMessages();

  // Verify both applied
  const before = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(before.length, 2, 'Both archetypes should be applied');

  // Double-click remove of first archetype
  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  const after = fighter.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(after), 'archetypes should still be an array');
  assertEqual(after.length, 1, 'Should have exactly 1 archetype remaining');
  assertEqual(after[0], 'weapon-master', 'Weapon Master should remain');
});

await asyncTest('Double-click remove preserves other archetype data', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype1 = buildTestArchetype();
  const diff1 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype1);
  await Applicator.apply(actor, fighter, archetype1, diff1);

  const archetype2 = buildSecondArchetype();
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype2);
  await Applicator.apply(actor, fighter, archetype2, diff2);
  clearNotifications();
  clearChatMessages();

  // Double-click remove of first archetype
  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  // Stored archetype data for remaining archetype should still be intact
  const storedData = fighter.getFlag('archetype-manager', 'appliedArchetypeData');
  assert(storedData !== null, 'appliedArchetypeData should still exist');
  assert(storedData['weapon-master'] !== undefined, 'weapon-master data should be preserved');
  assertEqual(storedData['two-handed-fighter'], undefined, 'two-handed-fighter data should be removed');
});

// --- Section 9: Apply-remove-apply cycle with double-clicks ---
console.log('\n--- Section 9: Apply-remove-apply cycle with double-clicks ---');

await asyncTest('Apply, double-click remove, re-apply works correctly', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();

  // Apply
  const diff1 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const applyResult = await Applicator.apply(actor, fighter, archetype, diff1);
  assertEqual(applyResult, true, 'Initial apply should succeed');

  // Double-click remove
  clearNotifications();
  clearChatMessages();
  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'two-handed-fighter')
  ]);

  // Re-apply
  clearNotifications();
  clearChatMessages();
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const reapplyResult = await Applicator.apply(actor, fighter, archetype, diff2);
  assertEqual(reapplyResult, true, 'Re-apply after double-click remove should succeed');

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes.length, 1, 'Should have exactly 1 archetype after re-apply');
});

// --- Section 10: Remove guard message content ---
console.log('\n--- Section 10: Remove guard message content ---');

await asyncTest('Remove guard message includes "already in progress"', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();

  Applicator._removeInProgress = true;
  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  const warns = notifications.filter(n => n.type === 'warn' && n.msg.includes('already in progress'));
  assert(warns.length >= 1, 'Should warn about in-progress operation');

  Applicator._removeInProgress = false;
});

await asyncTest('Remove guard message includes module title', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();

  Applicator._removeInProgress = true;
  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  const warns = notifications.filter(n => n.type === 'warn' && n.msg.includes('PF1e Archetype Manager'));
  assert(warns.length >= 1, 'Warning should include module title');

  Applicator._removeInProgress = false;
});

// --- Section 11: showRemoveConfirmation integration ---
console.log('\n--- Section 11: showRemoveConfirmation integration ---');

await asyncTest('showRemoveConfirmation creates confirmation dialog', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  const confirmPromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');

  const lastDialog = globalThis.Dialog._lastInstance;
  assert(lastDialog !== null, 'A dialog should have been created');
  assert(lastDialog.data.title.includes('Remove'), 'Dialog title should mention Remove');

  // Close to resolve
  lastDialog.data.close();
  await confirmPromise;
});

await asyncTest('showRemoveConfirmation default button is cancel (safety)', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  const confirmPromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');

  const lastDialog = globalThis.Dialog._lastInstance;
  assertEqual(lastDialog.data.default, 'cancel', 'Default button should be cancel for safety');

  lastDialog.data.close();
  await confirmPromise;
});

await asyncTest('showRemoveConfirmation content includes archetype display name', async () => {
  const { actor, fighter } = await setupAppliedArchetype();

  const confirmPromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');

  const lastDialog = globalThis.Dialog._lastInstance;
  const content = lastDialog.data.content;
  assert(content.includes('Two-Handed Fighter') || content.includes('Two Handed Fighter'),
    'Content should include archetype display name');

  lastDialog.data.close();
  await confirmPromise;
});

// --- Section 12: Apply and remove guards are independent ---
console.log('\n--- Section 12: Apply and remove guards are independent ---');

await asyncTest('Apply guard does not block remove', async () => {
  const { actor, fighter } = await setupAppliedArchetype();
  clearNotifications();
  clearChatMessages();

  // Set apply guard but not remove guard
  Applicator._applyInProgress = true;
  Applicator._removeInProgress = false;

  const result = await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed even when apply guard is set');

  Applicator._applyInProgress = false;
});

await asyncTest('Remove guard does not block apply', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Set remove guard but not apply guard
  Applicator._applyInProgress = false;
  Applicator._removeInProgress = true;

  const result = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(result, true, 'Apply should succeed even when remove guard is set');

  Applicator._removeInProgress = false;
});

// ========================
// Summary
// ========================

console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
