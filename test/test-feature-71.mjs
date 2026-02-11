/**
 * Test Suite for Feature #71: Back navigation works between dialog steps
 *
 * Verifies that users can navigate back between dialog steps:
 * - Preview → Back → returns to main
 * - Confirm → No → returns to preview
 * - No state corruption during navigation
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

// Setup mock environment
const { hooks, settings } = setupMockEnvironment();

// Import module to register settings
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import modules under test
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');

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

// Track all Dialog instances
const dialogTracker = [];
const OriginalDialog = globalThis.Dialog;

class TrackedDialog extends OriginalDialog {
  constructor(data, options) {
    super(data, options);
    this._closed = false;
    dialogTracker.push(this);
  }

  close() {
    this._closed = true;
    if (this.data.close) this.data.close();
    return this;
  }
}

globalThis.Dialog = TrackedDialog;

function clearDialogTracker() {
  dialogTracker.length = 0;
}

// Helper: create test archetype and diff
function createTestArchetypeAndDiff() {
  const parsedArchetype = {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      {
        name: 'Shattering Strike',
        type: 'replacement',
        level: 2,
        target: 'Bravery',
        matchedAssociation: { uuid: 'uuid-bravery', level: 2 }
      },
      {
        name: 'Overhand Chop',
        type: 'replacement',
        level: 3,
        target: 'Armor Training 1',
        matchedAssociation: { uuid: 'uuid-at1', level: 3 }
      },
      {
        name: 'Weapon Training',
        type: 'modification',
        level: 5,
        target: 'Weapon Training',
        matchedAssociation: { uuid: 'uuid-wt', level: 5 }
      }
    ]
  };

  const diff = [
    { status: 'unchanged', level: 1, name: 'Bonus Feat' },
    { status: 'removed', level: 2, name: 'Bravery', original: { uuid: 'uuid-bravery', level: 2 } },
    { status: 'added', level: 2, name: 'Shattering Strike', archetypeFeature: parsedArchetype.features[0] },
    { status: 'removed', level: 3, name: 'Armor Training 1', original: { uuid: 'uuid-at1', level: 3 } },
    { status: 'added', level: 3, name: 'Overhand Chop', archetypeFeature: parsedArchetype.features[1] },
    { status: 'modified', level: 5, name: 'Weapon Training', archetypeFeature: parsedArchetype.features[2] }
  ];

  return { parsedArchetype, diff };
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #71: Back navigation works between dialog steps ===\n');

// --- Preview Dialog Navigation ---
console.log('--- Preview Dialog Navigation ---');

// Test 1: Preview dialog has Back and Apply buttons
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.back !== undefined, 'Preview dialog has Back button');
  assert(dialog.data.buttons.apply !== undefined, 'Preview dialog has Apply button');

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 2: Preview dialog Back button returns 'back'
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  dialog.data.buttons.back.callback();
  const result = await promise;
  assert(result === 'back', 'Preview Back button resolves "back"');
}

// Test 3: Preview dialog Apply button returns 'apply'
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  dialog.data.buttons.apply.callback();
  const result = await promise;
  assert(result === 'apply', 'Preview Apply button resolves "apply"');
}

// Test 4: Preview dialog close (X/Escape) returns null
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  dialog.close();
  const result = await promise;
  assert(result === null, 'Preview X/Escape resolves null');
}

// Test 5: Preview dialog default button is 'back' (safe default for Escape)
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.default === 'back', 'Preview default is "back" (Escape goes back)');

  dialog.data.buttons.back.callback();
  await promise;
}

// --- Preview Dialog Content ---
console.log('\n--- Preview Dialog Content ---');

// Test 6: Preview dialog shows diff entries with correct status icons
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  // Check the content has the diff entries
  const content = dialog.data.content;
  assert(content.includes('Shattering Strike'), 'Preview content shows added feature name');
  assert(content.includes('Bravery'), 'Preview content shows removed feature name');
  assert(content.includes('Weapon Training'), 'Preview content shows modified feature name');
  assert(content.includes('Bonus Feat'), 'Preview content shows unchanged feature name');
  assert(content.includes('fa-check'), 'Preview content has check icon for unchanged');
  assert(content.includes('fa-times'), 'Preview content has times icon for removed');
  assert(content.includes('fa-plus'), 'Preview content has plus icon for added');
  assert(content.includes('fa-pen'), 'Preview content has pen icon for modified');

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 7: Preview dialog has archetype name in title
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.title.includes('Two-Handed Fighter'), 'Preview title includes archetype name');

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 8: Preview dialog has proper CSS class
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.options.classes && dialog.options.classes.includes('archetype-preview-dialog'),
    'Preview dialog has archetype-preview-dialog CSS class');

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 9: Added/modified features have editable level inputs
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const content = dialog.data.content;
  assert(content.includes('preview-level-input'), 'Preview has editable level inputs for added/modified features');

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 10: Unchanged features show level as plain text (not editable)
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  // The unchanged row should have <span> for level, not <input>
  // Check the first row (Bonus Feat is unchanged at level 1)
  assert(html.includes('preview-unchanged'), 'Preview has unchanged row class');

  // The Added row should have input
  assert(html.includes('preview-added'), 'Preview has added row class');
}

// Test 11: Preview handles empty diff
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const parsedArchetype = { name: 'Empty Archetype', slug: 'empty', features: [] };

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, []);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.content.includes('No changes detected'), 'Empty diff shows "No changes detected"');

  dialog.data.buttons.back.callback();
  await promise;
}

// --- Preview-Confirm Flow (showPreviewConfirmFlow) ---
console.log('\n--- Preview-Confirm Flow Navigation ---');

// Test 12: showPreviewConfirmFlow - Back in preview returns 'back-to-main'
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // First dialog should be preview
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog.data.title.includes('Preview'), 'Flow starts with preview dialog');

  // Click back
  previewDialog.data.buttons.back.callback();
  const result = await flowPromise;
  assert(result === 'back-to-main', 'Back in preview returns "back-to-main"');
}

// Test 13: showPreviewConfirmFlow - Apply in preview → opens confirm dialog
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // Preview dialog
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.apply.callback();

  // Wait a tick for confirm dialog to appear
  await new Promise(r => setTimeout(r, 10));

  // Confirm dialog should now be open
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog !== previewDialog, 'Confirm dialog is a new dialog');
  assert(confirmDialog.data.title.includes('Apply'), 'Confirm dialog title includes "Apply"');

  // Confirm it
  confirmDialog.data.buttons.confirm.callback();
  const result = await flowPromise;
  assert(result === 'applied', 'Apply + Confirm returns "applied"');
}

// Test 14: showPreviewConfirmFlow - Apply → Confirm Cancel → goes back to preview
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // Step 1: Preview dialog - click Apply
  const previewDialog1 = dialogTracker[dialogTracker.length - 1];
  previewDialog1.data.buttons.apply.callback();

  // Wait for confirm dialog
  await new Promise(r => setTimeout(r, 10));

  // Step 2: Confirm dialog - click Cancel (No)
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog.data.title.includes('Apply'), 'Confirm dialog opened after Apply');
  confirmDialog.data.buttons.cancel.callback();

  // Wait for preview to reopen
  await new Promise(r => setTimeout(r, 10));

  // Step 3: Should be back at preview
  const previewDialog2 = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog2.data.title.includes('Preview'), 'Returned to preview dialog after cancel');
  assert(previewDialog2 !== previewDialog1, 'A new preview dialog instance is created on return');

  // Now click back to go to main
  previewDialog2.data.buttons.back.callback();
  const result = await flowPromise;
  assert(result === 'back-to-main', 'After going back to preview and clicking Back, returns to main');
}

// Test 15: showPreviewConfirmFlow - Escape in preview returns null
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.close();

  const result = await flowPromise;
  assert(result === null, 'Escape in preview returns null');
}

// Test 16: showPreviewConfirmFlow - Escape in confirm goes back to preview
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // Apply in preview
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Close confirm dialog (simulates Escape)
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  confirmDialog.close();
  await new Promise(r => setTimeout(r, 10));

  // Should be back at preview
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog.data.title.includes('Preview'), 'After Escape in confirm, back at preview');

  previewDialog.data.buttons.back.callback();
  const result = await flowPromise;
  assert(result === 'back-to-main', 'Can navigate back from re-shown preview');
}

// --- State Integrity ---
console.log('\n--- State Integrity During Navigation ---');

// Test 17: Diff array is not corrupted during back navigation
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const originalDiffLength = diff.length;
  const originalFirstName = diff[0].name;

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // Preview → Apply
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  // Confirm → Cancel (back to preview)
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));

  // Back to preview → verify diff not corrupted
  assert(diff.length === originalDiffLength, `Diff length preserved (${diff.length} === ${originalDiffLength})`);
  assert(diff[0].name === originalFirstName, `Diff first entry name preserved (${diff[0].name})`);

  // Go back to main
  dialogTracker[dialogTracker.length - 1].data.buttons.back.callback();
  await flowPromise;
}

// Test 18: Parsed archetype data not corrupted during navigation
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const originalName = parsedArchetype.name;
  const originalFeatureCount = parsedArchetype.features.length;

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // Navigate: preview → apply → confirm cancel → preview → back
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));

  assert(parsedArchetype.name === originalName, 'Archetype name preserved after navigation');
  assert(parsedArchetype.features.length === originalFeatureCount, 'Feature count preserved after navigation');

  dialogTracker[dialogTracker.length - 1].data.buttons.back.callback();
  await flowPromise;
}

// Test 19: Multiple round-trips (preview → confirm → back → preview → confirm → back → preview → apply → confirm)
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  // Round 1: preview → apply → confirm cancel
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));

  // Round 2: preview → apply → confirm cancel
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));

  // Round 3: preview → apply → confirm YES
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));
  dialogTracker[dialogTracker.length - 1].data.buttons.confirm.callback();

  const result = await flowPromise;
  assert(result === 'applied', 'Multiple round-trips eventually applies correctly');
}

// Test 20: No state corruption when rapidly opening/closing
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  // Quick open and close
  const p1 = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  dialogTracker[dialogTracker.length - 1].close();
  const r1 = await p1;

  const p2 = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  dialogTracker[dialogTracker.length - 1].data.buttons.back.callback();
  const r2 = await p2;

  const p3 = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  const r3 = await p3;

  assert(r1 === null, 'Rapid close: null');
  assert(r2 === 'back', 'Rapid back: "back"');
  assert(r3 === 'apply', 'Rapid apply: "apply"');
  assert(UIManager._processing === false, 'Processing flag clean after rapid operations');
}

// --- Button Style Verification ---
console.log('\n--- Button Styling ---');

// Test 21: Preview dialog back button has arrow-left icon
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.back.icon.includes('fa-arrow-left'), 'Back button has arrow-left icon');
  assert(dialog.data.buttons.back.label === 'Back', 'Back button labeled "Back"');
  assert(dialog.data.buttons.apply.icon.includes('fa-check'), 'Apply button has check icon');
  assert(dialog.data.buttons.apply.label === 'Apply', 'Apply button labeled "Apply"');

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 22: Preview dialog width is set correctly
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.options.width >= 500, `Preview dialog width is reasonable (${dialog.options.width})`);

  dialog.data.buttons.back.callback();
  await promise;
}

// Test 23: Confirm dialog in flow shows archetype name and class name
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  const flowPromise = UIManager.showPreviewConfirmFlow(actor, fighter, parsedArchetype, diff);

  dialogTracker[dialogTracker.length - 1].data.buttons.apply.callback();
  await new Promise(r => setTimeout(r, 10));

  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  const content = confirmDialog.data.content;
  assert(content.includes('Two-Handed Fighter'), 'Confirm dialog shows archetype name');
  assert(content.includes('Fighter'), 'Confirm dialog shows class name');

  confirmDialog.data.buttons.cancel.callback();
  await new Promise(r => setTimeout(r, 10));
  dialogTracker[dialogTracker.length - 1].data.buttons.back.callback();
  await flowPromise;
}

// Test 24: Color coding in preview - removed entries in red
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  assert(html.includes('#c00'), 'Preview uses red (#c00) for removed entries');
  assert(html.includes('#08f'), 'Preview uses blue (#08f) for added entries');
  assert(html.includes('#f80'), 'Preview uses orange (#f80) for modified entries');
  assert(html.includes('#080'), 'Preview uses green (#080) for unchanged entries');
}

// Test 25: Preview dialog handles null diff gracefully
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);
  const parsedArchetype = { name: 'Test', slug: 'test', features: [] };

  let noError = true;
  try {
    const promise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, null);
    const dialog = dialogTracker[dialogTracker.length - 1];
    assert(dialog.data.content.includes('No changes detected'), 'Null diff shows "No changes detected"');
    dialog.data.buttons.back.callback();
    await promise;
  } catch (e) {
    noError = false;
  }
  assert(noError, 'Preview dialog handles null diff without error');
}

// ========================
// Summary
// ========================
console.log(`\n${'='.repeat(55)}`);
console.log(`Feature #71 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(55)}\n`);

if (failed > 0) {
  process.exit(1);
}
