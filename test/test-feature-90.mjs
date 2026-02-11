/**
 * Test Suite for Feature #90:
 * Search with special characters doesn't crash
 *
 * Verifies that typing regex-special and other special characters
 * into the archetype search input does not throw errors and
 * the list filters gracefully.
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

// Create mock compendium archetypes
function createMockArchetype(name, className) {
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name,
    type: 'Item',
    system: { class: className },
    flags: { 'pf1e-archetypes': { class: className } }
  };
}

// Include an archetype with parentheses in its name for matching tests
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

// Helper: create dialog and get its internal state
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

/**
 * Helper: type a special character into search and verify no crash.
 * Returns the number of .archetype-item elements in the list.
 */
async function searchAndVerify(character, label) {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  assert(searchInput, 'Search input should exist');
  assert(listEl, 'Archetype list should exist');

  // Count initial items before search
  const initialCount = listEl.querySelectorAll('.archetype-item').length;
  assert(initialCount > 0, 'Should have initial archetype items');

  // Type the special character - this must NOT throw
  searchInput.value = character;
  searchInput.dispatchEvent(new Event('input'));

  // After search, the list should render gracefully (no crash)
  const items = listEl.querySelectorAll('.archetype-item');
  const emptyState = listEl.querySelector('.empty-state');

  // Either we have matching items or a "no matching" message - no error/crash
  assert(items.length >= 0, 'Item count should be non-negative');
  if (items.length === 0) {
    assert(emptyState, `Empty state message should appear for "${label}" when no items match`);
  }

  return { items: items.length, initialCount, element, searchInput, listEl };
}

// =====================================================
// FEATURE #90: Search with special characters doesn't crash
// =====================================================

console.log('\n=== Feature #90: Search with special characters doesn\'t crash ===\n');

console.log('--- Regex special characters ---');

await testAsync('#90.1: Open parenthesis "(" doesn\'t crash search', async () => {
  const result = await searchAndVerify('(', 'open paren');
  // "(" should match "Brawler (Fighter)" which contains parentheses
  assert(result.items >= 1, `"(" should match at least Brawler (Fighter), got ${result.items} items`);
});

await testAsync('#90.2: Close parenthesis ")" doesn\'t crash search', async () => {
  const result = await searchAndVerify(')', 'close paren');
  // ")" appears in "Brawler (Fighter)"
  assert(result.items >= 1, `")" should match at least Brawler (Fighter), got ${result.items} items`);
});

await testAsync('#90.3: Asterisk "*" doesn\'t crash search', async () => {
  const result = await searchAndVerify('*', 'asterisk');
  // No archetype name contains literal "*", so 0 results is expected
  assertEqual(result.items, 0, '"*" should match zero archetypes (no literal asterisk in names)');
});

await testAsync('#90.4: Backslash "\\" doesn\'t crash search', async () => {
  const result = await searchAndVerify('\\', 'backslash');
  assertEqual(result.items, 0, '"\\" should match zero archetypes');
});

await testAsync('#90.5: Single quote "\'" doesn\'t crash search', async () => {
  const result = await searchAndVerify("'", 'single quote');
  // No archetype has a single quote in mock data
  assertEqual(result.items, 0, "\"'\" should match zero archetypes");
});

await testAsync('#90.6: Double quote doesn\'t crash search', async () => {
  const result = await searchAndVerify('"', 'double quote');
  assertEqual(result.items, 0, '"" should match zero archetypes');
});

await testAsync('#90.7: Plus "+" doesn\'t crash search', async () => {
  const result = await searchAndVerify('+', 'plus');
  assertEqual(result.items, 0, '"+" should match zero archetypes');
});

await testAsync('#90.8: Question mark "?" doesn\'t crash search', async () => {
  const result = await searchAndVerify('?', 'question mark');
  assertEqual(result.items, 0, '"?" should match zero archetypes');
});

await testAsync('#90.9: Dot "." doesn\'t crash search', async () => {
  const result = await searchAndVerify('.', 'dot');
  // Dot is not in any mock archetype name
  assertEqual(result.items, 0, '"." should match zero archetypes');
});

await testAsync('#90.10: Caret "^" doesn\'t crash search', async () => {
  const result = await searchAndVerify('^', 'caret');
  assertEqual(result.items, 0, '"^" should match zero archetypes');
});

await testAsync('#90.11: Dollar "$" doesn\'t crash search', async () => {
  const result = await searchAndVerify('$', 'dollar');
  assertEqual(result.items, 0, '"$" should match zero archetypes');
});

await testAsync('#90.12: Square brackets "[]" don\'t crash search', async () => {
  const result = await searchAndVerify('[]', 'brackets');
  assertEqual(result.items, 0, '"[]" should match zero archetypes');
});

await testAsync('#90.13: Curly braces "{}" don\'t crash search', async () => {
  const result = await searchAndVerify('{}', 'braces');
  assertEqual(result.items, 0, '"{}" should match zero archetypes');
});

await testAsync('#90.14: Pipe "|" doesn\'t crash search', async () => {
  const result = await searchAndVerify('|', 'pipe');
  assertEqual(result.items, 0, '"|" should match zero archetypes');
});

console.log('\n--- Special character combinations ---');

await testAsync('#90.15: Combined regex characters "(.*)" don\'t crash', async () => {
  const result = await searchAndVerify('(.*)', 'regex pattern');
  // "(.*)" as literal search - only matches if archetype has literal "(.*)" in name
  // Should not crash regardless
  assert(result.items >= 0, 'Should not crash with regex pattern "(.*)"');
});

await testAsync('#90.16: Backslash-d "\\d" doesn\'t crash (regex digit shorthand)', async () => {
  const result = await searchAndVerify('\\d', 'backslash-d');
  assertEqual(result.items, 0, '"\\d" should match zero archetypes');
});

await testAsync('#90.17: HTML-like characters "<script>" don\'t crash search', async () => {
  const result = await searchAndVerify('<script>', 'HTML tag');
  assertEqual(result.items, 0, '"<script>" should match zero archetypes');
});

await testAsync('#90.18: Multiple special chars "([{*+?}])" don\'t crash', async () => {
  const result = await searchAndVerify('([{*+?}])', 'multi-special');
  assertEqual(result.items, 0, 'Multiple special chars should match zero archetypes');
});

console.log('\n--- Graceful filtering with special characters ---');

await testAsync('#90.19: List filters gracefully - shows empty state or matching items', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Test several special characters in sequence - none should crash
  const specials = ['(', ')', '*', '\\', '"', "'", '+', '?', '.', '^', '$', '[', ']', '{', '}', '|'];

  for (const char of specials) {
    searchInput.value = char;
    searchInput.dispatchEvent(new Event('input'));

    const items = listEl.querySelectorAll('.archetype-item');
    const emptyState = listEl.querySelector('.empty-state');

    // Either items are shown or empty state message appears - never a broken/errored state
    assert(items.length > 0 || emptyState !== null,
      `Character "${char}": should show items or empty state, not a broken state`);
  }
});

await testAsync('#90.20: Search still works normally after special character searches', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // First do special char searches
  searchInput.value = '(';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.value = '\\';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.value = '*';
  searchInput.dispatchEvent(new Event('input'));

  // Now do a normal search - should still work
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));

  const html = listEl.innerHTML;
  assert(html.includes('Weapon Master'), 'Normal search should still work after special char searches');
});

await testAsync('#90.21: Clearing search after special chars restores full list', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  const initialCount = listEl.querySelectorAll('.archetype-item').length;
  assert(initialCount >= 5, 'Should have at least 5 initial items');

  // Search with special char
  searchInput.value = '(';
  searchInput.dispatchEvent(new Event('input'));

  // Clear
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));

  const restoredCount = listEl.querySelectorAll('.archetype-item').length;
  assertEqual(restoredCount, initialCount,
    `Restored count (${restoredCount}) should equal initial (${initialCount})`);
});

await testAsync('#90.22: Parenthetical name "Brawler (Fighter)" is searchable with "("', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  // Search for "(" which appears in "Brawler (Fighter)"
  searchInput.value = '(';
  searchInput.dispatchEvent(new Event('input'));

  const items = listEl.querySelectorAll('.archetype-item');
  assert(items.length >= 1, '"(" should match "Brawler (Fighter)"');

  let foundBrawler = false;
  items.forEach(item => {
    if (item.textContent.includes('Brawler')) foundBrawler = true;
  });
  assert(foundBrawler, 'Brawler (Fighter) should appear when searching "("');
});

await testAsync('#90.23: Searching "(Fighter)" matches Brawler archetype', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');
  const listEl = element.querySelector('.archetype-list');

  searchInput.value = '(fighter)';
  searchInput.dispatchEvent(new Event('input'));

  const items = listEl.querySelectorAll('.archetype-item');
  assert(items.length >= 1, '"(fighter)" should match Brawler (Fighter)');

  let foundBrawler = false;
  items.forEach(item => {
    if (item.textContent.includes('Brawler')) foundBrawler = true;
  });
  assert(foundBrawler, 'Brawler (Fighter) should appear when searching "(fighter)"');
});

await testAsync('#90.24: Search input field still editable after special character entry', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  const dialog = await createDialogAndGetState(actor, [fighterClass]);
  await delay(50);

  const element = getDialogElement(dialog);
  const searchInput = element.querySelector('.archetype-search');

  // Type special chars
  searchInput.value = '(*+?)';
  searchInput.dispatchEvent(new Event('input'));

  // Input should still be editable (not disabled)
  assert(!searchInput.disabled, 'Search input should not be disabled after special chars');
  assert(!searchInput.readOnly, 'Search input should not be readOnly after special chars');

  // Should be able to change value
  searchInput.value = 'weapon';
  searchInput.dispatchEvent(new Event('input'));
  assertEqual(searchInput.value, 'weapon', 'Search input value should be changeable after special chars');
});

await testAsync('#90.25: Unicode characters don\'t crash search', async () => {
  const result = await searchAndVerify('é', 'accent');
  assert(result.items >= 0, 'Unicode accent character should not crash');
});

await testAsync('#90.26: Emoji characters don\'t crash search', async () => {
  const result = await searchAndVerify('⚔️', 'emoji');
  assert(result.items >= 0, 'Emoji character should not crash');
});

await testAsync('#90.27: Null byte doesn\'t crash search', async () => {
  const result = await searchAndVerify('\0', 'null byte');
  assert(result.items >= 0, 'Null byte should not crash');
});

await testAsync('#90.28: Tab character doesn\'t crash search', async () => {
  const result = await searchAndVerify('\t', 'tab');
  // Tab is whitespace, trim() should make it empty → show full list
  assertEqual(result.items, result.initialCount, 'Tab should be treated as empty (whitespace trimmed)');
});

await testAsync('#90.29: Newline character doesn\'t crash search', async () => {
  const result = await searchAndVerify('\n', 'newline');
  // Newline is whitespace, trim() should make it empty → show full list
  assertEqual(result.items, result.initialCount, 'Newline should be treated as empty (whitespace trimmed)');
});

await testAsync('#90.30: Very long search string doesn\'t crash', async () => {
  const longString = 'a'.repeat(1000);
  const result = await searchAndVerify(longString, 'long string');
  assertEqual(result.items, 0, 'Very long non-matching string should show zero items');
});

// =====================================================
// RESULTS
// =====================================================

console.log(`\n============================================================`);
console.log(`Feature #90 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`============================================================\n`);

if (failed > 0) {
  console.error(`FAILED: ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('All tests passed!');
}
