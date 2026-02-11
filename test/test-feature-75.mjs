/**
 * Test Suite for Feature #75: Manual entry validates required fields
 *
 * Verifies that the manual archetype entry dialog validates all required
 * fields before saving, and provides appropriate error messages.
 *
 * Steps:
 * 1. Submit with empty name -> error
 * 2. Submit with empty class -> error
 * 3. Submit with no features -> error
 * 4. Feature missing name -> error
 * 5. Invalid level (0, negative, non-numeric) -> error
 * 6. All fields correct -> succeeds
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
console.log('\n=== Feature #75: Manual entry validates required fields ===\n');

const { hooks } = setupMockEnvironment();

await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { UIManager } = await import('../scripts/ui-manager.mjs');

// =====================================================
// Step 1: Submit with empty name -> error
// =====================================================

await testAsync('Step 1a: Empty archetype name is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: '',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with empty name');
  assert(result.errors.length > 0, 'Should have errors');
  assert(result.errors.some(e => e.includes('Archetype name')), 'Error should mention archetype name');
  assertEqual(result.data, null, 'Data should be null on failure');
});

await testAsync('Step 1b: Whitespace-only archetype name is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: '   ',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with whitespace-only name');
  assert(result.errors.some(e => e.includes('Archetype name')), 'Error should mention archetype name');
});

// =====================================================
// Step 2: Submit with empty class -> error
// =====================================================

await testAsync('Step 2a: Empty class is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: '',
    features: [{ name: 'Test Feature', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with empty class');
  assert(result.errors.some(e => e.includes('Class')), 'Error should mention class');
});

await testAsync('Step 2b: Whitespace-only class is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: '  ',
    features: [{ name: 'Test Feature', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with whitespace-only class');
  assert(result.errors.some(e => e.includes('Class')), 'Error should mention class');
});

// =====================================================
// Step 3: Submit with no features -> error
// =====================================================

await testAsync('Step 3a: No feature rows results in error', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [] // No feature rows at all
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with no features');
  assert(result.errors.some(e => e.toLowerCase().includes('feature')), 'Error should mention features');
});

await testAsync('Step 3b: All-empty feature rows results in error', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: '', level: '', replaces: '' },
      { name: '', level: '', replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid when all feature rows are empty');
  assert(result.errors.some(e => e.toLowerCase().includes('feature')), 'Error should mention features');
});

// =====================================================
// Step 4: Feature missing name -> error
// =====================================================

await testAsync('Step 4a: Feature with level but no name is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: '', level: 5, replaces: 'bravery' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid when feature has no name');
  assert(result.errors.some(e => e.includes('Name is required')), 'Error should mention feature name');
});

await testAsync('Step 4b: Feature with replaces but no name is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: '', level: '', replaces: 'bravery' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid when feature has no name but has replaces');
  assert(result.errors.some(e => e.includes('Name is required')), 'Error should mention feature name');
});

// =====================================================
// Step 5: Invalid level (0, negative, non-numeric) -> error
// =====================================================

await testAsync('Step 5a: Level 0 is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 0, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with level 0');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5b: Negative level (-1) is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: -1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with negative level');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5c: Negative level (-5) is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: -5, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with level -5');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5d: Non-numeric level (text) is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 'abc', replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with non-numeric level');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5e: Empty level is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: '', replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with empty level');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5f: Level above 20 is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 21, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with level 21');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5g: Level 100 is rejected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 100, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with level 100');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 5h: Decimal level is handled', async () => {
  // parseInt("3.5") returns 3, which is valid — this is acceptable behavior
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: '3.5', replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  // parseInt("3.5") = 3, which is valid
  assert(result.valid, 'parseInt("3.5")=3 should be valid (truncated to integer)');
  assertEqual(result.data.entry.features['test-feature'].level, 3, 'Level should be 3');
});

// =====================================================
// Step 6: All fields correct -> succeeds
// =====================================================

await testAsync('Step 6a: Valid single-feature form succeeds', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Improved Bravery', level: 2, replaces: 'bravery' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid but got: ${result.errors.join(', ')}`);
  assertEqual(result.data.slug, 'test-archetype');
  assertEqual(result.data.name, 'Test Archetype');
  assertEqual(result.data.entry.class, 'fighter');
  assertEqual(result.data.entry.features['improved-bravery'].level, 2);
  assertEqual(result.data.entry.features['improved-bravery'].replaces, 'bravery');
});

await testAsync('Step 6b: Valid multi-feature form succeeds', async () => {
  const html = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Blade Dancer',
    archetypeClass: 'Rogue',
    features: [
      { name: 'Blade Dance', level: 1, replaces: 'sneak attack' },
      { name: 'Flowing Steps', level: 3, replaces: 'trap sense' },
      { name: 'Whirlwind Strike', level: 10, replaces: 'advanced talents' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid but got: ${result.errors.join(', ')}`);
  assertEqual(result.data.type, 'custom');
  assertEqual(Object.keys(result.data.entry.features).length, 3);
  assertEqual(result.data.entry.features['blade-dance'].level, 1);
  assertEqual(result.data.entry.features['flowing-steps'].level, 3);
  assertEqual(result.data.entry.features['whirlwind-strike'].level, 10);
});

await testAsync('Step 6c: Valid form with level at boundaries (1 and 20)', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Boundary Test',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Level 1 Feature', level: 1, replaces: '' },
      { name: 'Level 20 Feature', level: 20, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid with levels 1 and 20, got: ${result.errors.join(', ')}`);
  assertEqual(result.data.entry.features['level-1-feature'].level, 1);
  assertEqual(result.data.entry.features['level-20-feature'].level, 20);
});

await testAsync('Step 6d: Valid form with additive feature (no replaces)', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Additive Test',
    archetypeClass: 'Wizard',
    features: [
      { name: 'Extra Cantrip', level: 1, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid with no replaces`);
  assertEqual(result.data.entry.features['extra-cantrip'].replaces, null);
});

// =====================================================
// Additional validation edge cases
// =====================================================

await testAsync('Multiple errors are reported at once', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: '',
    archetypeClass: '',
    features: []
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');
  // Should have errors for name, class, and features
  assert(result.errors.length >= 3, `Should have at least 3 errors, got ${result.errors.length}`);
});

await testAsync('Duplicate feature names are detected', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Improved Strike', level: 1, replaces: '' },
      { name: 'improved strike', level: 5, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with case-insensitive duplicate');
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
