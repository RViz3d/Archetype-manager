/**
 * Test Suite for Feature #48: Class dropdown populated from actor's class items
 *
 * Verifies that the main dialog shows a dropdown of actor's classes with level display,
 * and that selecting a class updates the archetype list.
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

async function testAsync(name, fn) {
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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Set up environment
const { hooks, settings } = setupMockEnvironment();

// Import module and fire hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import UIManager
const { UIManager } = await import('../scripts/ui-manager.mjs');

console.log('\n=== Feature #48: Class dropdown populated from actor\'s class items ===\n');

// --- Test with single class ---
console.log('--- Single class actor ---');

await testAsync('Main dialog creates a Dialog with class dropdown for single-class actor', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog, 'Dialog should have been created');
  assert(dialog.data.content, 'Dialog should have content');
  assert(dialog.data.content.includes('class-select'), 'Dialog should have class-select element');
  assert(dialog.data.content.includes('Fighter'), 'Dialog content should contain Fighter class name');
  assert(dialog.data.content.includes('Lv 5'), 'Dialog content should show level 5');
});

await testAsync('Dialog title contains actor name', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.title.includes('Test Fighter'), `Dialog title "${dialog.data.title}" should contain actor name`);
});

// --- Test with multiple classes ---
console.log('\n--- Multi-class actor ---');

await testAsync('Main dialog shows dropdown for multi-class actor (Fighter 5 / Rogue 3)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class Hero', classItems);

  await UIManager.showMainDialog(actor, classItems);

  const dialog = Dialog._lastInstance;
  const content = dialog.data.content;

  // Check both classes appear in dropdown options
  assert(content.includes('Fighter'), 'Content should contain Fighter');
  assert(content.includes('Rogue'), 'Content should contain Rogue');
  assert(content.includes('Lv 5'), 'Content should show Fighter level 5');
  assert(content.includes('Lv 3'), 'Content should show Rogue level 3');
});

await testAsync('Each class dropdown option has the class item id as value', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class Hero', classItems);

  await UIManager.showMainDialog(actor, classItems);

  const dialog = Dialog._lastInstance;
  const content = dialog.data.content;

  // Check that option values use class item IDs
  assert(content.includes(`value="${fighterClass.id}"`),
    'Fighter option should have correct id value');
  assert(content.includes(`value="${rogueClass.id}"`),
    'Rogue option should have correct id value');
});

await testAsync('Three-class actor shows all three classes', async () => {
  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const wizardClass = createMockClassItem('Wizard', 5, 'wiz');
  const clericClass = createMockClassItem('Cleric', 3, 'clr');
  const classItems = [fighterClass, wizardClass, clericClass];
  const actor = createMockActor('Triple-Class Hero', classItems);

  await UIManager.showMainDialog(actor, classItems);

  const dialog = Dialog._lastInstance;
  const content = dialog.data.content;

  assert(content.includes('Fighter'), 'Content should contain Fighter');
  assert(content.includes('Wizard'), 'Content should contain Wizard');
  assert(content.includes('Cleric'), 'Content should contain Cleric');
  assert(content.includes('Lv 10'), 'Content should show Fighter level 10');
  assert(content.includes('Lv 5'), 'Content should show Wizard level 5');
  assert(content.includes('Lv 3'), 'Content should show Cleric level 3');
});

// --- Test dropdown option format ---
console.log('\n--- Dropdown option format ---');

await testAsync('Class option format is "ClassName (Lv N)"', async () => {
  const paladinClass = createMockClassItem('Paladin', 7, 'pal');
  const actor = createMockActor('Holy Warrior', [paladinClass]);

  await UIManager.showMainDialog(actor, [paladinClass]);

  const dialog = Dialog._lastInstance;
  const content = dialog.data.content;

  // The option text should be: Paladin (Lv 7)
  assert(content.includes('Paladin (Lv 7)'), 'Option text should be "Paladin (Lv 7)"');
});

await testAsync('Class with level 1 shows correctly', async () => {
  const bardClass = createMockClassItem('Bard', 1, 'brd');
  const actor = createMockActor('Beginner Bard', [bardClass]);

  await UIManager.showMainDialog(actor, [bardClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('Bard (Lv 1)'), 'Option should show "Bard (Lv 1)"');
});

await testAsync('Class with level 20 shows correctly', async () => {
  const monkClass = createMockClassItem('Monk', 20, 'mnk');
  const actor = createMockActor('Master Monk', [monkClass]);

  await UIManager.showMainDialog(actor, [monkClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('Monk (Lv 20)'), 'Option should show "Monk (Lv 20)"');
});

// --- Test dialog structure ---
console.log('\n--- Dialog structure ---');

await testAsync('Dialog has search input for archetypes', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('archetype-search'), 'Dialog should have search input');
  assert(dialog.data.content.includes('Search archetypes'), 'Dialog should have search placeholder');
});

await testAsync('Dialog has archetype list container', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('archetype-list'), 'Dialog should have archetype list container');
});

await testAsync('Dialog has applied archetypes section', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('Applied Archetypes'), 'Dialog should have applied archetypes section');
});

await testAsync('Dialog has render callback for event handlers', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(typeof dialog.data.render === 'function', 'Dialog should have a render callback for DOM event setup');
});

await testAsync('Dialog has Add Archetype and Close buttons', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.buttons.addCustom, 'Dialog should have addCustom button');
  assert(dialog.data.buttons.close, 'Dialog should have close button');
  assert(dialog.data.buttons.addCustom.label.includes('Add Archetype'), 'Add button should be labeled "Add Archetype"');
});

// --- Test lastSelectedClass persistence ---
console.log('\n--- Class selection persistence ---');

await testAsync('Last selected class setting affects pre-selection', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class', classItems);

  // Set lastSelectedClass to the rogue's id
  settings.set('archetype-manager', 'lastSelectedClass', rogueClass.id);

  await UIManager.showMainDialog(actor, classItems);

  const dialog = Dialog._lastInstance;
  const content = dialog.data.content;

  // The rogue option should have 'selected' attribute
  // We check that the option with rogue's id has 'selected'
  const rogueOptionRegex = new RegExp(`value="${rogueClass.id}"[^>]*selected`);
  assert(rogueOptionRegex.test(content),
    `Rogue option should be pre-selected when lastSelectedClass matches. Content: ${content.substring(0, 500)}`);
});

// --- Test dialog dimensions ---
console.log('\n--- Dialog options ---');

await testAsync('Dialog has appropriate width', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.options, 'Dialog should have options');
  assert(dialog.options.width >= 400, `Dialog width ${dialog.options.width} should be at least 400px`);
});

await testAsync('Dialog has archetype-manager-dialog CSS class', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.options.classes, 'Dialog should have CSS classes');
  assert(dialog.options.classes.includes('archetype-manager-dialog'),
    'Dialog should have archetype-manager-dialog CSS class');
});

// --- Test with classes that have special characters ---
console.log('\n--- Edge cases ---');

await testAsync('Class name with special characters renders safely', async () => {
  const specialClass = createMockClassItem('Ranger (Revised)', 4, 'rng');
  const actor = createMockActor('Special', [specialClass]);

  await UIManager.showMainDialog(actor, [specialClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('Ranger (Revised)'), 'Should handle class names with parentheses');
});

await testAsync('Class with missing level shows gracefully', async () => {
  const classItem = createMockClassItem('Sorcerer', undefined, 'sor');
  classItem.system.level = undefined;
  classItem.system.levels = undefined;
  const actor = createMockActor('Unknown Level', [classItem]);

  await UIManager.showMainDialog(actor, [classItem]);

  const dialog = Dialog._lastInstance;
  // Should show "?" or some fallback for missing level
  assert(dialog.data.content.includes('Sorcerer'), 'Should still show class name');
  assert(dialog.data.content.includes('Lv'), 'Should still show Lv label');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #48 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #48 tests passed!\n');
  process.exit(0);
}
