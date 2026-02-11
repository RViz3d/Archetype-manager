/**
 * Test Suite for Feature #72: Dialog remembers last selected class within session
 *
 * Verifies that the archetype selection dialog pre-selects the last chosen class
 * when reopened within the same session:
 * - lastSelectedClass setting is registered
 * - Setting is client-scoped (per-user, session-level)
 * - Selecting a class in the dropdown saves the selection
 * - Reopening dialog pre-selects the previously chosen class
 * - Multiple reopens maintain the selection
 * - Setting only persists within session (cleared on settings reset)
 * - Multi-class actors correctly remember which class was selected
 *
 * Steps:
 * 1. Open dialog, select Rogue class
 * 2. Close dialog
 * 3. Reopen dialog
 * 4. Verify Rogue still selected
 * 5. Only persists within session
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
  // showMainDialog creates and renders a Dialog
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

// Import module to register settings via Hooks.init
const moduleImport = await import('../scripts/module.mjs');
const MODULE_ID = moduleImport.MODULE_ID;

// Fire init hook to register settings
await globalThis.Hooks.callAll('init');

// Import UIManager
const { UIManager } = await import('../scripts/ui-manager.mjs');

// Mock compendium loading to return empty (no compendium needed for this test)
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const origLoadArchetypeList = CompendiumParser.loadArchetypeList;
CompendiumParser.loadArchetypeList = async () => [];

// Mock JournalEntryDB to return empty sections
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
const origReadSection = JournalEntryDB.readSection;
JournalEntryDB.readSection = async () => ({});

console.log('=== Feature #72: Dialog remembers last selected class within session ===\n');

// ==========================================
// Section 1: Setting Registration
// ==========================================
console.log('--- Section 1: lastSelectedClass setting registration ---');

test('lastSelectedClass setting is registered', () => {
  assert(game.settings.isRegistered(MODULE_ID, 'lastSelectedClass'),
    'Setting should be registered');
});

test('lastSelectedClass default is empty string', () => {
  const defaultVal = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assertEqual(defaultVal, '', 'Default should be empty string');
});

test('lastSelectedClass setting scope is "client" (session-level)', () => {
  const registration = game.settings.getRegistration(MODULE_ID, 'lastSelectedClass');
  assertNotNull(registration, 'Registration should exist');
  assertEqual(registration.scope, 'client', 'Scope should be client');
});

test('lastSelectedClass setting config is false (not in settings UI)', () => {
  const registration = game.settings.getRegistration(MODULE_ID, 'lastSelectedClass');
  assertEqual(registration.config, false, 'Config should be false');
});

test('lastSelectedClass setting type is String', () => {
  const registration = game.settings.getRegistration(MODULE_ID, 'lastSelectedClass');
  assertEqual(registration.type, String, 'Type should be String');
});

test('lastSelectedClass can be set and retrieved', () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'test-class-id');
  const val = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assertEqual(val, 'test-class-id', 'Should retrieve the value that was set');
  // Reset
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');
});

// ==========================================
// Section 2: Dialog reads lastSelectedClass on open
// ==========================================
console.log('\n--- Section 2: Dialog reads lastSelectedClass on open ---');

await asyncTest('Dialog with no lastSelectedClass: no option has selected attribute', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  // With empty lastSelectedClass, no option should have selected attribute
  const anySelected = options.some(o => o.hasAttribute('selected'));
  assert(!anySelected, 'No option should have explicit selected attribute when lastSelectedClass is empty');
});

await asyncTest('Dialog with lastSelectedClass=rogueId pre-selects Rogue', async () => {
  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');

  game.settings.set(MODULE_ID, 'lastSelectedClass', rogueItem.id);

  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);
  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  const rogueOption = options.find(o => o.value === rogueItem.id);
  const fighterOption = options.find(o => o.value === fighterItem.id);

  assert(rogueOption !== null, 'Rogue option should exist');
  assert(rogueOption.hasAttribute('selected'), 'Rogue should be pre-selected');
  assert(!fighterOption.hasAttribute('selected'), 'Fighter should NOT be selected');
});

await asyncTest('Dialog with lastSelectedClass matching by tag pre-selects correct class', async () => {
  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');

  // Set to the tag name rather than id
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'rogue');

  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);
  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  const rogueOption = options.find(o => o.value === rogueItem.id);
  assert(rogueOption !== null, 'Rogue option should exist');
  assert(rogueOption.hasAttribute('selected'), 'Rogue should be pre-selected when matched by tag');
});

// ==========================================
// Section 3: Selecting class saves to setting
// ==========================================
console.log('\n--- Section 3: Selecting a class saves to setting ---');

await asyncTest('Initial load saves first class id to lastSelectedClass', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);

  await captureDialog(UIManager, actor, [fighterItem, rogueItem]);

  // After dialog renders and loadArchetypes fires, the setting should be saved
  const saved = game.settings.get(MODULE_ID, 'lastSelectedClass');
  // It should save either the first class's id (default select behavior) or the matched id
  assert(saved !== '', 'lastSelectedClass should not be empty after dialog opens');
});

await asyncTest('Changing class dropdown saves the new selection', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);

  // The dialog._element has the live DOM after render
  const element = dialog._element;
  assert(element, 'Dialog should have _element after render');

  const classSelect = element.querySelector('.class-select');
  assert(classSelect, 'Class select should exist in rendered DOM');

  // Change to Rogue
  classSelect.value = rogueItem.id;
  classSelect.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 100));

  const saved = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assertEqual(saved, rogueItem.id, 'lastSelectedClass should be updated to Rogue id');
});

await asyncTest('Setting changes each time a different class is selected', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Hero', [fighterItem, rogueItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const element = dialog._element;
  const classSelect = element.querySelector('.class-select');

  // Switch to Rogue
  classSelect.value = rogueItem.id;
  classSelect.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 100));
  assertEqual(game.settings.get(MODULE_ID, 'lastSelectedClass'), rogueItem.id, 'Should be Rogue after switch');

  // Switch back to Fighter
  classSelect.value = fighterItem.id;
  classSelect.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 100));
  assertEqual(game.settings.get(MODULE_ID, 'lastSelectedClass'), fighterItem.id, 'Should be Fighter after switching back');
});

// ==========================================
// Section 4: Reopening dialog preserves selection
// ==========================================
console.log('\n--- Section 4: Reopening dialog preserves selection ---');

await asyncTest('Close and reopen: Rogue still selected after being previously chosen', async () => {
  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);

  // First dialog: select Rogue via setting
  game.settings.set(MODULE_ID, 'lastSelectedClass', rogueItem.id);

  // Open dialog (simulating "reopen")
  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  const rogueOption = options.find(o => o.value === rogueItem.id);
  assert(rogueOption !== null, 'Rogue option should exist');
  assert(rogueOption.hasAttribute('selected'), 'Rogue should be pre-selected on reopen');
});

await asyncTest('Multiple reopens maintain selection (Wizard selected across 3 opens)', async () => {
  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const wizardItem = createMockClassItem('Wizard', 7, 'wizard');
  const actor = createMockActor('MultiClassHero', [fighterItem, rogueItem, wizardItem]);

  // Set Wizard as last selected
  game.settings.set(MODULE_ID, 'lastSelectedClass', wizardItem.id);

  // Open 1
  const dialog1 = await captureDialog(UIManager, actor, [fighterItem, rogueItem, wizardItem]);
  const parsed1 = parseDialogSelect(dialog1.data.content);
  const wizOpt1 = parsed1.options.find(o => o.value === wizardItem.id);
  assert(wizOpt1.hasAttribute('selected'), 'Wizard selected on open 1');

  // Open 2 (setting should still be wizardItem.id from the loadArchetypes call)
  const dialog2 = await captureDialog(UIManager, actor, [fighterItem, rogueItem, wizardItem]);
  const parsed2 = parseDialogSelect(dialog2.data.content);
  const wizOpt2 = parsed2.options.find(o => o.value === wizardItem.id);
  assert(wizOpt2.hasAttribute('selected'), 'Wizard selected on open 2');

  // Open 3
  const dialog3 = await captureDialog(UIManager, actor, [fighterItem, rogueItem, wizardItem]);
  const parsed3 = parseDialogSelect(dialog3.data.content);
  const wizOpt3 = parsed3.options.find(o => o.value === wizardItem.id);
  assert(wizOpt3.hasAttribute('selected'), 'Wizard selected on open 3');
});

await asyncTest('Fighter is NOT selected when lastSelectedClass points to Rogue', async () => {
  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');

  game.settings.set(MODULE_ID, 'lastSelectedClass', rogueItem.id);

  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);
  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  const fighterOption = options.find(o => o.value === fighterItem.id);
  assert(fighterOption !== null, 'Fighter option should exist');
  assert(!fighterOption.hasAttribute('selected'), 'Fighter should NOT be selected');
});

// ==========================================
// Section 5: Session-only persistence
// ==========================================
console.log('\n--- Section 5: Session-only persistence ---');

test('Setting scope is client (per-user, per-client session)', () => {
  const registration = game.settings.getRegistration(MODULE_ID, 'lastSelectedClass');
  assertEqual(registration.scope, 'client', 'Scope should be "client"');
});

test('Setting default is empty string (clean state on new session)', () => {
  const registration = game.settings.getRegistration(MODULE_ID, 'lastSelectedClass');
  assertEqual(registration.default, '', 'Default should be empty string');
});

test('Resetting settings clears lastSelectedClass (simulates new session)', () => {
  // Set a selection
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'some-class-id');
  assertEqual(game.settings.get(MODULE_ID, 'lastSelectedClass'), 'some-class-id');

  // Simulate session reset
  const freshEnv = resetMockEnvironment();

  // Re-register settings (simulating module init)
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class',
    hint: 'Remembers the last selected class within a session',
    scope: 'client',
    config: false,
    type: String,
    default: ''
  });

  const after = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assertEqual(after, '', 'Should be empty after session reset');
});

// Re-setup after resetMockEnvironment
env = setupMockEnvironment();
// Re-register settings manually (module.mjs hooks were registered on old Hooks instance)
game.settings.register(MODULE_ID, 'lastSelectedClass', {
  name: 'Last Selected Class',
  hint: 'Remembers the last selected class within a session',
  scope: 'client',
  config: false,
  type: String,
  default: ''
});
game.settings.register(MODULE_ID, 'showParseWarnings', {
  name: 'Show Parse Warnings',
  hint: 'Display warnings when archetype features cannot be automatically parsed',
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});
CompendiumParser.loadArchetypeList = async () => [];
JournalEntryDB.readSection = async () => ({});

// ==========================================
// Section 6: Edge cases
// ==========================================
console.log('\n--- Section 6: Edge cases ---');

await asyncTest('Stale lastSelectedClass (class removed from actor) does not select anything', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'non-existent-class-id-xxx');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('TestHero', [fighterItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  const anySelected = options.some(o => o.hasAttribute('selected'));
  assert(!anySelected, 'No option should be explicitly selected for stale id');
});

await asyncTest('Single class actor: lastSelectedClass set to its id on load', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('TestHero', [fighterItem]);

  await captureDialog(UIManager, actor, [fighterItem]);

  const saved = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assertEqual(saved, fighterItem.id, 'Should save the single class id');
});

await asyncTest('Empty lastSelectedClass does not cause errors on dialog open', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('TestHero', [fighterItem]);

  let errorOccurred = false;
  const origConsoleError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && !args[0].includes('\u2717')) {
      errorOccurred = true;
    }
    origConsoleError.apply(console, args);
  };

  try {
    await captureDialog(UIManager, actor, [fighterItem]);
    assert(!errorOccurred, 'No errors should occur with empty lastSelectedClass');
  } finally {
    console.error = origConsoleError;
  }
});

// ==========================================
// Section 7: Class select dropdown structure
// ==========================================
console.log('\n--- Section 7: Class select dropdown structure ---');

await asyncTest('Each class option has data-tag attribute', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const rogueItem = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('TestHero', [fighterItem, rogueItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem, rogueItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  for (const opt of options) {
    assert(opt.hasAttribute('data-tag'), `Option ${opt.textContent.trim()} should have data-tag attribute`);
  }
});

await asyncTest('Option value is class item id', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('TestHero', [fighterItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options[0].value, fighterItem.id, 'Option value should be the class item id');
});

await asyncTest('Option text shows class name and level', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('TestHero', [fighterItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  assert(options[0].textContent.includes('Fighter'), 'Option text should include class name');
  assert(options[0].textContent.includes('Lv 5'), 'Option text should include level');
});

await asyncTest('Data-tag attribute matches class system.tag', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighterItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('TestHero', [fighterItem]);

  const dialog = await captureDialog(UIManager, actor, [fighterItem]);
  const { options } = parseDialogSelect(dialog.data.content);

  assertEqual(options[0].getAttribute('data-tag'), 'fighter', 'data-tag should match system.tag');
});

// ==========================================
// Section 8: Cross-actor persistence
// ==========================================
console.log('\n--- Section 8: Cross-actor persistence ---');

await asyncTest('Tag-based matching works across actors with same class tags', async () => {
  // Set last selected to a tag value
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'rogue');

  const fighter2 = createMockClassItem('Fighter', 8, 'fighter');
  const rogue2 = createMockClassItem('Rogue', 6, 'rogue');
  const actor2 = createMockActor('Hero2', [fighter2, rogue2]);

  const dialog = await captureDialog(UIManager, actor2, [fighter2, rogue2]);
  const { options } = parseDialogSelect(dialog.data.content);

  const rogueOption = options.find(o => o.getAttribute('data-tag') === 'rogue');
  assert(rogueOption !== null, 'Rogue option should exist');
  assert(rogueOption.hasAttribute('selected'), 'Rogue should be selected when matching by tag');
});

await asyncTest('ID-based matching does NOT match across different actors', async () => {
  const fighter1 = createMockClassItem('Fighter', 5, 'fighter');
  const rogue1 = createMockClassItem('Rogue', 3, 'rogue');

  // Set to rogue1's specific id
  game.settings.set(MODULE_ID, 'lastSelectedClass', rogue1.id);

  // Different actor with different class item ids
  const fighter2 = createMockClassItem('Fighter', 8, 'fighter');
  const rogue2 = createMockClassItem('Rogue', 6, 'rogue');
  const actor2 = createMockActor('Hero2', [fighter2, rogue2]);

  const dialog = await captureDialog(UIManager, actor2, [fighter2, rogue2]);
  const { options } = parseDialogSelect(dialog.data.content);

  // rogue1.id won't match rogue2.id (different UUIDs), so no option should be selected
  const anySelected = options.some(o => o.hasAttribute('selected'));
  assert(!anySelected, 'No option should be selected when ids do not match (different actors)');
});

// ==========================================
// Section 9: Full open-select-close-reopen cycle
// ==========================================
console.log('\n--- Section 9: Full open-select-close-reopen cycle ---');

await asyncTest('Open, switch to Wizard, close, reopen -> Wizard pre-selected', async () => {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const wizard = createMockClassItem('Wizard', 7, 'wizard');
  const actor = createMockActor('TriClassHero', [fighter, rogue, wizard]);

  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  // First open
  const dialog1 = await captureDialog(UIManager, actor, [fighter, rogue, wizard]);
  const element1 = dialog1._element;
  assert(element1, 'Dialog should have _element after render');

  // Change to Wizard
  const classSelect = element1.querySelector('.class-select');
  if (classSelect) {
    classSelect.value = wizard.id;
    classSelect.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
  }

  assertEqual(game.settings.get(MODULE_ID, 'lastSelectedClass'), wizard.id,
    'After selecting Wizard, setting should be wizard id');

  // Simulate close and reopen
  const dialog2 = await captureDialog(UIManager, actor, [fighter, rogue, wizard]);
  const { options: opts2 } = parseDialogSelect(dialog2.data.content);
  const wizOpt = opts2.find(o => o.value === wizard.id);

  assert(wizOpt !== null, 'Wizard option should exist on reopen');
  assert(wizOpt.hasAttribute('selected'), 'Wizard should be pre-selected on reopen');
});

await asyncTest('Switch class twice: final selection is remembered', async () => {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const wizard = createMockClassItem('Wizard', 7, 'wizard');
  const actor = createMockActor('TriClassHero', [fighter, rogue, wizard]);

  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const dialog = await captureDialog(UIManager, actor, [fighter, rogue, wizard]);
  const element = dialog._element;
  const classSelect = element?.querySelector('.class-select');

  if (classSelect) {
    // Switch to Rogue
    classSelect.value = rogue.id;
    classSelect.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));

    // Switch to Wizard
    classSelect.value = wizard.id;
    classSelect.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
  }

  assertEqual(game.settings.get(MODULE_ID, 'lastSelectedClass'), wizard.id,
    'Last selection (Wizard) should be saved');
});

// ==========================================
// Section 10: loadArchetypes always saves to setting
// ==========================================
console.log('\n--- Section 10: loadArchetypes saves on every class change ---');

await asyncTest('Setting value is updated on each class change event', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Hero', [fighter, rogue]);

  // Track setting writes
  const savedValues = [];
  const origSettingsSet = game.settings.set.bind(game.settings);
  const wrappedSet = (moduleId, key, value) => {
    origSettingsSet(moduleId, key, value);
    if (moduleId === MODULE_ID && key === 'lastSelectedClass') {
      savedValues.push(value);
    }
  };
  game.settings.set = wrappedSet;

  const dialog = await captureDialog(UIManager, actor, [fighter, rogue]);
  const element = dialog._element;
  const classSelect = element?.querySelector('.class-select');

  // Initial load should have triggered a save
  const initialCount = savedValues.length;
  assert(initialCount >= 1, `Setting should be saved on initial load, got ${initialCount} saves`);

  if (classSelect) {
    // Change to Rogue
    classSelect.value = rogue.id;
    classSelect.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));

    assert(savedValues.length > initialCount, 'Setting should be saved again on class change');
    assertEqual(savedValues[savedValues.length - 1], rogue.id, 'Last saved value should be Rogue id');
  }

  // Restore
  game.settings.set = origSettingsSet;
});

await asyncTest('Setting stores the class item id (not the tag)', async () => {
  game.settings.set(MODULE_ID, 'lastSelectedClass', '');

  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Hero', [fighter]);

  await captureDialog(UIManager, actor, [fighter]);

  const saved = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assertEqual(saved, fighter.id, 'Setting should store the class item id');
});

// ==========================================
// Cleanup and Results
// ==========================================

// Restore original implementations
CompendiumParser.loadArchetypeList = origLoadArchetypeList;
JournalEntryDB.readSection = origReadSection;

console.log(`\n=== Feature #72 Results: ${passed}/${totalTests} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
