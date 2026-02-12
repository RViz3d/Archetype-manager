/**
 * Test Suite for Feature #69: Dialog flow: main -> preview -> confirm -> apply
 *
 * Verifies the complete dialog flow:
 * 1. Open main dialog, select archetype, click apply
 * 2. Verify preview dialog opens
 * 3. Review diff, click confirm
 * 4. Verify confirmation dialog
 * 5. Confirm -> verify application
 * 6. Verify success notification
 * 7. Verify all dialogs close
 * 8. Verify character reflects changes
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
const { ConflictChecker } = await import('../scripts/conflict-checker.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// Track notifications
const notifications = [];
const origNotify = globalThis.ui.notifications;
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
const origChatCreate = globalThis.ChatMessage.create;
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

/**
 * Build a standard Two-Handed Fighter archetype for testing
 * (replaces Bravery at level 2 with Shattering Strike)
 */
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
        },
        uuid: 'Compendium.pf1e-archetypes.pf-arch-features.Item.shattering-strike'
      },
      {
        name: 'Overhand Chop',
        type: 'additive',
        target: null,
        level: 3,
        description: 'Doubles Str bonus on single attacks.',
        uuid: 'Compendium.pf1e-archetypes.pf-arch-features.Item.overhand-chop'
      }
    ]
  };
}

/**
 * Build a standard Fighter class item with base associations
 */
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

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #69: Dialog flow: main -> preview -> confirm -> apply ===\n');

// --- Section 1: showPreviewDialog basic behavior ---
console.log('--- Preview Dialog ---');

// Test 1: showPreviewDialog returns a promise
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Test Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Preview dialog creates a Dialog that resolves from button callbacks
  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);

  assert(dialogTracker.length > 0, 'Preview dialog is created');
  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.title.includes('Preview'), 'Preview dialog title includes "Preview"');
  assert(dialog.data.title.includes('Two-Handed Fighter'), 'Preview dialog title includes archetype name');

  // Simulate clicking "Back" to resolve the promise
  if (dialog.data.buttons.back) {
    dialog.data.buttons.back.callback();
  }
  const result = await previewPromise;
  assert(result === 'back', 'Preview dialog resolves to "back" when Back is clicked');
}

// Test 2: Preview dialog shows Apply button
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Test Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.apply !== undefined, 'Preview dialog has Apply button');
  assert(dialog.data.buttons.apply.label === 'Apply', 'Apply button labeled "Apply"');
  assert(dialog.data.buttons.back !== undefined, 'Preview dialog has Back button');
  assert(dialog.data.buttons.back.label === 'Back', 'Back button labeled "Back"');

  // Resolve promise
  dialog.data.buttons.back.callback();
  await previewPromise;
}

// Test 3: Preview dialog content shows diff table
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Test Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.content.includes('preview-diff-table'), 'Preview dialog has diff table');
  assert(dialog.data.content.includes('Bravery'), 'Diff shows Bravery (removed feature)');
  assert(dialog.data.content.includes('Shattering Strike'), 'Diff shows Shattering Strike (added feature)');
  assert(dialog.data.content.includes('Overhand Chop'), 'Diff shows Overhand Chop (additive feature)');

  dialog.data.buttons.back.callback();
  await previewPromise;
}

// Test 4: Preview dialog shows diff status icons (removed/added/unchanged)
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Test Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.content.includes('preview-removed'), 'Preview has removed status rows');
  assert(dialog.data.content.includes('preview-added'), 'Preview has added status rows');
  assert(dialog.data.content.includes('preview-unchanged'), 'Preview has unchanged status rows');
  assert(dialog.data.content.includes('fa-times'), 'Removed icon (fa-times) present');
  assert(dialog.data.content.includes('fa-plus'), 'Added icon (fa-plus) present');

  dialog.data.buttons.back.callback();
  await previewPromise;
}

// Test 5: Preview dialog resolves to 'apply' when Apply clicked
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Test Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  dialog.data.buttons.apply.callback();
  const result = await previewPromise;
  assert(result === 'apply', 'Preview resolves "apply" when Apply button clicked');
}

// Test 6: Preview dialog resolves to null when closed via X (close handler)
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Test Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  // Simulate closing the dialog via X button
  if (dialog.data.close) dialog.data.close();
  const result = await previewPromise;
  assert(result === null, 'Preview resolves null when dialog closed via X');
}

// --- Section 2: showConfirmation ---
console.log('\n--- Confirmation Dialog ---');

// Test 7: showConfirmation returns true when confirmed
{
  clearDialogTracker();

  const confirmPromise = UIManager.showConfirmation('Test Confirm', '<p>Are you sure?</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.title.includes('Test Confirm'), 'Confirmation dialog title includes provided title');
  assert(dialog.data.content.includes('Are you sure?'), 'Confirmation dialog shows content');
  assert(dialog.data.buttons.confirm !== undefined, 'Confirmation has Confirm button');
  assert(dialog.data.buttons.cancel !== undefined, 'Confirmation has Cancel button');

  dialog.data.buttons.confirm.callback();
  const result = await confirmPromise;
  assert(result === true, 'Confirmation returns true when confirmed');
}

// Test 8: showConfirmation returns false when cancelled
{
  clearDialogTracker();

  const confirmPromise = UIManager.showConfirmation('Cancel Test', '<p>Cancel this?</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];

  dialog.data.buttons.cancel.callback();
  const result = await confirmPromise;
  assert(result === false, 'Confirmation returns false when cancelled');
}

// Test 9: showConfirmation returns false when dialog closed via X
{
  clearDialogTracker();

  const confirmPromise = UIManager.showConfirmation('Close Test', '<p>Close me</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];

  if (dialog.data.close) dialog.data.close();
  const result = await confirmPromise;
  assert(result === false, 'Confirmation returns false when closed via X');
}

// --- Section 3: showPreviewConfirmFlow ---
console.log('\n--- Preview-Confirm Flow ---');

// Test 10: Full flow preview -> apply (click Apply on preview, then Confirm)
{
  clearDialogTracker();
  clearNotifications();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Flow Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Step 1: Preview dialog should open
  assert(dialogTracker.length >= 1, 'Preview dialog opened in flow');
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog.data.title.includes('Preview'), 'First dialog is preview');

  // Step 2: Click Apply on preview
  previewDialog.data.buttons.apply.callback();
  // Give time for the next dialog to open
  await new Promise(r => setTimeout(r, 10));

  // Step 3: Confirmation dialog should open
  assert(dialogTracker.length >= 2, 'Confirmation dialog opened after clicking Apply');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.title.includes('Apply Archetype'), 'Confirm dialog title includes "Apply Archetype"');
  assert(confirmDialog.data.content.includes('Two-Handed Fighter'), 'Confirm dialog mentions archetype name');
  assert(confirmDialog.data.content.includes('Fighter'), 'Confirm dialog mentions class name');
  assert(confirmDialog.data.content.includes('backup'), 'Confirm dialog mentions backup for safety');

  // Step 4: Confirm
  confirmDialog.data.buttons.confirm.callback();
  const result = await flowPromise;
  assert(result === 'applied', 'Flow returns "applied" after preview->apply->confirm');
}

// Test 11: Flow with Back button returns to preview
{
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Back Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview -> click Back
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.back.callback();

  const result = await flowPromise;
  assert(result === 'back-to-main', 'Flow returns "back-to-main" when Back clicked on preview');
}

// Test 12: Flow with Cancel on confirmation goes back to preview
{
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Cancel Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview -> Apply
  const previewDialog1 = dialogTracker[dialogTracker.length - 1];
  previewDialog1.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Confirm -> Cancel (goes back to preview)
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));

  // Should be back at preview - now close it via back to resolve
  const previewDialog2 = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog2.data.title.includes('Preview'), 'After cancel on confirm, preview dialog reopens');
  previewDialog2.data.buttons.back.callback();

  const result = await flowPromise;
  assert(result === 'back-to-main', 'Flow navigates: preview -> confirm(cancel) -> preview -> back');
}

// Test 13: Flow returns null when preview dialog is closed via X
{
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Close Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  // Close via X
  if (previewDialog.data.close) previewDialog.data.close();
  const result = await flowPromise;
  assert(result === null, 'Flow returns null when preview closed via X');
}

// --- Section 4: Full application integration ---
console.log('\n--- Full Application (Applicator.apply) ---');

// Test 14: Applicator.apply modifies classAssociations
{
  clearNotifications();
  clearChatMessages();
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const originalLength = fighter.system.links.classAssociations.length;
  const actor = createMockActor('Apply Hero', [fighter]);

  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const result = await Applicator.apply(actor, fighter, archetype, diff);

  assert(result === true, 'Applicator.apply returns true on success');
  assert(notifications.some(n => n.type === 'info' && n.msg.includes('Applied')),
    'Success notification shown after apply');
}

// Test 15: Applied archetype creates tracking flags
{
  clearNotifications();
  clearChatMessages();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Flag Hero', [fighter]);

  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  await Applicator.apply(actor, fighter, archetype, diff);

  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(Array.isArray(archetypes) && archetypes.includes('two-handed-fighter'),
    'Class item has archetype slug in flags');

  const appliedAt = fighter.getFlag('archetype-manager', 'appliedAt');
  assert(typeof appliedAt === 'string' && appliedAt.length > 0,
    'appliedAt timestamp is set');

  const backup = fighter.getFlag('archetype-manager', 'originalAssociations');
  assert(Array.isArray(backup) && backup.length === 4,
    'Original associations backed up (4 entries)');
}

// Test 16: Applied archetype updates actor flags
{
  clearNotifications();
  clearChatMessages();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Actor Flag Hero', [fighter]);

  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  await Applicator.apply(actor, fighter, archetype, diff);

  const actorArchetypes = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assert(actorArchetypes !== null && actorArchetypes.fighter !== undefined,
    'Actor flags have fighter key');
  assert(actorArchetypes.fighter.includes('two-handed-fighter'),
    'Actor flags contain archetype slug');
}

// Test 17: Applied archetype posts chat message
{
  clearNotifications();
  clearChatMessages();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Chat Hero', [fighter]);

  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  await Applicator.apply(actor, fighter, archetype, diff);

  assert(chatMessages.length > 0, 'Chat message created on apply');
  const msg = chatMessages[chatMessages.length - 1];
  assert(msg.content.includes('Two-Handed Fighter'), 'Chat message includes archetype name');
  assert(msg.content.includes('Chat Hero'), 'Chat message includes actor name');
}

// Test 18: classAssociations reflect changes after apply
{
  clearNotifications();
  clearChatMessages();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Reflect Hero', [fighter]);

  const originalLength = fighter.system.links.classAssociations.length;

  // Verify original state
  assert(fighter.system.links.classAssociations.some(a => a.resolvedName === 'Bravery'),
    'Before apply: Bravery exists in classAssociations');

  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  await Applicator.apply(actor, fighter, archetype, diff);

  // After apply, the replacement swaps the Bravery UUID entry for the Shattering Strike
  // _buildNewAssociations removes 'removed' entries, keeps 'unchanged', and adds 'added'/'modified'
  // using their matchedAssociation (which carries the original UUID).
  // For additive features (Overhand Chop) that have no matchedAssociation, nothing is added to associations.
  // Net result: unchanged entries + replacement entries using original UUIDs
  const afterAssociations = fighter.system.links.classAssociations;

  // Unchanged features should still be there
  assert(afterAssociations.some(a => a.resolvedName === 'Armor Training'),
    'After apply: Armor Training still in classAssociations');
  assert(afterAssociations.some(a => a.resolvedName === 'Weapon Training'),
    'After apply: Weapon Training still in classAssociations');
  assert(afterAssociations.some(a => a.resolvedName === 'Bonus Feat'),
    'After apply: Bonus Feat still in classAssociations');

  // After BUG-001 fix: the replacement entry uses the archetype feature's own UUID,
  // NOT the base feature UUID. The Bravery slot is replaced by the archetype's Shattering Strike UUID.
  assert(afterAssociations.some(a => a.uuid === 'Compendium.pf1e-archetypes.pf-arch-features.Item.shattering-strike'),
    'After apply: Bravery UUID slot reused for replacement feature');

  // Tracking flags confirm archetype was applied
  const archetypeSlugs = fighter.getFlag('archetype-manager', 'archetypes');
  assert(archetypeSlugs && archetypeSlugs.includes('two-handed-fighter'),
    'After apply: archetype tracking flag set');
}

// --- Section 5: DiffEngine verification ---
console.log('\n--- DiffEngine Diff Generation ---');

// Test 19: DiffEngine.generateDiff produces correct diff entries
{
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  assert(Array.isArray(diff) && diff.length > 0, 'Diff is a non-empty array');

  const removed = diff.filter(e => e.status === 'removed');
  const added = diff.filter(e => e.status === 'added');
  const unchanged = diff.filter(e => e.status === 'unchanged');

  assert(removed.length >= 1, 'At least 1 removed entry (Bravery)');
  assert(removed.some(r => r.name === 'Bravery'), 'Bravery is in removed entries');
  assert(added.length >= 1, 'At least 1 added entry');
  assert(added.some(a => a.name === 'Shattering Strike'), 'Shattering Strike is in added entries');
  assert(added.some(a => a.name === 'Overhand Chop'), 'Overhand Chop is in added entries');
  assert(unchanged.length >= 2, 'At least 2 unchanged entries');
}

// Test 20: Diff entries have correct structure
{
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const entry = diff[0];
  assert('status' in entry, 'Diff entry has status field');
  assert('level' in entry, 'Diff entry has level field');
  assert('name' in entry, 'Diff entry has name field');
}

// Test 21: Diff is sorted by level
{
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  let sorted = true;
  for (let i = 1; i < diff.length; i++) {
    if ((diff[i].level || 0) < (diff[i - 1].level || 0)) {
      sorted = false;
      break;
    }
  }
  assert(sorted, 'Diff entries are sorted by level');
}

// --- Section 6: Preview HTML content verification ---
console.log('\n--- Preview HTML Content ---');

// Test 22: _buildPreviewHTML includes table structure
{
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const html = UIManager._buildPreviewHTML(archetype, diff);

  assert(html.includes('archetype-preview-content'), 'Preview HTML has content wrapper');
  assert(html.includes('preview-diff-table'), 'Preview HTML has diff table');
  assert(html.includes('<thead>'), 'Preview HTML has table header');
  assert(html.includes('<tbody>'), 'Preview HTML has table body');
  assert(html.includes('Status'), 'Preview HTML has Status column header');
  assert(html.includes('Level'), 'Preview HTML has Level column header');
  assert(html.includes('Feature'), 'Preview HTML has Feature column header');
}

// Test 23: Preview HTML shows archetype name
{
  const archetype = buildTestArchetype();
  const diff = [];

  const html = UIManager._buildPreviewHTML(archetype, diff);
  assert(html.includes('Two-Handed Fighter'), 'Preview HTML includes archetype name');
}

// Test 24: Preview HTML shows editable level inputs for added/modified features
{
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const html = UIManager._buildPreviewHTML(archetype, diff);
  assert(html.includes('preview-level-input'), 'Preview has editable level input for added features');
}

// Test 25: Preview HTML includes info buttons for features with descriptions
{
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const html = UIManager._buildPreviewHTML(archetype, diff);
  assert(html.includes('info-btn'), 'Preview has info buttons for features');
  assert(html.includes('fa-info-circle'), 'Info buttons have info-circle icon');
}

// --- Section 7: Confirm dialog content ---
console.log('\n--- Confirm Dialog Content ---');

// Test 26: Confirmation dialog content is well-structured
{
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Confirm Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Click Apply on preview
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Check confirmation dialog
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.content.includes('<strong>Two-Handed Fighter</strong>'),
    'Confirm dialog shows archetype name in bold');
  assert(confirmDialog.data.content.includes('<strong>Fighter</strong>'),
    'Confirm dialog shows class name in bold');

  confirmDialog.data.buttons.confirm.callback();
  await flowPromise;
}

// --- Section 8: Duplicate application prevention ---
console.log('\n--- Duplicate Application Prevention ---');

// Test 27: Cannot apply same archetype twice
{
  clearNotifications();
  clearChatMessages();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Dupe Hero', [fighter]);

  // First apply
  const diff1 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const result1 = await Applicator.apply(actor, fighter, archetype, diff1);
  assert(result1 === true, 'First application succeeds');

  clearNotifications();

  // Second apply (duplicate)
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const result2 = await Applicator.apply(actor, fighter, archetype, diff2);
  assert(result2 === false, 'Duplicate application returns false');
  assert(notifications.some(n => n.type === 'warn' && n.msg.includes('already applied')),
    'Warning shown for duplicate application');
}

// --- Section 9: Error handling in flow ---
console.log('\n--- Error Handling ---');

// Test 28: Permission check blocks unauthorized users
{
  clearNotifications();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('NoAuth Hero', [fighter]);
  actor.isOwner = false;

  const origGM = game.user.isGM;
  game.user.isGM = false;

  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const result = await Applicator.apply(actor, fighter, archetype, diff);

  assert(result === false, 'Apply fails for non-owner non-GM');
  assert(notifications.some(n => n.type === 'error' && n.msg.includes('permission')),
    'Permission error notification shown');

  game.user.isGM = origGM;
}

// Test 29: Wrong class archetype blocked
{
  clearNotifications();

  const archetype = buildTestArchetype(); // Fighter archetype
  const wizard = createMockClassItem('Wizard', 5, 'wizard');
  wizard.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.arcane-bond', id: 'arcane-bond-id', level: 1, resolvedName: 'Arcane Bond' }
  ];
  const actor = createMockActor('Wrong Class Hero', [wizard]);

  const diff = DiffEngine.generateDiff(wizard.system.links.classAssociations, archetype);
  const result = await Applicator.apply(actor, wizard, archetype, diff);

  assert(result === false, 'Apply fails for wrong class');
  assert(notifications.some(n => n.type === 'error' && n.msg.includes('fighter') && n.msg.includes('Wizard')),
    'Error notification mentions class mismatch');
}

// --- Section 10: Preview dialog CSS classes ---
console.log('\n--- Preview Dialog Styling ---');

// Test 30: Preview dialog has correct CSS classes
{
  clearDialogTracker();
  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('CSS Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.options.classes && dialog.options.classes.includes('archetype-preview-dialog'),
    'Preview dialog has archetype-preview-dialog CSS class');
  assert(dialog.options.width >= 500, `Preview dialog width is adequate (${dialog.options.width})`);

  dialog.data.buttons.back.callback();
  await previewPromise;
}

// Test 31: Confirmation dialog has correct title prefix
{
  clearDialogTracker();

  const confirmPromise = UIManager.showConfirmation('Apply Archetype', '<p>Test</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.title.includes('PF1e Archetype Manager'), 'Confirmation title includes module name');
  assert(dialog.data.title.includes('Apply Archetype'), 'Confirmation title includes action name');

  dialog.data.buttons.cancel.callback();
  await confirmPromise;
}

// --- Section 11: Empty diff handling ---
console.log('\n--- Edge Cases ---');

// Test 32: Preview with empty diff shows "No changes" message
{
  clearDialogTracker();
  const archetype = { name: 'Empty Archetype', slug: 'empty', features: [] };
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Empty Hero', [fighter]);

  const html = UIManager._buildPreviewHTML(archetype, []);
  // When diff is empty, the rows variable is empty string, and the fallback should show
  // But since rows is empty string (truthy) the fallback may not trigger. Let's verify
  // The table should still be present even with empty diff
  assert(html.includes('preview-diff-table'), 'Preview HTML has table even with empty diff');
  assert(html.includes('Empty Archetype'), 'Preview shows archetype name for empty diff');
}

// Test 33: Preview shows "No changes detected" or empty table for zero features
{
  const html = UIManager._buildPreviewHTML({ name: 'No Features' }, []);
  // The rows template literal will be empty string if diff is empty array
  // Since '' is falsy, the fallback message should appear
  assert(html.includes('No changes detected'), 'Preview shows "No changes detected" for empty diff');
}

// --- Section 12: Multi-step navigation ---
console.log('\n--- Multi-step Navigation ---');

// Test 34: Complete round trip: preview -> apply -> confirm -> applied
{
  clearDialogTracker();
  clearNotifications();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('Roundtrip Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Step 1: Preview opens
  const preview = dialogTracker[dialogTracker.length - 1];
  assert(preview.data.title.includes('Preview'), 'Step 1: Preview dialog opened');

  // Step 2: Click Apply
  preview.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Step 3: Confirm opens
  const confirm = dialogTracker[dialogTracker.length - 1];
  assert(confirm.data.title.includes('Apply'), 'Step 3: Confirm dialog opened');

  // Step 4: Confirm application
  confirm.data.buttons.confirm.callback();
  const result = await flowPromise;

  assert(result === 'applied', 'Complete round trip returns "applied"');
}

// Test 35: Navigate back and forth: preview -> confirm(cancel) -> preview -> apply -> confirm -> applied
{
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('BackForth Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Preview opens -> click Apply
  let currentDialog = dialogTracker[dialogTracker.length - 1];
  currentDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Confirm opens -> click Cancel (back to preview)
  currentDialog = dialogTracker[dialogTracker.length - 1];
  currentDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));

  // Preview reopens -> click Apply again
  currentDialog = dialogTracker[dialogTracker.length - 1];
  assert(currentDialog.data.title.includes('Preview'), 'Preview reopened after cancel');
  currentDialog.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Confirm opens again -> confirm this time
  currentDialog = dialogTracker[dialogTracker.length - 1];
  currentDialog.data.buttons.confirm.callback();
  const result = await flowPromise;

  assert(result === 'applied', 'Back-and-forth flow completes successfully');
}

// --- Section 13: End-to-end integration ---
console.log('\n--- End-to-End Integration ---');

// Test 36: Full end-to-end: diff -> preview flow -> applicator -> verify state
{
  clearNotifications();
  clearChatMessages();
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('E2E Hero', [fighter]);

  // Step 1: Generate diff
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  assert(diff.length > 0, 'E2E: Diff generated');

  // Step 2: Start preview flow
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, archetype, diff);

  // Step 3: Preview -> Apply
  const preview = dialogTracker[dialogTracker.length - 1];
  preview.data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Step 4: Confirm
  const confirm = dialogTracker[dialogTracker.length - 1];
  confirm.data.buttons.confirm.callback();
  const flowResult = await flowPromise;

  assert(flowResult === 'applied', 'E2E: Flow returned "applied"');

  // Step 5: Actually apply
  const applyResult = await Applicator.apply(actor, fighter, archetype, diff);
  assert(applyResult === true, 'E2E: Applicator.apply succeeded');

  // Step 6: Verify success notification
  assert(notifications.some(n => n.type === 'info' && n.msg.includes('Applied')),
    'E2E: Success notification shown');

  // Step 7: Verify character state
  const archetypes = fighter.getFlag('archetype-manager', 'archetypes');
  assert(archetypes && archetypes.includes('two-handed-fighter'),
    'E2E: Character has archetype in flags');

  const actorFlags = actor.getFlag('archetype-manager', 'appliedArchetypes');
  assert(actorFlags && actorFlags.fighter && actorFlags.fighter.includes('two-handed-fighter'),
    'E2E: Actor flags reflect archetype');

  // Step 8: Verify chat message posted
  assert(chatMessages.length > 0, 'E2E: Chat message posted');
  assert(chatMessages.some(m => m.content.includes('Two-Handed Fighter')),
    'E2E: Chat message mentions archetype');
}

// Test 37: Preview dialog renders correctly for modification features
{
  clearDialogTracker();

  const archetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        type: 'modification',
        target: 'Weapon Training',
        level: 5,
        description: 'Weapon Guard modifies Weapon Training.',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.weapon-training',
          id: 'weapon-training-id',
          level: 5,
          resolvedName: 'Weapon Training'
        }
      }
    ]
  };

  const fighter = buildFighterClassItem();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const html = UIManager._buildPreviewHTML(archetype, diff);
  assert(html.includes('preview-modified'), 'Preview shows modified status for modification features');
  assert(html.includes('fa-pen'), 'Modified features have pen icon');
  assert(html.includes('Weapon Guard'), 'Modified feature name shown');
}

// Test 38: Preview dialog has correct archetype-manager CSS namespace
{
  clearDialogTracker();

  const archetype = buildTestArchetype();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('NS Hero', [fighter]);
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, archetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.options.classes.includes('archetype-manager'),
    'Preview dialog has archetype-manager CSS class');

  dialog.data.buttons.back.callback();
  await previewPromise;
}

// ========================
// Summary
// ========================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #69 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
