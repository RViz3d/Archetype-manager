/**
 * Test Suite for Features #34, #35, #36 - Preview Dialog & Diff Display
 *
 * Feature #34: Preview dialog displays diff with status icons
 * Feature #35: Editable level fields in preview dialog
 * Feature #36: Feature info button shows description
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

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
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

// Helper: create test archetype and diff data
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
        description: '<p>At 2nd level, a two-handed fighter gains a +1 bonus to CMB and CMD on sunder attempts.</p>',
        matchedAssociation: { uuid: 'uuid-bravery', level: 2 }
      },
      {
        name: 'Overhand Chop',
        type: 'replacement',
        level: 3,
        target: 'Armor Training 1',
        description: '<p>At 3rd level, when a two-handed fighter makes a single attack with a two-handed weapon, he adds double his Strength bonus to damage.</p>',
        matchedAssociation: { uuid: 'uuid-at1', level: 3 }
      },
      {
        name: 'Weapon Training',
        type: 'modification',
        level: 5,
        target: 'Weapon Training',
        description: '<p>As the normal fighter weapon training, but only two-handed weapons.</p>',
        matchedAssociation: { uuid: 'uuid-wt', level: 5 }
      },
      {
        name: 'Backswing',
        type: 'additive',
        level: 7,
        description: '<p>At 7th level, a two-handed fighter can make an extra attack at the end of a full-attack action.</p>'
      }
    ]
  };

  const diff = [
    { status: 'unchanged', level: 1, name: 'Bonus Feat', original: { uuid: 'uuid-bonusfeat', level: 1 } },
    { status: 'removed', level: 2, name: 'Bravery', original: { uuid: 'uuid-bravery', level: 2 } },
    { status: 'added', level: 2, name: 'Shattering Strike', archetypeFeature: parsedArchetype.features[0] },
    { status: 'removed', level: 3, name: 'Armor Training 1', original: { uuid: 'uuid-at1', level: 3 } },
    { status: 'added', level: 3, name: 'Overhand Chop', archetypeFeature: parsedArchetype.features[1] },
    { status: 'modified', level: 5, name: 'Weapon Training', archetypeFeature: parsedArchetype.features[2] },
    { status: 'unchanged', level: 5, name: 'Weapon Training 1', original: { uuid: 'uuid-wt1', level: 5 } },
    { status: 'added', level: 7, name: 'Backswing', archetypeFeature: parsedArchetype.features[3] },
    { status: 'unchanged', level: 9, name: 'Weapon Training 2', original: { uuid: 'uuid-wt2', level: 9 } },
    { status: 'unchanged', level: 19, name: 'Armor Mastery', original: { uuid: 'uuid-am', level: 19 } }
  ];

  return { parsedArchetype, diff };
}


// ============================================
// Feature #34: Preview dialog displays diff with status icons
// ============================================

console.log('\n=== Feature #34: Preview dialog displays diff with status icons ===\n');

// --- Test 1: Open preview dialog ---
console.log('--- Test 1: Open preview dialog ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  // Start the showPreviewDialog (it returns a promise)
  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog !== undefined, 'Preview dialog was created');
  assert(dialog.data.title.includes('Preview'), 'Dialog title contains "Preview"');
  assert(dialog.data.title.includes('Two-Handed Fighter'), 'Dialog title contains archetype name');

  // Close the dialog to resolve the promise
  dialog.close();
  const result = await previewPromise;
  assert(result === null, 'Closing dialog resolves with null');
}

// --- Test 2: Removed entries have red X icon ---
console.log('--- Test 2: Removed entries have red X icon ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  // Get the rendered HTML content
  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Check for removed rows
  const removedRows = html.querySelectorAll('.preview-removed');
  assert(removedRows.length === 2, `Found ${removedRows.length} removed rows (expected 2: Bravery, Armor Training 1)`);

  // Check the status icon for removed
  const firstRemovedRow = removedRows[0];
  if (firstRemovedRow) {
    const icon = firstRemovedRow.querySelector('.status-icon i');
    assert(icon !== null, 'Removed row has a status icon');
    assert(icon?.classList.contains('fa-times'), 'Removed icon is fa-times (X)');

    const statusSpan = firstRemovedRow.querySelector('.status-icon');
    const style = statusSpan?.getAttribute('style') || '';
    assert(style.includes('#c00') || style.includes('red'), 'Removed icon color is red (#c00)');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 3: Added entries have blue + icon ---
console.log('--- Test 3: Added entries have blue + icon ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Check for added rows
  const addedRows = html.querySelectorAll('.preview-added');
  assert(addedRows.length === 3, `Found ${addedRows.length} added rows (expected 3: Shattering Strike, Overhand Chop, Backswing)`);

  // Check the status icon for added
  const firstAddedRow = addedRows[0];
  if (firstAddedRow) {
    const icon = firstAddedRow.querySelector('.status-icon i');
    assert(icon !== null, 'Added row has a status icon');
    assert(icon?.classList.contains('fa-plus'), 'Added icon is fa-plus (+)');

    const statusSpan = firstAddedRow.querySelector('.status-icon');
    const style = statusSpan?.getAttribute('style') || '';
    assert(style.includes('#08f') || style.includes('blue'), 'Added icon color is blue (#08f)');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 4: Modified entries have orange ~ icon ---
console.log('--- Test 4: Modified entries have orange ~ icon ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Check for modified rows
  const modifiedRows = html.querySelectorAll('.preview-modified');
  assert(modifiedRows.length === 1, `Found ${modifiedRows.length} modified rows (expected 1: Weapon Training)`);

  if (modifiedRows[0]) {
    const icon = modifiedRows[0].querySelector('.status-icon i');
    assert(icon !== null, 'Modified row has a status icon');
    assert(icon?.classList.contains('fa-pen'), 'Modified icon is fa-pen (~)');

    const statusSpan = modifiedRows[0].querySelector('.status-icon');
    const style = statusSpan?.getAttribute('style') || '';
    assert(style.includes('#f80') || style.includes('orange'), 'Modified icon color is orange (#f80)');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 5: Unchanged entries have green checkmark ---
console.log('--- Test 5: Unchanged entries have green checkmark ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Check for unchanged rows
  const unchangedRows = html.querySelectorAll('.preview-unchanged');
  assert(unchangedRows.length === 4, `Found ${unchangedRows.length} unchanged rows (expected 4: Bonus Feat, WT1, WT2, Armor Mastery)`);

  if (unchangedRows[0]) {
    const icon = unchangedRows[0].querySelector('.status-icon i');
    assert(icon !== null, 'Unchanged row has a status icon');
    assert(icon?.classList.contains('fa-check'), 'Unchanged icon is fa-check (checkmark)');

    const statusSpan = unchangedRows[0].querySelector('.status-icon');
    const style = statusSpan?.getAttribute('style') || '';
    assert(style.includes('#080') || style.includes('green'), 'Unchanged icon color is green (#080)');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 6: All entries show name and level ---
console.log('--- Test 6: All entries show name and level ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Check all rows have entries
  const allRows = html.querySelectorAll('.preview-row');
  assert(allRows.length === diff.length, `All ${diff.length} diff entries rendered as rows`);

  // Verify each row has name and level
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const rowText = row.textContent;
    const diffEntry = diff[i];

    // Name should appear somewhere in the row
    assert(rowText.includes(diffEntry.name), `Row ${i} contains name "${diffEntry.name}"`);

    // Level should appear - either in an input or as text
    const levelInput = row.querySelector('.preview-level-input');
    const levelText = row.textContent;
    if (levelInput) {
      assert(levelInput.value === String(diffEntry.level), `Row ${i} level input has value ${diffEntry.level}`);
    } else {
      assert(levelText.includes(String(diffEntry.level)), `Row ${i} shows level ${diffEntry.level}`);
    }
  }

  dialog.close();
  await previewPromise;
}

// --- Test 7: Clear before/after views (status labels) ---
console.log('--- Test 7: Clear before/after views (status labels) ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Verify status labels are clear
  const allRows = html.querySelectorAll('.preview-row');
  let hasRemovedLabel = false;
  let hasAddedLabel = false;
  let hasModifiedLabel = false;
  let hasUnchangedLabel = false;

  for (const row of allRows) {
    const text = row.textContent;
    if (text.includes('Removed')) hasRemovedLabel = true;
    if (text.includes('Added')) hasAddedLabel = true;
    if (text.includes('Modified')) hasModifiedLabel = true;
    if (text.includes('Unchanged')) hasUnchangedLabel = true;
  }

  assert(hasRemovedLabel, 'At least one row has "Removed" label text');
  assert(hasAddedLabel, 'At least one row has "Added" label text');
  assert(hasModifiedLabel, 'At least one row has "Modified" label text');
  assert(hasUnchangedLabel, 'At least one row has "Unchanged" label text');

  dialog.close();
  await previewPromise;
}

// --- Test 8: Preview HTML uses correct table structure ---
console.log('--- Test 8: Preview HTML uses correct table structure ---');
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  // Verify table headers exist
  assert(html.includes('Status'), 'Preview HTML has Status column header');
  assert(html.includes('Level'), 'Preview HTML has Level column header');
  assert(html.includes('Feature'), 'Preview HTML has Feature column header');
  assert(html.includes('Action'), 'Preview HTML has Action column header');

  // Verify it contains the diff table class
  assert(html.includes('preview-diff-table'), 'HTML has preview-diff-table class');

  // Verify archetype name is displayed
  assert(html.includes('Two-Handed Fighter'), 'HTML shows archetype name');
}

// --- Test 9: Preview with empty diff shows no changes message ---
console.log('--- Test 9: Preview with empty diff shows no changes message ---');
{
  const parsedArchetype = { name: 'Empty Archetype' };
  const html = UIManager._buildPreviewHTML(parsedArchetype, []);

  assert(html.includes('No changes detected'), 'Empty diff shows "No changes detected" message');
}

// --- Test 10: Preview with null diff handled gracefully ---
console.log('--- Test 10: Preview with null diff handled gracefully ---');
{
  const parsedArchetype = { name: 'Null Diff Archetype' };
  const html = UIManager._buildPreviewHTML(parsedArchetype, null);

  assert(html.includes('No changes detected'), 'Null diff shows "No changes detected" message');
}

// --- Test 11: Status icon tooltip shows correct label ---
console.log('--- Test 11: Status icon tooltip shows correct label ---');
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  // Check title attributes for tooltips
  assert(html.includes('title="Removed"'), 'Removed icon has "Removed" tooltip');
  assert(html.includes('title="Added"'), 'Added icon has "Added" tooltip');
  assert(html.includes('title="Modified"'), 'Modified icon has "Modified" tooltip');
  assert(html.includes('title="Unchanged"'), 'Unchanged icon has "Unchanged" tooltip');
}

// --- Test 12: Dialog has Apply and Back buttons ---
console.log('--- Test 12: Dialog has Apply and Back buttons ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  assert(dialog.data.buttons.apply !== undefined, 'Dialog has Apply button');
  assert(dialog.data.buttons.back !== undefined, 'Dialog has Back button');
  assert(dialog.data.buttons.apply.label === 'Apply', 'Apply button has correct label');
  assert(dialog.data.buttons.back.label === 'Back', 'Back button has correct label');

  dialog.close();
  await previewPromise;
}

// --- Test 13: Apply button resolves with 'apply' ---
console.log('--- Test 13: Apply button resolves with "apply" ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  // Simulate clicking "Apply"
  dialog.data.buttons.apply.callback(dialog._element || document.createElement('div'));
  const result = await previewPromise;
  assertEqual(result, 'apply', 'Apply button resolves with "apply"');
}

// --- Test 14: Back button resolves with 'back' ---
console.log('--- Test 14: Back button resolves with "back" ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  // Simulate clicking "Back"
  dialog.data.buttons.back.callback(dialog._element || document.createElement('div'));
  const result = await previewPromise;
  assertEqual(result, 'back', 'Back button resolves with "back"');
}

// --- Test 15: Row CSS classes correspond to status ---
console.log('--- Test 15: Row CSS classes correspond to status ---');
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  assert(html.includes('preview-removed'), 'HTML contains preview-removed class');
  assert(html.includes('preview-added'), 'HTML contains preview-added class');
  assert(html.includes('preview-modified'), 'HTML contains preview-modified class');
  assert(html.includes('preview-unchanged'), 'HTML contains preview-unchanged class');
}

// --- Test 16: Diff entries sorted by level in preview ---
console.log('--- Test 16: Diff entries sorted by level in preview ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const rows = html.querySelectorAll('.preview-row');
  let prevLevel = 0;
  let sortedCorrectly = true;

  for (const row of rows) {
    const levelInput = row.querySelector('.preview-level-input');
    const levelText = row.querySelectorAll('td')[1]?.textContent?.trim() || '';
    const level = levelInput ? parseInt(levelInput.value) : parseInt(levelText);

    if (!isNaN(level) && level < prevLevel) {
      sortedCorrectly = false;
    }
    if (!isNaN(level)) prevLevel = level;
  }

  assert(sortedCorrectly, 'Diff entries are sorted by level (ascending)');

  dialog.close();
  await previewPromise;
}


// ============================================
// Feature #35: Editable level fields in preview dialog
// ============================================

console.log('\n=== Feature #35: Editable level fields in preview dialog ===\n');

// --- Test 17: Added entries have editable level fields ---
console.log('--- Test 17: Added entries have editable level fields ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const addedRows = html.querySelectorAll('.preview-added');
  let allHaveInputs = true;
  for (const row of addedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    if (!levelInput) allHaveInputs = false;
  }
  assert(allHaveInputs, 'All added rows have editable level input fields');

  dialog.close();
  await previewPromise;
}

// --- Test 18: Modified entries have editable level fields ---
console.log('--- Test 18: Modified entries have editable level fields ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const modifiedRows = html.querySelectorAll('.preview-modified');
  let allHaveInputs = true;
  for (const row of modifiedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    if (!levelInput) allHaveInputs = false;
  }
  assert(allHaveInputs, 'All modified rows have editable level input fields');

  dialog.close();
  await previewPromise;
}

// --- Test 19: Unchanged entries do NOT have editable level fields ---
console.log('--- Test 19: Unchanged entries do NOT have editable level fields ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const unchangedRows = html.querySelectorAll('.preview-unchanged');
  let noneHaveInputs = true;
  for (const row of unchangedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    if (levelInput) noneHaveInputs = false;
  }
  assert(noneHaveInputs, 'No unchanged rows have editable level input fields');

  dialog.close();
  await previewPromise;
}

// --- Test 20: Removed entries do NOT have editable level fields ---
console.log('--- Test 20: Removed entries do NOT have editable level fields ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const removedRows = html.querySelectorAll('.preview-removed');
  let noneHaveInputs = true;
  for (const row of removedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    if (levelInput) noneHaveInputs = false;
  }
  assert(noneHaveInputs, 'No removed rows have editable level input fields');

  dialog.close();
  await previewPromise;
}

// --- Test 21: Level input fields have correct initial values ---
console.log('--- Test 21: Level input fields have correct initial values ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const levelInputs = html.querySelectorAll('.preview-level-input');
  assert(levelInputs.length > 0, 'Level inputs exist in preview');

  // Check that each input has a valid initial value
  for (const input of levelInputs) {
    const idx = parseInt(input.dataset.index);
    const expectedLevel = diff[idx]?.level;
    assertEqual(input.value, String(expectedLevel || ''), `Level input at index ${idx} has correct value ${expectedLevel}`);
  }

  dialog.close();
  await previewPromise;
}

// --- Test 22: Changing level value updates the diff array ---
console.log('--- Test 22: Changing level value updates the diff array ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  // Save original level for an added entry
  const addedIdx = diff.findIndex(d => d.status === 'added');
  const originalLevel = diff[addedIdx].level;

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Find the input for the added entry
  const levelInput = html.querySelector(`.preview-level-input[data-index="${addedIdx}"]`);
  assert(levelInput !== null, 'Found level input for added entry');

  if (levelInput) {
    // Change the level from 2 to 4
    levelInput.value = '4';

    // Dispatch change event to trigger handler
    const event = new Event('change');
    levelInput.dispatchEvent(event);

    // Verify the diff array was updated
    assertEqual(diff[addedIdx].level, 4, 'Diff entry level updated from 2 to 4');
  }

  dialog.close();
  await previewPromise;

  // Restore for other tests
  diff[addedIdx].level = originalLevel;
}

// --- Test 23: Level input has min/max attributes ---
console.log('--- Test 23: Level input has min/max attributes ---');
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  assert(html.includes('min="1"'), 'Level inputs have min="1"');
  assert(html.includes('max="20"'), 'Level inputs have max="20"');
  assert(html.includes('type="number"'), 'Level inputs are type="number"');
}

// --- Test 24: Non-numeric level change is rejected (NaN check) ---
console.log('--- Test 24: Non-numeric level change is rejected ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const addedIdx = diff.findIndex(d => d.status === 'added');
  const originalLevel = diff[addedIdx].level;

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const levelInput = html.querySelector(`.preview-level-input[data-index="${addedIdx}"]`);
  if (levelInput) {
    // Set a non-numeric value
    levelInput.value = 'abc';
    const event = new Event('change');
    levelInput.dispatchEvent(event);

    // Level should NOT be updated (NaN check in handler)
    assertEqual(diff[addedIdx].level, originalLevel, 'Non-numeric value does not update diff level');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 25: Level input data-index matches diff array ---
console.log('--- Test 25: Level input data-index matches diff array ---');
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  // Parse all data-index values from level inputs
  const indexMatches = html.match(/data-index="(\d+)"/g) || [];
  const indices = indexMatches.map(m => parseInt(m.match(/\d+/)[0]));

  // Each index should be within diff bounds and point to an added/modified entry
  let allValid = true;
  for (const idx of indices) {
    if (idx < 0 || idx >= diff.length) {
      allValid = false;
      break;
    }
    const entry = diff[idx];
    if (entry.status !== 'added' && entry.status !== 'modified') {
      allValid = false;
      break;
    }
  }
  assert(allValid, 'All level input data-index values point to added/modified entries');
}

// --- Test 26: Multiple level changes all update correctly ---
console.log('--- Test 26: Multiple level changes all update correctly ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  // Make a copy of original levels for added/modified entries
  const editableIndices = diff.reduce((acc, d, i) => {
    if (d.status === 'added' || d.status === 'modified') acc.push(i);
    return acc;
  }, []);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Change all editable levels to 10
  for (const idx of editableIndices) {
    const input = html.querySelector(`.preview-level-input[data-index="${idx}"]`);
    if (input) {
      input.value = '10';
      input.dispatchEvent(new Event('change'));
    }
  }

  // Check all were updated
  let allUpdated = true;
  for (const idx of editableIndices) {
    if (diff[idx].level !== 10) allUpdated = false;
  }
  assert(allUpdated, 'All editable level fields update the diff array when changed');

  dialog.close();
  await previewPromise;
}


// ============================================
// Feature #36: Feature info button shows description
// ============================================

console.log('\n=== Feature #36: Feature info button shows description ===\n');

// --- Test 27: Preview HTML has info buttons for archetype features ---
console.log('--- Test 27: Preview HTML has info buttons for archetype features ---');
{
  // For Feature #36, we need info buttons in the preview dialog.
  // Currently the preview may not have info buttons - let's verify
  // and add them if needed.
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();

  // Build the preview HTML
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  // Info buttons should exist for features that have archetypeFeature data
  const container = document.createElement('div');
  container.innerHTML = html;

  // Check that info buttons exist on added/modified rows
  const addedModifiedRows = container.querySelectorAll('.preview-added, .preview-modified');
  let infoButtonCount = 0;
  for (const row of addedModifiedRows) {
    const infoBtn = row.querySelector('.info-btn');
    if (infoBtn) infoButtonCount++;
  }

  assert(infoButtonCount > 0, 'Info buttons exist on archetype feature rows');
}

// --- Test 28: Info button on compendium feature shows module description ---
console.log('--- Test 28: Info button on compendium feature shows module description ---');
{
  clearDialogTracker();
  clearNotifications();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  // Find an info button on an archetype feature
  const infoBtns = html.querySelectorAll('.info-btn');
  if (infoBtns.length > 0) {
    // Click the first info button
    infoBtns[0].click();

    // Should show an info dialog or notification with description
    // The implementation could be a notification, popup, or nested dialog
    const lastDialog = dialogTracker[dialogTracker.length - 1];
    const hasInfoDialog = lastDialog && lastDialog !== dialog;
    const hasNotification = notifications.length > 0;

    assert(hasInfoDialog || hasNotification, 'Clicking info button shows description (via dialog or notification)');

    if (hasInfoDialog) {
      const infoContent = lastDialog.data.content || '';
      // Should contain some description text
      assert(infoContent.length > 0, 'Info dialog has content');
      lastDialog.close();
    }
  } else {
    assert(false, 'Info buttons found (need implementation)');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 29: Info button on JE feature shows JE description ---
console.log('--- Test 29: Info button on JE feature shows JE description ---');
{
  clearDialogTracker();
  clearNotifications();

  // Create a diff with a JE-sourced feature
  const parsedArchetype = {
    name: 'Custom Archetype',
    slug: 'custom-archetype',
    features: [
      {
        name: 'Custom Ability',
        type: 'replacement',
        level: 3,
        description: 'This is a custom ability from the JE database.',
        source: 'custom',
        target: 'Some Feature',
        matchedAssociation: { uuid: 'uuid-somefeat', level: 3 }
      }
    ]
  };

  const diff = [
    { status: 'added', level: 3, name: 'Custom Ability', archetypeFeature: parsedArchetype.features[0] }
  ];

  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const infoBtns = html.querySelectorAll('.info-btn');
  if (infoBtns.length > 0) {
    infoBtns[0].click();

    const hasResponse = dialogTracker.length > 1 || notifications.length > 0;
    assert(hasResponse, 'Clicking info on JE feature shows description');
  } else {
    assert(false, 'Info buttons found for JE features');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 30: Info button on additive feature shows description ---
console.log('--- Test 30: Info button on additive feature shows description ---');
{
  clearDialogTracker();
  clearNotifications();

  const parsedArchetype = {
    name: 'Additive Archetype',
    slug: 'additive-archetype',
    features: [
      {
        name: 'Extra Power',
        type: 'additive',
        level: 5,
        description: '<p>Grants extra power at 5th level. This is purely additive.</p>'
      }
    ]
  };

  const diff = [
    { status: 'added', level: 5, name: 'Extra Power', archetypeFeature: parsedArchetype.features[0] }
  ];

  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const infoBtns = html.querySelectorAll('.info-btn');
  if (infoBtns.length > 0) {
    infoBtns[0].click();

    const hasResponse = dialogTracker.length > 1 || notifications.length > 0;
    assert(hasResponse, 'Clicking info on additive feature shows description');
  } else {
    assert(false, 'Info buttons found for additive features');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 31: Info popup is dismissable ---
console.log('--- Test 31: Info popup is dismissable ---');
{
  clearDialogTracker();
  clearNotifications();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const infoBtns = html.querySelectorAll('.info-btn');
  if (infoBtns.length > 0) {
    infoBtns[0].click();

    // If an info dialog was created
    const infoDialog = dialogTracker.find(d => d !== dialog && !d._closed);
    if (infoDialog) {
      // It should be closeable
      infoDialog.close();
      assert(infoDialog._closed, 'Info popup dialog can be closed');
    } else {
      // If notification-based, it's inherently dismissable
      assert(notifications.length > 0, 'Info shown via notification (inherently dismissable)');
    }
  } else {
    assert(false, 'Info buttons found to test dismissability');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 32: Info button click doesn't close preview dialog ---
console.log('--- Test 32: Info button click doesn\'t close preview dialog ---');
{
  clearDialogTracker();
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const fighter = createMockClassItem('Fighter', 10);
  const actor = createMockActor('Test Hero', [fighter]);

  const previewPromise = UIManager.showPreviewDialog(actor, fighter, parsedArchetype, diff);
  const dialog = dialogTracker[dialogTracker.length - 1];

  const html = dialog._element || document.createElement('div');
  if (!dialog._element) html.innerHTML = dialog.data.content;

  const infoBtns = html.querySelectorAll('.info-btn');
  if (infoBtns.length > 0) {
    infoBtns[0].click();
    assert(!dialog._closed, 'Preview dialog stays open after info button click');
  }

  dialog.close();
  await previewPromise;
}

// --- Test 33: Unchanged/removed rows do NOT have info buttons ---
console.log('--- Test 33: Info buttons only on archetype features (added/modified) ---');
{
  const { parsedArchetype, diff } = createTestArchetypeAndDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  const container = document.createElement('div');
  container.innerHTML = html;

  // Unchanged rows should NOT have info buttons (they are base class features)
  const unchangedRows = container.querySelectorAll('.preview-unchanged');
  let unchangedHaveInfo = false;
  for (const row of unchangedRows) {
    if (row.querySelector('.info-btn')) unchangedHaveInfo = true;
  }

  // Removed rows should NOT have info buttons
  const removedRows = container.querySelectorAll('.preview-removed');
  let removedHaveInfo = false;
  for (const row of removedRows) {
    if (row.querySelector('.info-btn')) removedHaveInfo = true;
  }

  assert(!unchangedHaveInfo, 'Unchanged rows do NOT have info buttons');
  assert(!removedHaveInfo, 'Removed rows do NOT have info buttons');
}

// ============================================
// Summary
// ============================================

console.log('\n============================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('============================================\n');

if (failed > 0) {
  process.exit(1);
}
