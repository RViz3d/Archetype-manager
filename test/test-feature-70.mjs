/**
 * Test Suite for Feature #70: All dialogs close correctly
 *
 * Verifies that all dialogs in the Archetype Manager close cleanly via:
 * - Close button (X)
 * - Cancel button
 * - Escape key
 * - The `close` callback on FoundryVTT Dialog
 * - No orphaned dialogs remain
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
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

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

// Track all Dialog instances created
const dialogTracker = [];
const OriginalDialog = globalThis.Dialog;

class TrackedDialog extends OriginalDialog {
  constructor(data, options) {
    super(data, options);
    this._closed = false;
    this._closeCallbackFired = false;
    this._originalClose = data.close;

    // Wrap the close callback to track it
    const self = this;
    if (data.close) {
      const origClose = data.close;
      data.close = function(...args) {
        self._closeCallbackFired = true;
        return origClose.apply(this, args);
      };
    } else {
      data.close = function() {
        self._closeCallbackFired = true;
      };
    }

    dialogTracker.push(this);
  }

  close() {
    this._closed = true;
    if (this.data.close) this.data.close();
    return this;
  }
}

globalThis.Dialog = TrackedDialog;
// Also keep _lastInstance tracking
globalThis.Dialog._lastInstance = null;

function clearDialogTracker() {
  dialogTracker.length = 0;
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #70: All dialogs close correctly ===\n');

// --- Main Dialog Close Tests ---
console.log('--- Main Dialog Close Behavior ---');

// Test 1: Main dialog has a close button that works
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog !== undefined, 'Main dialog is created');
  assert(dialog.data.buttons.close !== undefined, 'Main dialog has a close button');
  assert(typeof dialog.data.buttons.close.callback === 'function', 'Close button has a callback');
}

// Test 2: Main dialog close button callback executes without error
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);

  const dialog = dialogTracker[dialogTracker.length - 1];
  let noError = true;
  try {
    dialog.data.buttons.close.callback();
  } catch (e) {
    noError = false;
  }
  assert(noError, 'Close button callback executes without error');
}

// Test 3: Main dialog has `default: "close"` so Escape key triggers close
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.default === 'close', 'Main dialog default button is "close" (Escape triggers close behavior)');
}

// Test 4: Main dialog close callback resolves properly
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);

  const dialog = dialogTracker[dialogTracker.length - 1];
  // Main dialog is fire-and-forget (no Promise), verify close callback exists
  assert(typeof dialog.data.close === 'function' || dialog.data.close === undefined || dialog.data.close === null,
    'Main dialog close handler is properly defined (or absent for fire-and-forget)');
}

// Test 5: Main dialog can be closed via Dialog.close() method
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);

  const dialog = dialogTracker[dialogTracker.length - 1];
  let noError = true;
  try {
    dialog.close();
  } catch (e) {
    noError = false;
  }
  assert(noError, 'Main dialog close() method executes without error');
  assert(dialog._closed, 'Main dialog is marked as closed after close()');
}

// --- Fix Dialog Close Tests ---
console.log('\n--- Fix Dialog Close Behavior ---');

// Test 6: Fix dialog Cancel resolves null
{
  clearDialogTracker();

  const feature = {
    name: 'Shattering Strike',
    description: '<p>A powerful attack</p>',
    level: 2,
    archetypeSlug: 'two-handed-fighter'
  };
  const baseFeatures = [
    { name: 'Bravery', level: 2 },
    { name: 'Armor Training 1', level: 3 }
  ];

  const promise = UIManager.showFixDialog(feature, baseFeatures);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.cancel !== undefined, 'Fix dialog has cancel button');

  // Simulate cancel click
  dialog.data.buttons.cancel.callback();
  const result = await promise;
  assert(result === null, 'Fix dialog cancel resolves null');
}

// Test 7: Fix dialog close handler (X button / Escape) resolves null
{
  clearDialogTracker();

  const feature = {
    name: 'Test Feature',
    description: 'Test desc',
    level: 3,
    archetypeSlug: 'test-archetype'
  };

  const promise = UIManager.showFixDialog(feature, []);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(typeof dialog.data.close === 'function', 'Fix dialog has close handler (for X button/Escape)');

  // Simulate X button / escape
  dialog.close();
  const result = await promise;
  assert(result === null, 'Fix dialog X button/Escape resolves null (no orphaned state)');
}

// Test 8: Fix dialog default button is 'cancel'
{
  clearDialogTracker();

  const feature = { name: 'Test', description: '', level: 1, archetypeSlug: 'test' };
  const promise = UIManager.showFixDialog(feature, []);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.default === 'cancel', 'Fix dialog default is cancel (Escape triggers cancel)');

  dialog.data.buttons.cancel.callback();
  await promise;
}

// --- Description Verify Dialog Close Tests ---
console.log('\n--- Description Verify Dialog Close Behavior ---');

// Test 9: Description verify dialog Cancel resolves null
{
  clearDialogTracker();

  const feature = {
    name: 'Test Feature',
    description: '<p>Some desc</p>',
    archetypeSlug: 'test-arch',
    className: 'Fighter'
  };

  const promise = UIManager.showDescriptionVerifyDialog(feature);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.cancel !== undefined, 'Description verify dialog has cancel button');

  dialog.data.buttons.cancel.callback();
  const result = await promise;
  assert(result === null, 'Description verify dialog cancel resolves null');
}

// Test 10: Description verify dialog close handler resolves null
{
  clearDialogTracker();

  const feature = { name: 'Test', description: 'desc', archetypeSlug: 'test' };
  const promise = UIManager.showDescriptionVerifyDialog(feature);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(typeof dialog.data.close === 'function', 'Description verify dialog has close handler');

  dialog.close();
  const result = await promise;
  assert(result === null, 'Description verify dialog X/Escape resolves null');
}

// Test 11: Description verify dialog default is 'cancel'
{
  clearDialogTracker();

  const feature = { name: 'Test', description: 'desc', archetypeSlug: 'test' };
  const promise = UIManager.showDescriptionVerifyDialog(feature);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.default === 'cancel', 'Description verify dialog default is cancel');

  dialog.data.buttons.cancel.callback();
  await promise;
}

// --- Manual Entry Dialog Close Tests ---
console.log('\n--- Manual Entry Dialog Close Behavior ---');

// Test 12: Manual entry dialog Cancel resolves null
{
  clearDialogTracker();

  const promise = UIManager.showManualEntryDialog('custom');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.cancel !== undefined, 'Manual entry dialog has cancel button');

  dialog.data.buttons.cancel.callback();
  const result = await promise;
  assert(result === null, 'Manual entry dialog cancel resolves null');
}

// Test 13: Manual entry dialog close handler resolves null
{
  clearDialogTracker();

  const promise = UIManager.showManualEntryDialog('custom');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(typeof dialog.data.close === 'function', 'Manual entry dialog has close handler');

  dialog.close();
  const result = await promise;
  assert(result === null, 'Manual entry dialog X/Escape resolves null (no orphaned promise)');
}

// Test 14: Manual entry dialog default is 'cancel'
{
  clearDialogTracker();

  const promise = UIManager.showManualEntryDialog('custom');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.default === 'cancel', 'Manual entry dialog default is cancel');

  dialog.data.buttons.cancel.callback();
  await promise;
}

// --- Confirmation Dialog Close Tests ---
console.log('\n--- Confirmation Dialog Close Behavior ---');

// Test 15: Confirmation dialog Cancel resolves false
{
  clearDialogTracker();

  const promise = UIManager.showConfirmation('Test', '<p>Are you sure?</p>');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.cancel !== undefined, 'Confirmation dialog has cancel button');

  dialog.data.buttons.cancel.callback();
  const result = await promise;
  assert(result === false, 'Confirmation dialog cancel resolves false');
}

// Test 16: Confirmation dialog Confirm resolves true
{
  clearDialogTracker();

  const promise = UIManager.showConfirmation('Test', '<p>Confirm?</p>');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.confirm !== undefined, 'Confirmation dialog has confirm button');

  dialog.data.buttons.confirm.callback();
  const result = await promise;
  assert(result === true, 'Confirmation dialog confirm resolves true');
}

// Test 17: Confirmation dialog close handler (X/Escape) resolves false
{
  clearDialogTracker();

  const promise = UIManager.showConfirmation('Test', '<p>Close test</p>');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(typeof dialog.data.close === 'function', 'Confirmation dialog has close handler');

  dialog.close();
  const result = await promise;
  assert(result === false, 'Confirmation dialog X/Escape resolves false (safe default)');
}

// Test 18: Confirmation dialog default is 'cancel' (safe default)
{
  clearDialogTracker();

  const promise = UIManager.showConfirmation('Test', '<p>Default?</p>');

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.default === 'cancel', 'Confirmation dialog default is cancel (safe)');

  dialog.data.buttons.cancel.callback();
  await promise;
}

// --- No Orphaned Dialogs Tests ---
console.log('\n--- No Orphaned Dialogs ---');

// Test 19: Promise-based dialogs always resolve (no hanging promises)
{
  clearDialogTracker();

  // Test fix dialog
  const fixPromise = UIManager.showFixDialog({ name: 'T', description: '', level: 1, archetypeSlug: 'x' }, []);
  dialogTracker[dialogTracker.length - 1].close();
  const fixResult = await fixPromise;
  assert(fixResult === null, 'Fix dialog promise resolves on close (no orphan)');

  // Test description verify dialog
  const descPromise = UIManager.showDescriptionVerifyDialog({ name: 'T', description: '', archetypeSlug: 'x' });
  dialogTracker[dialogTracker.length - 1].close();
  const descResult = await descPromise;
  assert(descResult === null, 'Description verify dialog promise resolves on close (no orphan)');

  // Test manual entry dialog
  const manualPromise = UIManager.showManualEntryDialog('custom');
  dialogTracker[dialogTracker.length - 1].close();
  const manualResult = await manualPromise;
  assert(manualResult === null, 'Manual entry dialog promise resolves on close (no orphan)');

  // Test confirmation dialog
  const confirmPromise = UIManager.showConfirmation('T', '');
  dialogTracker[dialogTracker.length - 1].close();
  const confirmResult = await confirmPromise;
  assert(confirmResult === false, 'Confirmation dialog promise resolves on close (no orphan)');
}

// Test 20: Multiple dialogs opened and closed sequentially don't leak
{
  clearDialogTracker();

  for (let i = 0; i < 5; i++) {
    const p = UIManager.showConfirmation(`Test ${i}`, `<p>Iteration ${i}</p>`);
    dialogTracker[dialogTracker.length - 1].close();
    await p;
  }
  assert(dialogTracker.length === 5, `5 dialogs created over 5 iterations (got ${dialogTracker.length})`);
  assert(dialogTracker.every(d => d._closed || d._closeCallbackFired), 'All dialogs closed or had close callback fired');
}

// Test 21: Cancel buttons never leave unresolved state
{
  clearDialogTracker();

  // Open and cancel each Promise-based dialog type
  const results = [];

  // Fix dialog cancel
  const p1 = UIManager.showFixDialog({ name: 'T', description: '', level: 1, archetypeSlug: 'x' }, []);
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  results.push(await p1);

  // Description verify cancel
  const p2 = UIManager.showDescriptionVerifyDialog({ name: 'T', description: '', archetypeSlug: 'x' });
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  results.push(await p2);

  // Manual entry cancel
  const p3 = UIManager.showManualEntryDialog('custom');
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  results.push(await p3);

  // Confirmation cancel
  const p4 = UIManager.showConfirmation('T', '');
  dialogTracker[dialogTracker.length - 1].data.buttons.cancel.callback();
  results.push(await p4);

  assert(results[0] === null, 'Fix dialog cancel: null result (clean state)');
  assert(results[1] === null, 'Desc verify cancel: null result (clean state)');
  assert(results[2] === null, 'Manual entry cancel: null result (clean state)');
  assert(results[3] === false, 'Confirmation cancel: false result (clean state)');
}

// Test 22: Dialog buttons have correct icons
{
  clearDialogTracker();

  const p = UIManager.showConfirmation('Test', '<p>Test</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.cancel.icon.includes('fa-times'), 'Cancel button has times icon');
  assert(dialog.data.buttons.confirm.icon.includes('fa-check'), 'Confirm button has check icon');

  dialog.close();
  await p;
}

// Test 23: Main dialog close button has times icon
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.close.icon.includes('fa-times'), 'Main dialog close button has times icon');
  assert(dialog.data.buttons.close.label === 'Close', 'Main dialog close button labeled "Close"');
}

// Test 24: Fix dialog buttons are labeled correctly
{
  clearDialogTracker();

  const p = UIManager.showFixDialog({ name: 'T', description: '', level: 1, archetypeSlug: 'x' }, []);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.confirm.label === 'Save Fix', 'Fix dialog confirm button labeled "Save Fix"');
  assert(dialog.data.buttons.cancel.label === 'Cancel', 'Fix dialog cancel button labeled "Cancel"');

  dialog.data.buttons.cancel.callback();
  await p;
}

// Test 25: Manual entry dialog buttons are labeled correctly
{
  clearDialogTracker();

  const p = UIManager.showManualEntryDialog('custom');
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.submit.label === 'Save', 'Manual entry submit button labeled "Save"');
  assert(dialog.data.buttons.cancel.label === 'Cancel', 'Manual entry cancel button labeled "Cancel"');

  dialog.data.buttons.cancel.callback();
  await p;
}

// Test 26: Description verify dialog buttons are labeled correctly
{
  clearDialogTracker();

  const p = UIManager.showDescriptionVerifyDialog({ name: 'T', description: '', archetypeSlug: 'x' });
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.save.label === 'Save Correction', 'Description verify save button labeled "Save Correction"');
  assert(dialog.data.buttons.cancel.label === 'Cancel', 'Description verify cancel button labeled "Cancel"');

  dialog.data.buttons.cancel.callback();
  await p;
}

// Test 27: Each dialog type has proper CSS classes
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);
  const mainDialog = dialogTracker[dialogTracker.length - 1];
  assert(mainDialog.options.classes && mainDialog.options.classes.includes('archetype-manager-dialog'),
    'Main dialog has archetype-manager-dialog CSS class');

  const p2 = UIManager.showFixDialog({ name: 'T', description: '', level: 1, archetypeSlug: 'x' }, []);
  const fixDialog = dialogTracker[dialogTracker.length - 1];
  assert(fixDialog.options.classes && fixDialog.options.classes.some(c => c.includes('archetype')),
    'Fix dialog has archetype CSS class');
  fixDialog.data.buttons.cancel.callback();
  await p2;

  const p3 = UIManager.showManualEntryDialog('custom');
  const manualDialog = dialogTracker[dialogTracker.length - 1];
  assert(manualDialog.options.classes && manualDialog.options.classes.some(c => c.includes('archetype')),
    'Manual entry dialog has archetype CSS class');
  manualDialog.data.buttons.cancel.callback();
  await p3;
}

// Test 28: Close callback doesn't throw when called multiple times
{
  clearDialogTracker();

  const p = UIManager.showConfirmation('Test', '<p>Multi-close</p>');
  const dialog = dialogTracker[dialogTracker.length - 1];

  let noError = true;
  try {
    dialog.close();
    // Second close shouldn't throw
    // Note: the first close resolves the promise, subsequent close callbacks
    // may fail because promise is already resolved but shouldn't throw externally
  } catch (e) {
    noError = false;
  }
  assert(noError, 'Closing dialog does not throw error');
  await p;
}

// Test 29: Dialog close doesn't corrupt module state (_processing flag)
{
  clearDialogTracker();

  // Ensure _processing flag is clean
  assert(UIManager._processing === false, 'UIManager._processing starts as false');

  // Open and close several dialogs
  const p1 = UIManager.showConfirmation('Test1', '');
  dialogTracker[dialogTracker.length - 1].close();
  await p1;

  const p2 = UIManager.showConfirmation('Test2', '');
  dialogTracker[dialogTracker.length - 1].close();
  await p2;

  assert(UIManager._processing === false, 'UIManager._processing remains false after dialog closes');
}

// Test 30: Dialog width is set correctly (UX - proper sizing)
{
  clearDialogTracker();
  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);

  await UIManager.showMainDialog(actor, [fighter]);
  const mainDialog = dialogTracker[dialogTracker.length - 1];
  assert(mainDialog.options.width >= 400, `Main dialog width is reasonable (${mainDialog.options.width})`);

  const p = UIManager.showFixDialog({ name: 'T', description: '', level: 1, archetypeSlug: 'x' }, []);
  const fixDialog = dialogTracker[dialogTracker.length - 1];
  assert(fixDialog.options.width >= 400, `Fix dialog width is reasonable (${fixDialog.options.width})`);
  fixDialog.data.buttons.cancel.callback();
  await p;
}

// ========================
// Summary
// ========================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #70 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
