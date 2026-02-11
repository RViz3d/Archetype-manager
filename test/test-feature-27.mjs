/**
 * Test Suite for Feature #27: Manual entry for missing official archetypes
 *
 * Tests the manual entry dialog flow for adding official archetypes
 * not present in the pf1e-archetypes module, saved to JE missing section.
 *
 * Since no live FoundryVTT instance is available, we test:
 * - The _slugify helper method
 * - The _validateManualEntry method with mock DOM elements
 * - Integration with JournalEntryDB (save to missing section)
 * - GM-only access control
 * - Full round-trip: create via dialog logic → verify in JE DB
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';

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
 * Create a mock DOM element that mimics querySelector/querySelectorAll
 * for testing _validateManualEntry without a real browser.
 */
function createMockFormHTML(data) {
  const elements = new Map();

  // Set up named inputs
  if (data.entryType !== undefined) {
    elements.set('[name="entry-type"]', { value: data.entryType, querySelector: () => null });
  }
  if (data.archetypeName !== undefined) {
    elements.set('[name="archetype-name"]', { value: data.archetypeName });
  }
  if (data.archetypeClass !== undefined) {
    elements.set('[name="archetype-class"]', { value: data.archetypeClass });
  }

  // Feature rows
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
console.log('\n=== Feature #27: Manual entry for missing official archetypes ===\n');

const { hooks } = setupMockEnvironment();

// Import module and fire lifecycle hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import UIManager and JournalEntryDB
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// =====================================================
// Step 1: Test _slugify helper
// =====================================================

await testAsync('Step 1a: _slugify converts name to slug', async () => {
  assertEqual(UIManager._slugify('Divine Tracker'), 'divine-tracker');
  assertEqual(UIManager._slugify('Two-Handed Fighter'), 'two-handed-fighter');
  assertEqual(UIManager._slugify('Shadow Adept'), 'shadow-adept');
});

await testAsync('Step 1b: _slugify handles special characters', async () => {
  assertEqual(UIManager._slugify("Master's Tricks"), 'master-s-tricks');
  assertEqual(UIManager._slugify('  Spaces  Everywhere  '), 'spaces-everywhere');
  assertEqual(UIManager._slugify('Name (Variant)'), 'name-variant');
});

// =====================================================
// Step 2: Test _buildManualEntryHTML
// =====================================================

await testAsync('Step 2a: _buildManualEntryHTML generates form HTML', async () => {
  const html = UIManager._buildManualEntryHTML('missing');
  assert(html.includes('entry-type'), 'HTML should contain entry-type select');
  assert(html.includes('archetype-name'), 'HTML should contain archetype name input');
  assert(html.includes('archetype-class'), 'HTML should contain class input');
  assert(html.includes('feature-rows'), 'HTML should contain feature rows container');
  assert(html.includes('add-feature-btn'), 'HTML should contain add feature button');
});

await testAsync('Step 2b: _buildManualEntryHTML defaults to missing when specified', async () => {
  const html = UIManager._buildManualEntryHTML('missing');
  assert(html.includes('value="missing" selected'), 'Missing should be selected by default');
});

await testAsync('Step 2c: _buildManualEntryHTML defaults to custom when specified', async () => {
  const html = UIManager._buildManualEntryHTML('custom');
  assert(html.includes('value="custom" selected'), 'Custom should be selected by default');
});

// =====================================================
// Step 3: Test _validateManualEntry — valid inputs
// =====================================================

await testAsync('Step 3a: _validateManualEntry accepts valid complete form', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Divine Tracker',
    archetypeClass: 'Ranger',
    features: [
      { name: 'Divine Tracking', level: 1, replaces: 'wild empathy' },
      { name: 'Blessings', level: 4, replaces: "hunter's bond" }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid, but got errors: ${result.errors.join(', ')}`);
  assertEqual(result.data.slug, 'divine-tracker');
  assertEqual(result.data.name, 'Divine Tracker');
  assertEqual(result.data.type, 'missing');
  assertEqual(result.data.entry.class, 'ranger');
  assert(result.data.entry.features['divine-tracking'], 'Should have divine-tracking feature');
  assertEqual(result.data.entry.features['divine-tracking'].level, 1);
  assertEqual(result.data.entry.features['divine-tracking'].replaces, 'wild empathy');
  assert(result.data.entry.features['blessings'], 'Should have blessings feature');
  assertEqual(result.data.entry.features['blessings'].level, 4);
});

await testAsync('Step 3b: _validateManualEntry handles feature with no replaces (additive)', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Holy Avenger',
    archetypeClass: 'Paladin',
    features: [
      { name: 'Holy Smite', level: 3, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, 'Should be valid for additive feature');
  assertEqual(result.data.entry.features['holy-smite'].replaces, null, 'Empty replaces should be null');
});

// =====================================================
// Step 4: Test _validateManualEntry — invalid inputs
// =====================================================

await testAsync('Step 4a: Validation fails with empty archetype name', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: '',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('Archetype name')), 'Error should mention name');
});

await testAsync('Step 4b: Validation fails with empty class', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: '',
    features: [{ name: 'Test', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.some(e => e.includes('Class')), 'Error should mention class');
});

await testAsync('Step 4c: Validation fails with no features', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: '', level: '', replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with no features');
  assert(result.errors.some(e => e.includes('feature')), 'Error should mention features');
});

await testAsync('Step 4d: Validation fails with invalid level', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: 25, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with level > 20');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

await testAsync('Step 4e: Validation fails with duplicate feature names', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Same Feature', level: 1, replaces: '' },
      { name: 'same feature', level: 3, replaces: '' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with duplicate names');
  assert(result.errors.some(e => e.includes('Duplicate')), 'Error should mention duplicate');
});

await testAsync('Step 4f: Validation fails with feature name but no level', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test Archetype',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feature', level: '', replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(!result.valid, 'Should be invalid with missing level');
  assert(result.errors.some(e => e.includes('Level')), 'Error should mention level');
});

// =====================================================
// Step 5: Integration test — full round-trip with JE DB
// =====================================================

await testAsync('Step 5a: Validated data saves to JE missing section via setArchetype', async () => {
  game.user.isGM = true;

  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Divine Tracker',
    archetypeClass: 'Ranger',
    features: [
      { name: 'Divine Tracking', level: 1, replaces: 'wild empathy' },
      { name: 'Blessings', level: 4, replaces: "hunter's bond" },
      { name: 'Divine Pursuance', level: 12, replaces: 'camouflage' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, 'Form should validate');

  // Save to JE DB just like the dialog callback would
  const success = await JournalEntryDB.setArchetype(
    result.data.type,
    result.data.slug,
    result.data.entry
  );
  assert(success, 'Save should succeed');

  // Verify in JE DB
  const saved = await JournalEntryDB.getArchetype('divine-tracker');
  assert(saved, 'Should find saved archetype');
  assertEqual(saved._section, 'missing', 'Should be in missing section');
  assertEqual(saved.class, 'ranger', 'Class should be ranger');
  assertEqual(Object.keys(saved.features).length, 3, 'Should have 3 features');
  assertEqual(saved.features['divine-tracking'].level, 1);
  assertEqual(saved.features['divine-tracking'].replaces, 'wild empathy');
  assertEqual(saved.features['blessings'].level, 4);
  assertEqual(saved.features['divine-pursuance'].level, 12);
});

await testAsync('Step 5b: Saved archetype persists across simulated reload', async () => {
  // Verify it exists
  const before = await JournalEntryDB.getArchetype('divine-tracker');
  assert(before, 'Should exist before reload');

  // Simulate reload
  resetMockEnvironment();
  game.user.isGM = true;

  // Verify persistence
  const after = await JournalEntryDB.getArchetype('divine-tracker');
  assert(after, 'Should persist after reload');
  assertEqual(after._section, 'missing');
  assertEqual(after.class, 'ranger');
  assertEqual(Object.keys(after.features).length, 3);

  // Clean up
  await JournalEntryDB.deleteArchetype('missing', 'divine-tracker');
});

// =====================================================
// Step 6: Test that entry appears in correct section
// =====================================================

await testAsync('Step 6a: Entry saved to missing section appears only in missing', async () => {
  game.user.isGM = true;

  await JournalEntryDB.setArchetype('missing', 'test-missing-only', {
    class: 'wizard',
    features: { 'test-feat': { level: 1, replaces: null, description: '' } }
  });

  // Should be in missing
  const missing = await JournalEntryDB.readSection('missing');
  assert(missing['test-missing-only'], 'Should be in missing section');

  // Should NOT be in custom or fixes
  const custom = await JournalEntryDB.readSection('custom');
  assert(!custom['test-missing-only'], 'Should NOT be in custom section');

  const fixes = await JournalEntryDB.readSection('fixes');
  assert(!fixes['test-missing-only'], 'Should NOT be in fixes section');

  // getArchetype should find it in missing
  const result = await JournalEntryDB.getArchetype('test-missing-only');
  assertEqual(result._section, 'missing');

  // Clean up
  await JournalEntryDB.deleteArchetype('missing', 'test-missing-only');
});

// =====================================================
// Step 7: GM-only access control
// =====================================================

await testAsync('Step 7a: Non-GM cannot save to missing section', async () => {
  game.user.isGM = false;

  const result = await JournalEntryDB.setArchetype('missing', 'non-gm-test', {
    class: 'fighter',
    features: { 'test': { level: 1, replaces: null, description: '' } }
  });
  assert(result === false, 'Non-GM should fail to save to missing');

  // Verify not saved
  game.user.isGM = true;
  const data = await JournalEntryDB.readSection('missing');
  assert(!data['non-gm-test'], 'Entry should not exist');
});

await testAsync('Step 7b: showManualEntryDialog rejects non-GM for missing type', async () => {
  game.user.isGM = false;

  // The method should return null for non-GM users requesting 'missing' type
  const result = await UIManager.showManualEntryDialog('missing');
  assertEqual(result, null, 'Should return null for non-GM');

  // Reset
  game.user.isGM = true;
});

await testAsync('Step 7c: Validation sets correct type in result data', async () => {
  const htmlMissing = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feat', level: 1, replaces: '' }]
  });
  const resultMissing = UIManager._validateManualEntry(htmlMissing);
  assert(resultMissing.valid);
  assertEqual(resultMissing.data.type, 'missing', 'Type should be missing');

  const htmlCustom = createMockFormHTML({
    entryType: 'custom',
    archetypeName: 'Test',
    archetypeClass: 'Fighter',
    features: [{ name: 'Test Feat', level: 1, replaces: '' }]
  });
  const resultCustom = UIManager._validateManualEntry(htmlCustom);
  assert(resultCustom.valid);
  assertEqual(resultCustom.data.type, 'custom', 'Type should be custom');
});

// =====================================================
// Step 8: Test usability for application (data structure)
// =====================================================

await testAsync('Step 8: Saved entry has correct structure for applicator usage', async () => {
  game.user.isGM = true;

  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Lore Warden',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Scholastic', level: 2, replaces: 'bravery' },
      { name: 'Expertise', level: 3, replaces: 'armor training 1' },
      { name: 'Maneuver Mastery', level: 7, replaces: 'armor training 2' },
      { name: 'Know Thy Enemy', level: 11, replaces: 'armor training 3' },
      { name: 'Hair\'s Breadth', level: 15, replaces: 'armor training 4' },
      { name: 'Swift Assessment', level: 19, replaces: 'armor mastery' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, `Should be valid, but: ${result.errors.join(', ')}`);

  // Save
  const success = await JournalEntryDB.setArchetype('missing', result.data.slug, result.data.entry);
  assert(success, 'Save should succeed');

  // Read and verify structure is usable
  const archetype = await JournalEntryDB.getArchetype('lore-warden');
  assert(archetype, 'Should find lore-warden');
  assertEqual(archetype.class, 'fighter');

  // Verify every feature has the required fields for the applicator
  for (const [slug, feature] of Object.entries(archetype.features)) {
    assert(typeof feature.level === 'number', `${slug} should have numeric level`);
    assert(feature.level >= 1 && feature.level <= 20, `${slug} level should be 1-20`);
    assert('replaces' in feature, `${slug} should have replaces field`);
    assert('description' in feature, `${slug} should have description field`);
  }

  // Verify specific features
  assertEqual(archetype.features['scholastic'].replaces, 'bravery');
  assertEqual(archetype.features['expertise'].replaces, 'armor training 1');
  assertEqual(archetype.features['know-thy-enemy'].replaces, 'armor training 3');

  // Clean up
  await JournalEntryDB.deleteArchetype('missing', 'lore-warden');
});

// =====================================================
// Additional edge case tests
// =====================================================

await testAsync('Edge case: Multiple features at same level are allowed', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Multi Level',
    archetypeClass: 'Fighter',
    features: [
      { name: 'Feature A', level: 1, replaces: 'bravery' },
      { name: 'Feature B', level: 1, replaces: 'intimidating prowess' }
    ]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid, 'Multiple features at same level should be valid');
  assertEqual(Object.keys(result.data.entry.features).length, 2);
});

await testAsync('Edge case: Class name is normalized to lowercase', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: 'Test',
    archetypeClass: 'FIGHTER',
    features: [{ name: 'Test Feat', level: 1, replaces: '' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid);
  assertEqual(result.data.entry.class, 'fighter', 'Class should be lowercase');
});

await testAsync('Edge case: Whitespace in names is trimmed', async () => {
  const html = createMockFormHTML({
    entryType: 'missing',
    archetypeName: '  Trimmed Name  ',
    archetypeClass: '  ranger  ',
    features: [{ name: '  Feature Name  ', level: 1, replaces: '  wild empathy  ' }]
  });

  const result = UIManager._validateManualEntry(html);
  assert(result.valid);
  assertEqual(result.data.name, 'Trimmed Name', 'Name should be trimmed');
  assertEqual(result.data.entry.class, 'ranger', 'Class should be trimmed');
  assert(result.data.entry.features['feature-name'], 'Feature slug should be based on trimmed name');
  assertEqual(result.data.entry.features['feature-name'].replaces, 'wild empathy', 'Replaces should be trimmed');
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
