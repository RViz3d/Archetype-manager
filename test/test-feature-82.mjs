/**
 * Test Suite for Feature #82: Confirmation dialog before remove operation
 *
 * Verifies that a confirmation dialog is required before archetype removal:
 * 1. Trigger removal
 * 2. Verify confirmation dialog
 * 3. Names archetype being removed
 * 4. Cancel -> not removed
 * 5. Confirm -> proceeds
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

// Track dialogs
const dialogTracker = [];
const OrigDialog = globalThis.Dialog;

class TrackedDialog extends OrigDialog {
  constructor(data, options) {
    super(data, options);
    dialogTracker.push(this);
  }
}

globalThis.Dialog = TrackedDialog;

function clearDialogTracker() {
  dialogTracker.length = 0;
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

/**
 * Helper: Apply an archetype to set up state for removal tests
 */
async function applyArchetype(actor, classItem, archetype) {
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);
  return Applicator.apply(actor, classItem, archetype, diff);
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #82: Confirmation dialog before remove operation ===\n');

// --- Section 1: showRemoveConfirmation method exists ---
console.log('--- Section 1: showRemoveConfirmation exists ---');

test('UIManager.showRemoveConfirmation is a function', () => {
  assert(typeof UIManager.showRemoveConfirmation === 'function',
    'showRemoveConfirmation should be a function');
});

// --- Section 2: Trigger removal -> Confirmation dialog appears ---
console.log('\n--- Section 2: Confirmation dialog appears on removal ---');

await asyncTest('showRemoveConfirmation opens a confirmation dialog', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();

  // Apply the archetype first
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();
  clearChatMessages();

  // Now trigger removal
  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');

  assert(dialogTracker.length >= 1, 'A confirmation dialog should be created');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.title.includes('Remove Archetype'),
    'Dialog title should contain "Remove Archetype"');

  // Clean up - cancel
  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

await asyncTest('Confirmation dialog has Confirm and Cancel buttons', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assert(confirmDialog.data.buttons.confirm !== undefined, 'Should have Confirm button');
  assert(confirmDialog.data.buttons.cancel !== undefined, 'Should have Cancel button');
  assertEqual(confirmDialog.data.buttons.confirm.label, 'Confirm', 'Confirm button labeled "Confirm"');
  assertEqual(confirmDialog.data.buttons.cancel.label, 'Cancel', 'Cancel button labeled "Cancel"');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

await asyncTest('Default button is cancel (safety)', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assertEqual(confirmDialog.data.default, 'cancel', 'Default should be cancel for safety');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

// --- Section 3: Confirmation dialog names the archetype ---
console.log('\n--- Section 3: Confirmation names archetype ---');

await asyncTest('Confirmation content includes archetype display name', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  // The slug "two-handed-fighter" should be displayed as "Two Handed Fighter" (hyphens -> spaces)
  assert(confirmDialog.data.content.includes('Two Handed Fighter'),
    'Confirmation should include archetype display name "Two Handed Fighter"');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

await asyncTest('Confirmation content includes class name', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assert(confirmDialog.data.content.includes('Fighter'),
    'Confirmation should include class name "Fighter"');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

await asyncTest('Confirmation mentions restoring from backup', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  const content = confirmDialog.data.content.toLowerCase();
  assert(content.includes('restore') || content.includes('backup'),
    'Confirmation should mention restoring or backup');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

await asyncTest('Confirmation dialog title includes module title', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assert(confirmDialog.data.title.includes('Archetype Manager'),
    'Dialog title should include module title');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

await asyncTest('Different archetype slug shows correct name (weapon-master)', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildSecondArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'weapon-master');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assert(confirmDialog.data.content.includes('Weapon Master'),
    'Confirmation should show "Weapon Master" for weapon-master slug');

  confirmDialog.data.buttons.cancel.callback();
  await removePromise;
});

// --- Section 4: Cancel -> not removed ---
console.log('\n--- Section 4: Cancel -> archetype not removed ---');

await asyncTest('Cancel leaves archetype applied (classAssociations unchanged)', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);

  // Record state after application
  const assocAfterApply = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  const result = await removePromise;

  assertEqual(result, false, 'showRemoveConfirmation should return false on cancel');

  // classAssociations should be unchanged (still modified from application)
  assertEqual(JSON.stringify(fighter.system.links.classAssociations),
    JSON.stringify(assocAfterApply),
    'classAssociations should remain unchanged after cancel');
});

await asyncTest('Cancel leaves archetype tracking flag intact', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await removePromise;

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(archetypes !== null && archetypes.includes('two-handed-fighter'),
    'Archetype tracking flag should still be present after cancel');
});

await asyncTest('Cancel produces no removal chat message', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearChatMessages();
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await removePromise;

  assertEqual(chatMessages.length, 0, 'No chat messages after cancel');
});

await asyncTest('Cancel produces no removal notification', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await removePromise;

  const removeNotifs = notifications.filter(n => n.type === 'info' && n.msg.includes('Removed'));
  assertEqual(removeNotifs.length, 0, 'No removal notification after cancel');
});

await asyncTest('Cancel leaves backup flag intact', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await removePromise;

  const backup = fighter.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should still exist after cancel');
});

await asyncTest('Close via X/Escape also does not remove', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.close();
  const result = await removePromise;

  assertEqual(result, false, 'Close via X should return false');

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(archetypes !== null && archetypes.includes('two-handed-fighter'),
    'Archetype should still be applied after X close');
  assertEqual(chatMessages.length, 0, 'No chat messages after X close');
});

// --- Section 5: Confirm -> proceeds with removal ---
console.log('\n--- Section 5: Confirm -> proceeds with removal ---');

await asyncTest('Confirm triggers Applicator.remove and returns true', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  const result = await removePromise;

  assertEqual(result, true, 'showRemoveConfirmation should return true on confirm');
});

await asyncTest('Confirmed removal clears archetype tracking flag', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await removePromise;

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Archetype tracking flag should be cleared after confirmed removal');
});

await asyncTest('Confirmed removal restores original classAssociations', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const originalAssoc = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await removePromise;

  // classAssociations should be restored to original
  assertEqual(JSON.stringify(fighter.system.links.classAssociations),
    JSON.stringify(originalAssoc),
    'classAssociations should be restored after confirmed removal');
});

await asyncTest('Confirmed removal posts chat message', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await removePromise;

  assert(chatMessages.length >= 1, 'Chat message should be posted on confirmed removal');
  assert(chatMessages[chatMessages.length - 1].content.includes('two-handed-fighter'),
    'Chat message should include archetype slug');
});

await asyncTest('Confirmed removal shows success notification', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await removePromise;

  const successNotifs = notifications.filter(n => n.type === 'info' && n.msg.includes('Removed'));
  assert(successNotifs.length >= 1, 'Should show removal success notification');
});

await asyncTest('Confirmed removal cleans up backup flag', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await removePromise;

  // Since this was the only archetype, backup should be cleaned up
  const backup = fighter.getFlag('archetype-manager', 'originalAssociations');
  assertEqual(backup, null, 'Backup flag should be cleaned up after last archetype removal');
});

// --- Section 6: Rogue class removal confirmation ---
console.log('\n--- Section 6: Different class types ---');

await asyncTest('Removal confirmation works with Rogue class', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const rogue = createMockClassItem('Rogue', 5, 'rogue');
  rogue.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.sneak-attack', id: 'sneak-attack-id', level: 1, resolvedName: 'Sneak Attack' },
    { uuid: 'Compendium.pf1.class-abilities.Item.trapfinding', id: 'trapfinding-id', level: 1, resolvedName: 'Trapfinding' },
  ];
  const actor = createMockActor('TestRogue', [rogue]);
  actor.isOwner = true;
  const rogueArchetype = {
    name: 'Knife Master',
    slug: 'knife-master',
    class: 'rogue',
    features: [{
      name: 'Hidden Blade',
      type: 'replacement',
      target: 'Trapfinding',
      level: 1,
      description: 'A knife master replaces trapfinding.',
      matchedAssociation: {
        uuid: 'Compendium.pf1.class-abilities.Item.trapfinding',
        id: 'trapfinding-id',
        level: 1,
        resolvedName: 'Trapfinding'
      }
    }]
  };
  await applyArchetype(actor, rogue, rogueArchetype);
  clearNotifications();
  clearChatMessages();

  const removePromise = UIManager.showRemoveConfirmation(actor, rogue, 'knife-master');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assert(confirmDialog.data.content.includes('Knife Master'),
    'Should show "Knife Master" for knife-master slug');
  assert(confirmDialog.data.content.includes('Rogue'),
    'Should show "Rogue" class name');

  confirmDialog.data.buttons.confirm.callback();
  const result = await removePromise;
  assertEqual(result, true, 'Removal should succeed');

  const archetypes = rogue.getFlag('archetype-manager', 'archetypes');
  assertEqual(archetypes, null, 'Archetype flag should be cleared');
});

// --- Section 7: Edge cases ---
console.log('\n--- Section 7: Edge cases ---');

await asyncTest('Removing non-existent archetype returns false even after confirm', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;

  // Don't apply any archetype - try to remove
  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'non-existent');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  const result = await removePromise;

  // Applicator.remove should return false for non-existent archetype
  assertEqual(result, false, 'Should return false for non-existent archetype');
});

await asyncTest('Confirmation not skippable for removal', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  await applyArchetype(actor, fighter, archetype);
  clearNotifications();

  // Call showRemoveConfirmation which should always show a dialog
  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'two-handed-fighter');

  // Dialog should exist (confirmation is required, not skippable)
  const lastDialogIndex = dialogTracker.length - 1;
  assert(lastDialogIndex >= 0, 'Confirmation dialog must be created');
  const confirmDialog = dialogTracker[lastDialogIndex];
  assert(confirmDialog.data.title.includes('Remove Archetype'),
    'Must be a removal confirmation dialog');

  // The method should not have resolved yet (waiting for user input)
  let resolved = false;
  removePromise.then(() => { resolved = true; });
  await new Promise(r => setTimeout(r, 50));
  assertEqual(resolved, false, 'Method should NOT resolve before user confirms/cancels');

  // Confirm to clean up
  confirmDialog.data.buttons.confirm.callback();
  await removePromise;
});

await asyncTest('Removal of one archetype from multi-archetype stack shows correct name', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;

  // Apply two archetypes
  const arch1 = buildTestArchetype();
  await applyArchetype(actor, fighter, arch1);
  const arch2 = buildSecondArchetype();
  await applyArchetype(actor, fighter, arch2);
  clearNotifications();
  clearChatMessages();

  // Remove just the second one
  const removePromise = UIManager.showRemoveConfirmation(actor, fighter, 'weapon-master');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assert(confirmDialog.data.content.includes('Weapon Master'),
    'Should name "Weapon Master" specifically');
  // Should NOT mention Two-Handed Fighter
  // (The confirmation is about the specific archetype being removed)

  confirmDialog.data.buttons.confirm.callback();
  const result = await removePromise;
  assertEqual(result, true, 'Selective removal should succeed');

  // Verify first archetype still applied
  const remaining = fighter.getFlag('archetype-manager', 'archetypes');
  assert(remaining !== null && remaining.includes('two-handed-fighter'),
    'Two-Handed Fighter should still be applied');
  assert(!remaining.includes('weapon-master'),
    'Weapon Master should be removed');
});

// --- Summary ---
console.log('\n==========================================');
console.log(`Feature #82 Results: ${passed}/${totalTests} tests passed`);
if (failed > 0) {
  console.log(`  ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('  All tests PASSED!');
}
