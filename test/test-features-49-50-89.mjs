/**
 * Test Suite for Features #49, #50, #89:
 * - #49: Archetype list filtered by selected class
 * - #50: Text filter/search on archetype names
 * - #89: Empty search returns full list
 *
 * Tests the main dialog's archetype filtering by class and search functionality.
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
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
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

// =====================================================
// MOCK SETUP
// =====================================================

// Set up mock environment
const { hooks, settings } = setupMockEnvironment();

// Set up mock compendium packs with archetype entries for different classes
function createMockArchetype(name, className) {
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name,
    type: 'Item',
    system: { class: className },
    flags: { 'pf1e-archetypes': { class: className } }
  };
}

// Create mock compendium archetypes for multiple classes
const mockArchetypes = [
  // Fighter archetypes
  createMockArchetype('Two-Handed Fighter', 'fighter'),
  createMockArchetype('Weapon Master', 'fighter'),
  createMockArchetype('Armor Master', 'fighter'),
  createMockArchetype('Brawler (Fighter)', 'fighter'),
  createMockArchetype('Polearm Master', 'fighter'),
  // Rogue archetypes
  createMockArchetype('Knife Master', 'rogue'),
  createMockArchetype('Scout', 'rogue'),
  createMockArchetype('Thug', 'rogue'),
  createMockArchetype('Acrobat', 'rogue'),
  // Wizard archetypes
  createMockArchetype('Evoker', 'wizard'),
  createMockArchetype('Necromancer', 'wizard'),
  // Cleric archetypes
  createMockArchetype('Crusader', 'cleric'),
  createMockArchetype('Evangelist', 'cleric'),
  createMockArchetype('Merciful Healer', 'cleric'),
];

// Set up mock compendium pack
const mockPack = {
  getDocuments: async () => mockArchetypes
};

// Register pf1e-archetypes module as active
globalThis.game.modules.set('pf1e-archetypes', {
  id: 'pf1e-archetypes',
  active: true,
  title: 'PF1e Archetypes'
});

// Register the compendium pack
globalThis.game.packs.set('pf1e-archetypes.pf-archetypes', mockPack);

// Import module and fire hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import UIManager and JournalEntryDB
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// Helper: create dialog and get its internal state via render callback
async function createDialogAndGetState(actor, classItems) {
  await UIManager.showMainDialog(actor, classItems);
  const dialog = Dialog._lastInstance;

  // The dialog renders and fires the render callback which sets up loadArchetypes
  // Our mock Dialog auto-fires render, so the internal state should be set up
  return dialog;
}

// Helper: simulate the render callback and get the archetype list element
function getDialogElement(dialog) {
  return dialog._element;
}

// Helper: wait for async loadArchetypes to complete
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// FEATURE #49: Archetype list filtered by selected class
// =====================================================

console.log('\n=== Feature #49: Archetype list filtered by selected class ===\n');

console.log('--- Basic class filtering ---');

await testAsync('#49.1: loadArchetypes function filters compendium archetypes by selected class', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50); // Let loadArchetypes async complete

  const element = getDialogElement(dialog);
  assert(element, 'Dialog element should exist');

  // Check the rendered archetype list content
  const listEl = element.querySelector('.archetype-list');
  assert(listEl, 'Archetype list element should exist');
  const html = listEl.innerHTML;

  // Fighter archetypes should be present
  assert(html.includes('Two-Handed Fighter'), 'Should show Two-Handed Fighter (fighter archetype)');
  assert(html.includes('Weapon Master'), 'Should show Weapon Master (fighter archetype)');
  assert(html.includes('Armor Master'), 'Should show Armor Master (fighter archetype)');

  // Rogue archetypes should NOT be present
  assert(!html.includes('Knife Master'), 'Should NOT show Knife Master (rogue archetype)');
  assert(!html.includes('Scout'), 'Should NOT show Scout (rogue archetype)');
  assert(!html.includes('Thug'), 'Should NOT show Thug (rogue archetype)');

  // Wizard archetypes should NOT be present
  assert(!html.includes('Evoker'), 'Should NOT show Evoker (wizard archetype)');
});

await testAsync('#49.2: Selecting Rogue shows only Rogue archetypes', async () => {
  const rogueClass = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Test Rogue', [rogueClass]);

  const dialog = await createDialogAndGetState(actor, [rogueClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Rogue archetypes should be present
  assert(html.includes('Knife Master'), 'Should show Knife Master');
  assert(html.includes('Scout'), 'Should show Scout');
  assert(html.includes('Thug'), 'Should show Thug');
  assert(html.includes('Acrobat'), 'Should show Acrobat');

  // Fighter archetypes should NOT be present
  assert(!html.includes('Two-Handed Fighter'), 'Should NOT show Two-Handed Fighter');
  assert(!html.includes('Weapon Master'), 'Should NOT show Weapon Master');
});

await testAsync('#49.3: Multi-class actor defaults to first class and shows only its archetypes', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const rogueClass = createMockClassItem('Rogue', 3, 'rogue');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class', classItems);

  // Clear lastSelectedClass to ensure default selection
  settings.set('archetype-manager', 'lastSelectedClass', '');

  const dialog = await createDialogAndGetState(actor, classItems);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Default selection should be first class (Fighter)
  assert(html.includes('Two-Handed Fighter'), 'Should show Fighter archetypes by default');
  assert(!html.includes('Knife Master'), 'Should NOT show Rogue archetypes initially');
});

console.log('\n--- Class switching ---');

await testAsync('#49.4: Switching class dropdown updates archetype list', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const rogueClass = createMockClassItem('Rogue', 3, 'rogue');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class', classItems);

  settings.set('archetype-manager', 'lastSelectedClass', '');
  const dialog = await createDialogAndGetState(actor, classItems);
  await delay(50);

  const element = getDialogElement(dialog);
  const classSelect = element.querySelector('.class-select');
  assert(classSelect, 'Class select element should exist');

  // Initially showing Fighter archetypes
  let listEl = element.querySelector('.archetype-list');
  assert(listEl.innerHTML.includes('Two-Handed Fighter'), 'Initially should show Fighter archetypes');

  // Simulate switching to Rogue
  classSelect.value = rogueClass.id;
  classSelect.dispatchEvent(new Event('change'));
  await delay(50);

  // After switch, should show Rogue archetypes
  listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;
  assert(html.includes('Knife Master'), 'After switch, should show Rogue archetype Knife Master');
  assert(html.includes('Scout'), 'After switch, should show Rogue archetype Scout');
  assert(!html.includes('Two-Handed Fighter'), 'After switch, should NOT show Fighter archetype Two-Handed Fighter');
});

await testAsync('#49.5: Switching to Wizard shows Wizard archetypes only', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const wizardClass = createMockClassItem('Wizard', 7, 'wizard');
  const classItems = [fighterClass, wizardClass];
  const actor = createMockActor('Fighter/Wizard', classItems);

  settings.set('archetype-manager', 'lastSelectedClass', '');
  const dialog = await createDialogAndGetState(actor, classItems);
  await delay(50);

  const element = getDialogElement(dialog);
  const classSelect = element.querySelector('.class-select');

  // Switch to Wizard
  classSelect.value = wizardClass.id;
  classSelect.dispatchEvent(new Event('change'));
  await delay(50);

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;
  assert(html.includes('Evoker'), 'Should show Evoker (wizard archetype)');
  assert(html.includes('Necromancer'), 'Should show Necromancer (wizard archetype)');
  assert(!html.includes('Two-Handed Fighter'), 'Should NOT show Fighter archetypes');
  assert(!html.includes('Knife Master'), 'Should NOT show Rogue archetypes');
});

console.log('\n--- JE entries merged into list ---');

await testAsync('#49.6: JE missing entries are merged into filtered list', async () => {
  // Add a missing archetype for Fighter
  await JournalEntryDB.setArchetype('missing', 'divine-warrior', {
    name: 'Divine Warrior',
    class: 'fighter',
    features: {
      'holy-strike': { level: 1, replaces: 'Bonus Feat 1', description: '' }
    }
  });

  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Compendium archetypes should still be present
  assert(html.includes('Two-Handed Fighter'), 'Should show compendium Fighter archetypes');

  // JE missing entry should be merged in
  assert(html.includes('Divine Warrior'), 'Should show JE missing entry "Divine Warrior"');

  // Should show correct source icon for JE missing entry
  assert(html.includes('fa-exclamation-triangle'), 'JE missing entry should have warning icon');
});

await testAsync('#49.7: JE custom entries are merged into filtered list', async () => {
  // Add a custom archetype for Rogue
  await JournalEntryDB.setArchetype('custom', 'shadow-blade', {
    name: 'Shadow Blade',
    class: 'rogue',
    features: {
      'shadow-strike': { level: 1, replaces: 'Sneak Attack 1', description: '' }
    }
  });

  const rogueClass = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Test Rogue', [rogueClass]);

  const dialog = await createDialogAndGetState(actor, [rogueClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Compendium rogue archetypes
  assert(html.includes('Knife Master'), 'Should show compendium Rogue archetypes');

  // Custom JE entry should be merged in
  assert(html.includes('Shadow Blade'), 'Should show JE custom entry "Shadow Blade"');

  // Custom entries should have user icon
  assert(html.includes('fa-user'), 'JE custom entry should have user icon');
});

await testAsync('#49.8: JE entries for wrong class are NOT shown', async () => {
  // The "divine-warrior" is for fighter, "shadow-blade" is for rogue
  // When viewing Wizard, neither should appear

  const wizardClass = createMockClassItem('Wizard', 5, 'wizard');
  const actor = createMockActor('Test Wizard', [wizardClass]);

  const dialog = await createDialogAndGetState(actor, [wizardClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // JE entries for other classes should NOT appear
  assert(!html.includes('Divine Warrior'), 'Should NOT show fighter JE entry for Wizard');
  assert(!html.includes('Shadow Blade'), 'Should NOT show rogue JE entry for Wizard');

  // Wizard compendium archetypes should appear
  assert(html.includes('Evoker'), 'Should show Wizard compendium archetypes');
});

await testAsync('#49.9: Archetypes are sorted alphabetically', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const items = element.querySelectorAll('.archetype-item');

  // Extract names
  const names = [];
  items.forEach(item => {
    const nameEl = item.querySelector('.archetype-name');
    if (nameEl) names.push(nameEl.textContent);
  });

  // Verify sorted alphabetically
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  for (let i = 0; i < names.length; i++) {
    assertEqual(names[i], sorted[i], `Position ${i}: expected "${sorted[i]}", got "${names[i]}"`);
  }
  assert(names.length > 0, 'Should have at least one archetype in list');
});

await testAsync('#49.10: Each archetype item has data-slug attribute', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const items = element.querySelectorAll('.archetype-item');

  assert(items.length > 0, 'Should have archetype items');
  items.forEach(item => {
    assert(item.dataset.slug, `Item "${item.textContent.trim()}" should have data-slug attribute`);
  });
});

await testAsync('#49.11: Each archetype item has data-source attribute', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const items = element.querySelectorAll('.archetype-item');

  assert(items.length > 0, 'Should have archetype items');
  items.forEach(item => {
    const source = item.dataset.source;
    assert(source, `Item should have data-source attribute`);
    assert(['compendium', 'missing', 'custom'].includes(source),
      `data-source "${source}" should be one of: compendium, missing, custom`);
  });
});

await testAsync('#49.12: Class with no archetypes shows empty state message', async () => {
  // Create a class that has no archetypes in our mock data
  const alchemistClass = createMockClassItem('Alchemist', 5, 'alchemist');
  const actor = createMockActor('Test Alchemist', [alchemistClass]);

  const dialog = await createDialogAndGetState(actor, [alchemistClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Should show empty state message
  assert(html.includes('No archetypes available') || html.includes('empty-state'),
    'Should show empty state when no archetypes match the class');
});

// =====================================================
// FEATURE #50: Text filter/search on archetype names
// =====================================================

console.log('\n=== Feature #50: Text filter/search on archetype names ===\n');

console.log('--- Basic search filtering ---');

await testAsync('#50.1: Typing search term filters archetype list', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  assert(searchInput, 'Search input should exist');

  // Type "two-handed" in search
  searchInput.value = 'two-handed';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Should show matching entry
  assert(html.includes('Two-Handed Fighter'), 'Should show "Two-Handed Fighter" matching "two-handed"');

  // Should NOT show non-matching entries
  assert(!html.includes('Weapon Master'), 'Should NOT show "Weapon Master" for search "two-handed"');
  assert(!html.includes('Armor Master'), 'Should NOT show "Armor Master" for search "two-handed"');
});

await testAsync('#50.2: Search is case-insensitive', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // Type uppercase search term
  searchInput.value = 'TWO-HANDED';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  assert(html.includes('Two-Handed Fighter'),
    'Case-insensitive search: "TWO-HANDED" should match "Two-Handed Fighter"');
});

await testAsync('#50.3: Partial match works - "hand" shows Two-Handed Fighter', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  searchInput.value = 'hand';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  assert(html.includes('Two-Handed Fighter'),
    'Partial match: "hand" should match "Two-Handed Fighter"');
});

await testAsync('#50.4: Partial match "master" shows multiple matching archetypes', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  searchInput.value = 'master';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // "Master" should match multiple archetypes
  assert(html.includes('Weapon Master'), '"master" should match Weapon Master');
  assert(html.includes('Armor Master'), '"master" should match Armor Master');
  assert(html.includes('Polearm Master'), '"master" should match Polearm Master');

  // Should NOT match non-master archetypes
  assert(!html.includes('Two-Handed Fighter'), '"master" should NOT match Two-Handed Fighter');
});

await testAsync('#50.5: No results search shows appropriate message', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // Search for something that doesn't exist
  searchInput.value = 'zzzzzzz';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  // Should show "no matching" message
  assert(html.includes('No matching archetypes found') || html.includes('empty-state'),
    'Should show empty/no results message for nonsense search');

  // No archetype items should be visible
  const items = element.querySelectorAll('.archetype-item');
  assertEqual(items.length, 0, 'Should have zero archetype items for non-matching search');
});

console.log('\n--- Search edge cases ---');

await testAsync('#50.6: Search with leading/trailing whitespace still works', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  searchInput.value = '  weapon  ';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  assert(html.includes('Weapon Master'),
    'Search with whitespace: "  weapon  " should match "Weapon Master"');
});

await testAsync('#50.7: Single character search works', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // "b" should match "Brawler (Fighter)"
  searchInput.value = 'b';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const items = listEl.querySelectorAll('.archetype-item');

  // Should show at least the Brawler
  assert(items.length > 0, 'Single character "b" should match at least one archetype');

  let foundBrawler = false;
  items.forEach(item => {
    if (item.textContent.includes('Brawler')) foundBrawler = true;
  });
  assert(foundBrawler, 'Single character "b" should match Brawler');
});

await testAsync('#50.8: Search input has event listener for input event', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  // Verify the dialog render callback sets up the input event listener
  assert(typeof dialog.data.render === 'function', 'Dialog should have render callback');

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  assert(searchInput, 'Search input should be present');

  // Verify search works by changing value and dispatching
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  assert(listEl.innerHTML.includes('Weapon Master'), 'Input event should trigger filtering');
});

await testAsync('#50.9: Search also matches JE entries', async () => {
  // The "divine-warrior" JE entry for Fighter was added in #49.6
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  searchInput.value = 'divine';
  searchInput.dispatchEvent(new Event('input'));

  const listEl = element.querySelector('.archetype-list');
  const html = listEl.innerHTML;

  assert(html.includes('Divine Warrior'),
    'Search should also match JE missing entries: "divine" should match "Divine Warrior"');
});

// =====================================================
// FEATURE #89: Empty search returns full list
// =====================================================

console.log('\n=== Feature #89: Empty search returns full list ===\n');

console.log('--- Empty search restores full list ---');

await testAsync('#89.1: Full list displayed initially (no search term)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // Search should be empty initially
  assertEqual(searchInput.value, '', 'Search input should be empty initially');

  // All fighter archetypes should be visible (5 compendium + 1 JE)
  const items = element.querySelectorAll('.archetype-item');
  assert(items.length >= 5, `Should show at least 5 fighter archetypes (compendium), got ${items.length}`);
});

await testAsync('#89.2: After typing search and clearing, full list is restored', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Count initial items
  const initialItems = listEl.querySelectorAll('.archetype-item');
  const initialCount = initialItems.length;
  assert(initialCount >= 5, 'Should have at least 5 initial items');

  // Type search to filter
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));

  const filteredItems = listEl.querySelectorAll('.archetype-item');
  assert(filteredItems.length < initialCount,
    `Filtered count (${filteredItems.length}) should be less than initial (${initialCount})`);

  // Clear search
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));

  // Full list should be restored
  const restoredItems = listEl.querySelectorAll('.archetype-item');
  assertEqual(restoredItems.length, initialCount,
    `Restored count (${restoredItems.length}) should equal initial count (${initialCount})`);
});

await testAsync('#89.3: Clearing search after "no results" restores full list', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Count initial items
  const initialCount = listEl.querySelectorAll('.archetype-item').length;

  // Search for non-existent archetype
  searchInput.value = 'zzzzzzz';
  searchInput.dispatchEvent(new Event('input'));

  // Should have zero results
  let items = listEl.querySelectorAll('.archetype-item');
  assertEqual(items.length, 0, 'Should have 0 items for nonsense search');

  // Clear search
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));

  // Full list should be restored
  items = listEl.querySelectorAll('.archetype-item');
  assertEqual(items.length, initialCount,
    `Full list (${items.length}) should match initial count (${initialCount})`);
});

await testAsync('#89.4: Whitespace-only search treated as empty (shows full list)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  const initialCount = listEl.querySelectorAll('.archetype-item').length;

  // Type only spaces
  searchInput.value = '   ';
  searchInput.dispatchEvent(new Event('input'));

  const items = listEl.querySelectorAll('.archetype-item');
  assertEqual(items.length, initialCount,
    `Whitespace search should show full list (${items.length} vs ${initialCount})`);
});

await testAsync('#89.5: Multiple search-clear cycles maintain correct list', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  const initialCount = listEl.querySelectorAll('.archetype-item').length;

  // Cycle 1: search and clear
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  let count = listEl.querySelectorAll('.archetype-item').length;
  assertEqual(count, initialCount, `Cycle 1: count ${count} should equal initial ${initialCount}`);

  // Cycle 2: different search and clear
  searchInput.value = 'armor';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  count = listEl.querySelectorAll('.archetype-item').length;
  assertEqual(count, initialCount, `Cycle 2: count ${count} should equal initial ${initialCount}`);

  // Cycle 3: no-results search and clear
  searchInput.value = 'nonexistent';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  count = listEl.querySelectorAll('.archetype-item').length;
  assertEqual(count, initialCount, `Cycle 3: count ${count} should equal initial ${initialCount}`);
});

// =====================================================
// CROSS-FEATURE INTEGRATION TESTS
// =====================================================

console.log('\n=== Cross-feature integration tests ===\n');

await testAsync('Integration: Search + class switch resets properly', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const rogueClass = createMockClassItem('Rogue', 3, 'rogue');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class', classItems);

  settings.set('archetype-manager', 'lastSelectedClass', '');
  const dialog = await createDialogAndGetState(actor, classItems);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const classSelect = element.querySelector('.class-select');
  const listEl = element.querySelector('.archetype-list');

  // Search within Fighter archetypes
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));

  let items = listEl.querySelectorAll('.archetype-item');
  assert(items.length > 0, 'Should find weapon-related Fighter archetypes');

  // Switch to Rogue - search is still active but Rogue list loads
  classSelect.value = rogueClass.id;
  classSelect.dispatchEvent(new Event('change'));
  await delay(50);

  // The search term is still in the input, so it should filter the new Rogue list too
  // "weapon" shouldn't match any Rogue archetypes
  items = listEl.querySelectorAll('.archetype-item');
  // Since "weapon" doesn't match any Rogue archetype, should be empty
  assertEqual(items.length, 0,
    'After class switch with "weapon" search, no Rogue archetypes should match');

  // Clear search to see all Rogue archetypes
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));

  items = listEl.querySelectorAll('.archetype-item');
  assert(items.length >= 4, `Should show all Rogue archetypes after clearing search, got ${items.length}`);
});

await testAsync('Integration: Applied archetype shown with check icon', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  // Mark an archetype as applied
  await fighterClass.setFlag('archetype-manager', 'archetypes', ['two-handed-fighter']);

  const actor = createMockActor('Applied Test', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');

  // The Two-Handed Fighter item should have the applied class
  const appliedItems = listEl.querySelectorAll('.archetype-item.applied');
  assert(appliedItems.length > 0, 'Should have at least one applied archetype item');

  // Check for check-circle icon
  const html = listEl.innerHTML;
  assert(html.includes('fa-check-circle'), 'Applied archetype should have check-circle icon');
});

await testAsync('Integration: Loading indicator is shown and hidden', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const loadingIndicator = element.querySelector('.loading-indicator');

  // After loading completes, indicator should be hidden
  assert(loadingIndicator, 'Loading indicator element should exist');
  assertEqual(loadingIndicator.style.display, 'none',
    'Loading indicator should be hidden after loading completes');
});

await testAsync('Integration: Info button exists on each archetype item', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const items = element.querySelectorAll('.archetype-item');
  assert(items.length > 0, 'Should have archetype items');

  items.forEach(item => {
    const infoBtn = item.querySelector('.info-btn');
    assert(infoBtn, `Info button should exist on item "${item.textContent.trim().substring(0, 30)}"`);
    assert(infoBtn.querySelector('.fa-info-circle'), 'Info button should have info-circle icon');
  });
});

// =====================================================
// CLEANUP: Remove test JE entries
// =====================================================

await JournalEntryDB.deleteArchetype('missing', 'divine-warrior');
await JournalEntryDB.deleteArchetype('custom', 'shadow-blade');

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Features #49, #50, #89 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  console.log('FAILED TESTS:');
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
