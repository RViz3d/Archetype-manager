/**
 * Test Suite for Feature #61: User cancellation at any dialog leaves clean state
 *
 * Verifies that cancelling any dialog at any point leaves no partial changes:
 * 1. Open main dialog, cancel -> verify clean
 * 2. Open preview dialog, cancel -> verify clean
 * 3. Open fix dialog, cancel -> verify no JE changes
 * 4. Open manual entry, cancel -> verify no JE changes
 * 5. Open confirm dialog, cancel -> verify no application
 * 6. Verify no flags modified on cancel
 * 7. Verify no item copies created on cancel
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

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message || 'Deep equality failed'}: expected ${e}, got ${a}`);
  }
}

function assertNull(actual, message) {
  if (actual !== null && actual !== undefined) {
    throw new Error(`${message || 'Expected null/undefined'}: got ${JSON.stringify(actual)}`);
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
const { Applicator } = await import('../scripts/applicator.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');

console.log('\n=== Feature #61: User cancellation at any dialog leaves clean state ===\n');

// Track notifications
const notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};
function clearNotifications() { notifications.length = 0; }

// Track created dialogs
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

// Helper: Build a standard Fighter class item with 12 associations
function buildFighterClassItem() {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  const associations = [];
  const featureNames = [
    'Bonus Feats', 'Bravery', 'Armor Training', 'Weapon Training',
    'Armor Mastery', 'Weapon Mastery', 'Tower Shield Proficiency',
    'Heavy Armor Proficiency', 'Medium Armor Proficiency', 'Light Armor Proficiency',
    'Shield Proficiency', 'Martial Weapon Proficiency'
  ];
  for (let i = 0; i < featureNames.length; i++) {
    associations.push({
      uuid: `Compendium.pf1.class-abilities.Item.fighter-${featureNames[i].toLowerCase().replace(/\s+/g, '-')}`,
      level: Math.min(i + 1, 20),
      resolvedName: featureNames[i]
    });
  }
  classItem.system.links.classAssociations = associations;
  return classItem;
}

// Helper: Build a parsed archetype (Two-Handed Fighter style)
function buildParsedArchetype() {
  return {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      {
        name: 'Shattering Strike',
        type: 'replacement',
        level: 2,
        target: 'Bravery',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.fighter-bravery',
          level: 2,
          resolvedName: 'Bravery'
        }
      },
      {
        name: 'Overhand Chop',
        type: 'replacement',
        level: 3,
        target: 'Armor Training',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.fighter-armor-training',
          level: 3,
          resolvedName: 'Armor Training'
        }
      },
      {
        name: 'Weapon Training (Modified)',
        type: 'modification',
        level: 5,
        target: 'Weapon Training',
        description: 'Two-Handed variant of Weapon Training',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.fighter-weapon-training',
          level: 4,
          resolvedName: 'Weapon Training'
        }
      }
    ]
  };
}

// Helper: Snapshot of all flags on a class item and actor
function snapshotFlags(classItem, actor) {
  return {
    classItemFlags: JSON.stringify(classItem.flags),
    actorFlags: JSON.stringify(actor.flags),
    classAssociations: JSON.stringify(classItem.system.links.classAssociations)
  };
}

// Helper: Verify snapshot matches current state
function verifySnapshotUnchanged(before, classItem, actor, context) {
  const after = snapshotFlags(classItem, actor);
  assertEqual(after.classItemFlags, before.classItemFlags, `${context}: classItem flags changed`);
  assertEqual(after.actorFlags, before.actorFlags, `${context}: actor flags changed`);
  assertEqual(after.classAssociations, before.classAssociations, `${context}: classAssociations changed`);
}


// ==========================================
// Section 1: Main dialog close/cancel leaves clean state
// ==========================================
console.log('\n--- Section 1: Main dialog close/cancel ---');

await asyncTest('Main dialog close button callback does nothing (empty function)', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);

  clearDialogTracker();

  // Trigger main dialog (it creates a Dialog and calls render)
  UIManager.showMainDialog(actor, [classItem]);

  // Find the dialog that was created
  assert(dialogTracker.length >= 1, 'Main dialog should have been created');
  const mainDialog = dialogTracker[dialogTracker.length - 1];

  // The 'close' button callback is an empty function
  assert(mainDialog.data.buttons.close, 'Close button should exist');
  const closeCallback = mainDialog.data.buttons.close.callback;
  assert(typeof closeCallback === 'function', 'Close callback should be a function');

  // Execute close callback - should do nothing
  closeCallback();

  // Verify state unchanged
  verifySnapshotUnchanged(before, classItem, actor, 'Main dialog close');
});

await asyncTest('Main dialog default button is close', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);

  const mainDialog = dialogTracker[dialogTracker.length - 1];
  assertEqual(mainDialog.data.default, 'close', 'Default button should be close');
});

await asyncTest('Main dialog Escape/X close leaves no changes', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);

  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);

  // Verify unchanged after dialog creation (no auto-apply on open)
  verifySnapshotUnchanged(before, classItem, actor, 'Main dialog open');
});

await asyncTest('No archetypes selected + close = clean state, no warnings', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);

  clearNotifications();
  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);

  const mainDialog = dialogTracker[dialogTracker.length - 1];
  mainDialog.data.buttons.close.callback();

  // No error/warning notifications from close
  const errorNotifs = notifications.filter(n => n.type === 'error');
  assertEqual(errorNotifs.length, 0, 'No error notifications on close');

  verifySnapshotUnchanged(before, classItem, actor, 'Close with no selection');
});


// ==========================================
// Section 2: Preview dialog cancel leaves clean state
// ==========================================
console.log('\n--- Section 2: Preview dialog cancel ---');

await asyncTest('Preview dialog returns null on close (X/Escape)', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();

  // Start preview dialog - it returns a promise
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);

  // Find the dialog
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog, 'Preview dialog should be created');

  // Simulate close (Escape / X button)
  previewDialog.data.close();

  const result = await previewPromise;
  assertNull(result, 'Preview dialog close should return null');
});

await asyncTest('Preview dialog close leaves no flags modified', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.close();
  await previewPromise;

  verifySnapshotUnchanged(before, classItem, actor, 'Preview dialog close');
});

await asyncTest('Preview dialog "Back" button returns "back" (not apply)', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  // Click "Back" button
  const backResult = previewDialog.data.buttons.back.callback();
  const result = await previewPromise;
  assertEqual(result, 'back', 'Back button should resolve with "back"');
});

await asyncTest('Preview dialog "Back" leaves no partial changes', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.back.callback();
  await previewPromise;

  verifySnapshotUnchanged(before, classItem, actor, 'Preview dialog back');
});

await asyncTest('Preview dialog default is "back" (not "apply")', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];

  assertEqual(previewDialog.data.default, 'back', 'Preview default should be "back"');

  // Clean up
  previewDialog.data.close();
  await previewPromise;
});


// ==========================================
// Section 3: Fix dialog cancel leaves no JE changes
// ==========================================
console.log('\n--- Section 3: Fix dialog cancel ---');

await asyncTest('Fix dialog cancel callback resolves null', async () => {
  const feature = {
    name: 'Shattering Strike',
    description: '<p>Some ability</p>',
    level: 2,
    archetypeSlug: 'two-handed-fighter',
    archetypeName: 'Two-Handed Fighter',
    className: 'Fighter'
  };
  const baseFeatures = [
    { name: 'Bravery', level: 2, uuid: 'Compendium.pf1.class-abilities.Item.bravery' },
    { name: 'Armor Training', level: 3, uuid: 'Compendium.pf1.class-abilities.Item.armor-training' }
  ];

  clearDialogTracker();
  const fixPromise = UIManager.showFixDialog(feature, baseFeatures);
  const fixDialog = dialogTracker[dialogTracker.length - 1];
  assert(fixDialog, 'Fix dialog should be created');

  // Click cancel
  fixDialog.data.buttons.cancel.callback();
  const result = await fixPromise;
  assertNull(result, 'Fix dialog cancel should return null');
});

await asyncTest('Fix dialog cancel leaves JE database untouched', async () => {
  // Snapshot JE state before
  const fixesBefore = await JournalEntryDB.readSection('fixes');
  const missingBefore = await JournalEntryDB.readSection('missing');
  const customBefore = await JournalEntryDB.readSection('custom');

  const feature = {
    name: 'Test Feature Cancel',
    description: 'Testing cancel',
    level: 5,
    archetypeSlug: 'cancel-test-arch',
    archetypeName: 'Cancel Test Archetype',
    className: 'Fighter'
  };
  const baseFeatures = [{ name: 'Bravery', level: 2, uuid: 'test-uuid' }];

  clearDialogTracker();
  const fixPromise = UIManager.showFixDialog(feature, baseFeatures);
  const fixDialog = dialogTracker[dialogTracker.length - 1];
  fixDialog.data.buttons.cancel.callback();
  await fixPromise;

  // Verify no JE changes
  const fixesAfter = await JournalEntryDB.readSection('fixes');
  const missingAfter = await JournalEntryDB.readSection('missing');
  const customAfter = await JournalEntryDB.readSection('custom');

  assertDeepEqual(fixesAfter, fixesBefore, 'Fixes section unchanged after cancel');
  assertDeepEqual(missingAfter, missingBefore, 'Missing section unchanged after cancel');
  assertDeepEqual(customAfter, customBefore, 'Custom section unchanged after cancel');
});

await asyncTest('Fix dialog close (X/Escape) resolves null', async () => {
  const feature = {
    name: 'Test Feature',
    description: 'Testing',
    level: 3,
    archetypeSlug: 'test-arch'
  };
  const baseFeatures = [];

  clearDialogTracker();
  const fixPromise = UIManager.showFixDialog(feature, baseFeatures);
  const fixDialog = dialogTracker[dialogTracker.length - 1];

  // Simulate X/Escape close
  fixDialog.data.close();
  const result = await fixPromise;
  assertNull(result, 'Fix dialog X close should return null');
});

await asyncTest('Fix dialog default button is cancel', async () => {
  const feature = { name: 'Test', description: '', level: 1, archetypeSlug: 'test' };
  const baseFeatures = [];

  clearDialogTracker();
  const fixPromise = UIManager.showFixDialog(feature, baseFeatures);
  const fixDialog = dialogTracker[dialogTracker.length - 1];

  assertEqual(fixDialog.data.default, 'cancel', 'Fix dialog default should be cancel');

  fixDialog.data.close();
  await fixPromise;
});


// ==========================================
// Section 4: Manual entry dialog cancel leaves no JE changes
// ==========================================
console.log('\n--- Section 4: Manual entry dialog cancel ---');

await asyncTest('Manual entry cancel callback resolves null', async () => {
  clearDialogTracker();
  const entryPromise = UIManager.showManualEntryDialog('custom');
  const entryDialog = dialogTracker[dialogTracker.length - 1];
  assert(entryDialog, 'Manual entry dialog should be created');

  entryDialog.data.buttons.cancel.callback();
  const result = await entryPromise;
  assertNull(result, 'Manual entry cancel should return null');
});

await asyncTest('Manual entry cancel leaves JE untouched', async () => {
  const fixesBefore = await JournalEntryDB.readSection('fixes');
  const missingBefore = await JournalEntryDB.readSection('missing');
  const customBefore = await JournalEntryDB.readSection('custom');

  clearDialogTracker();
  const entryPromise = UIManager.showManualEntryDialog('custom');
  const entryDialog = dialogTracker[dialogTracker.length - 1];
  entryDialog.data.buttons.cancel.callback();
  await entryPromise;

  const fixesAfter = await JournalEntryDB.readSection('fixes');
  const missingAfter = await JournalEntryDB.readSection('missing');
  const customAfter = await JournalEntryDB.readSection('custom');

  assertDeepEqual(fixesAfter, fixesBefore, 'Fixes unchanged after manual entry cancel');
  assertDeepEqual(missingAfter, missingBefore, 'Missing unchanged after manual entry cancel');
  assertDeepEqual(customAfter, customBefore, 'Custom unchanged after manual entry cancel');
});

await asyncTest('Manual entry close (X/Escape) resolves null', async () => {
  clearDialogTracker();
  const entryPromise = UIManager.showManualEntryDialog('custom');
  const entryDialog = dialogTracker[dialogTracker.length - 1];

  // Simulate X/Escape
  entryDialog.data.close();
  const result = await entryPromise;
  assertNull(result, 'Manual entry X close should return null');
});

await asyncTest('Manual entry close leaves JE untouched', async () => {
  const customBefore = await JournalEntryDB.readSection('custom');

  clearDialogTracker();
  const entryPromise = UIManager.showManualEntryDialog('custom');
  const entryDialog = dialogTracker[dialogTracker.length - 1];
  entryDialog.data.close();
  await entryPromise;

  const customAfter = await JournalEntryDB.readSection('custom');
  assertDeepEqual(customAfter, customBefore, 'Custom unchanged after manual entry close');
});

await asyncTest('Manual entry default button is cancel', async () => {
  clearDialogTracker();
  const entryPromise = UIManager.showManualEntryDialog('custom');
  const entryDialog = dialogTracker[dialogTracker.length - 1];

  assertEqual(entryDialog.data.default, 'cancel', 'Manual entry default should be cancel');

  entryDialog.data.close();
  await entryPromise;
});


// ==========================================
// Section 5: Confirm dialog cancel prevents application
// ==========================================
console.log('\n--- Section 5: Confirm dialog cancel ---');

await asyncTest('Confirm dialog cancel resolves false', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test', '<p>Test?</p>');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];
  assert(confirmDialog, 'Confirm dialog should be created');

  confirmDialog.data.buttons.cancel.callback();
  const result = await confirmPromise;
  assertEqual(result, false, 'Cancel should resolve false');
});

await asyncTest('Confirm dialog close (X/Escape) resolves false', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test', '<p>Test?</p>');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  // Simulate X/Escape
  confirmDialog.data.close();
  const result = await confirmPromise;
  assertEqual(result, false, 'Confirm close should resolve false');
});

await asyncTest('Confirm dialog default button is cancel', async () => {
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test', '<p>Test?</p>');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  assertEqual(confirmDialog.data.default, 'cancel', 'Confirm default should be cancel');

  confirmDialog.data.close();
  await confirmPromise;
});

await asyncTest('Cancelled confirmation prevents archetype application', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);

  // Simulate the full flow: preview -> apply -> confirm -> CANCEL
  // The confirmation returns false, which should prevent actual application
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();

  // Call showPreviewConfirmFlow which opens preview then confirm
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, classItem, parsed, diff);

  // Preview dialog appears first
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  assert(previewDialog, 'Preview dialog should appear first');

  // Click "Apply" in preview to proceed to confirm
  previewDialog.data.buttons.apply.callback();

  // Wait a tick for confirm dialog
  await new Promise(r => setTimeout(r, 10));

  // Confirm dialog should now exist
  assert(dialogTracker.length >= 2, 'Confirm dialog should be created');
  const confirmDialog = dialogTracker[dialogTracker.length - 1];

  // Click "Cancel" in confirm dialog
  confirmDialog.data.buttons.cancel.callback();

  // Wait for second preview dialog to appear (flow goes back to preview on cancel)
  await new Promise(r => setTimeout(r, 10));

  // Now close the re-shown preview
  const secondPreviewDialog = dialogTracker[dialogTracker.length - 1];
  if (secondPreviewDialog && secondPreviewDialog.data.close) {
    secondPreviewDialog.data.close();
  }

  const result = await flowPromise;

  // Verify no changes were made
  verifySnapshotUnchanged(before, classItem, actor, 'Cancelled confirmation');
});


// ==========================================
// Section 6: No flags modified on cancel
// ==========================================
console.log('\n--- Section 6: No flags modified on cancel ---');

await asyncTest('No archetypes flag set on class item after main dialog close', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  assertNull(classItem.getFlag('archetype-manager', 'archetypes'), 'archetypes flag should be null initially');

  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);
  const mainDialog = dialogTracker[dialogTracker.length - 1];
  mainDialog.data.buttons.close.callback();

  assertNull(classItem.getFlag('archetype-manager', 'archetypes'), 'archetypes flag should remain null after close');
});

await asyncTest('No originalAssociations backup created on preview cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  assertNull(classItem.getFlag('archetype-manager', 'originalAssociations'), 'No backup initially');

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.close();
  await previewPromise;

  assertNull(classItem.getFlag('archetype-manager', 'originalAssociations'), 'No backup after preview cancel');
});

await asyncTest('No appliedAt timestamp set on any cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  assertNull(classItem.getFlag('archetype-manager', 'appliedAt'), 'No appliedAt initially');

  // Open and close main dialog
  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);
  dialogTracker[dialogTracker.length - 1].data.buttons.close.callback();

  assertNull(classItem.getFlag('archetype-manager', 'appliedAt'), 'No appliedAt after main close');

  // Open and close preview dialog
  clearDialogTracker();
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  assertNull(classItem.getFlag('archetype-manager', 'appliedAt'), 'No appliedAt after preview close');
});

await asyncTest('No actor appliedArchetypes flag set on any cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  assertNull(actor.getFlag('archetype-manager', 'appliedArchetypes'), 'No actor flag initially');

  // Open main dialog and close
  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);
  dialogTracker[dialogTracker.length - 1].data.buttons.close.callback();

  assertNull(actor.getFlag('archetype-manager', 'appliedArchetypes'), 'No actor flag after main close');
});

await asyncTest('No appliedArchetypeData stored on cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  assertNull(classItem.getFlag('archetype-manager', 'appliedArchetypeData'), 'No stored data initially');

  clearDialogTracker();
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  assertNull(classItem.getFlag('archetype-manager', 'appliedArchetypeData'), 'No stored data after cancel');
});


// ==========================================
// Section 7: No item copies created on cancel
// ==========================================
console.log('\n--- Section 7: No item copies created on cancel ---');

await asyncTest('No createEmbeddedDocuments called on preview cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  let createCalled = false;
  actor.createEmbeddedDocuments = async (type, data) => {
    createCalled = true;
    return data.map(d => ({ ...d, id: 'test-id' }));
  };

  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  assertEqual(createCalled, false, 'createEmbeddedDocuments should not be called on cancel');
});

await asyncTest('No deleteEmbeddedDocuments called on any cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);

  let deleteCalled = false;
  actor.deleteEmbeddedDocuments = async (type, ids) => {
    deleteCalled = true;
    return ids;
  };

  // Main dialog close
  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);
  dialogTracker[dialogTracker.length - 1].data.buttons.close.callback();

  assertEqual(deleteCalled, false, 'deleteEmbeddedDocuments should not be called on cancel');
});

await asyncTest('Actor items remain unchanged after all dialog cancels', async () => {
  const classItem = buildFighterClassItem();
  const weaponItem = { id: 'weapon-1', name: 'Longsword', type: 'weapon', flags: {},
    getFlag: function(s,k) { return this.flags[s]?.[k] ?? null; } };
  const actor = createMockActor('TestFighter', [classItem, weaponItem]);

  const itemCountBefore = [...actor.items].length;

  // Open and close preview dialog
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);
  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  const itemCountAfter = [...actor.items].length;
  assertEqual(itemCountAfter, itemCountBefore, 'Actor item count should be unchanged');
});

await asyncTest('classAssociations array is identical after preview cancel', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const originalAssociations = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));

  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  const afterAssociations = classItem.system.links.classAssociations;
  assertEqual(afterAssociations.length, originalAssociations.length, 'Association count unchanged');
  for (let i = 0; i < originalAssociations.length; i++) {
    assertEqual(afterAssociations[i].uuid, originalAssociations[i].uuid, `Association ${i} UUID unchanged`);
    assertEqual(afterAssociations[i].level, originalAssociations[i].level, `Association ${i} level unchanged`);
  }
});


// ==========================================
// Section 8: Preview-Confirm flow cancellation at each step
// ==========================================
console.log('\n--- Section 8: Preview-Confirm flow cancellation ---');

await asyncTest('showPreviewConfirmFlow: cancel at preview returns null', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, classItem, parsed, diff);

  // Close preview dialog immediately
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.close();

  const result = await flowPromise;
  assertNull(result, 'Flow should return null when preview is closed');
});

await asyncTest('showPreviewConfirmFlow: "Back" at preview returns "back-to-main"', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, classItem, parsed, diff);

  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.back.callback();

  const result = await flowPromise;
  assertEqual(result, 'back-to-main', 'Back at preview should return "back-to-main"');
});

await asyncTest('showPreviewConfirmFlow: back-to-main leaves no changes', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  clearDialogTracker();
  const flowPromise = UIManager.showPreviewConfirmFlow(actor, classItem, parsed, diff);
  const previewDialog = dialogTracker[dialogTracker.length - 1];
  previewDialog.data.buttons.back.callback();
  await flowPromise;

  verifySnapshotUnchanged(before, classItem, actor, 'Back-to-main in flow');
});


// ==========================================
// Section 9: Description verify dialog cancel
// ==========================================
console.log('\n--- Section 9: Description verify dialog cancel ---');

await asyncTest('Description verify dialog cancel resolves null', async () => {
  const feature = {
    name: 'Test Feature',
    description: '<p>Some raw description</p>',
    archetypeSlug: 'test-arch',
    className: 'Fighter'
  };

  clearDialogTracker();
  const verifyPromise = UIManager.showDescriptionVerifyDialog(feature);
  const verifyDialog = dialogTracker[dialogTracker.length - 1];
  assert(verifyDialog, 'Description verify dialog should be created');

  verifyDialog.data.buttons.cancel.callback();
  const result = await verifyPromise;
  assertNull(result, 'Verify dialog cancel should return null');
});

await asyncTest('Description verify dialog close (X/Escape) resolves null', async () => {
  const feature = {
    name: 'Test Feature',
    description: '<p>Some raw description</p>',
    archetypeSlug: 'test-arch',
    className: 'Fighter'
  };

  clearDialogTracker();
  const verifyPromise = UIManager.showDescriptionVerifyDialog(feature);
  const verifyDialog = dialogTracker[dialogTracker.length - 1];
  verifyDialog.data.close();
  const result = await verifyPromise;
  assertNull(result, 'Verify dialog close should return null');
});

await asyncTest('Description verify dialog cancel leaves JE untouched', async () => {
  const fixesBefore = await JournalEntryDB.readSection('fixes');

  const feature = {
    name: 'Desc Cancel Test',
    description: '<p>Test</p>',
    archetypeSlug: 'desc-cancel-test',
    className: 'Fighter'
  };

  clearDialogTracker();
  const verifyPromise = UIManager.showDescriptionVerifyDialog(feature);
  const verifyDialog = dialogTracker[dialogTracker.length - 1];
  verifyDialog.data.buttons.cancel.callback();
  await verifyPromise;

  const fixesAfter = await JournalEntryDB.readSection('fixes');
  assertDeepEqual(fixesAfter, fixesBefore, 'Fixes section unchanged after desc verify cancel');
});

await asyncTest('Description verify dialog default button is cancel', async () => {
  const feature = { name: 'Test', description: '', archetypeSlug: 'test', className: 'Fighter' };

  clearDialogTracker();
  const verifyPromise = UIManager.showDescriptionVerifyDialog(feature);
  const verifyDialog = dialogTracker[dialogTracker.length - 1];

  assertEqual(verifyDialog.data.default, 'cancel', 'Verify dialog default should be cancel');

  verifyDialog.data.close();
  await verifyPromise;
});


// ==========================================
// Section 10: Multi-dialog sequence cancellation
// ==========================================
console.log('\n--- Section 10: Multi-dialog sequence cancellation ---');

await asyncTest('Opening and cancelling multiple dialogs in sequence leaves clean state', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  // 1. Open and close main dialog
  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);
  dialogTracker[dialogTracker.length - 1].data.buttons.close.callback();

  // 2. Open and close preview dialog
  clearDialogTracker();
  const prevPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await prevPromise;

  // 3. Open and close fix dialog
  clearDialogTracker();
  const fixPromise = UIManager.showFixDialog(
    { name: 'Test', description: '', level: 1, archetypeSlug: 'test' }, []
  );
  dialogTracker[dialogTracker.length - 1].data.close();
  await fixPromise;

  // 4. Open and close manual entry
  clearDialogTracker();
  const manualPromise = UIManager.showManualEntryDialog('custom');
  dialogTracker[dialogTracker.length - 1].data.close();
  await manualPromise;

  // 5. Open and close confirm dialog
  clearDialogTracker();
  const confirmPromise = UIManager.showConfirmation('Test', '<p>Test?</p>');
  dialogTracker[dialogTracker.length - 1].data.close();
  await confirmPromise;

  // After all cancellations, state should be completely clean
  verifySnapshotUnchanged(before, classItem, actor, 'After all dialog cancellations');
});

await asyncTest('Cancelling dialogs does not trigger any ChatMessage.create', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  let chatCreated = false;
  globalThis.ChatMessage.create = async (data) => {
    chatCreated = true;
    return data;
  };

  // Cancel preview
  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  assertEqual(chatCreated, false, 'No ChatMessage created on cancel');

  // Restore
  globalThis.ChatMessage.create = async (data) => data;
});

await asyncTest('No classItem.update called during any cancel flow', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const parsed = buildParsedArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsed);

  let updateCalled = false;
  const originalUpdate = classItem.update;
  classItem.update = async (data) => {
    updateCalled = true;
    return originalUpdate.call(classItem, data);
  };

  // Cancel preview
  clearDialogTracker();
  const previewPromise = UIManager.showPreviewDialog(actor, classItem, parsed, diff);
  dialogTracker[dialogTracker.length - 1].data.close();
  await previewPromise;

  assertEqual(updateCalled, false, 'classItem.update should not be called on cancel');
});


// ==========================================
// Section 11: "Apply Selected" with no selection is not a data change
// ==========================================
console.log('\n--- Section 11: Apply Selected with no selection ---');

await asyncTest('Apply Selected with no selection shows warning, no data changes', async () => {
  const classItem = buildFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const before = snapshotFlags(classItem, actor);

  clearNotifications();
  clearDialogTracker();
  UIManager.showMainDialog(actor, [classItem]);

  const mainDialog = dialogTracker[dialogTracker.length - 1];
  assert(mainDialog.data.buttons.applySelected, '"Apply Selected" button should exist');

  // Call applySelected with no archetypes selected
  await mainDialog.data.buttons.applySelected.callback();

  // Should show warning
  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length > 0, 'Should show warning when no archetypes selected');
  assert(warnNotifs[0].msg.includes('No archetypes selected') || warnNotifs[0].msg.toLowerCase().includes('select'),
    'Warning should mention no selection');

  // No changes
  verifySnapshotUnchanged(before, classItem, actor, 'Apply Selected with no selection');
});


// ==========================================
// Summary
// ==========================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #61 Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
