/**
 * Test Suite for Feature #15: Identify additive features correctly
 *
 * Verifies that CompendiumParser.classifyFeature() correctly identifies additive features:
 * features that have a level tag but no replace/modify pattern, meaning they are
 * new features added by the archetype without removing any base class feature.
 *
 * Steps:
 * 1. Feature with Level but no replaces/modifies -> additive
 * 2. Feature with Level AND replaces -> replacement, not additive
 * 3. Feature with Level AND modifies -> modification, not additive
 * 4. Verify additive features don't remove base features
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

console.log('\n=== Feature #15: Identify additive features correctly ===\n');

// =====================================================
// Step 1: Feature with Level but no replaces/modifies -> additive
// =====================================================
console.log('--- Step 1: Level tag + no replaces/modifies = additive ---');

test('Feature with Level tag only classified as additive', () => {
  const desc = '<p>Bonus Feature (<strong>Level</strong>: 4): This grants a special ability.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'additive', 'Should classify as additive');
});

test('Additive feature has null target', () => {
  const desc = '<p>Extra Ability (<strong>Level</strong>: 6): Grants an extra ability.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.target, null, 'Additive features should have null target');
});

test('Feature with just Level: 1 is additive', () => {
  const desc = '<p><strong>Level</strong>: 1</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'additive', 'Level-only description should be additive');
});

test('Feature with Level: 20 and flavor text is additive', () => {
  const desc = '<p>Capstone (<strong>Level</strong>: 20): At 20th level, the character gains immense power.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'additive', 'Level 20 feature without replace/modify is additive');
});

test('Feature with Level: 10 and non-keyword text is additive', () => {
  const desc = '<p>Improved Strike (<strong>Level</strong>: 10): The fighter\'s strikes deal additional damage.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'additive', 'Level 10 feature without replace/modify keywords is additive');
});

test('Additive feature at level 3', () => {
  const desc = '<p><strong>Level</strong>: 3. This class feature provides additional bonuses to saving throws.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'additive', 'Level 3 feature without replace/modify should be additive');
});

test('Real-world example: Weapon Training (Two-Handed Fighter lv5) is modification not additive', () => {
  // Weapon Training from Two-Handed Fighter modifies the base Weapon Training
  const desc = '<p>Weapon Training (<strong>Level</strong>: 5): This ability modifies Weapon Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  // This should NOT be additive because it has a modifies pattern
  assertEqual(result.type, 'modification', 'Weapon Training should be modification, not additive');
});

// =====================================================
// Step 2: Feature with Level AND replaces -> replacement, not additive
// =====================================================
console.log('\n--- Step 2: Level + replaces = replacement, NOT additive ---');

test('Feature with Level AND replaces classified as replacement', () => {
  const desc = '<p>Shattering Strike (<strong>Level</strong>: 2): This ability replaces Bravery.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'replacement', 'Should classify as replacement');
});

test('Replacement feature has correct target', () => {
  const desc = '<p>Shattering Strike (<strong>Level</strong>: 2): This ability replaces Bravery.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.target, 'Bravery', 'Should have target "Bravery"');
});

test('Feature with Level AND "replace" (singular) classified as replacement', () => {
  const desc = '<p>Shield Fighter (<strong>Level</strong>: 3): This replace Armor Training 1.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'replacement', 'Singular "replace" should still be replacement');
});

test('Replacement takes priority over additive classification', () => {
  // Even though it has a Level tag, the replaces pattern makes it a replacement
  const desc = '<p>Overhand Chop (<strong>Level</strong>: 3): This ability replaces Armor Training 1.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'replacement', 'replaces pattern should override additive');
  assertEqual(result.target, 'Armor Training 1', 'Target should be Armor Training 1');
});

test('All Two-Handed Fighter replacement features classified correctly', () => {
  const replacementFeatures = [
    { desc: '<p>Shattering Strike (<strong>Level</strong>: 2): replaces Bravery.</p>', target: 'Bravery' },
    { desc: '<p>Overhand Chop (<strong>Level</strong>: 3): replaces Armor Training 1.</p>', target: 'Armor Training 1' },
    { desc: '<p>Backswing (<strong>Level</strong>: 7): replaces Armor Training 2.</p>', target: 'Armor Training 2' },
    { desc: '<p>Piledriver (<strong>Level</strong>: 11): replaces Armor Training 3.</p>', target: 'Armor Training 3' },
    { desc: '<p>Greater Power Attack (<strong>Level</strong>: 15): replaces Armor Training 4.</p>', target: 'Armor Training 4' },
    { desc: '<p>Devastating Blow (<strong>Level</strong>: 19): replaces Armor Mastery.</p>', target: 'Armor Mastery' }
  ];

  for (const { desc, target } of replacementFeatures) {
    const result = CompendiumParser.classifyFeature(desc);
    assertEqual(result.type, 'replacement', `Feature replacing ${target} should be replacement`);
    assertEqual(result.target, target, `Target should be ${target}`);
  }
});

// =====================================================
// Step 3: Feature with Level AND modifies -> modification, not additive
// =====================================================
console.log('\n--- Step 3: Level + modifies = modification, NOT additive ---');

test('Feature with Level AND modifies classified as modification', () => {
  const desc = '<p>Weapon Training (<strong>Level</strong>: 5): This ability modifies Weapon Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'modification', 'Should classify as modification');
});

test('Modification feature has correct target', () => {
  const desc = '<p>Custom Feature (<strong>Level</strong>: 8): This modifies Armor Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.target, 'Armor Training', 'Should have target "Armor Training"');
});

test('Feature with Level AND "modify" (base form) classified as modification', () => {
  const desc = '<p>Alternative Training (<strong>Level</strong>: 4): This modify Weapon Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'modification', 'Base form "modify" should be modification');
});

test('Feature with Level AND "modifying" classified as modification', () => {
  const desc = '<p>Variant Ability (<strong>Level</strong>: 6): This works by modifying Spellcasting.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'modification', '"modifying" should be modification');
});

test('Modification takes priority over additive classification', () => {
  const desc = '<p>Improved Training (<strong>Level</strong>: 9): This ability modifies Combat Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'modification', 'modifies pattern should override additive');
  assert(result.target !== null, 'Modification should have a non-null target');
});

// =====================================================
// Step 4: Verify additive features don't remove base features
// =====================================================
console.log('\n--- Step 4: Additive features don\'t remove base features ---');

test('Additive feature has null target (nothing to remove)', () => {
  const desc = '<p>Bonus Feat (<strong>Level</strong>: 1): The fighter gains a bonus combat feat.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'additive', 'Should be additive');
  assertEqual(result.target, null, 'Additive should have null target - nothing to remove');
});

test('Multiple additive features all have null targets', () => {
  const additiveDescs = [
    '<p>Extra Feat (<strong>Level</strong>: 2): Grants an extra feat.</p>',
    '<p>Special Ability (<strong>Level</strong>: 6): Grants a special ability.</p>',
    '<p>Greater Power (<strong>Level</strong>: 12): Grants greater power.</p>',
    '<p>Ultimate Skill (<strong>Level</strong>: 18): Grants ultimate skill.</p>'
  ];

  for (const desc of additiveDescs) {
    const result = CompendiumParser.classifyFeature(desc);
    assertEqual(result.type, 'additive', 'Should be additive');
    assertEqual(result.target, null, 'Additive target must be null');
  }
});

test('parseLevel returns level for additive feature', () => {
  const desc = '<p>Bonus Strike (<strong>Level</strong>: 4): Grants a bonus strike.</p>';
  const level = CompendiumParser.parseLevel(desc);
  assertEqual(level, 4, 'parseLevel should still extract level from additive feature');
});

test('parseReplaces returns null for additive feature', () => {
  const desc = '<p>Bonus Strike (<strong>Level</strong>: 4): Grants a bonus strike.</p>';
  const replaces = CompendiumParser.parseReplaces(desc);
  assertEqual(replaces, null, 'parseReplaces should return null for additive');
});

test('parseModifies returns null for additive feature', () => {
  const desc = '<p>Bonus Strike (<strong>Level</strong>: 4): Grants a bonus strike.</p>';
  const modifies = CompendiumParser.parseModifies(desc);
  assertEqual(modifies, null, 'parseModifies should return null for additive');
});

// =====================================================
// Additional edge cases: unknown type
// =====================================================
console.log('\n--- Edge cases ---');

test('Feature with no Level, no replaces, no modifies classified as unknown', () => {
  const desc = '<p>This is a vague description with no classification patterns.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'unknown', 'Should classify as unknown');
  assertEqual(result.target, null, 'Unknown should have null target');
});

test('Empty description classified as unknown', () => {
  const result = CompendiumParser.classifyFeature('');
  assertEqual(result.type, 'unknown', 'Empty description should be unknown');
});

test('Null description classified as unknown', () => {
  const result = CompendiumParser.classifyFeature(null);
  assertEqual(result.type, 'unknown', 'Null description should be unknown');
});

test('Undefined description classified as unknown', () => {
  const result = CompendiumParser.classifyFeature(undefined);
  assertEqual(result.type, 'unknown', 'Undefined description should be unknown');
});

test('Classification priority: replaces checked before modifies', () => {
  // A feature that has both "replaces X" and "modifies Y" patterns
  // replaces should take priority since it's checked first
  const desc = '<p>(<strong>Level</strong>: 5): This ability replaces Bravery. It also modifies Armor Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'replacement', 'replaces should take priority over modifies');
  assertEqual(result.target, 'Bravery', 'Target should be from the replaces pattern');
});

test('Classification priority: replaces checked before additive', () => {
  const desc = '<p>(<strong>Level</strong>: 3): This replaces Weapon Training.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'replacement', 'replaces should take priority over additive');
});

test('Classification priority: modifies checked before additive', () => {
  const desc = '<p>(<strong>Level</strong>: 7): This ability modifies Sneak Attack.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assertEqual(result.type, 'modification', 'modifies should take priority over additive');
});

test('classifyFeature returns object with type and target', () => {
  const desc = '<p>Test (<strong>Level</strong>: 1): A test feature.</p>';
  const result = CompendiumParser.classifyFeature(desc);
  assert('type' in result, 'Result should have type property');
  assert('target' in result, 'Result should have target property');
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
