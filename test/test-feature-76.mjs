/**
 * Test Suite for Feature #76: No duplicate feature names in manual entry
 *
 * Verifies that the manual archetype entry dialog detects and rejects
 * duplicate feature names, and that renaming the duplicate allows submission.
 *
 * Steps:
 * 1. Add feature 'Bonus Feat' at level 1
 * 2. Add another 'Bonus Feat' at level 2
 * 3. Submit -> duplicate error
 * 4. Rename second -> succeeds
 */

import { setupMockEnvironment } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

/**
 * Create a mock DOM element for validation testing
 */
function createMockFormHTML(data) {
  const elements = new Map();

  if (data.entryType !== undefined) {
    elements.set('[name="entry-type"]', { value: data.entryType });
  }
  if (data.archetypeName !== undefined) {
    elements.set('[name="archetype-name"]', { value: data.archetypeName });
  }
  if (data.archetypeClass !== undefined) {
    elements.set('[name="archetype-class"]', { value: data.archetypeClass });
  }

  const featureRowElements = [];
  if (data.features) {
    data.features.forEach((feat, idx) => {
      elements.set(`[name="feat-name-${idx}"]`, { value: feat.name || '' });
      elements.set(`[name="feat-level-${idx}"]`, { value: feat.level !== undefined ? String(feat.level) : '' });
      elements.set(`[name="feat-replaces-${idx}"]`, { value: feat.replaces || '' });
      featureRowElements.push({ dataset: { index: String(idx) } });
    });
  }

  return {
    querySelector: (selector) => elements.get(selector) || null,
    querySelectorAll: (selector) => {
      if (selector === '.feature-row') return featureRowElements;
      return [];
    }
  };
}

// =====================================================
// Setup
// =====================================================
console.log('\n=== Feature #76: No duplicate feature names in manual entry ===\n');

const { hooks } = setupMockEnvironment();

await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { UIManager } = await import('../scripts/ui-manager.mjs');

// =====================================================
// Step 1 & 2: Add 'Bonus Feat' at level 1, then another 'Bonus Feat' at level 2
// Step 3: Submit -> duplicate error
// =====================================================
console.log('\n--- Step 1-3: Exact duplicate feature names produce error ---');

await testAsync('Exact duplicate "Bonus Feat" names at different levels rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with duplicate feature names');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
  assertEqual(result.data, null, 'Data should be null on failure');
});

await testAsync('Duplicate error message includes the duplicated name', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('Bonus Feat')), 'Error should include the feature name "Bonus Feat"');
});

await testAsync('Exactly one duplicate error for two identical names', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  const dupErrors = result.errors.filter(e => e.includes('Duplicate'));
  assertEqual(dupErrors.length, 1, 'Should have exactly 1 duplicate error');
});

// =====================================================
// Step 4: Rename second -> succeeds
// =====================================================
console.log('\n--- Step 4: Rename second feature to unique name -> succeeds ---');

await testAsync('Renaming duplicate to unique name allows submission', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Greater Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid after rename, got errors: ${result.errors.join(', ')}`);
  assert(result.data !== null, 'Data should not be null');
  assertEqual(Object.keys(result.data.entry.features).length, 2, 'Should have 2 features');
});

await testAsync('Both unique features are present in output data', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Greater Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, 'Should be valid');
  assertEqual(result.data.entry.features['bonus-feat'].level, 1, 'First feature level');
  assertEqual(result.data.entry.features['greater-bonus-feat'].level, 2, 'Second feature level');
});

// =====================================================
// Case-insensitive duplicate detection
// =====================================================
console.log('\n--- Case-insensitive duplicate detection ---');

await testAsync('Case-insensitive duplicates are detected ("bonus feat" vs "Bonus Feat")', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'bonus feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with case-insensitive duplicate');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

await testAsync('Mixed case duplicates detected ("BONUS FEAT" vs "Bonus Feat")', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'BONUS FEAT', level: 5, replaces: 'weapon training' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with UPPER CASE duplicate');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

await testAsync('Different case features that are NOT duplicates pass', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feats', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid - different names, got errors: ${result.errors.join(', ')}`);
});

// =====================================================
// Triple duplicates and more
// =====================================================
console.log('\n--- Multiple duplicates ---');

await testAsync('Three features with same name: multiple duplicate errors', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 3, replaces: '' },
      { name: 'Bonus Feat', level: 5, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with 3 duplicate names');
  const dupErrors = result.errors.filter(e => e.includes('Duplicate'));
  assert(dupErrors.length >= 1, 'Should have at least 1 duplicate error');
});

await testAsync('Two different sets of duplicates both detected', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Armor Training', level: 3, replaces: '' },
      { name: 'Bonus Feat', level: 5, replaces: '' },
      { name: 'Armor Training', level: 7, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with two sets of duplicates');
  const dupErrors = result.errors.filter(e => e.includes('Duplicate'));
  assert(dupErrors.length >= 2, `Should have at least 2 duplicate errors, got ${dupErrors.length}`);
});

// =====================================================
// Duplicate among valid and invalid rows
// =====================================================
console.log('\n--- Duplicates with different replaces/levels ---');

await testAsync('Duplicates with different replaces fields are still rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: 'bravery' },
      { name: 'Bonus Feat', level: 2, replaces: 'armor training' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Different replaces does not make duplicates OK');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

await testAsync('Duplicate among features where one replaces and one is additive', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: 'bravery' },
      { name: 'Bonus Feat', level: 5, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'One replacing and one additive with same name still rejected');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

// =====================================================
// Edge cases with whitespace
// =====================================================
console.log('\n--- Whitespace edge cases ---');

await testAsync('Leading/trailing whitespace treated as same name', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: '  Bonus Feat  ', level: 2, replaces: '' }
    ]
  });

  // The validator trims names, so " Bonus Feat " becomes "Bonus Feat" = duplicate
  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Whitespace-trimmed duplicates should be rejected');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

// =====================================================
// Positive cases: unique names succeed
// =====================================================
console.log('\n--- Positive cases: unique names succeed ---');

await testAsync('Three unique features all succeed', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Master Archer',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Trick Shot', level: 1, replaces: 'bonus feat' },
      { name: 'Improved Aim', level: 3, replaces: 'armor training' },
      { name: 'Arrow Storm', level: 10, replaces: 'weapon training' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid with unique names, got: ${result.errors.join(', ')}`);
  assertEqual(Object.keys(result.data.entry.features).length, 3, 'Should have 3 features');
});

await testAsync('Similar but distinct names pass (Feat, Feats, Feat II)', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feats', level: 3, replaces: '' },
      { name: 'Bonus Feat II', level: 5, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid - all names unique, got: ${result.errors.join(', ')}`);
  assertEqual(Object.keys(result.data.entry.features).length, 3, 'Should have 3 features');
});

// =====================================================
// Integration: duplicate doesn't block other errors
// =====================================================
console.log('\n--- Integration with other validation errors ---');

await testAsync('Duplicate error combined with missing class error', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test',
    archetypeClass: '',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('Class')), 'Should have class error');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Should have duplicate error');
});

await testAsync('Duplicate error combined with missing archetype name', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: '',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 5, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('Archetype name')), 'Should have name error');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Should have duplicate error');
});

// =====================================================
// Entry type variations
// =====================================================
console.log('\n--- Both entry types handle duplicates ---');

await testAsync('Duplicate rejection works for "missing" entry type', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Official Archetype',
    archetypeClass: 'Rogue',
    features: [
      { name: 'Sneak Strike', level: 1, replaces: 'sneak attack' },
      { name: 'Sneak Strike', level: 5, replaces: 'uncanny dodge' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid even for "missing" type');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

await testAsync('Duplicate rejection works for "custom" entry type', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Homebrew Archetype',
    archetypeClass: 'Wizard',
    features: [
      { name: 'Arcane Blast', level: 1, replaces: '' },
      { name: 'Arcane Blast', level: 10, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid for "custom" type');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

// =====================================================
// Skip empty rows don't contribute to duplicates
// =====================================================
console.log('\n--- Empty rows ignored in duplicate check ---');

await testAsync('Empty rows between duplicates still caught', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: '', level: '', replaces: '' },
      { name: 'Bonus Feat', level: 5, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Empty rows between duplicates still caught');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

await testAsync('Single feature with empty rows is valid (no duplicates)', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: '', level: '', replaces: '' },
      { name: '', level: '', replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Single feature + empty rows should be valid, got: ${result.errors.join(', ')}`);
  assertEqual(Object.keys(result.data.entry.features).length, 1, 'Should have 1 feature');
});

// =====================================================
// Full workflow simulation
// =====================================================
console.log('\n--- Full workflow: duplicate -> fix -> succeed ---');

await testAsync('Complete workflow: first submit with duplicate fails, second with rename succeeds', async () => {
  // Step 1-3: First attempt with duplicate names
  const htmlDuplicate = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Weapon Master',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: 'bravery' },
      { name: 'Bonus Feat', level: 2, replaces: 'armor training' }
    ]
  });

  const result1 = UIManager._validateManualEntry(htmlDuplicate);
  assert(!result1.valid, 'First attempt should fail due to duplicate');
  assert(result1.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
  assertEqual(result1.data, null, 'No data on failure');

  // Step 4: Second attempt with renamed feature
  const htmlFixed = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Weapon Master',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: 'bravery' },
      { name: 'Greater Bonus Feat', level: 2, replaces: 'armor training' }
    ]
  });

  const result2 = UIManager._validateManualEntry(htmlFixed);
  assert(result2.valid, `Second attempt should succeed, got: ${result2.errors.join(', ')}`);
  assert(result2.data !== null, 'Data should be present');
  assertEqual(result2.data.slug, 'weapon-master', 'Archetype slug');
  assertEqual(result2.data.entry.features['bonus-feat'].level, 1, 'First feature level');
  assertEqual(result2.data.entry.features['bonus-feat'].replaces, 'bravery', 'First feature replaces');
  assertEqual(result2.data.entry.features['greater-bonus-feat'].level, 2, 'Second feature level');
  assertEqual(result2.data.entry.features['greater-bonus-feat'].replaces, 'armor training', 'Second feature replaces');
});

// =====================================================
// Notification shown on validation failure
// =====================================================
console.log('\n--- Validation error notification ---');

await testAsync('showManualEntryDialog would show error notification for duplicates', async () => {
  // Test the validation path - when _validateManualEntry returns errors,
  // showManualEntryDialog calls ui.notifications.error with formatted errors
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus Feat', level: 1, replaces: '' },
      { name: 'Bonus Feat', level: 2, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');

  // Verify the error messages can be formatted as a notification string
  const errorMsg = `Validation errors:\n${result.errors.join('\n')}`;
  assert(errorMsg.includes('Duplicate'), 'Notification message should include duplicate error');
  assert(errorMsg.includes('Bonus Feat'), 'Notification message should include the feature name');
});

// =====================================================
// Slug collision (different names that slugify to same)
// =====================================================
console.log('\n--- Slug-based considerations ---');

await testAsync('Names that differ only by case produce duplicate error', async () => {
  // "Bonus FEAT" and "bonus feat" both lowercase to "bonus feat"
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Bonus FEAT', level: 1, replaces: '' },
      { name: 'bonus feat', level: 3, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Names differing only by case should be duplicate');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
