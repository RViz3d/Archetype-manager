/**
 * Test Suite for Feature #91:
 * Search shows zero-results message
 *
 * Verifies that when no archetypes match a search query,
 * a helpful "No matching archetypes" message is displayed,
 * and the search field remains editable.
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

const { hooks, settings } = setupMockEnvironment();

function createMockArchetype(name, className) {
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name,
    type: 'Item',
    system: { class: className },
    flags: { 'pf1e-archetypes': { class: className } }
  };
}

const mockArchetypes = [
  createMockArchetype('Two-Handed Fighter', 'fighter'),
  createMockArchetype('Weapon Master', 'fighter'),
  createMockArchetype('Armor Master', 'fighter'),
  createMockArchetype('Brawler (Fighter)', 'fighter'),
  createMockArchetype('Polearm Master', 'fighter'),
  createMockArchetype('Knife Master', 'rogue'),
  createMockArchetype('Scout', 'rogue'),
  createMockArchetype('Thug', 'rogue'),
  createMockArchetype('Acrobat', 'rogue'),
];

const mockPack = {
  getDocuments: async () => mockArchetypes
};

globalThis.game.modules.set('pf1e-archetypes', {
  id: 'pf1e-archetypes',
  active: true,
  title: 'PF1e Archetypes'
});
globalThis.game.packs.set('pf1e-archetypes.pf-archetypes', mockPack);

await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { UIManager } = await import('../scripts/ui-manager.mjs');

async function createDialogAndGetState(actor, classItems) {
  await UIManager.showMainDialog(actor, classItems);
  const dialog = Dialog._lastInstance;
  return dialog;
}

function getDialogElement(dialog) {
  return dialog._element;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// FEATURE #91: Search shows zero-results message
// =====================================================

console.log('\n=== Feature #91: Search shows zero-results message ===\n');

console.log('--- Basic no-match message ---');

await testAsync('#91.1: Typing "xyznonexistent" shows "No matching archetypes" message', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Type non-existent search term
  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const html = listEl.innerHTML;

  // Should contain the "No matching archetypes" text
  assert(html.includes('No matching archetypes'),
    'Should show "No matching archetypes" message for non-existent search');
});

await testAsync('#91.2: No matching message includes the search term', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const html = listEl.innerHTML;

  // The message should include the search term so the user knows what was searched
  assert(html.includes('xyznonexistent'),
    'No-results message should include the search term "xyznonexistent"');
});

await testAsync('#91.3: Empty state div has .empty-state class', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const emptyState = listEl.querySelector('.empty-state');
  assert(emptyState !== null, 'Should have an element with .empty-state class');
});

await testAsync('#91.4: No archetype items visible when search has no matches', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const items = listEl.querySelectorAll('.archetype-item');
  assertEqual(items.length, 0, 'Should have zero archetype items for non-matching search');
});

console.log('\n--- Message is helpful, not just empty ---');

await testAsync('#91.5: Message is not just empty space or whitespace', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const emptyState = listEl.querySelector('.empty-state');
  assert(emptyState, 'Empty state element should exist');

  const textContent = emptyState.textContent.trim();
  assert(textContent.length > 0, 'Empty state message should not be blank');
  assert(textContent.length > 10, `Empty state message should be meaningful (got "${textContent}")`);
});

await testAsync('#91.6: Message contains a helpful suggestion (e.g., "try" or "clear")', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const emptyState = listEl.querySelector('.empty-state');
  const text = emptyState.textContent.toLowerCase();

  // The message should provide some guidance (not just "not found")
  const hasHelpful = text.includes('try') || text.includes('clear') || text.includes('different') || text.includes('search');
  assert(hasHelpful,
    `Message should include helpful suggestion (try/clear/different/search). Got: "${emptyState.textContent.trim()}"`);
});

await testAsync('#91.7: Message includes a search icon (fa-search)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const html = listEl.innerHTML;
  assert(html.includes('fa-search'), 'No-results message should include a search icon');
});

await testAsync('#91.8: Different non-matching terms all show the message', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  const nonExistentTerms = ['xyznonexistent', 'abcdefg', 'qqqqq', 'foobar123'];

  for (const term of nonExistentTerms) {
    searchInput.value = term;
    searchInput.dispatchEvent(new Event('input'));

    const emptyState = listEl.querySelector('.empty-state');
    assert(emptyState, `Should show empty state for "${term}"`);
    assert(emptyState.textContent.includes('No matching archetypes'),
      `Should show "No matching archetypes" for "${term}"`);
  }
});

await testAsync('#91.9: Message reflects the actual search term typed', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Search for "abcdefg"
  searchInput.value = 'abcdefg';
  searchInput.dispatchEvent(new Event('input'));

  const html = listEl.innerHTML;
  assert(html.includes('abcdefg'), 'Message should include the actual search term "abcdefg"');

  // Now search for "zzz999"
  searchInput.value = 'zzz999';
  searchInput.dispatchEvent(new Event('input'));

  const html2 = listEl.innerHTML;
  assert(html2.includes('zzz999'), 'Message should update to include new search term "zzz999"');
});

console.log('\n--- Search field remains editable ---');

await testAsync('#91.10: Search field is still editable after no-results', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // Type non-matching term
  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  // Search field should not be disabled
  assert(!searchInput.disabled, 'Search input should not be disabled after no results');
  assert(!searchInput.readOnly, 'Search input should not be readOnly after no results');
});

await testAsync('#91.11: Can type new search after no-results', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // First, trigger no results
  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  let items = listEl.querySelectorAll('.archetype-item');
  assertEqual(items.length, 0, 'Should have zero items');

  // Now type a valid search
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));

  items = listEl.querySelectorAll('.archetype-item');
  assert(items.length > 0, 'Should find items for "weapon" after a no-results search');
  assert(listEl.innerHTML.includes('Weapon Master'), 'Should find Weapon Master');
});

await testAsync('#91.12: Can clear search after no-results to restore full list', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  const initialCount = listEl.querySelectorAll('.archetype-item').length;
  assert(initialCount >= 5, 'Should have at least 5 initial items');

  // Trigger no results
  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  // Clear search
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));

  const restoredCount = listEl.querySelectorAll('.archetype-item').length;
  assertEqual(restoredCount, initialCount,
    `Restored count (${restoredCount}) should equal initial count (${initialCount})`);
});

await testAsync('#91.13: Search value is preserved in input after no results', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  // The search input should still hold the typed value
  assertEqual(searchInput.value, 'xyznonexistent',
    'Search input should still contain the typed value after no results');
});

console.log('\n--- Edge cases ---');

await testAsync('#91.14: No-results for different class (Rogue with no matches)', async () => {
  const rogueClass = createMockClassItem('Rogue', 5, 'rogue');
  const actor = createMockActor('Test Rogue', [rogueClass]);

  const dialog = await createDialogAndGetState(actor, [rogueClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  const emptyState = listEl.querySelector('.empty-state');
  assert(emptyState, 'Should show empty state for Rogue class with non-matching search');
  assert(emptyState.textContent.includes('No matching archetypes'),
    'Should show "No matching archetypes" for Rogue too');
});

await testAsync('#91.15: Class with zero archetypes shows appropriate non-search message', async () => {
  const alchemistClass = createMockClassItem('Alchemist', 5, 'alchemist');
  const actor = createMockActor('Test Alchemist', [alchemistClass]);

  const dialog = await createDialogAndGetState(actor, [alchemistClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const listEl = element.querySelector('.archetype-list');

  // Without any search term, should show the class-level empty message
  const html = listEl.innerHTML;
  assert(html.includes('No archetypes available') || html.includes('empty-state'),
    'Class with no archetypes should show "No archetypes available" message');
});

await testAsync('#91.16: Search empty-state message is different from class empty-state', async () => {
  // Empty class scenario
  const alchemistClass = createMockClassItem('Alchemist', 5, 'alchemist');
  const actorA = createMockActor('Test Alchemist', [alchemistClass]);

  const dialogA = await createDialogAndGetState(actorA, [alchemistClass]);
  await delay(50);
  const elementA = getDialogElement(dialogA);
  const listElA = elementA.querySelector('.archetype-list');
  const classEmptyText = listElA.querySelector('.empty-state')?.textContent.trim() || '';

  // Search no-results scenario
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actorB = createMockActor('Test Fighter', [fighterClass]);

  const dialogB = await createDialogAndGetState(actorB, [fighterClass]);
  await delay(50);
  const elementB = getDialogElement(dialogB);
  const searchInput = elementB.querySelector('.archetype-search');
  const listElB = elementB.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));
  const searchEmptyText = listElB.querySelector('.empty-state')?.textContent.trim() || '';

  // The two messages should be different
  assert(classEmptyText !== searchEmptyText,
    `Class empty "${classEmptyText}" and search empty "${searchEmptyText}" should be different messages`);
});

await testAsync('#91.17: Multiple no-results searches update message each time', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // First no-results search
  searchInput.value = 'aaaa';
  searchInput.dispatchEvent(new Event('input'));
  let html = listEl.innerHTML;
  assert(html.includes('aaaa'), 'Message should show "aaaa"');

  // Second no-results search
  searchInput.value = 'bbbb';
  searchInput.dispatchEvent(new Event('input'));
  html = listEl.innerHTML;
  assert(html.includes('bbbb'), 'Message should update to show "bbbb"');
  assert(!html.includes('aaaa'), 'Previous search term "aaaa" should no longer appear');
});

await testAsync('#91.18: No-results message is inside the archetype list container', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  // The empty-state should be a child of .archetype-list
  const emptyState = listEl.querySelector('.empty-state');
  assert(emptyState, 'Empty state should be inside .archetype-list');
  assert(emptyState.parentElement === listEl || emptyState.closest('.archetype-list') === listEl,
    'Empty state should be a direct or nested child of .archetype-list');
});

await testAsync('#91.19: Search field is of type text/search and accepts input after no results', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // Verify it's an input element
  assertEqual(searchInput.tagName, 'INPUT', 'Search should be an INPUT element');

  // Type non-matching
  searchInput.value = 'xyznonexistent';
  searchInput.dispatchEvent(new Event('input'));

  // Change value - should work
  searchInput.value = 'armor';
  searchInput.dispatchEvent(new Event('input'));
  assertEqual(searchInput.value, 'armor', 'Should be able to change input value');
});

await testAsync('#91.20: No-results message uses the trimmed search term', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Type with whitespace
  searchInput.value = '  xyznonexistent  ';
  searchInput.dispatchEvent(new Event('input'));

  const html = listEl.innerHTML;
  // The displayed term should be trimmed
  assert(html.includes('xyznonexistent'), 'Message should include the trimmed search term');
});

// =====================================================
// RESULTS
// =====================================================

console.log(`\n============================================================`);
console.log(`Feature #91 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`============================================================\n`);

if (failed > 0) {
  console.error(`FAILED: ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('All tests passed!');
}
