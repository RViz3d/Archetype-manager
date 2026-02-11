/**
 * Test Suite for Feature #12: Parse level from feature descriptions via regex
 *
 * Verifies that CompendiumParser.parseLevel() correctly extracts the level
 * number from archetype feature description HTML.
 *
 * Steps:
 * 1. Test 'Level</strong>: 2' -> returns 2
 * 2. Test 'Level</strong>: 15' -> returns 15
 * 3. Test lowercase variant -> returns correctly
 * 4. Test missing Level tag -> returns null
 * 5. Test multiple Level patterns -> returns first match
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

console.log('\n=== Feature #12: Parse level from feature descriptions via regex ===\n');

// =====================================================
// Step 1: Test 'Level</strong>: 2' -> returns 2
// =====================================================
console.log('--- Step 1: "Level</strong>: 2" pattern -> returns 2 ---');

test('parseLevel extracts 2 from "Level</strong>: 2"', () => {
  const desc = '<p><strong>Level</strong>: 2</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 2, 'Should extract level 2');
});

test('parseLevel extracts 2 from description with surrounding text', () => {
  const desc = '<p>Shattering Strike (<strong>Level</strong>: 2): This ability replaces Bravery.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 2, 'Should extract level 2 from longer description');
});

test('parseLevel extracts 1 from level 1', () => {
  const desc = '<p><strong>Level</strong>: 1</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 1, 'Should extract level 1');
});

test('parseLevel extracts 3 from level 3', () => {
  const desc = '<p><strong>Level</strong>: 3</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 3, 'Should extract level 3');
});

test('parseLevel extracts 5 from level 5', () => {
  const desc = '<p>Weapon Training (<strong>Level</strong>: 5): This ability modifies Weapon Training.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 5, 'Should extract level 5');
});

test('parseLevel extracts 7 from level 7', () => {
  const desc = '<p><strong>Level</strong>: 7</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 7, 'Should extract level 7');
});

// =====================================================
// Step 2: Test 'Level</strong>: 15' -> returns 15
// =====================================================
console.log('\n--- Step 2: "Level</strong>: 15" pattern -> returns 15 ---');

test('parseLevel extracts 15 from "Level</strong>: 15"', () => {
  const desc = '<p><strong>Level</strong>: 15</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 15, 'Should extract level 15');
});

test('parseLevel extracts 19 from "Level</strong>: 19"', () => {
  const desc = '<p>Devastating Blow (<strong>Level</strong>: 19): This ability replaces Armor Mastery.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 19, 'Should extract level 19');
});

test('parseLevel extracts 20 from level 20', () => {
  const desc = '<p><strong>Level</strong>: 20</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 20, 'Should extract level 20');
});

test('parseLevel extracts 11 from level 11', () => {
  const desc = '<p>Piledriver (<strong>Level</strong>: 11): This ability replaces Armor Training 3.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 11, 'Should extract level 11');
});

test('parseLevel extracts 10 from two-digit level', () => {
  const desc = '<p><strong>Level</strong>: 10</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 10, 'Should extract level 10');
});

// =====================================================
// Step 3: Test lowercase variant -> returns correctly
// =====================================================
console.log('\n--- Step 3: Lowercase variant -> returns correctly ---');

test('parseLevel handles "level</strong>: 5" (lowercase "level")', () => {
  const desc = '<p><strong>level</strong>: 5</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 5, 'Should extract level 5 from lowercase variant');
});

test('parseLevel handles "LEVEL</strong>: 8" (uppercase "LEVEL")', () => {
  const desc = '<p><strong>LEVEL</strong>: 8</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 8, 'Should extract level 8 from uppercase variant');
});

test('parseLevel handles "Level</strong>: 3" (standard mixed case)', () => {
  const desc = '<p><strong>Level</strong>: 3</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 3, 'Should extract level 3 from mixed case');
});

test('parseLevel handles "lEvEl</strong>: 12" (weird mixed case)', () => {
  const desc = '<p><strong>lEvEl</strong>: 12</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 12, 'Should extract level 12 from weird case');
});

// =====================================================
// Step 4: Test missing Level tag -> returns null
// =====================================================
console.log('\n--- Step 4: Missing Level tag -> returns null ---');

test('parseLevel returns null for description with no Level tag', () => {
  const desc = '<p>This is a regular description without any level information.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, null, 'Should return null for no Level tag');
});

test('parseLevel returns null for empty string', () => {
  const result = CompendiumParser.parseLevel('');
  assertEqual(result, null, 'Should return null for empty string');
});

test('parseLevel returns null for null input', () => {
  const result = CompendiumParser.parseLevel(null);
  assertEqual(result, null, 'Should return null for null input');
});

test('parseLevel returns null for undefined input', () => {
  const result = CompendiumParser.parseLevel(undefined);
  assertEqual(result, null, 'Should return null for undefined input');
});

test('parseLevel returns null for description with "Level" text but no strong tag', () => {
  const desc = '<p>Level: 5</p>';
  const result = CompendiumParser.parseLevel(desc);
  // The regex requires Level</strong>: so plain text "Level:" should not match
  assertEqual(result, null, 'Should return null for Level without </strong> closing tag');
});

test('parseLevel returns null for description with only number', () => {
  const desc = '<p>42</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, null, 'Should return null for just a number');
});

test('parseLevel returns null for "replaces X" only description', () => {
  const desc = '<p>This ability replaces Bravery.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, null, 'Should return null for replaces-only description');
});

// =====================================================
// Step 5: Test multiple Level patterns -> returns first match
// =====================================================
console.log('\n--- Step 5: Multiple Level patterns -> returns first match ---');

test('parseLevel returns first match when multiple Level tags present', () => {
  const desc = '<p><strong>Level</strong>: 3. Also see <strong>Level</strong>: 7.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 3, 'Should return first match (3), not second (7)');
});

test('parseLevel returns first match from complex description', () => {
  const desc = '<p>Feature (<strong>Level</strong>: 5): At <strong>Level</strong>: 10, this improves.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 5, 'Should return first match (5), not second (10)');
});

test('parseLevel returns first even when second is smaller', () => {
  const desc = '<p><strong>Level</strong>: 15. Requirements: <strong>Level</strong>: 2.</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(result, 15, 'Should return first match (15), not second (2)');
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

test('parseLevel extracts number immediately after colon+space', () => {
  const desc = '<p><strong>Level</strong>:  2</p>';  // Extra space
  const result = CompendiumParser.parseLevel(desc);
  // Regex uses \s* which matches zero or more whitespace
  assertEqual(result, 2, 'Should handle extra whitespace');
});

test('parseLevel extracts number with no space after colon', () => {
  const desc = '<p><strong>Level</strong>:2</p>';  // No space
  const result = CompendiumParser.parseLevel(desc);
  // Regex uses \s* which matches zero whitespace too
  assertEqual(result, 2, 'Should handle no space after colon');
});

test('parseLevel works with Two-Handed Fighter reference data', () => {
  // Real-world test: Two-Handed Fighter archetype features
  const features = [
    { desc: '<p>Shattering Strike (<strong>Level</strong>: 2): replaces Bravery.</p>', expected: 2 },
    { desc: '<p>Overhand Chop (<strong>Level</strong>: 3): replaces Armor Training 1.</p>', expected: 3 },
    { desc: '<p>Weapon Training (<strong>Level</strong>: 5): modifies Weapon Training.</p>', expected: 5 },
    { desc: '<p>Backswing (<strong>Level</strong>: 7): replaces Armor Training 2.</p>', expected: 7 },
    { desc: '<p>Piledriver (<strong>Level</strong>: 11): replaces Armor Training 3.</p>', expected: 11 },
    { desc: '<p>Greater Power Attack (<strong>Level</strong>: 15): replaces Armor Training 4.</p>', expected: 15 },
    { desc: '<p>Devastating Blow (<strong>Level</strong>: 19): replaces Armor Mastery.</p>', expected: 19 }
  ];

  for (const { desc, expected } of features) {
    const result = CompendiumParser.parseLevel(desc);
    assertEqual(result, expected, `Should extract ${expected} from Two-Handed Fighter feature`);
  }
});

test('parseLevel returns integer (not string)', () => {
  const desc = '<p><strong>Level</strong>: 7</p>';
  const result = CompendiumParser.parseLevel(desc);
  assertEqual(typeof result, 'number', 'Should return a number type');
  assert(Number.isInteger(result), 'Should return an integer');
});

test('LEVEL_REGEX exists as a static property', () => {
  assert(CompendiumParser.LEVEL_REGEX instanceof RegExp, 'LEVEL_REGEX should be a RegExp');
  assert(CompendiumParser.LEVEL_REGEX.flags.includes('i'), 'LEVEL_REGEX should be case-insensitive');
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  console.error(`FAIL: ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('SUCCESS: All tests passed!');
}
