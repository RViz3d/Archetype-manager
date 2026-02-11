/**
 * Test Suite for Feature #87: Tooltips on all interactive elements
 *
 * Verifies that tooltips provide context for all interactive UI elements:
 * 1. Conflict warning icon -> tooltip
 * 2. Status icon in preview -> tooltip
 * 3. Info button -> tooltip
 * 4. Add archetype button -> tooltip
 * 5. Tooltips visible and readable
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

function assertIncludes(str, sub, message) {
  if (!str || !str.includes(sub)) {
    throw new Error(`${message || 'String inclusion failed'}: "${str && str.substring(0, 300)}" does not include "${sub}"`);
  }
}

// Set up environment
setupMockEnvironment();

// Register required settings
game.settings.register('archetype-manager', 'lastSelectedClass', {
  scope: 'client', config: false, type: String, default: ''
});
game.settings.register('archetype-manager', 'showParseWarnings', {
  scope: 'world', config: true, type: Boolean, default: true
});

// Notification capture
let notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', message: msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', message: msg }); },
  error: (msg) => { notifications.push({ type: 'error', message: msg }); }
};

globalThis.ChatMessage = { create: async (data) => data };
globalThis.fromUuid = async (uuid) => null;

// Import modules
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');

console.log('\n=== Feature #87: Tooltips on all interactive elements ===\n');

// ============================================================
// Section 1: Conflict warning icon has tooltip
// ============================================================
console.log('\n--- Section 1: Conflict warning icon -> tooltip ---');

test('Conflict warning HTML template includes title attribute', () => {
  const source = UIManager.showMainDialog.toString();
  // The conflict-warning span should have a title attribute with descriptive text
  assertIncludes(source, 'conflict-warning', 'Should have conflict-warning class');
  assertIncludes(source, 'title="Conflicts', 'Conflict icon should have title starting with "Conflicts"');
});

test('Conflict warning tooltip includes conflicting feature names', () => {
  const source = UIManager.showMainDialog.toString();
  // The title should dynamically include conflict names
  assertIncludes(source, 'Conflicts with applied archetype(s)', 'Tooltip should describe the conflict with archetype names');
});

test('Conflict warning title attribute contains descriptive text (not empty)', () => {
  const source = UIManager.showMainDialog.toString();
  // Look for title="Conflicts... pattern — must not be empty
  const titleMatch = source.match(/title="Conflicts[^"]+"/);
  assert(titleMatch !== null, 'Conflict warning should have non-empty title attribute with "Conflicts" text');
  assert(titleMatch[0].length > 10, 'Title should contain meaningful descriptive text');
});

// ============================================================
// Section 2: Status icons in preview have tooltips
// ============================================================
console.log('\n--- Section 2: Status icon in preview -> tooltip ---');

test('Unchanged status icon has title="Unchanged"', () => {
  const diff = [{ status: 'unchanged', name: 'Bonus Feats', level: 1 }];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const icon = container.querySelector('.preview-unchanged .status-icon');
  assertEqual(icon.getAttribute('title'), 'Unchanged', 'Unchanged icon should have title "Unchanged"');
});

test('Removed status icon has title="Removed"', () => {
  const diff = [{ status: 'removed', name: 'Bravery', level: 2 }];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const icon = container.querySelector('.preview-removed .status-icon');
  assertEqual(icon.getAttribute('title'), 'Removed', 'Removed icon should have title "Removed"');
});

test('Added status icon has title="Added"', () => {
  const diff = [{ status: 'added', name: 'Strike', level: 2, archetypeFeature: {} }];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const icon = container.querySelector('.preview-added .status-icon');
  assertEqual(icon.getAttribute('title'), 'Added', 'Added icon should have title "Added"');
});

test('Modified status icon has title="Modified"', () => {
  const diff = [{ status: 'modified', name: 'Training', level: 5 }];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const icon = container.querySelector('.preview-modified .status-icon');
  assertEqual(icon.getAttribute('title'), 'Modified', 'Modified icon should have title "Modified"');
});

test('All status icons in mixed diff have non-empty title attributes', () => {
  const diff = [
    { status: 'unchanged', name: 'A', level: 1 },
    { status: 'removed', name: 'B', level: 2 },
    { status: 'added', name: 'C', level: 3, archetypeFeature: {} },
    { status: 'modified', name: 'D', level: 4 }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const icons = container.querySelectorAll('.status-icon');
  assertEqual(icons.length, 4, 'Should have 4 status icons');
  icons.forEach(icon => {
    const title = icon.getAttribute('title');
    assert(title && title.length > 0, `Status icon should have non-empty title: ${icon.outerHTML}`);
  });
});

// ============================================================
// Section 3: Info buttons have tooltips
// ============================================================
console.log('\n--- Section 3: Info button -> tooltip ---');

test('Info button in preview dialog has title attribute', () => {
  const diff = [
    { status: 'added', name: 'Shattering Strike', level: 2, archetypeFeature: { description: 'A powerful strike' } }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const infoBtn = container.querySelector('.info-btn');
  assert(infoBtn !== null, 'Should have an info button');
  const title = infoBtn.getAttribute('title');
  assert(title && title.length > 0, 'Info button should have a non-empty title attribute');
  assertIncludes(title, 'description', 'Info button title should mention "description"');
});

test('Info button in main dialog has title attribute', () => {
  const source = UIManager.showMainDialog.toString();
  // The info-btn in the archetype list should have a title
  const infoMatch = source.match(/info-btn[^>]*title="([^"]+)"/);
  assert(infoMatch !== null, 'Info button should have a title attribute');
  assert(infoMatch[1].length > 0, 'Info button title should not be empty');
});

test('Info button tooltip text is descriptive (e.g., "Show description" or "Info")', () => {
  // Check the preview info button
  const diff = [
    { status: 'added', name: 'Test Feature', level: 2, archetypeFeature: { description: 'Desc' } }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const infoBtn = container.querySelector('.info-btn');
  const title = infoBtn.getAttribute('title');
  // Should be "Show description" or "Info"
  assert(
    title === 'Show description' || title === 'Info' || title.toLowerCase().includes('info') || title.toLowerCase().includes('description'),
    `Info button title should be descriptive: got "${title}"`
  );
});

// ============================================================
// Section 4: Add archetype / Add feature buttons have tooltips
// ============================================================
console.log('\n--- Section 4: Add archetype button -> tooltip ---');

test('Add Archetype button in main dialog has label (acts as tooltip in FoundryVTT)', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('TooltipTest1', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  // FoundryVTT Dialog buttons are rendered with labels that serve as tooltips
  assert(dialogData.buttons.addCustom, 'Should have addCustom button');
  assert(dialogData.buttons.addCustom.label, 'addCustom button should have a label');
  assertIncludes(dialogData.buttons.addCustom.label, 'Add', 'Label should contain "Add"');
  assertIncludes(dialogData.buttons.addCustom.label, 'Archetype', 'Label should contain "Archetype"');
});

test('Add Archetype button has icon element', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('TooltipTest2', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  assert(dialogData.buttons.addCustom.icon, 'addCustom button should have an icon');
  assertIncludes(dialogData.buttons.addCustom.icon, 'fa-plus', 'Icon should be fa-plus');
});

test('Apply Selected button has descriptive label', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('TooltipTest3', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  assert(dialogData.buttons.applySelected, 'Should have applySelected button');
  assertIncludes(dialogData.buttons.applySelected.label, 'Apply', 'Label should contain "Apply"');
});

test('Close button has descriptive label', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('TooltipTest4', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  assert(dialogData.buttons.close, 'Should have close button');
  assertIncludes(dialogData.buttons.close.label, 'Close', 'Label should contain "Close"');
});

test('Add Feature button in manual entry has title attribute', () => {
  const html = UIManager._buildManualEntryHTML('custom');
  const container = document.createElement('div');
  container.innerHTML = html;
  const addBtn = container.querySelector('.add-feature-btn');
  assert(addBtn !== null, 'Should have add-feature-btn');
  const title = addBtn.getAttribute('title');
  assert(title && title.length > 0, 'Add Feature button should have a non-empty title attribute');
});

test('Remove feature button in manual entry has title attribute', () => {
  const html = UIManager._buildManualEntryHTML('custom');
  const container = document.createElement('div');
  container.innerHTML = html;
  const removeBtn = container.querySelector('.remove-feature-btn');
  assert(removeBtn !== null, 'Should have remove-feature-btn');
  const title = removeBtn.getAttribute('title');
  assert(title && title.length > 0, 'Remove feature button should have non-empty title');
  assertIncludes(title, 'Remove', 'Remove button title should contain "Remove"');
});

// ============================================================
// Section 5: Tooltips visible and readable
// ============================================================
console.log('\n--- Section 5: Tooltips visible and readable ---');

test('Status icon titles match their visual labels (Unchanged, Removed, Added, Modified)', () => {
  const diff = [
    { status: 'unchanged', name: 'A', level: 1 },
    { status: 'removed', name: 'B', level: 2 },
    { status: 'added', name: 'C', level: 3, archetypeFeature: {} },
    { status: 'modified', name: 'D', level: 4 }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;

  const expectedTitles = {
    'preview-unchanged': 'Unchanged',
    'preview-removed': 'Removed',
    'preview-added': 'Added',
    'preview-modified': 'Modified'
  };

  for (const [rowClass, expectedTitle] of Object.entries(expectedTitles)) {
    const row = container.querySelector(`.${rowClass}`);
    const icon = row.querySelector('.status-icon');
    assertEqual(icon.getAttribute('title'), expectedTitle, `${rowClass} icon title should be "${expectedTitle}"`);
  }
});

test('Tooltip text is human-readable (no technical jargon, no code)', () => {
  const diff = [
    { status: 'unchanged', name: 'A', level: 1 },
    { status: 'removed', name: 'B', level: 2 },
    { status: 'added', name: 'C', level: 3, archetypeFeature: {} },
    { status: 'modified', name: 'D', level: 4 }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('[title]').forEach(el => {
    const title = el.getAttribute('title');
    assert(title.length > 0, 'Title should not be empty');
    assert(title.length < 200, `Title should be concise (< 200 chars): "${title}"`);
    // Should not contain raw code patterns
    assert(!title.includes('${'), 'Title should not contain template literal syntax');
    assert(!title.includes('undefined'), 'Title should not contain "undefined"');
    assert(!title.includes('null'), 'Title should not contain "null"');
    assert(!title.includes('[object'), 'Title should not contain [object');
  });
});

test('Preview dialog buttons (Apply, Back) have labels that act as tooltips', () => {
  // The preview dialog uses Dialog API buttons which have labels
  const source = UIManager.showPreviewDialog.toString();
  assertIncludes(source, "'Apply'", 'Apply button should have label');
  assertIncludes(source, "'Back'", 'Back button should have label');
});

test('Confirmation dialog buttons (Confirm, Cancel) have labels', () => {
  const source = UIManager.showConfirmation.toString();
  assertIncludes(source, "'Confirm'", 'Confirm button should have label');
  assertIncludes(source, "'Cancel'", 'Cancel button should have label');
});

test('Fix dialog buttons (Save Fix, Cancel) have labels', () => {
  const source = UIManager.showFixDialog.toString();
  assertIncludes(source, "'Save Fix'", 'Save Fix button should have label');
  assertIncludes(source, "'Cancel'", 'Cancel button should have label');
});

test('Manual entry dialog buttons (Save, Cancel) have labels', () => {
  const source = UIManager.showManualEntryDialog.toString();
  assertIncludes(source, "'Save'", 'Save button should have label');
  assertIncludes(source, "'Cancel'", 'Cancel button should have label');
});

test('Description verify dialog buttons (Save Correction, Cancel) have labels', () => {
  const source = UIManager.showDescriptionVerifyDialog.toString();
  assertIncludes(source, "'Save Correction'", 'Save Correction button should have label');
  assertIncludes(source, "'Cancel'", 'Cancel button should have label');
});

test('Source type icon in main dialog has title attribute', () => {
  // The source icon (compendium, missing, custom) should have a title
  const source = UIManager.showMainDialog.toString();
  assertIncludes(source, 'title="${sourceLabel}"', 'Source icon should use sourceLabel as title');
});

test('Applied archetype tag in main dialog has title indicating "Applied"', () => {
  const source = UIManager.showMainDialog.toString();
  assertIncludes(source, 'title="Applied"', 'Applied tag icon should have title "Applied"');
});

// ============================================================
// Section 6: All dialog buttons have icon + label combo
// ============================================================
console.log('\n--- Section 6: All dialog buttons have icon + label ---');

test('Main dialog: all buttons have both icon and label', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('TooltipTest5', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  for (const [key, btn] of Object.entries(dialogData.buttons)) {
    assert(btn.icon, `Button "${key}" should have an icon`);
    assert(btn.label, `Button "${key}" should have a label`);
    assertIncludes(btn.icon, '<i ', `Button "${key}" icon should contain an <i> element`);
    assert(btn.label.length > 0, `Button "${key}" label should not be empty`);
  }
});

test('Preview dialog buttons have icons with <i> elements', () => {
  const source = UIManager.showPreviewDialog.toString();
  // Apply button icon
  assertIncludes(source, 'fa-check', 'Apply button should have check icon');
  // Back button icon
  assertIncludes(source, 'fa-arrow-left', 'Back button should have arrow-left icon');
});

test('Confirmation dialog buttons have icons with <i> elements', () => {
  const source = UIManager.showConfirmation.toString();
  assertIncludes(source, 'fa-check', 'Confirm button should have check icon');
  assertIncludes(source, 'fa-times', 'Cancel button should have times icon');
});

// ============================================================
// Section 7: Tooltip on dynamically-created elements
// ============================================================
console.log('\n--- Section 7: Dynamically-created element tooltips ---');

test('Dynamically added remove-feature-btn in manual entry has title', () => {
  // The dynamic row creation code should also include title
  const source = UIManager.showManualEntryDialog.toString();
  assertIncludes(source, 'remove-feature-btn', 'Should generate remove-feature-btn elements');
  assertIncludes(source, 'title="Remove"', 'Dynamic remove button should have title="Remove"');
});

test('Preview info buttons always have title="Show description"', () => {
  // Verify info buttons in preview have tooltip
  const diff = [
    { status: 'added', name: 'Feature A', level: 1, archetypeFeature: { description: 'Desc A' } },
    { status: 'modified', name: 'Feature B', level: 2, archetypeFeature: { description: 'Desc B' } }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const infoBtns = container.querySelectorAll('.info-btn');
  assertEqual(infoBtns.length, 2, 'Should have 2 info buttons');
  infoBtns.forEach(btn => {
    assertEqual(btn.getAttribute('title'), 'Show description', 'Each info button should have "Show description" title');
  });
});

test('Unchanged and removed rows do NOT have info buttons (no spurious tooltips)', () => {
  const diff = [
    { status: 'unchanged', name: 'A', level: 1 },
    { status: 'removed', name: 'B', level: 2 }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test' }, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  const infoBtns = container.querySelectorAll('.info-btn');
  assertEqual(infoBtns.length, 0, 'Unchanged and removed rows should not have info buttons');
});

// Print summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #87 Results: ${passed}/${totalTests} passing`);
if (failed > 0) {
  console.log(`  ${failed} FAILED`);
  process.exit(1);
} else {
  console.log('  All tests passed!');
}
