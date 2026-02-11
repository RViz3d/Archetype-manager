/**
 * Test Suite for Feature #14: Parse 'modifies X' from feature descriptions
 *
 * Verifies that the CompendiumParser.parseModifies() method correctly
 * extracts the modified feature name from modify/modifies/modifying patterns.
 */

import { setupMockEnvironment } from './foundry-mock.mjs';

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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Set up environment
setupMockEnvironment();

// Import CompendiumParser
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #14: Parse "modifies X" from feature descriptions ===\n');

// =====================================================
// Step 1: Test 'modifies Weapon Training.' -> 'Weapon Training'
// =====================================================
console.log('--- Step 1: "modifies X." pattern ---');

test('parseModifies extracts "Weapon Training" from "modifies Weapon Training."', () => {
  const desc = '<p>This ability modifies Weapon Training.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Weapon Training', 'Should extract "Weapon Training"');
});

test('parseModifies extracts "weapon training" from lowercase "modifies weapon training."', () => {
  const desc = '<p>This ability modifies weapon training.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'weapon training', 'Should extract "weapon training"');
});

test('parseModifies works with HTML tags around the pattern', () => {
  const desc = '<p><strong>Level</strong>: 5</p><p>This modifies weapon training.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'weapon training', 'Should extract "weapon training" from HTML context');
});

test('parseModifies extracts multi-word feature names', () => {
  const desc = '<p>This ability modifies Sneak Attack.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Sneak Attack', 'Should extract "Sneak Attack"');
});

test('parseModifies extracts "Wild Empathy"', () => {
  const desc = '<p>This ability modifies Wild Empathy.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Wild Empathy', 'Should extract "Wild Empathy"');
});

test('parseModifies extracts "Bardic Performance"', () => {
  const desc = '<p>This ability modifies Bardic Performance.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Bardic Performance', 'Should extract "Bardic Performance"');
});

// =====================================================
// Step 2: Test 'modify Armor Training.' -> 'Armor Training'
// =====================================================
console.log('\n--- Step 2: "modify X." pattern (singular) ---');

test('parseModifies extracts "Armor Training" from "modify Armor Training."', () => {
  const desc = '<p>This ability modify Armor Training.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Armor Training', 'Should handle singular "modify"');
});

test('parseModifies handles "Modify" at start of sentence', () => {
  const desc = 'Modify Bravery.';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Bravery', 'Should handle "Modify" at sentence start');
});

// =====================================================
// Step 3: Test 'modifying the X class feature.' -> extracts correctly
// =====================================================
console.log('\n--- Step 3: "modifying X." pattern ---');

test('parseModifies extracts from "modifying Weapon Training."', () => {
  const desc = '<p>This ability is modifying Weapon Training.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Weapon Training', 'Should handle "modifying" form');
});

test('parseModifies extracts from "modifying the Armor Training class feature."', () => {
  const desc = '<p>This ability is modifying the Armor Training class feature.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assert(result !== null, 'Should find a match for "modifying the X class feature."');
  assert(result.includes('Armor Training'), `Result "${result}" should contain "Armor Training"`);
});

test('parseModifies extracts from "modifying the Bravery ability."', () => {
  const desc = '<p>This ability is modifying the Bravery ability.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assert(result !== null, 'Should find a match');
  assert(result.includes('Bravery'), `Result "${result}" should contain "Bravery"`);
});

test('parseModifies handles "modifying Sneak Attack."', () => {
  const desc = '<p>Instead of standard progression, modifying Sneak Attack.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Sneak Attack', 'Should handle "modifying" followed by feature name');
});

// =====================================================
// Step 4: Test no modify pattern -> null
// =====================================================
console.log('\n--- Step 4: No modify pattern returns null ---');

test('parseModifies returns null when no modify pattern exists', () => {
  const desc = '<p>This is just a bonus feat gained at 1st level.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, null, 'Should return null when no "modifies" pattern');
});

test('parseModifies returns null for empty string', () => {
  const result = CompendiumParser.parseModifies('');
  assertEqual(result, null, 'Should return null for empty string');
});

test('parseModifies returns null for null input', () => {
  const result = CompendiumParser.parseModifies(null);
  assertEqual(result, null, 'Should return null for null input');
});

test('parseModifies returns null for undefined input', () => {
  const result = CompendiumParser.parseModifies(undefined);
  assertEqual(result, null, 'Should return null for undefined input');
});

test('parseModifies returns null for "replaces" pattern (not modify)', () => {
  const desc = '<p>This ability replaces bravery.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, null, 'Should return null when description has "replaces" but not "modifies"');
});

test('parseModifies returns null for "as the X but" pattern', () => {
  const desc = '<p>As the studied target class feature, but with improved bonuses.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, null, 'Should return null for "as X but" pattern');
});

test('parseModifies returns null for additive-only description', () => {
  const desc = '<p><strong>Level</strong>: 1</p><p>A bonus feat gained at 1st level.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, null, 'Should return null for additive feature');
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

test('parseModifies case insensitive - "Modifies X."', () => {
  const desc = '<p>Modifies Bravery.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Bravery', 'Should be case insensitive');
});

test('parseModifies case insensitive - "MODIFIES X."', () => {
  const desc = '<p>MODIFIES Bravery.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'Bravery', 'Should handle uppercase "MODIFIES"');
});

test('parseModifies trims result whitespace', () => {
  const desc = '<p>This ability modifies  Weapon Training .</p>';
  const result = CompendiumParser.parseModifies(desc);
  assert(result !== null, 'Should find a match');
  assertEqual(result, result.trim(), 'Result should be trimmed');
});

test('parseModifies correctly classifies as "modification" type', () => {
  const desc = '<p><strong>Level</strong>: 5</p><p>This modifies weapon training.</p>';
  const classification = CompendiumParser.classifyFeature(desc);
  assertEqual(classification.type, 'modification', 'Should classify as modification');
  assertEqual(classification.target, 'weapon training', 'Should target weapon training');
});

test('MODIFIES_REGEX pattern is correct', () => {
  assert(CompendiumParser.MODIFIES_REGEX instanceof RegExp, 'MODIFIES_REGEX should be a RegExp');
  assert(CompendiumParser.MODIFIES_REGEX.flags.includes('i'), 'Should be case insensitive');
});

test('MODIFIES_REGEX matches all three forms: modify, modifies, modifying', () => {
  const regex = CompendiumParser.MODIFIES_REGEX;
  assert(regex.test('modify Bravery.'), 'Should match "modify"');
  assert(regex.test('modifies Bravery.'), 'Should match "modifies"');
  assert(regex.test('modifying Bravery.'), 'Should match "modifying"');
});

test('parseModifies with Two-Handed Fighter reference data (Weapon Training)', () => {
  // Real-world test: THF archetype has weapon training as a modification
  const desc = '<p><strong>Level</strong>: 5</p><p>This modifies weapon training.</p>';
  const result = CompendiumParser.parseModifies(desc);
  assertEqual(result, 'weapon training', 'Should extract "weapon training" from THF archetype data');
});

test('Modification feature is not confused with replacement', () => {
  const desc = '<p><strong>Level</strong>: 5</p><p>This modifies weapon training.</p>';
  const replaces = CompendiumParser.parseReplaces(desc);
  const modifies = CompendiumParser.parseModifies(desc);
  assertEqual(replaces, null, 'Should NOT be detected as replacement');
  assertEqual(modifies, 'weapon training', 'Should be detected as modification');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #14 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #14 tests passed!\n');
  process.exit(0);
}
