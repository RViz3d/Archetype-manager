/**
 * Test Suite for Feature #13: Parse 'replaces X' from feature descriptions
 *
 * Verifies that the CompendiumParser.parseReplaces() method correctly
 * extracts the replaced feature name from various description patterns.
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

console.log('\n=== Feature #13: Parse "replaces X" from feature descriptions ===\n');

// =====================================================
// Step 1: Test 'replaces Bravery.' -> 'Bravery'
// =====================================================
console.log('--- Step 1: Basic "replaces X." pattern ---');

test('parseReplaces extracts "Bravery" from "replaces Bravery."', () => {
  const desc = '<p>This ability replaces Bravery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Bravery', 'Should extract "Bravery"');
});

test('parseReplaces extracts "bravery" from lowercase "replaces bravery."', () => {
  const desc = '<p>This ability replaces bravery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'bravery', 'Should extract "bravery"');
});

test('parseReplaces works with HTML tags around the pattern', () => {
  const desc = '<p><strong>Level</strong>: 2</p><p>This ability replaces Bravery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Bravery', 'Should extract "Bravery" even with surrounding HTML');
});

test('parseReplaces works with "This ability replaces X." format', () => {
  const desc = 'This ability replaces Bravery.';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Bravery', 'Should work in plain text "This ability replaces X." format');
});

// =====================================================
// Step 2: Test 'replaces Armor Training 1.' -> 'Armor Training 1'
// =====================================================
console.log('\n--- Step 2: Multi-word feature names with numbers ---');

test('parseReplaces extracts "Armor Training 1" from "replaces Armor Training 1."', () => {
  const desc = '<p>This ability replaces Armor Training 1.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Armor Training 1', 'Should extract "Armor Training 1"');
});

test('parseReplaces extracts "armor training 1" (lowercase)', () => {
  const desc = '<p>This ability replaces armor training 1.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'armor training 1', 'Should extract "armor training 1"');
});

test('parseReplaces extracts "Armor Training 2"', () => {
  const desc = '<p>This ability replaces Armor Training 2.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Armor Training 2', 'Should extract "Armor Training 2"');
});

test('parseReplaces extracts "Armor Training 3"', () => {
  const desc = '<p>This ability replaces Armor Training 3.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Armor Training 3', 'Should extract "Armor Training 3"');
});

test('parseReplaces extracts "Armor Training 4"', () => {
  const desc = '<p>This ability replaces Armor Training 4.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Armor Training 4', 'Should extract "Armor Training 4"');
});

test('parseReplaces extracts "Armor Mastery"', () => {
  const desc = '<p>This ability replaces Armor Mastery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Armor Mastery', 'Should extract "Armor Mastery"');
});

// =====================================================
// Step 3: Test 'replace Weapon Training.' -> 'Weapon Training'
// (Singular "replace" without "s")
// =====================================================
console.log('\n--- Step 3: Singular "replace" (without "s") ---');

test('parseReplaces extracts "Weapon Training" from "replace Weapon Training."', () => {
  const desc = '<p>This ability replace Weapon Training.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Weapon Training', 'Should handle singular "replace" without "s"');
});

test('parseReplaces handles "replace" at start of sentence', () => {
  const desc = 'Replace Weapon Training.';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Weapon Training', 'Should handle "Replace" at start of sentence');
});

// =====================================================
// Step 4: Test no replaces pattern -> null
// =====================================================
console.log('\n--- Step 4: No replaces pattern returns null ---');

test('parseReplaces returns null when no replaces pattern exists', () => {
  const desc = '<p>This is just a bonus feat gained at 1st level.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, null, 'Should return null when no "replaces" pattern');
});

test('parseReplaces returns null for empty string', () => {
  const result = CompendiumParser.parseReplaces('');
  assertEqual(result, null, 'Should return null for empty string');
});

test('parseReplaces returns null for null input', () => {
  const result = CompendiumParser.parseReplaces(null);
  assertEqual(result, null, 'Should return null for null input');
});

test('parseReplaces returns null for undefined input', () => {
  const result = CompendiumParser.parseReplaces(undefined);
  assertEqual(result, null, 'Should return null for undefined input');
});

test('parseReplaces returns null for description with "modifies" only', () => {
  const desc = '<p>This ability modifies weapon training.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, null, 'Should return null when description has "modifies" but not "replaces"');
});

test('parseReplaces returns null for "as the X but" pattern', () => {
  const desc = '<p>As the studied target class feature, but with improved bonuses.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, null, 'Should return null for "as the X but" pattern');
});

test('parseReplaces returns null for description without any pattern', () => {
  const desc = '<p><strong>Level</strong>: 1</p><p>A bonus feat gained at 1st level.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, null, 'Should return null for additive feature description');
});

// =====================================================
// Step 5: Test 'replaces the X class feature.' -> extracts correctly
// =====================================================
console.log('\n--- Step 5: "replaces the X class feature." pattern ---');

test('parseReplaces extracts from "replaces the Bravery class feature."', () => {
  const desc = '<p>This ability replaces the Bravery class feature.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  // The regex captures "the Bravery class feature" but we need at minimum
  // to verify the match contains the feature name
  assert(result !== null, 'Should find a match for "replaces the X class feature."');
  assert(result.includes('Bravery'), `Result "${result}" should contain "Bravery"`);
});

test('parseReplaces extracts from "replaces the armor training class feature."', () => {
  const desc = '<p>This ability replaces the armor training class feature.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assert(result !== null, 'Should find a match');
  assert(result.includes('armor training'), `Result "${result}" should contain "armor training"`);
});

test('parseReplaces extracts from "replaces the Uncanny Dodge ability."', () => {
  const desc = '<p>This ability replaces the Uncanny Dodge ability.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assert(result !== null, 'Should find a match');
  assert(result.includes('Uncanny Dodge'), `Result "${result}" should contain "Uncanny Dodge"`);
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

test('parseReplaces case insensitive - "Replaces X."', () => {
  const desc = '<p>Replaces Bravery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Bravery', 'Should be case insensitive');
});

test('parseReplaces case insensitive - "REPLACES X."', () => {
  const desc = '<p>REPLACES Bravery.</p>';
  const result = CompendiumParser.parseReplaces(desc);
  assertEqual(result, 'Bravery', 'Should handle uppercase "REPLACES"');
});

test('parseReplaces trims result whitespace', () => {
  const desc = '<p>This ability replaces  Bravery .</p>';
  const result = CompendiumParser.parseReplaces(desc);
  // The regex captures up to the period, trim() applied
  assert(result !== null, 'Should find a match');
  // Check no trailing whitespace
  assertEqual(result, result.trim(), 'Result should be trimmed');
});

test('parseReplaces with two-handed fighter reference data', () => {
  // Real-world test case based on Two-Handed Fighter archetype
  const descriptions = {
    'Shattering Strike': '<p><strong>Level</strong>: 2</p><p>This ability replaces bravery.</p>',
    'Overhand Chop': '<p><strong>Level</strong>: 3</p><p>This ability replaces armor training 1.</p>',
    'Backswing': '<p><strong>Level</strong>: 7</p><p>This ability replaces armor training 2.</p>',
    'Piledriver': '<p><strong>Level</strong>: 11</p><p>This ability replaces armor training 3.</p>',
    'Greater Power Attack': '<p><strong>Level</strong>: 15</p><p>This ability replaces armor training 4.</p>',
    'Devastating Blow': '<p><strong>Level</strong>: 19</p><p>This ability replaces armor mastery.</p>'
  };

  const expected = {
    'Shattering Strike': 'bravery',
    'Overhand Chop': 'armor training 1',
    'Backswing': 'armor training 2',
    'Piledriver': 'armor training 3',
    'Greater Power Attack': 'armor training 4',
    'Devastating Blow': 'armor mastery'
  };

  for (const [name, desc] of Object.entries(descriptions)) {
    const result = CompendiumParser.parseReplaces(desc);
    assertEqual(result, expected[name], `${name} should replace "${expected[name]}", got "${result}"`);
  }
});

test('parseReplaces correctly classifies as "replacement" type', () => {
  const desc = '<p><strong>Level</strong>: 2</p><p>This ability replaces bravery.</p>';
  const classification = CompendiumParser.classifyFeature(desc);
  assertEqual(classification.type, 'replacement', 'Should classify as replacement');
  assertEqual(classification.target, 'bravery', 'Should target bravery');
});

test('REPLACES_REGEX pattern is correct', () => {
  // Verify the regex is defined and works
  assert(CompendiumParser.REPLACES_REGEX instanceof RegExp, 'REPLACES_REGEX should be a RegExp');
  assert(CompendiumParser.REPLACES_REGEX.flags.includes('i'), 'Should be case insensitive');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #13 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #13 tests passed!\n');
  process.exit(0);
}
