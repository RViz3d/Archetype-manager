/**
 * Test Suite for Feature #95: Class dropdown defaults to first class
 *
 * Verifies that the main dialog defaults to the first class item when opened
 * for a multi-class actor (with no saved lastSelectedClass):
 * - First class option is selected by default in the dropdown
 * - Archetype list populated for the default (first) class
 * - Works for single-class, dual-class, triple-class actors
 * - No explicit 'selected' attribute needed — HTML select defaults to first option
 * - When lastSelectedClass is empty/unset, first class wins
 *
 * Steps:
 * 1. Open dialog for multi-class actor
 * 2. First class selected by default
 * 3. Archetype list populated for default class
 */

import { setupMockEnvironment, createMockClassItem, createMockActor, resetMockEnvironment } from './foundry-mock.mjs';

var passed = 0;
var failed = 0;
var totalTests = 0;

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

function assertNotNull(actual, message) {
  if (actual === null || actual === undefined) {
    throw new Error(`${message || 'Expected non-null value'}: got ${JSON.stringify(actual)}`);
  }
}

// ==========================================
// Helper: capture dialog and wait for async render
// ==========================================

/**
 * Capture the last dialog created by showMainDialog and wait for async render.
 * Returns the dialog instance after the render callback's async code completes.
 */
async function captureDialog(UIManager, actor, classItems) {
  await UIManager.showMainDialog(actor, classItems);
  // Wait for any async operations (loadArchetypes) triggered in render
  await new Promise(r => setTimeout(r, 100));
  return globalThis.Dialog._lastInstance;
}

/**
 * Parse dialog content HTML and return the select element's state
 */
function parseDialogSelect(dialogContent) {
  const div = document.createElement('div');
  div.innerHTML = dialogContent;
  const select = div.querySelector('.class-select');
  const options = select ? [...select.querySelectorAll('option')] : [];
  return { div, select, options };
}

// ==========================================
// Environment Setup
// ==========================================
var env = setupMockEnvironment();

// Import module and fire hooks
await import('../scripts/module.mjs');
await env.hooks.callAll('init');
await env.hooks.callAll('ready');

// Import UIManager
const { UIManager } = await import('../scripts/ui-manager.mjs');

console.log('\n=== Feature #95: Class dropdown defaults to first class ===\n');

// ==========================================
// Section 1: First class selected by default (no lastSelectedClass)
// ==========================================
console.log('--- Section 1: First class selected by default (no lastSelectedClass) ---');

await asyncTest('No lastSelectedClass: first option is naturally first in dropdown for dual-class actor', async () => {
  // Reset lastSelectedClass to empty (fresh state)
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Dual-Class Hero', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  assertNotNull(dialog, 'Dialog should be created');

  // Parse the content to check option ordering
  const { options } = parseDialogSelect(dialog.data.content);
  assert(options.length === 2, `Should have 2 options, got ${options.length}`);

  // First option should be Fighter
  assert(options[0].textContent.includes('Fighter'), `First option should be Fighter, got "${options[0].textContent}"`);
  assertEqual(options[0].value, fighterClass.id, 'First option value should be Fighter id');
});

await asyncTest('No lastSelectedClass: Fighter option has no "selected" attr and neither does Rogue (browser uses first by default)', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Dual-Class Hero', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const content = dialog.data.content;

  // When lastSelectedClass is empty, no option should have the 'selected' attribute
  // OR the first option could have it - either way, the browser defaults to first
  const { options } = parseDialogSelect(content);

  // Verify the first option is Fighter
  assert(options[0].textContent.includes('Fighter'), 'First option should be Fighter');

  // If neither option has 'selected', browser defaults to first - which is correct
  // If first has 'selected', that's also correct
  const rogueHasSelected = options[1].hasAttribute('selected');
  assert(!rogueHasSelected, 'Rogue (second class) should NOT have selected attribute when no lastSelectedClass');
});

await asyncTest('Single-class actor: only option is the one class (defaults naturally)', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const wizardClass = createMockClassItem('Wizard', 10, 'wiz');
  const classItems = [wizardClass];
  const actor = createMockActor('Solo Wizard', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options.length, 1, 'Should have exactly 1 option');
  assert(options[0].textContent.includes('Wizard'), 'Only option should be Wizard');
  assertEqual(options[0].value, wizardClass.id, 'Option value should match Wizard id');
});

await asyncTest('Triple-class actor: first class (Fighter) is first in dropdown by default', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const wizardClass = createMockClassItem('Wizard', 5, 'wiz');
  const clericClass = createMockClassItem('Cleric', 3, 'clr');
  const classItems = [fighterClass, wizardClass, clericClass];
  const actor = createMockActor('Triple-Class Hero', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options.length, 3, 'Should have 3 options');
  assert(options[0].textContent.includes('Fighter'), `First option should be Fighter, got "${options[0].textContent}"`);
  assert(options[1].textContent.includes('Wizard'), `Second option should be Wizard, got "${options[1].textContent}"`);
  assert(options[2].textContent.includes('Cleric'), `Third option should be Cleric, got "${options[2].textContent}"`);
});

await asyncTest('Order of classItems determines dropdown order (Rogue first, then Fighter)', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  // Rogue is first in classItems array
  const classItems = [rogueClass, fighterClass];
  const actor = createMockActor('Rogue-Fighter', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options.length, 2, 'Should have 2 options');
  assert(options[0].textContent.includes('Rogue'), `First option should be Rogue (first in classItems), got "${options[0].textContent}"`);
  assert(options[1].textContent.includes('Fighter'), `Second option should be Fighter, got "${options[1].textContent}"`);
});

// ==========================================
// Section 2: Render callback triggers loadArchetypes for default class
// ==========================================
console.log('\n--- Section 2: loadArchetypes called on dialog open for default class ---');

await asyncTest('Render callback triggers loadArchetypes on initial open (classItems.length > 0)', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Loader Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  assertNotNull(dialog, 'Dialog should be created');

  // After render, loadArchetypes should have run — which saves the selected class
  // The first class should have been selected by the browser default (Fighter is first option)
  // loadArchetypes reads classSelect.value — which is the first option's value
  // Then it saves that as lastSelectedClass
  const savedClass = game.settings.get('archetype-manager', 'lastSelectedClass');
  // Should be the Fighter's id since it's the first option
  assertEqual(savedClass, fighterClass.id,
    `loadArchetypes should save first class id. Expected "${fighterClass.id}", got "${savedClass}"`);
});

await asyncTest('After render, archetype list element is populated (or shows empty-state for no compendium)', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('List Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  // After render + loadArchetypes, the archetype list element should have content
  // (even if it's the "no archetypes available" empty state)
  const element = dialog._element;
  assertNotNull(element, 'Dialog should have rendered element');

  const archetypeListEl = element.querySelector('.archetype-list');
  assertNotNull(archetypeListEl, 'Should have archetype list element');

  // The list should have some content (empty-state message or actual items)
  const innerContent = archetypeListEl.innerHTML;
  assert(innerContent.length > 0, 'Archetype list should have content after initial load');
});

await asyncTest('Loading indicator is hidden after initial load completes', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const classItems = [fighterClass];
  const actor = createMockActor('Loading Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;
  assertNotNull(element, 'Dialog should have rendered element');

  const loadingIndicator = element.querySelector('.loading-indicator');
  assertNotNull(loadingIndicator, 'Should have loading indicator element');

  // After load completes, indicator should be hidden
  assertEqual(loadingIndicator.style.display, 'none', 'Loading indicator should be hidden after load');
});

await asyncTest('Class select element exists and has correct value after render for first class', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Select Value Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;
  assertNotNull(element, 'Dialog should have rendered element');

  const classSelect = element.querySelector('.class-select');
  assertNotNull(classSelect, 'Should have class-select element');

  // The select element's value should be the first class's id
  assertEqual(classSelect.value, fighterClass.id,
    `Class select value should default to first class id. Expected "${fighterClass.id}", got "${classSelect.value}"`);
});

// ==========================================
// Section 3: Default class behavior with edge cases
// ==========================================
console.log('\n--- Section 3: Default class edge cases ---');

await asyncTest('Empty lastSelectedClass string treated same as unset — first class selected', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const paladinClass = createMockClassItem('Paladin', 7, 'pal');
  const rangerClass = createMockClassItem('Ranger', 4, 'rgr');
  const classItems = [paladinClass, rangerClass];
  const actor = createMockActor('Empty String Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;
  const classSelect = element.querySelector('.class-select');

  // With empty lastSelectedClass, hasSelection will be false, so first option is default
  assertEqual(classSelect.value, paladinClass.id, 'First class (Paladin) should be selected');

  // Verify loadArchetypes saved Paladin as last selected
  const saved = game.settings.get('archetype-manager', 'lastSelectedClass');
  assertEqual(saved, paladinClass.id, 'Paladin id should be saved as lastSelectedClass');
});

await asyncTest('Stale lastSelectedClass (non-existent id) falls back to first class', async () => {
  // Set a stale id that doesn't match any class
  game.settings.set('archetype-manager', 'lastSelectedClass', 'nonexistent-class-id-xyz');

  const barbarianClass = createMockClassItem('Barbarian', 6, 'bar');
  const sorcererClass = createMockClassItem('Sorcerer', 4, 'sor');
  const classItems = [barbarianClass, sorcererClass];
  const actor = createMockActor('Stale Selection Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const { options } = parseDialogSelect(dialog.data.content);

  // Neither option should have 'selected' attribute (stale id doesn't match)
  // HTML select defaults to first option
  assert(options[0].textContent.includes('Barbarian'), 'First option should be Barbarian');

  // Verify classSelect.value in the rendered element defaults to first
  const element = dialog._element;
  const classSelect = element.querySelector('.class-select');
  assertEqual(classSelect.value, barbarianClass.id,
    'Select should default to first class (Barbarian) when lastSelectedClass is stale');
});

await asyncTest('Stale lastSelectedClass tag (non-existent tag) falls back to first class', async () => {
  // Set a stale tag that doesn't match any class
  game.settings.set('archetype-manager', 'lastSelectedClass', 'nonexistent-tag');

  const monkClass = createMockClassItem('Monk', 8, 'mnk');
  const clericClass = createMockClassItem('Cleric', 5, 'clr');
  const classItems = [monkClass, clericClass];
  const actor = createMockActor('Stale Tag Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;
  const classSelect = element.querySelector('.class-select');

  assertEqual(classSelect.value, monkClass.id,
    'Select should default to first class (Monk) when lastSelectedClass tag is stale');
});

// ==========================================
// Section 4: Applied archetypes section updates for default class
// ==========================================
console.log('\n--- Section 4: Applied archetypes section for default class ---');

await asyncTest('Applied archetypes section shows "None" for default class with no applied archetypes', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Applied None Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;

  const appliedListEl = element.querySelector('.applied-list');
  assertNotNull(appliedListEl, 'Should have applied-list element');
  assert(appliedListEl.innerHTML.includes('None'), 'Applied list should show "None" when no archetypes applied');
});

await asyncTest('Applied archetypes section shows applied archetype tags for default class', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  // Set an applied archetype on Fighter
  await fighterClass.setFlag('archetype-manager', 'archetypes', ['weapon-master']);

  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Applied Archetypes Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;

  const appliedListEl = element.querySelector('.applied-list');
  assertNotNull(appliedListEl, 'Should have applied-list element');

  // Should show the applied archetype tag
  assert(appliedListEl.innerHTML.includes('Weapon Master'),
    `Applied list should show "Weapon Master" tag, got: ${appliedListEl.innerHTML}`);
  assert(appliedListEl.querySelector('.applied-archetype-tag'), 'Should have archetype tag element');
});

// ==========================================
// Section 5: Dialog buttons work with default class
// ==========================================
console.log('\n--- Section 5: Dialog buttons accessible with default class ---');

await asyncTest('Apply Selected button exists in dialog', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Button Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  assert(dialog.data.buttons.applySelected, 'Dialog should have applySelected button');
  assert(dialog.data.buttons.applySelected.label.includes('Apply Selected'),
    `Apply button label should contain "Apply Selected", got "${dialog.data.buttons.applySelected.label}"`);
});

await asyncTest('Close button exists in dialog', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Close Button Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  assert(dialog.data.buttons.close, 'Dialog should have close button');
  assertEqual(dialog.data.default, 'close', 'Default button should be close');
});

await asyncTest('Add Archetype button exists in dialog', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Add Button Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  assert(dialog.data.buttons.addCustom, 'Dialog should have addCustom button');
  assert(dialog.data.buttons.addCustom.label.includes('Add Archetype'),
    `Add button label should contain "Add Archetype"`);
});

// ==========================================
// Section 6: Interaction with lastSelectedClass (contrast tests)
// ==========================================
console.log('\n--- Section 6: Contrast with lastSelectedClass (when set, overrides default) ---');

await asyncTest('When lastSelectedClass matches second class id, second class is pre-selected (not first)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];

  // Set lastSelectedClass to Rogue
  game.settings.set('archetype-manager', 'lastSelectedClass', rogueClass.id);

  const actor = createMockActor('Last Selected Override', classItems);
  const dialog = await captureDialog(UIManager, actor, classItems);
  const content = dialog.data.content;

  // Rogue should have the selected attribute
  const rogueOptionRegex = new RegExp(`value="${rogueClass.id}"[^>]*selected`);
  assert(rogueOptionRegex.test(content),
    `Rogue option should be pre-selected when lastSelectedClass matches Rogue id`);
});

await asyncTest('When lastSelectedClass matches second class tag, second class is pre-selected', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];

  // Set lastSelectedClass to Rogue's tag
  game.settings.set('archetype-manager', 'lastSelectedClass', 'rog');

  const actor = createMockActor('Tag Override Test', classItems);
  const dialog = await captureDialog(UIManager, actor, classItems);
  const content = dialog.data.content;

  // Rogue should have the selected attribute (tag match)
  const rogueOptionRegex = new RegExp(`value="${rogueClass.id}"[^>]*selected`);
  assert(rogueOptionRegex.test(content),
    `Rogue option should be pre-selected when lastSelectedClass matches tag "rog"`);
});

await asyncTest('After fresh session reset (empty lastSelectedClass), defaults back to first class', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];

  // First set lastSelectedClass to Rogue
  game.settings.set('archetype-manager', 'lastSelectedClass', rogueClass.id);

  // Simulate session reset
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const actor = createMockActor('Session Reset Test', classItems);
  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;
  const classSelect = element.querySelector('.class-select');

  // After reset, should default back to first class
  assertEqual(classSelect.value, fighterClass.id,
    'After session reset, should default to first class (Fighter)');
});

// ==========================================
// Section 7: Search input ready for default class
// ==========================================
console.log('\n--- Section 7: Search input available for default class ---');

await asyncTest('Search input is present and empty after dialog opens with default class', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Search Input Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const element = dialog._element;

  const searchInput = element.querySelector('.archetype-search');
  assertNotNull(searchInput, 'Should have search input element');
  assertEqual(searchInput.value, '', 'Search input should be empty on initial open');
});

// ==========================================
// Section 8: Five-class actor
// ==========================================
console.log('\n--- Section 8: Five-class actor defaults to first ---');

await asyncTest('Five-class actor: first class is default in dropdown', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const c1 = createMockClassItem('Fighter', 10, 'ftr');
  const c2 = createMockClassItem('Wizard', 5, 'wiz');
  const c3 = createMockClassItem('Cleric', 3, 'clr');
  const c4 = createMockClassItem('Rogue', 2, 'rog');
  const c5 = createMockClassItem('Bard', 1, 'brd');
  const classItems = [c1, c2, c3, c4, c5];
  const actor = createMockActor('Five-Class Hero', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options.length, 5, 'Should have 5 options');
  assert(options[0].textContent.includes('Fighter'), `First option should be Fighter, got "${options[0].textContent}"`);

  // Verify select value is first class
  const element = dialog._element;
  const classSelect = element.querySelector('.class-select');
  assertEqual(classSelect.value, c1.id, 'Select value should be first class id');
});

// ==========================================
// Section 9: lastSelectedClass gets saved after initial load
// ==========================================
console.log('\n--- Section 9: Default class gets saved to lastSelectedClass ---');

await asyncTest('Opening dialog with no lastSelectedClass saves the first class id to settings', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Save Default Test', classItems);

  await captureDialog(UIManager, actor, classItems);

  // loadArchetypes saves the selected class
  const saved = game.settings.get('archetype-manager', 'lastSelectedClass');
  assertEqual(saved, fighterClass.id, 'First class id should be saved as lastSelectedClass after initial open');
});

await asyncTest('Opening dialog again with saved lastSelectedClass still shows same class selected', async () => {
  // Use the saved class from previous test
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];

  // Simulate: first open saved Fighter's id
  game.settings.set('archetype-manager', 'lastSelectedClass', fighterClass.id);

  const actor = createMockActor('Reopen Test', classItems);
  const dialog = await captureDialog(UIManager, actor, classItems);
  const content = dialog.data.content;

  // Fighter option should have 'selected' attribute
  const fighterOptionRegex = new RegExp(`value="${fighterClass.id}"[^>]*selected`);
  assert(fighterOptionRegex.test(content),
    `Fighter option should be pre-selected on reopen when lastSelectedClass matches`);
});

// ==========================================
// Section 10: Dialog CSS class and options
// ==========================================
console.log('\n--- Section 10: Dialog has correct CSS classes and options ---');

await asyncTest('Dialog with default class has archetype-manager-dialog CSS class', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('CSS Class Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  assert(dialog.options.classes, 'Dialog should have CSS classes');
  assert(dialog.options.classes.includes('archetype-manager-dialog'),
    'Dialog should include archetype-manager-dialog CSS class');
});

await asyncTest('Dialog is resizable', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Resizable Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  assertEqual(dialog.options.resizable, true, 'Dialog should be resizable');
});

// ==========================================
// Section 11: HTML structure of default select
// ==========================================
console.log('\n--- Section 11: HTML structure of dropdown ---');

await asyncTest('Each option has data-tag attribute with class tag', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Tag Attr Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options[0].dataset.tag, 'ftr', 'Fighter option should have data-tag="ftr"');
  assertEqual(options[1].dataset.tag, 'rog', 'Rogue option should have data-tag="rog"');
});

await asyncTest('Option text format is "ClassName (Lv N)"', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Format Test', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);
  const content = dialog.data.content;

  assert(content.includes('Fighter (Lv 5)'), 'Should include "Fighter (Lv 5)"');
  assert(content.includes('Rogue (Lv 3)'), 'Should include "Rogue (Lv 3)"');
});

// ==========================================
// Section 12: Dialog title includes module title and actor name
// ==========================================
console.log('\n--- Section 12: Dialog title ---');

await asyncTest('Dialog title includes module title and actor name', async () => {
  game.settings.set('archetype-manager', 'lastSelectedClass', '');

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Sir Galahad', classItems);

  const dialog = await captureDialog(UIManager, actor, classItems);

  assert(dialog.data.title.includes('Sir Galahad'), `Title should include actor name, got "${dialog.data.title}"`);
  assert(dialog.data.title.includes('Archetype Manager'), `Title should include module title, got "${dialog.data.title}"`);
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #95 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #95 tests passed!\n');
  process.exit(0);
}
