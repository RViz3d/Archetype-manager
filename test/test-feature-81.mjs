/**
 * Test Suite for Feature #81: Confirmation dialog before apply operation
 *
 * Verifies that a confirmation dialog is required before archetype application:
 * 1. Proceed through preview
 * 2. Verify confirmation dialog
 * 3. Shows change summary
 * 4. Cancel -> no application
 * 5. Confirm -> proceeds
 * 6. Not skippable
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

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #81: Confirmation dialog before apply operation ===\n');

// --- Section 1: Preview step exists and is required before confirm ---
console.log('--- Section 1: Preview opens before confirmation ---');

await asyncTest('showPreviewDialog opens a dialog (preview step exists)', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // showPreviewDialog creates a dialog
  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);

  assert(dialogTracker.length >= 1, 'At least one dialog should be created for preview');
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog.data.title.includes('Preview'), 'Preview dialog title should contain "Preview"');

  // Close dialog to resolve promise
  previewDialog.data.close();
  await previewPromise;
});

await asyncTest('Preview dialog has Apply button that leads to confirmation', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  // Preview dialog should have an 'apply' button
  assert(previewDialog.data.buttons.apply !== undefined, 'Preview dialog should have an Apply button');
  assert(previewDialog.data.buttons.apply.label === 'Apply', 'Apply button should be labeled "Apply"');

  previewDialog.data.close();
  await previewPromise;
});

await asyncTest('Preview dialog has Back button', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  assert(previewDialog.data.buttons.back !== undefined, 'Preview dialog should have a Back button');
  assert(previewDialog.data.buttons.back.label === 'Back', 'Back button should be labeled "Back"');

  previewDialog.data.close();
  await previewPromise;
});

// --- Section 2: Confirmation dialog appears after Apply in preview ---
console.log('\n--- Section 2: Confirmation dialog after Apply ---');

await asyncTest('showPreviewConfirmFlow opens confirmation after Apply in preview', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // First dialog is the preview
  assert(dialogTracker.length >= 1, 'Preview dialog should be created');
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  // Click Apply in preview to move to confirmation
  previewDialog.data.buttons.apply.callback();

  // Wait a tick for the confirmation dialog to be created
  await new Promise(r => setTimeout(r, 50));

  // Second dialog should be the confirmation dialog
  assert(dialogTracker.length >= 2, 'Confirmation dialog should be created after Apply');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.title.includes('Apply Archetype'), 'Confirmation dialog title should include "Apply Archetype"');

  // Clean up - cancel the confirmation
  confirmDialog.data.buttons.cancel.callback();

  // Wait for the flow to go back to preview
  await new Promise(r => setTimeout(r, 50));

  // Should be back at preview (new preview dialog)
  const backToPreview = dialogTracker[dialogTracker.length - 1];
  backToPreview.data.close();
  await flowPromise;
});

await asyncTest('Confirmation dialog has Confirm and Cancel buttons', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.buttons.confirm !== undefined, 'Confirmation dialog should have Confirm button');
  assert(confirmDialog.data.buttons.cancel !== undefined, 'Confirmation dialog should have Cancel button');
  assert(confirmDialog.data.buttons.confirm.label === 'Confirm', 'Confirm button labeled "Confirm"');
  assert(confirmDialog.data.buttons.cancel.label === 'Cancel', 'Cancel button labeled "Cancel"');

  // Clean up
  confirmDialog.data.close();
  await new Promise(r => setTimeout(r, 50));
  const backDialog = dialogTracker[dialogTracker.length - 1];
  backDialog.data.close();
  await flowPromise;
});

// --- Section 3: Confirmation dialog shows change summary ---
console.log('\n--- Section 3: Confirmation dialog shows change summary ---');

await asyncTest('Confirmation content includes archetype name', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  const content = confirmDialog.data.content;
  assert(content.includes('Two-Handed Fighter'), 'Confirmation content should include archetype name "Two-Handed Fighter"');

  confirmDialog.data.close();
  await new Promise(r => setTimeout(r, 50));
  const backDialog = dialogTracker[dialogTracker.length - 1];
  backDialog.data.close();
  await flowPromise;
});

await asyncTest('Confirmation content includes class name', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  const content = confirmDialog.data.content;
  assert(content.includes('Fighter'), 'Confirmation content should include class name "Fighter"');

  confirmDialog.data.close();
  await new Promise(r => setTimeout(r, 50));
  const backDialog = dialogTracker[dialogTracker.length - 1];
  backDialog.data.close();
  await flowPromise;
});

await asyncTest('Confirmation content mentions backup', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  const content = confirmDialog.data.content;
  assert(content.toLowerCase().includes('backup'), 'Confirmation content should mention backup');

  confirmDialog.data.close();
  await new Promise(r => setTimeout(r, 50));
  const backDialog = dialogTracker[dialogTracker.length - 1];
  backDialog.data.close();
  await flowPromise;
});

await asyncTest('Confirmation content mentions modifying class features', async () => {
  clearDialogTracker();
  const actor = createMockActor('TestActor', []);
  const fighter = buildFighterClassItem();
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  const content = confirmDialog.data.content.toLowerCase();
  assert(content.includes('modify') || content.includes('feature'), 'Confirmation should mention feature modifications');

  confirmDialog.data.close();
  await new Promise(r => setTimeout(r, 50));
  const backDialog = dialogTracker[dialogTracker.length - 1];
  backDialog.data.close();
  await flowPromise;
});

// --- Section 4: Cancel confirmation -> no application ---
console.log('\n--- Section 4: Cancel confirmation -> no application ---');

await asyncTest('Cancel in confirmation returns to preview (no application)', async () => {
  clearDialogTracker();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const originalAssoc = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview -> click Apply
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  // Confirmation -> click Cancel
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  // Should be back at preview - classAssociations not modified
  const currentAssoc = JSON.stringify(fighter.system.links.classAssociations);
  assertEqual(currentAssoc, JSON.stringify(originalAssoc), 'classAssociations should be unchanged after cancel');

  // Clean up - close the preview we came back to
  const backPreview = dialogTracker[dialogTracker.length - 1];
  backPreview.data.close();
  await flowPromise;
});

await asyncTest('Cancel confirmation produces no success notification', async () => {
  clearDialogTracker();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  // No success notification
  const successNotifs = notifications.filter(n => n.type === 'info' && n.msg.includes('Applied'));
  assertEqual(successNotifs.length, 0, 'No success notification after cancel');

  const backPreview = dialogTracker[dialogTracker.length - 1];
  backPreview.data.close();
  await flowPromise;
});

await asyncTest('Cancel confirmation leaves no flags on classItem', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  // No archetype flags should have been set
  assertEqual(fighter.getFlag('archetype-manager', 'archetypes'), null, 'No archetypes flag after cancel');
  assertEqual(fighter.getFlag('archetype-manager', 'originalAssociations'), null, 'No backup flag after cancel');
  assertEqual(fighter.getFlag('archetype-manager', 'appliedAt'), null, 'No appliedAt flag after cancel');

  const backPreview = dialogTracker[dialogTracker.length - 1];
  backPreview.data.close();
  await flowPromise;
});

await asyncTest('Cancel confirmation produces no chat message', async () => {
  clearDialogTracker();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  assertEqual(chatMessages.length, 0, 'No chat messages after cancel');

  const backPreview = dialogTracker[dialogTracker.length - 1];
  backPreview.data.close();
  await flowPromise;
});

// --- Section 5: Confirm -> proceeds with application ---
console.log('\n--- Section 5: Confirm -> proceeds ---');

await asyncTest('showPreviewConfirmFlow returns "applied" when confirmed', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview -> Apply
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  // Confirm
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();

  const result = await flowPromise;
  assertEqual(result, 'applied', 'Flow should return "applied" when confirmed');
});

await asyncTest('Full flow: preview -> confirm -> Applicator.apply succeeds', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Start the flow
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview -> Apply
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  // Confirm
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();

  const flowResult = await flowPromise;
  assertEqual(flowResult, 'applied', 'Flow returns "applied"');

  // Now actually apply
  const applyResult = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(applyResult, true, 'Applicator.apply should succeed');

  // Verify flags were set
  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(archetypes !== null && archetypes.includes('two-handed-fighter'), 'Archetype should be tracked in flags');
});

await asyncTest('Confirmed application creates backup', async () => {
  clearDialogTracker();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const originalAssoc = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Go through confirmation flow
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  const flowResult = await flowPromise;
  assertEqual(flowResult, 'applied', 'Flow confirmed');

  // Apply
  await Applicator.apply(actor, fighter, archetype, diff);

  // Verify backup was created
  const backup = fighter.getFlag('archetype-manager', 'originalAssociations');
  assert(backup !== null, 'Backup should be created');
  assertEqual(backup.length, originalAssoc.length, 'Backup should have same count as original');
});

await asyncTest('Confirmed application posts chat message', async () => {
  clearDialogTracker();
  clearChatMessages();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  actor.isOwner = true;
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Go through confirmation flow
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await flowPromise;

  // Apply
  await Applicator.apply(actor, fighter, archetype, diff);

  assert(chatMessages.length >= 1, 'Chat message should be posted on apply');
  assert(chatMessages[0].content.includes('Two-Handed Fighter'), 'Chat message should include archetype name');
});

// --- Section 6: Confirmation is not skippable ---
console.log('\n--- Section 6: Confirmation is not skippable ---');

await asyncTest('showPreviewConfirmFlow always goes through confirmation step', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview dialog is first
  assert(dialogTracker.length === 1, 'Only preview dialog exists initially');
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  // Click Apply in preview
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  // Confirmation dialog must appear (not direct application)
  assert(dialogTracker.length >= 2, 'Confirmation dialog must appear after Apply');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.title.includes('Apply Archetype'), 'Must be confirmation dialog');

  // The flow has NOT returned 'applied' yet - still waiting
  let flowResolved = false;
  flowPromise.then(() => { flowResolved = true; });
  await new Promise(r => setTimeout(r, 50));
  assertEqual(flowResolved, false, 'Flow should NOT resolve before confirmation');

  // Confirm to clean up
  confirmDialog.data.buttons.confirm.callback();
  await flowPromise;
});

await asyncTest('Default button in confirmation is cancel (safety)', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const confirmPromise = UIManager.showConfirmation('Apply Archetype', '<p>Test</p>');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assertEqual(confirmDialog.data.default, 'cancel', 'Default button should be cancel for safety');

  confirmDialog.data.buttons.cancel.callback();
  await confirmPromise;
});

await asyncTest('Closing confirmation via X returns false (not applied)', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test', '<p>Test</p>');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  // Simulate X/Escape close
  confirmDialog.data.close();
  const result = await confirmPromise;
  assertEqual(result, false, 'Closing confirmation via X should return false');
});

await asyncTest('Preview Apply button does not directly apply - only opens confirm', async () => {
  clearDialogTracker();
  clearNotifications();
  const fighter = buildFighterClassItem();
  const originalAssoc = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Click Apply in preview
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  // classAssociations should not be modified yet
  const currentAssoc = JSON.stringify(fighter.system.links.classAssociations);
  assertEqual(currentAssoc, JSON.stringify(originalAssoc), 'Clicking Apply in preview should NOT modify classAssociations');

  // No flags should be set
  assertEqual(fighter.getFlag('archetype-manager', 'archetypes'), null, 'No archetypes flag after preview Apply click');

  // Clean up
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.confirm.callback();
  await flowPromise;
});

// --- Section 7: Back/Close navigation ---
console.log('\n--- Section 7: Back/Close navigation ---');

await asyncTest('Back in preview returns "back-to-main"', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.back.callback();

  const result = await flowPromise;
  assertEqual(result, 'back-to-main', 'Back in preview should return "back-to-main"');
});

await asyncTest('Close (X) in preview returns null', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.close();

  const result = await flowPromise;
  assertEqual(result, null, 'Close in preview should return null');
});

await asyncTest('Cancel in confirmation goes back to preview (loop)', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview -> Apply
  const preview1 = dialogTracker[dialogTracker.length - 1];
  preview1.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  // Confirm -> Cancel -> back to preview
  const confirm1 = dialogTracker[dialogTracker.length - 1];
  confirm1.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  // Should be at a new preview dialog
  const preview2 = dialogTracker[dialogTracker.length - 1];
  assert(preview2.data.title.includes('Preview'), 'Should be back at preview after cancel');

  // Now close
  preview2.data.close();
  const result = await flowPromise;
  assertEqual(result, null, 'Closing the returned preview should return null');
});

// --- Section 8: showConfirmation directly ---
console.log('\n--- Section 8: showConfirmation direct tests ---');

await asyncTest('showConfirmation returns true when confirmed', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test Title', '<p>Test content</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];
  dialog.data.buttons.confirm.callback();
  const result = await confirmPromise;
  assertEqual(result, true, 'Confirm should return true');
});

await asyncTest('showConfirmation returns false when cancelled', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test Title', '<p>Test content</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];
  dialog.data.buttons.cancel.callback();
  const result = await confirmPromise;
  assertEqual(result, false, 'Cancel should return false');
});

await asyncTest('showConfirmation returns false when closed via X', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test Title', '<p>Test content</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];
  dialog.data.close();
  const result = await confirmPromise;
  assertEqual(result, false, 'Close should return false');
});

await asyncTest('showConfirmation title includes MODULE_TITLE', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Apply Archetype', '<p>Test</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.title.includes('Archetype Manager'), 'Title should include module title');
  dialog.data.buttons.cancel.callback();
  await confirmPromise;
});

// --- Section 9: Different archetype names in confirmation ---
console.log('\n--- Section 9: Different archetypes display correctly ---');

await asyncTest('Confirmation shows correct archetype name for Weapon Master', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildSecondArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.content.includes('Weapon Master'), 'Confirmation should show "Weapon Master"');

  confirmDialog.data.buttons.confirm.callback();
  await flowPromise;
});

await asyncTest('Preview shows change summary in diff table (has rows)', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Check preview HTML has a diff table with entries
  const previewHTML = UIManager._buildPreviewHTML(archetype, diff);
  assert(previewHTML.includes('preview-diff-table'), 'Preview should have diff table');
  assert(previewHTML.includes('Bravery') || previewHTML.includes('Shattering Strike') || previewHTML.includes('Overhand Chop'),
    'Preview should show feature names in diff');
  // Check status icons exist
  assert(previewHTML.includes('fa-times') || previewHTML.includes('fa-plus') || previewHTML.includes('fa-check'),
    'Preview should have status icons');
});

// --- Section 10: Multiple cancel-retry cycles ---
console.log('\n--- Section 10: Multiple cancel-retry cycles ---');

await asyncTest('Can cancel confirmation and re-Apply from preview repeatedly', async () => {
  clearDialogTracker();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // First cycle: Preview -> Apply -> Cancel
  const preview1 = dialogTracker[dialogTracker.length - 1];
  preview1.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));
  const confirm1 = dialogTracker[dialogTracker.length - 1];
  confirm1.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  // Second cycle: Preview -> Apply -> Cancel
  const preview2 = dialogTracker[dialogTracker.length - 1];
  preview2.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));
  const confirm2 = dialogTracker[dialogTracker.length - 1];
  confirm2.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 50));

  // Third cycle: Preview -> Apply -> Confirm (finally proceed)
  const preview3 = dialogTracker[dialogTracker.length - 1];
  preview3.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));
  const confirm3 = dialogTracker[dialogTracker.length - 1];
  confirm3.data.buttons.confirm.callback();

  const result = await flowPromise;
  assertEqual(result, 'applied', 'Flow should eventually return "applied" after multiple cancel-retry cycles');
});

await asyncTest('No data changes during cancel-retry cycles', async () => {
  clearDialogTracker();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const originalAssoc = JSON.parse(JSON.stringify(fighter.system.links.classAssociations));
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildTestArchetype();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Cancel twice
  for (let i = 0; i < 2; i++) {
    const preview = dialogTracker[dialogTracker.length - 1];
    preview.data.buttons.apply.callback();
    await new Promise(r => setTimeout(r, 50));
    const confirm = dialogTracker[dialogTracker.length - 1];
    confirm.data.buttons.cancel.callback();
    await new Promise(r => setTimeout(r, 50));
  }

  // Verify no data changed after 2 cancellations
  assertEqual(JSON.stringify(fighter.system.links.classAssociations), JSON.stringify(originalAssoc),
    'classAssociations unchanged after 2 cancel cycles');
  assertEqual(fighter.getFlag('archetype-manager', 'archetypes'), null, 'No flags after cancel cycles');
  assertEqual(chatMessages.length, 0, 'No chat messages during cancel cycles');

  // Clean up: confirm the third time
  const preview3 = dialogTracker[dialogTracker.length - 1];
  preview3.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));
  const confirm3 = dialogTracker[dialogTracker.length - 1];
  confirm3.data.buttons.confirm.callback();
  await flowPromise;
});

// --- Section 11: Confirmation with different class types ---
console.log('\n--- Section 11: Different class types ---');

await asyncTest('Confirmation works with Rogue class', async () => {
  clearDialogTracker();
  const rogue = createMockClassItem('Rogue', 5, 'rogue');
  rogue.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.sneak-attack', id: 'sneak-attack-id', level: 1, resolvedName: 'Sneak Attack' },
    { uuid: 'Compendium.pf1.class-abilities.Item.trapfinding', id: 'trapfinding-id', level: 1, resolvedName: 'Trapfinding' },
  ];
  const actor = createMockActor('TestRogue', [rogue]);
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
  const diff = DiffEngine.generateDiff(rogue.system.links.classAssociations, rogueArchetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, rogue, rogueArchetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 50));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.content.includes('Knife Master'), 'Should show "Knife Master"');
  assert(confirmDialog.data.content.includes('Rogue'), 'Should show "Rogue" class');

  confirmDialog.data.buttons.confirm.callback();
  const result = await flowPromise;
  assertEqual(result, 'applied', 'Should return applied for Rogue archetype');
});

// --- Summary ---
console.log('\n==========================================');
console.log(`Feature #81 Results: ${passed}/${totalTests} tests passed`);
if (failed > 0) {
  console.log(`  ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('  All tests PASSED!');
}
