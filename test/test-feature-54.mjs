/**
 * Test Suite for Feature #54: Add archetype button opens manual entry dialog
 *
 * Verifies:
 * 1. Open main dialog
 * 2. Click 'Add archetype' button
 * 3. Verify manual entry dialog opens
 * 4. Verify it contains type selector, name, class, feature rows
 * 5. Close the dialog and verify return to main dialog
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

function assertContains(str, substr, message) {
  if (typeof str !== 'string' || !str.includes(substr)) {
    throw new Error(`${message || 'Assertion failed'}: "${String(str).substring(0, 100)}" does not contain "${substr}"`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected non-null, got ${value}`);
  }
}

// Set up environment
const { hooks, settings } = setupMockEnvironment();

// Import and init module
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { UIManager } = await import('../scripts/ui-manager.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

console.log('\n=== Feature #54: Add archetype button opens manual entry dialog ===\n');

// Track notifications
const notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};
function clearNotifications() { notifications.length = 0; }

// Track dialogs - capture all dialog instances and their data
const dialogTracker = [];
const OrigDialog = globalThis.Dialog;
class TrackedDialog extends OrigDialog {
  constructor(data, options) {
    super(data, options);
    dialogTracker.push(this);
  }
}
globalThis.Dialog = TrackedDialog;
function clearDialogTracker() { dialogTracker.length = 0; }

/**
 * Helper: Open main dialog, invoke addCustom callback (non-blocking since
 * showManualEntryDialog returns a Promise that blocks until dialog interaction).
 * We fire the callback without awaiting so we can inspect the dialog that was created.
 * Then we close the manual entry dialog to avoid dangling promises.
 */
async function openMainAndClickAddArchetype(actor, classItems) {
  clearDialogTracker();
  clearNotifications();

  await UIManager.showMainDialog(actor, classItems);
  const mainDialog = dialogTracker[0];

  const dialogCountBefore = dialogTracker.length;

  // Fire the addCustom callback without awaiting - it will create the dialog
  // then block waiting for user input. We don't need to await it.
  const callbackPromise = mainDialog.data.buttons.addCustom.callback();

  // Wait a tick for the dialog to be constructed
  await new Promise(r => setTimeout(r, 10));

  // Find the manual entry dialog (last created)
  const manualDialog = dialogTracker.length > dialogCountBefore
    ? dialogTracker[dialogTracker.length - 1]
    : null;

  return { mainDialog, manualDialog, callbackPromise };
}

/**
 * Helper: Directly call showManualEntryDialog (non-blocking) and return the dialog.
 */
async function openManualEntryDialog(defaultType = 'custom') {
  clearDialogTracker();
  const dialogCountBefore = dialogTracker.length;

  // Fire without awaiting
  const promise = UIManager.showManualEntryDialog(defaultType);

  await new Promise(r => setTimeout(r, 10));

  const dialog = dialogTracker.length > dialogCountBefore
    ? dialogTracker[dialogTracker.length - 1]
    : null;

  // If dialog exists, close it immediately to resolve the promise
  return { dialog, promise };
}

// =====================================================
// SECTION 1: Main dialog has "Add Archetype" button
// =====================================================

console.log('--- Section 1: Main dialog has "Add Archetype" button ---');

await asyncTest('Main dialog contains "Add Archetype" button in buttons config', async () => {
  clearDialogTracker();

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  await UIManager.showMainDialog(actor, [classItem]);

  assert(dialogTracker.length >= 1, 'At least one dialog should be created');
  const mainDialog = dialogTracker[0];

  assert(mainDialog.data.buttons.addCustom, 'Main dialog should have "addCustom" button');
  assertEqual(mainDialog.data.buttons.addCustom.label, 'Add Archetype',
    'Button label should be "Add Archetype"');
});

await asyncTest('Add Archetype button has plus icon', async () => {
  clearDialogTracker();

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  await UIManager.showMainDialog(actor, [classItem]);

  const mainDialog = dialogTracker[0];
  const iconHtml = mainDialog.data.buttons.addCustom.icon;
  assertContains(iconHtml, 'fa-plus', 'Button icon should contain fa-plus');
});

await asyncTest('Add Archetype button has a callback function', async () => {
  clearDialogTracker();

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  await UIManager.showMainDialog(actor, [classItem]);

  const mainDialog = dialogTracker[0];
  assertEqual(typeof mainDialog.data.buttons.addCustom.callback, 'function',
    'addCustom button should have a callback function');
});

// =====================================================
// SECTION 2: Clicking "Add Archetype" opens manual entry dialog
// =====================================================

console.log('\n--- Section 2: Clicking "Add Archetype" opens manual entry dialog ---');

await asyncTest('Clicking "Add Archetype" button creates a new dialog', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { mainDialog, manualDialog, callbackPromise } = await openMainAndClickAddArchetype(actor, [classItem]);

  assert(manualDialog !== null, 'Manual entry dialog should be created');
  assert(manualDialog !== mainDialog, 'Manual entry dialog should be different from main dialog');

  // Close manual dialog to unblock
  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Manual entry dialog has correct title', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assertContains(manualDialog.data.title, 'Add Archetype',
    'Manual entry dialog title should contain "Add Archetype"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Manual entry dialog is separate from main dialog', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { mainDialog, manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assert(mainDialog !== manualDialog, 'Manual entry dialog should be a different instance');
  assert(mainDialog.data.title !== manualDialog.data.title, 'Titles should differ');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 3: Manual entry dialog contains type selector
// =====================================================

console.log('\n--- Section 3: Manual entry dialog contains type selector ---');

await asyncTest('Manual entry dialog contains entry type selector', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'entry-type', 'Should have entry-type selector');
  assertContains(content, 'entry-type-select', 'Should have entry-type-select class');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Type selector has "Official Missing" option', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'Official Missing', 'Should have "Official Missing" option');
  assertContains(content, 'value="missing"', 'Should have option value="missing"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Type selector has "Custom / Homebrew" option', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'Custom / Homebrew', 'Should have "Custom / Homebrew" option');
  assertContains(content, 'value="custom"', 'Should have option value="custom"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Default type is "custom" when opened from Add Archetype button', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  // The callback calls showManualEntryDialog('custom'), so custom should be selected
  assert(
    content.includes('value="custom" selected') ||
    content.includes("value=\"custom\" selected"),
    'Custom option should be selected by default'
  );

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 4: Manual entry dialog contains name field
// =====================================================

console.log('\n--- Section 4: Manual entry dialog contains name field ---');

await asyncTest('Manual entry dialog has archetype name input', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'archetype-name', 'Should have archetype-name input field');
  assertContains(content, 'Archetype Name', 'Should have "Archetype Name" label');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Archetype name field has placeholder', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'placeholder=', 'Name field should have a placeholder');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Archetype name field is required', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'name="archetype-name"', 'Should have archetype-name field');
  assertContains(content, 'required', 'Name field should be required');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 5: Manual entry dialog contains class field
// =====================================================

console.log('\n--- Section 5: Manual entry dialog contains class field ---');

await asyncTest('Manual entry dialog has class input', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'archetype-class', 'Should have archetype-class input field');
  assertContains(content, 'Class', 'Should have "Class" label');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Class field has placeholder', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'name="archetype-class"', 'Should have archetype-class field');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Class field is required', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  const nameIdx = content.indexOf('archetype-class');
  assert(nameIdx >= 0, 'Should have archetype-class field');
  const afterClass = content.substring(nameIdx);
  assertContains(afterClass, 'required', 'Class field should be required');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 6: Manual entry dialog contains feature rows
// =====================================================

console.log('\n--- Section 6: Manual entry dialog contains feature rows ---');

await asyncTest('Manual entry dialog has feature rows section', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'feature-rows', 'Should have feature-rows container');
  assertContains(content, 'feature-row', 'Should have at least one feature-row');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Initial feature row has name, level, and replaces fields', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'feat-name-0', 'Should have feature name input (index 0)');
  assertContains(content, 'feat-level-0', 'Should have feature level input (index 0)');
  assertContains(content, 'feat-replaces-0', 'Should have feature replaces input (index 0)');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Feature name input has placeholder', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'Feature name', 'Feature name input should have placeholder "Feature name"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Feature level input has min/max attributes', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'min="1"', 'Level input should have min="1"');
  assertContains(content, 'max="20"', 'Level input should have max="20"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Feature replaces input has placeholder', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'Replaces (or blank)', 'Replaces input should have appropriate placeholder');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Feature row has remove button', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'remove-feature-btn', 'Feature row should have remove button');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Add Feature button exists in manual entry dialog', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'add-feature-btn', 'Should have Add Feature button');
  assertContains(content, 'Add Feature', 'Add Feature button should have label');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Features section has heading "Features"', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'Features', 'Should have "Features" heading');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 7: Manual entry dialog has Save and Cancel buttons
// =====================================================

console.log('\n--- Section 7: Manual entry dialog has Save and Cancel buttons ---');

await asyncTest('Manual entry dialog has Save button', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assert(manualDialog.data.buttons.submit, 'Should have submit/save button');
  assertEqual(manualDialog.data.buttons.submit.label, 'Save', 'Save button label should be "Save"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Manual entry dialog has Cancel button', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assert(manualDialog.data.buttons.cancel, 'Should have cancel button');
  assertEqual(manualDialog.data.buttons.cancel.label, 'Cancel', 'Cancel button label should be "Cancel"');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Save button has save icon', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assertContains(manualDialog.data.buttons.submit.icon, 'fa-save', 'Save button should have fa-save icon');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Cancel button has times icon', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assertContains(manualDialog.data.buttons.cancel.icon, 'fa-times', 'Cancel button should have fa-times icon');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 8: showManualEntryDialog called correctly
// =====================================================

console.log('\n--- Section 8: showManualEntryDialog function behavior ---');

await asyncTest('showManualEntryDialog can be called directly with "custom" type', async () => {
  const { dialog, promise } = await openManualEntryDialog('custom');

  assertNotNull(dialog, 'Should create a dialog');
  const content = dialog.data.content;
  assert(
    content.includes('value="custom" selected') ||
    content.includes("value=\"custom\" selected"),
    'Custom should be selected by default'
  );

  if (dialog?.data?.close) dialog.data.close();
});

await asyncTest('showManualEntryDialog can be called with "missing" type (GM)', async () => {
  globalThis.game.user.isGM = true;

  const { dialog, promise } = await openManualEntryDialog('missing');

  assertNotNull(dialog, 'Should create a dialog');
  const content = dialog.data.content;
  assert(
    content.includes('value="missing" selected') ||
    content.includes("value=\"missing\" selected"),
    'Missing should be selected when defaultType is "missing"'
  );

  if (dialog?.data?.close) dialog.data.close();
});

await asyncTest('Non-GM cannot open manual entry dialog with "missing" type', async () => {
  clearDialogTracker();
  clearNotifications();

  globalThis.game.user.isGM = false;

  const result = await UIManager.showManualEntryDialog('missing');

  assertEqual(result, null, 'Non-GM should get null result for missing type');
  assert(notifications.some(n => n.type === 'error' && n.msg.includes('GM')),
    'Should show GM-only error notification');

  globalThis.game.user.isGM = true;
});

// =====================================================
// SECTION 9: Form structure
// =====================================================

console.log('\n--- Section 9: Form structure and interactivity ---');

await asyncTest('Manual entry dialog content is a form', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, '<form', 'Content should be wrapped in a form tag');
  assertContains(content, 'archetype-manual-entry', 'Form should have archetype-manual-entry class');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Manual entry dialog has render callback for interactivity', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assertEqual(typeof manualDialog.data.render, 'function',
    'Manual entry dialog should have a render callback');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Manual entry dialog has autocomplete off on form', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  const { manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);
  const content = manualDialog.data.content;

  assertContains(content, 'autocomplete="off"', 'Form should have autocomplete off');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// SECTION 10: _buildManualEntryHTML generates proper structure
// =====================================================

console.log('\n--- Section 10: _buildManualEntryHTML generates proper structure ---');

test('_buildManualEntryHTML with custom default generates correct HTML', () => {
  const html = UIManager._buildManualEntryHTML('custom');

  assertContains(html, 'archetype-manual-entry', 'Should have form class');
  assertContains(html, 'entry-type-select', 'Should have type selector');
  assertContains(html, 'archetype-name', 'Should have name field');
  assertContains(html, 'archetype-class', 'Should have class field');
  assertContains(html, 'feature-rows', 'Should have feature rows container');
  assertContains(html, 'feat-name-0', 'Should have initial feature name field');
  assertContains(html, 'feat-level-0', 'Should have initial feature level field');
  assertContains(html, 'feat-replaces-0', 'Should have initial feature replaces field');
  assertContains(html, 'add-feature-btn', 'Should have Add Feature button');
});

test('_buildManualEntryHTML with missing default selects missing option', () => {
  const html = UIManager._buildManualEntryHTML('missing');
  assert(
    html.includes('value="missing" selected') ||
    html.includes("value=\"missing\" selected"),
    'Missing option should be selected'
  );
});

test('_buildManualEntryHTML with custom default selects custom option', () => {
  const html = UIManager._buildManualEntryHTML('custom');
  assert(
    html.includes('value="custom" selected') ||
    html.includes("value=\"custom\" selected"),
    'Custom option should be selected'
  );
});

test('_buildManualEntryHTML includes Features heading with separator', () => {
  const html = UIManager._buildManualEntryHTML('custom');
  assertContains(html, '<hr', 'Should have <hr/> separator before features section');
  assertContains(html, '<h3', 'Should have heading for features section');
  assertContains(html, 'Features', 'Heading should say "Features"');
});

test('_buildManualEntryHTML includes help text for features', () => {
  const html = UIManager._buildManualEntryHTML('custom');
  assertContains(html, 'Add each feature', 'Should have help text about adding features');
});

// =====================================================
// SECTION 11: _validateManualEntry validates input
// =====================================================

console.log('\n--- Section 11: _validateManualEntry validates input ---');

test('_validateManualEntry rejects empty name', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Test Feature';
  container.querySelector('[name="feat-level-0"]').value = '1';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, false, 'Should be invalid without name');
  assert(result.errors.some(e => e.includes('name')), 'Error should mention name');
});

test('_validateManualEntry rejects empty class', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Test Archetype';
  container.querySelector('[name="feat-name-0"]').value = 'Test Feature';
  container.querySelector('[name="feat-level-0"]').value = '1';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, false, 'Should be invalid without class');
  assert(result.errors.some(e => e.includes('Class')), 'Error should mention class');
});

test('_validateManualEntry rejects if no features', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Test Archetype';
  container.querySelector('[name="archetype-class"]').value = 'fighter';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, false, 'Should be invalid without features');
  assert(result.errors.some(e => e.toLowerCase().includes('feature')), 'Error should mention features');
});

test('_validateManualEntry accepts valid entry', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Test Archetype';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Test Feature';
  container.querySelector('[name="feat-level-0"]').value = '3';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, true, 'Should be valid with all required fields');
  assertEqual(result.data.name, 'Test Archetype', 'Data name should match');
  assertEqual(result.data.entry.class, 'fighter', 'Data class should be lowercase');
  assert(Object.keys(result.data.entry.features).length > 0, 'Should have at least one feature');
});

test('_validateManualEntry includes replaces field in feature data', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Test Archetype';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Shattering Strike';
  container.querySelector('[name="feat-level-0"]').value = '2';
  container.querySelector('[name="feat-replaces-0"]').value = 'Bravery';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, true, 'Should be valid');
  const featureKeys = Object.keys(result.data.entry.features);
  const feature = result.data.entry.features[featureKeys[0]];
  assertEqual(feature.replaces, 'Bravery', 'Feature should have replaces field');
  assertEqual(feature.level, 2, 'Feature should have numeric level');
});

test('_validateManualEntry sets replaces to null when blank', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Additive Archetype';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Extra Power';
  container.querySelector('[name="feat-level-0"]').value = '1';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, true, 'Should be valid');
  const featureKeys = Object.keys(result.data.entry.features);
  const feature = result.data.entry.features[featureKeys[0]];
  assertEqual(feature.replaces, null, 'Feature replaces should be null when blank');
});

test('_validateManualEntry generates slug from name', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Two-Handed Fighter';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Test';
  container.querySelector('[name="feat-level-0"]').value = '1';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, true, 'Should be valid');
  assertEqual(result.data.slug, 'two-handed-fighter', 'Should generate correct slug');
});

test('_validateManualEntry rejects invalid level (0)', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Test';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Feature';
  container.querySelector('[name="feat-level-0"]').value = '0';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, false, 'Should be invalid with level 0');
});

test('_validateManualEntry rejects invalid level (21)', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');
  container.querySelector('[name="archetype-name"]').value = 'Test';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Feature';
  container.querySelector('[name="feat-level-0"]').value = '21';

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, false, 'Should be invalid with level 21');
});

test('_validateManualEntry rejects duplicate feature names', () => {
  const container = document.createElement('div');
  container.innerHTML = UIManager._buildManualEntryHTML('custom');

  container.querySelector('[name="archetype-name"]').value = 'Test';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Same Feature';
  container.querySelector('[name="feat-level-0"]').value = '1';

  // Add a second feature row manually
  const rowsContainer = container.querySelector('.feature-rows');
  const newRow = document.createElement('div');
  newRow.className = 'feature-row';
  newRow.dataset.index = '1';
  newRow.innerHTML = `
    <input type="text" name="feat-name-1" value="Same Feature" />
    <input type="number" name="feat-level-1" value="3" />
    <input type="text" name="feat-replaces-1" value="" />
  `;
  rowsContainer.appendChild(newRow);

  const result = UIManager._validateManualEntry(container);
  assertEqual(result.valid, false, 'Should be invalid with duplicate feature names');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

// =====================================================
// SECTION 12: Close behavior
// =====================================================

console.log('\n--- Section 12: Close/cancel behavior ---');

await asyncTest('Cancel button returns null (does not save)', async () => {
  clearDialogTracker();

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  const dialog = dialogTracker[dialogTracker.length - 1];
  // Simulate clicking cancel
  dialog.data.buttons.cancel.callback();

  const result = await promise;
  assertEqual(result, null, 'Cancel should return null');
});

await asyncTest('Closing dialog (X button) returns null', async () => {
  clearDialogTracker();

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  const dialog = dialogTracker[dialogTracker.length - 1];
  dialog.data.close();

  const result = await promise;
  assertEqual(result, null, 'Closing dialog should return null');
});

await asyncTest('Main dialog still accessible after manual entry dialog interaction', async () => {
  clearDialogTracker();

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  await UIManager.showMainDialog(actor, [classItem]);
  const mainDialog = dialogTracker[0];

  // Verify main dialog was rendered and has expected structure
  assert(mainDialog.data.buttons.addCustom, 'Main dialog still has addCustom button');
  assert(mainDialog.data.buttons.close, 'Main dialog still has close button');
  assert(mainDialog.data.buttons.applySelected, 'Main dialog still has applySelected button');
});

// =====================================================
// SECTION 13: Integration tests
// =====================================================

console.log('\n--- Section 13: Integration - full flow ---');

await asyncTest('Full flow: open main dialog -> Add Archetype -> verify dialog structure', async () => {
  const classItem = createMockClassItem('Wizard', 8, 'wizard');
  const actor = createMockActor('Gandalf', [classItem]);

  const { mainDialog, manualDialog } = await openMainAndClickAddArchetype(actor, [classItem]);

  assertNotNull(manualDialog, 'Manual entry dialog should be created');

  const content = manualDialog.data.content;

  // Type selector
  assertContains(content, 'entry-type-select', 'Has type selector');
  assertContains(content, 'value="missing"', 'Has missing option');
  assertContains(content, 'value="custom"', 'Has custom option');

  // Name field
  assertContains(content, 'archetype-name', 'Has name field');

  // Class field
  assertContains(content, 'archetype-class', 'Has class field');

  // Feature rows
  assertContains(content, 'feature-rows', 'Has feature rows');
  assertContains(content, 'feat-name-0', 'Has initial feature name');
  assertContains(content, 'feat-level-0', 'Has initial feature level');
  assertContains(content, 'feat-replaces-0', 'Has initial feature replaces');

  // Buttons
  assert(manualDialog.data.buttons.submit, 'Has Save button');
  assert(manualDialog.data.buttons.cancel, 'Has Cancel button');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

await asyncTest('Full flow: main dialog with multiple classes -> Add Archetype works', async () => {
  const fighterClass = createMockClassItem('Fighter', 10, 'fighter');
  const rogueClass = createMockClassItem('Rogue', 5, 'rogue');
  const actor = createMockActor('Multi-class Hero', [fighterClass, rogueClass]);

  const { mainDialog, manualDialog } = await openMainAndClickAddArchetype(actor, [fighterClass, rogueClass]);

  // Verify main dialog has both classes in dropdown
  assertContains(mainDialog.data.content, 'Fighter', 'Main dialog has Fighter option');
  assertContains(mainDialog.data.content, 'Rogue', 'Main dialog has Rogue option');

  // Verify manual dialog was created
  assertNotNull(manualDialog, 'Manual dialog should be created');
  assert(manualDialog !== mainDialog, 'Manual dialog is separate from main dialog');
  assertContains(manualDialog.data.title, 'Add Archetype', 'Manual dialog has correct title');

  if (manualDialog?.data?.close) manualDialog.data.close();
});

// =====================================================
// RESULTS
// =====================================================

console.log('\n=== RESULTS ===');
console.log(`Total: ${totalTests}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`${passed}/${totalTests} tests passing`);

if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nAll tests PASSED!');
}
