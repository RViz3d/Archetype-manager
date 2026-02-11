/**
 * Test Suite for Feature #16: Feature name normalization for matching
 *
 * Verifies that CompendiumParser.normalizeName() correctly normalizes feature
 * names by stripping trailing tier numbers, parentheticals, whitespace, and
 * lowercasing — enabling fuzzy matching between parsed "replaces X" text
 * and classAssociations entries.
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

console.log('\n=== Feature #16: Feature name normalization for matching ===\n');

// =====================================================
// Step 1: 'Armor Training 1' -> 'armor training'
// =====================================================
console.log('--- Step 1: Strip trailing numbers ---');

test('normalizeName strips trailing "1" from "Armor Training 1"', () => {
  const result = CompendiumParser.normalizeName('Armor Training 1');
  assertEqual(result, 'armor training', 'Should strip trailing number and lowercase');
});

test('normalizeName strips trailing "2" from "Armor Training 2"', () => {
  const result = CompendiumParser.normalizeName('Armor Training 2');
  assertEqual(result, 'armor training', 'Should strip trailing "2"');
});

test('normalizeName strips trailing "3" from "Armor Training 3"', () => {
  const result = CompendiumParser.normalizeName('Armor Training 3');
  assertEqual(result, 'armor training', 'Should strip trailing "3"');
});

test('normalizeName strips trailing "4" from "Armor Training 4"', () => {
  const result = CompendiumParser.normalizeName('Armor Training 4');
  assertEqual(result, 'armor training', 'Should strip trailing "4"');
});

test('normalizeName does NOT strip internal numbers (e.g., "Feat 1 Extra")', () => {
  // Trailing number regex should only match at end
  const result = CompendiumParser.normalizeName('Feat 1 Extra');
  // The number is not at the end, so it should remain
  assert(result.includes('1'), 'Internal number should not be stripped');
});

test('All Armor Training tiers normalize to same base name', () => {
  const t1 = CompendiumParser.normalizeName('Armor Training 1');
  const t2 = CompendiumParser.normalizeName('Armor Training 2');
  const t3 = CompendiumParser.normalizeName('Armor Training 3');
  const t4 = CompendiumParser.normalizeName('Armor Training 4');
  assertEqual(t1, 'armor training', 'AT1 should normalize');
  assertEqual(t2, 'armor training', 'AT2 should normalize');
  assertEqual(t3, 'armor training', 'AT3 should normalize');
  assertEqual(t4, 'armor training', 'AT4 should normalize');
});

// =====================================================
// Step 2: 'Weapon Training (Swords)' -> 'weapon training'
// =====================================================
console.log('\n--- Step 2: Strip parentheticals ---');

test('normalizeName strips "(Swords)" from "Weapon Training (Swords)"', () => {
  const result = CompendiumParser.normalizeName('Weapon Training (Swords)');
  assertEqual(result, 'weapon training', 'Should strip parenthetical');
});

test('normalizeName strips "(Heavy Blades)" from "Weapon Training (Heavy Blades)"', () => {
  const result = CompendiumParser.normalizeName('Weapon Training (Heavy Blades)');
  assertEqual(result, 'weapon training', 'Should strip parenthetical with spaces');
});

test('normalizeName strips multiple parentheticals', () => {
  const result = CompendiumParser.normalizeName('Feature (Modifier) (Extra)');
  assertEqual(result, 'feature', 'Should strip multiple parentheticals');
});

test('normalizeName strips parenthetical in middle of name', () => {
  const result = CompendiumParser.normalizeName('Rage (Greater) Powers');
  assertEqual(result, 'rage powers', 'Should strip parenthetical from middle');
});

test('normalizeName strips parenthetical with numbers inside', () => {
  const result = CompendiumParser.normalizeName('Sneak Attack (3d6)');
  assertEqual(result, 'sneak attack', 'Should strip parenthetical containing numbers');
});

// =====================================================
// Step 3: '  Bravery  ' -> 'bravery'
// =====================================================
console.log('\n--- Step 3: Strip whitespace ---');

test('normalizeName trims leading whitespace from "  Bravery  "', () => {
  const result = CompendiumParser.normalizeName('  Bravery  ');
  assertEqual(result, 'bravery', 'Should trim whitespace and lowercase');
});

test('normalizeName trims tabs and mixed whitespace', () => {
  const result = CompendiumParser.normalizeName('\t Bravery \t');
  assertEqual(result, 'bravery', 'Should trim tabs and whitespace');
});

test('normalizeName handles single word with no extra spaces', () => {
  const result = CompendiumParser.normalizeName('Bravery');
  assertEqual(result, 'bravery', 'Single word should just be lowercased');
});

// =====================================================
// Step 4: 'Armor Training IV' -> 'armor training'
// =====================================================
console.log('\n--- Step 4: Strip Roman numerals ---');

test('normalizeName strips "IV" from "Armor Training IV"', () => {
  const result = CompendiumParser.normalizeName('Armor Training IV');
  assertEqual(result, 'armor training', 'Should strip Roman numeral IV');
});

test('normalizeName strips "I" from "Armor Training I"', () => {
  const result = CompendiumParser.normalizeName('Armor Training I');
  assertEqual(result, 'armor training', 'Should strip Roman numeral I');
});

test('normalizeName strips "II" from "Armor Training II"', () => {
  const result = CompendiumParser.normalizeName('Armor Training II');
  assertEqual(result, 'armor training', 'Should strip Roman numeral II');
});

test('normalizeName strips "III" from "Armor Training III"', () => {
  const result = CompendiumParser.normalizeName('Armor Training III');
  assertEqual(result, 'armor training', 'Should strip Roman numeral III');
});

test('normalizeName strips "V" from "Feature V"', () => {
  const result = CompendiumParser.normalizeName('Feature V');
  assertEqual(result, 'feature', 'Should strip Roman numeral V');
});

test('normalizeName strips "VI" from "Feature VI"', () => {
  const result = CompendiumParser.normalizeName('Feature VI');
  assertEqual(result, 'feature', 'Should strip Roman numeral VI');
});

// =====================================================
// Step 5: Case insensitive matching works
// =====================================================
console.log('\n--- Step 5: Case insensitive matching ---');

test('normalizeName lowercases "BRAVERY" to "bravery"', () => {
  const result = CompendiumParser.normalizeName('BRAVERY');
  assertEqual(result, 'bravery', 'Should lowercase all caps');
});

test('normalizeName lowercases "Armor Mastery" to "armor mastery"', () => {
  const result = CompendiumParser.normalizeName('Armor Mastery');
  assertEqual(result, 'armor mastery', 'Should lowercase mixed case');
});

test('normalizeName allows matching between different cases', () => {
  const a = CompendiumParser.normalizeName('Bravery');
  const b = CompendiumParser.normalizeName('bravery');
  const c = CompendiumParser.normalizeName('BRAVERY');
  assertEqual(a, b, '"Bravery" and "bravery" should normalize the same');
  assertEqual(b, c, '"bravery" and "BRAVERY" should normalize the same');
});

test('normalizeName allows matching between tiered variants', () => {
  const base = CompendiumParser.normalizeName('Armor Training');
  const t1 = CompendiumParser.normalizeName('Armor Training 1');
  const tIV = CompendiumParser.normalizeName('Armor Training IV');
  assertEqual(base, t1, 'Base and tier 1 should normalize the same');
  assertEqual(base, tIV, 'Base and tier IV should normalize the same');
});

test('normalizeName enables matchTarget to find fuzzy matches', () => {
  // Simulate classAssociations with resolved names
  const associations = [
    { resolvedName: 'Armor Training 1', level: 3 },
    { resolvedName: 'Armor Training 2', level: 7 },
    { resolvedName: 'Bravery', level: 2 },
    { resolvedName: 'Armor Mastery', level: 19 }
  ];

  // Test matching "bravery" against "Bravery"
  const match1 = CompendiumParser.matchTarget('bravery', associations);
  assert(match1 !== null, 'Should match "bravery" to "Bravery"');
  assertEqual(match1.resolvedName, 'Bravery', 'Should match Bravery');

  // Test matching "armor mastery" against "Armor Mastery"
  const match2 = CompendiumParser.matchTarget('armor mastery', associations);
  assert(match2 !== null, 'Should match "armor mastery" to "Armor Mastery"');
  assertEqual(match2.resolvedName, 'Armor Mastery', 'Should match Armor Mastery');
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

test('normalizeName returns empty string for null', () => {
  const result = CompendiumParser.normalizeName(null);
  assertEqual(result, '', 'Should return empty string for null');
});

test('normalizeName returns empty string for undefined', () => {
  const result = CompendiumParser.normalizeName(undefined);
  assertEqual(result, '', 'Should return empty string for undefined');
});

test('normalizeName returns empty string for empty string', () => {
  const result = CompendiumParser.normalizeName('');
  assertEqual(result, '', 'Should return empty string for empty input');
});

test('normalizeName handles name with both parenthetical and trailing number', () => {
  const result = CompendiumParser.normalizeName('Weapon Training (Swords) 2');
  // Should strip both "(Swords)" and trailing "2"
  assertEqual(result, 'weapon training', 'Should strip both parenthetical and trailing number');
});

test('normalizeName handles "Armor Mastery" (no tier)', () => {
  const result = CompendiumParser.normalizeName('Armor Mastery');
  assertEqual(result, 'armor mastery', 'Should just lowercase Armor Mastery');
});

test('normalizeName preserves hyphens in feature names', () => {
  const result = CompendiumParser.normalizeName('Half-Orc Trait');
  assertEqual(result, 'half-orc trait', 'Should preserve hyphens');
});

test('normalizeName consistency: Two-Handed Fighter archetype feature names', () => {
  // These are the real feature names from the Two-Handed Fighter archetype reference
  const names = [
    'Shattering Strike',
    'Overhand Chop',
    'Weapon Training',
    'Backswing',
    'Piledriver',
    'Greater Power Attack',
    'Devastating Blow'
  ];

  for (const name of names) {
    const result = CompendiumParser.normalizeName(name);
    assert(result.length > 0, `"${name}" should normalize to non-empty string`);
    assertEqual(result, name.toLowerCase(), `"${name}" should normalize to lowercase form`);
  }
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #16 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #16 tests passed!\n');
  process.exit(0);
}
