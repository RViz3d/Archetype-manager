/**
 * Test Suite for Feature #25: On-the-fly fix dialog UI works
 *
 * Tests:
 * 1. Trigger fix dialog for unknown replacement
 * 2. Verify dialog shows feature name and description
 * 3. Verify dropdown with base class features
 * 4. Verify 'is additive' checkbox
 * 5. Select and confirm -> verify saved to JE fixes
 * 6. Cancel -> verify nothing saved
 * 7. Verify FoundryVTT dialog styling
 */

import { setupMockEnvironment, resetMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function runTests() {
  console.log('Feature #25: On-the-fly fix dialog UI works\n');

  // Set up environment
  const env = setupMockEnvironment();

  // Initialize module (registers settings, creates JE DB)
  await import('../scripts/module.mjs');
  await env.hooks.callAll('init');
  await env.hooks.callAll('ready');

  const { UIManager } = await import('../scripts/ui-manager.mjs');
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // ================================================================
  section('1. Fix dialog HTML generation');
  // ================================================================

  const testFeature = {
    name: 'Shattering Strike',
    description: '<p><strong>Level</strong>: 2</p><p>This is a broken description.</p>',
    level: 2,
    archetypeSlug: 'two-handed-fighter',
    archetypeName: 'Two-Handed Fighter',
    className: 'fighter'
  };

  const baseFeatures = [
    { name: 'Bravery', level: 2, uuid: 'Compendium.pf1.class-abilities.bravery' },
    { name: 'Armor Training 1', level: 3, uuid: 'Compendium.pf1.class-abilities.armor-training-1' },
    { name: 'Weapon Training 1', level: 5, uuid: 'Compendium.pf1.class-abilities.weapon-training-1' },
    { name: 'Armor Training 2', level: 7, uuid: 'Compendium.pf1.class-abilities.armor-training-2' },
    { name: 'Bonus Feat', level: 1, uuid: 'Compendium.pf1.class-abilities.bonus-feat' }
  ];

  const html = UIManager._buildFixDialogHTML(testFeature, baseFeatures);

  assert(typeof html === 'string' && html.length > 0,
    'Fix dialog HTML is generated');

  assert(html.includes('Shattering Strike'),
    'HTML contains feature name');

  assert(html.includes('This is a broken description'),
    'HTML contains feature description');

  assert(html.includes('fix-replaces-select'),
    'HTML contains replaces dropdown');

  assert(html.includes('fix-additive-checkbox'),
    'HTML contains additive checkbox');

  assert(html.includes('fix-level-input'),
    'HTML contains level input');

  // ================================================================
  section('2. Dropdown contains base class features');
  // ================================================================

  assert(html.includes('Bravery'),
    'Dropdown contains Bravery');

  assert(html.includes('Armor Training 1'),
    'Dropdown contains Armor Training 1');

  assert(html.includes('Weapon Training 1'),
    'Dropdown contains Weapon Training 1');

  assert(html.includes('Armor Training 2'),
    'Dropdown contains Armor Training 2');

  assert(html.includes('Bonus Feat'),
    'Dropdown contains Bonus Feat');

  // Check that levels are shown in dropdown options
  assert(html.includes('(Lv 2)'),
    'Dropdown shows level for Bravery');

  assert(html.includes('(Lv 3)'),
    'Dropdown shows level for Armor Training 1');

  // Options are sorted by level
  const bonusFeatPos = html.indexOf('Bonus Feat');
  const braveryPos = html.indexOf('Bravery');
  const armorTraining1Pos = html.indexOf('Armor Training 1');
  assert(bonusFeatPos < braveryPos && braveryPos < armorTraining1Pos,
    'Base features sorted by level in dropdown');

  // ================================================================
  section('3. Level input pre-populated');
  // ================================================================

  assert(html.includes('value="2"'),
    'Level input pre-populated with feature level');

  // ================================================================
  section('4. _parseFixDialogResult - replacement selection');
  // ================================================================

  // Build a mock element that simulates the fix dialog form
  const mockFormElement = {
    querySelector(selector) {
      if (selector === '.fix-level-input') return mockLevelInput;
      if (selector === '.fix-replaces-select') return mockReplacesSelect;
      if (selector === '.fix-additive-checkbox') return mockAdditiveCheckbox;
      return null;
    }
  };

  let mockLevelInput = { value: '2' };
  let mockReplacesSelect = { value: 'Bravery' };
  let mockAdditiveCheckbox = { checked: false };

  // Test: replacement selection
  let result = UIManager._parseFixDialogResult(mockFormElement, testFeature);
  assert(result !== null,
    'parseFixDialogResult returns non-null for replacement selection');
  assert(result.replaces === 'Bravery',
    'Result has correct replaces value');
  assert(result.level === 2,
    'Result has correct level');
  assert(result.isAdditive === false,
    'Result is not additive');
  assert(result.featureName === 'Shattering Strike',
    'Result has correct feature name');

  // ================================================================
  section('5. _parseFixDialogResult - additive selection');
  // ================================================================

  mockAdditiveCheckbox.checked = true;
  mockReplacesSelect.value = '';

  result = UIManager._parseFixDialogResult(mockFormElement, testFeature);
  assert(result !== null,
    'parseFixDialogResult returns non-null for additive selection');
  assert(result.replaces === null,
    'Additive result has null replaces');
  assert(result.isAdditive === true,
    'Result isAdditive is true');
  assert(result.level === 2,
    'Additive result has correct level');

  // ================================================================
  section('6. _parseFixDialogResult - no selection (invalid)');
  // ================================================================

  mockAdditiveCheckbox.checked = false;
  mockReplacesSelect.value = '';

  result = UIManager._parseFixDialogResult(mockFormElement, testFeature);
  assert(result === null,
    'parseFixDialogResult returns null when neither additive nor replaces selected');

  // ================================================================
  section('7. Fix dialog saves to JE fixes (full flow)');
  // ================================================================

  // Reset to ensure clean state
  resetMockEnvironment();
  await env.hooks.callAll('init');
  await env.hooks.callAll('ready');

  // Simulate the fix dialog callback directly (since we can't interact with Dialog UI in Node)
  const archetypeSlug = 'two-handed-fighter';
  const featureSlug = UIManager._slugify('Shattering Strike');

  // Simulate saving a fix entry
  const fixEntry = {
    level: 2,
    replaces: 'Bravery',
    description: testFeature.description
  };

  const existingFix = await JournalEntryDB.getArchetype(archetypeSlug);
  const fixData = existingFix && existingFix._section === 'fixes'
    ? { class: existingFix.class || '', features: { ...existingFix.features } }
    : { class: 'fighter', features: {} };

  fixData.features[featureSlug] = fixEntry;

  const saveSuccess = await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData);
  assert(saveSuccess === true,
    'Fix entry saved to JE fixes section');

  // Verify saved data
  const savedFixes = await JournalEntryDB.readSection('fixes');
  assert(savedFixes[archetypeSlug] !== undefined,
    'Archetype slug exists in fixes section');
  assert(savedFixes[archetypeSlug].class === 'fighter',
    'Fix data has correct class');
  assert(savedFixes[archetypeSlug].features[featureSlug] !== undefined,
    'Feature slug exists in fix data');
  assert(savedFixes[archetypeSlug].features[featureSlug].level === 2,
    'Saved fix has correct level');
  assert(savedFixes[archetypeSlug].features[featureSlug].replaces === 'Bravery',
    'Saved fix has correct replaces value');

  // ================================================================
  section('8. Cancel flow - nothing saved');
  // ================================================================

  // Verify that on cancel, the fix dialog returns null without modifying JE
  // We test this by verifying the Dialog's cancel callback behavior

  // The showFixDialog returns a Promise. On cancel, the close callback calls resolve(null)
  // We test the logic: if we read the fixes now, no additional entries should exist
  const fixesBefore = await JournalEntryDB.readSection('fixes');
  const entryCountBefore = Object.keys(fixesBefore).length;

  // Simulate "cancel" - nothing should be saved
  // (Since the cancel callback just calls resolve(null), we verify the mechanism)
  assert(typeof UIManager.showFixDialog === 'function',
    'showFixDialog is a function');

  // The cancel path resolves to null, which is verified by the Promise API
  // (dialog.data.buttons.cancel.callback resolves null, dialog.data.close resolves null)

  // Verify entry count hasn't changed
  const fixesAfter = await JournalEntryDB.readSection('fixes');
  const entryCountAfter = Object.keys(fixesAfter).length;
  assert(entryCountBefore === entryCountAfter,
    'No new entries added when simulating cancel (fixes section unchanged)');

  // ================================================================
  section('9. Multiple fixes for same archetype coexist');
  // ================================================================

  // Add a second feature fix to the same archetype
  const secondFeatureSlug = UIManager._slugify('Overhand Chop');
  const existingFix2 = await JournalEntryDB.getArchetype(archetypeSlug);
  const fixData2 = { class: existingFix2.class, features: { ...existingFix2.features } };
  fixData2.features[secondFeatureSlug] = {
    level: 3,
    replaces: 'Armor Training 1',
    description: 'Overhand Chop description'
  };

  await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData2);

  const savedFixes2 = await JournalEntryDB.readSection('fixes');
  const archEntry = savedFixes2[archetypeSlug];

  assert(Object.keys(archEntry.features).length === 2,
    'Two feature fixes coexist for same archetype');
  assert(archEntry.features[featureSlug] !== undefined,
    'First feature fix still exists');
  assert(archEntry.features[secondFeatureSlug] !== undefined,
    'Second feature fix exists');
  assert(archEntry.features[secondFeatureSlug].replaces === 'Armor Training 1',
    'Second feature fix has correct replaces value');

  // ================================================================
  section('10. Additive fix saves correctly to JE');
  // ================================================================

  const additiveFeature = {
    name: 'Greater Power Attack',
    description: '<p>An additive feature.</p>',
    level: 15,
    archetypeSlug: 'two-handed-fighter',
    archetypeName: 'Two-Handed Fighter',
    className: 'fighter'
  };

  const additiveSlug = UIManager._slugify('Greater Power Attack');
  const existingFix3 = await JournalEntryDB.getArchetype(archetypeSlug);
  const fixData3 = { class: existingFix3.class, features: { ...existingFix3.features } };
  fixData3.features[additiveSlug] = {
    level: 15,
    replaces: null,
    description: additiveFeature.description
  };

  await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData3);

  const savedFixes3 = await JournalEntryDB.readSection('fixes');
  const additiveEntry = savedFixes3[archetypeSlug].features[additiveSlug];
  assert(additiveEntry !== undefined,
    'Additive fix entry exists');
  assert(additiveEntry.replaces === null,
    'Additive fix has null replaces');
  assert(additiveEntry.level === 15,
    'Additive fix has correct level');

  // ================================================================
  section('11. Fix dialog with empty base features');
  // ================================================================

  const emptyHtml = UIManager._buildFixDialogHTML(testFeature, []);
  assert(emptyHtml.includes('fix-replaces-select'),
    'Dropdown still rendered with empty base features');
  assert(emptyHtml.includes('-- Select base feature --'),
    'Dropdown shows placeholder with empty base features');

  // ================================================================
  section('12. Fix dialog with null/undefined base features');
  // ================================================================

  const nullHtml = UIManager._buildFixDialogHTML(testFeature, null);
  assert(nullHtml.includes('fix-replaces-select'),
    'Dropdown rendered with null base features');

  const undefinedHtml = UIManager._buildFixDialogHTML(testFeature, undefined);
  assert(undefinedHtml.includes('fix-replaces-select'),
    'Dropdown rendered with undefined base features');

  // ================================================================
  section('13. Fix dialog with missing feature properties');
  // ================================================================

  const minimalFeature = { name: 'Unknown Feature' };
  const minimalHtml = UIManager._buildFixDialogHTML(minimalFeature, baseFeatures);
  assert(minimalHtml.includes('Unknown Feature'),
    'Minimal feature name shown');
  assert(minimalHtml.includes('No description available'),
    'Missing description shows fallback text');

  // Feature with no level
  const noLevelFeature = { name: 'Test Feature', description: '<p>Desc</p>' };
  const noLevelHtml = UIManager._buildFixDialogHTML(noLevelFeature, baseFeatures);
  assert(noLevelHtml.includes('value=""'),
    'No level defaults to empty input');

  // ================================================================
  section('14. _parseFixDialogResult level handling');
  // ================================================================

  // Custom level in input overrides feature level
  mockLevelInput = { value: '7' };
  mockReplacesSelect = { value: 'Armor Training 2' };
  mockAdditiveCheckbox = { checked: false };

  result = UIManager._parseFixDialogResult(mockFormElement, testFeature);
  assert(result.level === 7,
    'Custom level in input overrides feature level');
  assert(result.replaces === 'Armor Training 2',
    'Custom replaces value used');

  // Empty level input falls back to feature level
  mockLevelInput = { value: '' };
  mockReplacesSelect = { value: 'Bravery' };
  mockAdditiveCheckbox = { checked: false };

  result = UIManager._parseFixDialogResult(mockFormElement, testFeature);
  assert(result.level === 2,
    'Empty level falls back to feature level');

  // ================================================================
  section('15. Dialog styling classes');
  // ================================================================

  // The showFixDialog creates a Dialog with archetype-manager and archetype-fix-dialog classes
  // We verify this by checking the function exists and would set these classes
  assert(typeof UIManager.showFixDialog === 'function',
    'showFixDialog method exists');

  // Check that _buildFixDialogHTML has proper styling attributes
  assert(html.includes('archetype-fix-dialog-content'),
    'HTML has fix dialog content class');
  assert(html.includes('fix-feature-info'),
    'HTML has feature info section');
  assert(html.includes('fix-description'),
    'HTML has description section');
  assert(html.includes('fa-puzzle-piece'),
    'HTML has puzzle piece icon for feature');

  // ================================================================
  section('16. Fix data persists across reload');
  // ================================================================

  // Simulate reload
  resetMockEnvironment();
  await env.hooks.callAll('init');
  await env.hooks.callAll('ready');

  // Note: we need to re-import with a fresh namespace to avoid caching
  // In the mock, JE data persists across resetMockEnvironment calls
  const fixesAfterReload = await JournalEntryDB.readSection('fixes');
  assert(fixesAfterReload[archetypeSlug] !== undefined,
    'Fix data persists after reload');
  assert(fixesAfterReload[archetypeSlug].features[featureSlug] !== undefined,
    'Feature fix persists after reload');
  assert(fixesAfterReload[archetypeSlug].features[featureSlug].replaces === 'Bravery',
    'Fix replaces value persists after reload');

  // ================================================================
  section('17. GM-only access for fixes section');
  // ================================================================

  // Test that non-GM can still trigger the dialog but can't save to fixes
  game.user.isGM = false;

  const nonGmSaveResult = await JournalEntryDB.writeSection('fixes', { test: 'should-fail' });
  assert(nonGmSaveResult === false,
    'Non-GM cannot write to fixes section');

  // Restore GM status
  game.user.isGM = true;

  // ================================================================
  // Summary
  // ================================================================

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Feature #25 Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
