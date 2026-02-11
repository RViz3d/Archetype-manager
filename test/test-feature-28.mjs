/**
 * Test Suite for Feature #28: Manual entry for custom/homebrew archetypes
 *
 * Tests:
 * 1. Open manual entry dialog
 * 2. Select 'custom/homebrew' type
 * 3. Enter archetype name and class
 * 4. Add feature rows
 * 5. Submit entry
 * 6. Verify saved to JE custom
 * 7. Verify appears in selection list
 */

import { setupMockEnvironment, resetMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

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
  console.log('Feature #28: Manual entry for custom/homebrew archetypes\n');

  // Set up environment
  const env = setupMockEnvironment();

  // Initialize module
  await import('../scripts/module.mjs');
  await env.hooks.callAll('init');
  await env.hooks.callAll('ready');

  const { UIManager } = await import('../scripts/ui-manager.mjs');
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // ================================================================
  section('1. Manual entry dialog HTML generation for custom type');
  // ================================================================

  const html = UIManager._buildManualEntryHTML('custom');

  assert(typeof html === 'string' && html.length > 0,
    'Manual entry HTML is generated');

  assert(html.includes('entry-type-select'),
    'HTML contains type selector');

  assert(html.includes('archetype-name'),
    'HTML contains archetype name field');

  assert(html.includes('archetype-class'),
    'HTML contains class field');

  assert(html.includes('feature-rows'),
    'HTML contains feature rows container');

  assert(html.includes('add-feature-btn'),
    'HTML contains add feature button');

  // ================================================================
  section('2. Default type is custom/homebrew');
  // ================================================================

  // When defaultType is 'custom', the custom option should be selected
  assert(html.includes('value="custom" selected'),
    'Custom option is selected by default');

  // When defaultType is 'missing', the missing option should be selected
  const missingHtml = UIManager._buildManualEntryHTML('missing');
  assert(missingHtml.includes('value="missing" selected'),
    'Missing option is selected when specified');

  // ================================================================
  section('3. Archetype name and class fields present');
  // ================================================================

  assert(html.includes('placeholder="e.g., Divine Tracker"'),
    'Archetype name has placeholder');

  assert(html.includes('placeholder="e.g., ranger"'),
    'Class field has placeholder');

  assert(html.includes('required'),
    'Required attributes present on inputs');

  // ================================================================
  section('4. Initial feature row present');
  // ================================================================

  assert(html.includes('feat-name-0'),
    'First feature name input present');

  assert(html.includes('feat-level-0'),
    'First feature level input present');

  assert(html.includes('feat-replaces-0'),
    'First feature replaces input present');

  assert(html.includes('remove-feature-btn'),
    'Remove feature button present');

  assert(html.includes('data-index="0"'),
    'First row has index 0');

  // ================================================================
  section('5. _validateManualEntry - valid custom entry');
  // ================================================================

  // Mock a valid form element
  const createMockForm = (values) => ({
    querySelector(selector) {
      const nameMatch = selector.match(/\[name="(.+?)"\]/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (values[name] !== undefined) {
          return { value: values[name] };
        }
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.feature-row') {
        return values._featureRows || [];
      }
      return [];
    }
  });

  const validForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Shield Master',
    'archetype-class': 'fighter',
    'feat-name-0': 'Shield Bash',
    'feat-level-0': '2',
    'feat-replaces-0': 'Bravery',
    _featureRows: [
      { dataset: { index: '0' } }
    ]
  });

  const validResult = UIManager._validateManualEntry(validForm);
  assert(validResult.valid === true,
    'Valid custom entry passes validation');
  assert(validResult.errors.length === 0,
    'No validation errors for valid entry');
  assert(validResult.data.type === 'custom',
    'Data has correct type');
  assert(validResult.data.name === 'Shield Master',
    'Data has correct name');
  assert(validResult.data.slug === 'shield-master',
    'Data has correct slug');
  assert(validResult.data.entry.class === 'fighter',
    'Data has correct class');
  assert(Object.keys(validResult.data.entry.features).length === 1,
    'Data has one feature');

  const featureSlug = Object.keys(validResult.data.entry.features)[0];
  const feature = validResult.data.entry.features[featureSlug];
  assert(feature.level === 2,
    'Feature has correct level');
  assert(feature.replaces === 'Bravery',
    'Feature has correct replaces');

  // ================================================================
  section('6. _validateManualEntry - custom entry with additive feature');
  // ================================================================

  const additiveForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Mystic Guardian',
    'archetype-class': 'paladin',
    'feat-name-0': 'Arcane Shield',
    'feat-level-0': '3',
    'feat-replaces-0': '', // No replaces = additive
    _featureRows: [
      { dataset: { index: '0' } }
    ]
  });

  const additiveResult = UIManager._validateManualEntry(additiveForm);
  assert(additiveResult.valid === true,
    'Additive feature entry passes validation');

  const addFeatureSlug = Object.keys(additiveResult.data.entry.features)[0];
  const addFeature = additiveResult.data.entry.features[addFeatureSlug];
  assert(addFeature.replaces === null,
    'Additive feature has null replaces');

  // ================================================================
  section('7. _validateManualEntry - multiple features');
  // ================================================================

  const multiForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Blade Dancer',
    'archetype-class': 'fighter',
    'feat-name-0': 'Dance of Blades',
    'feat-level-0': '1',
    'feat-replaces-0': 'Bonus Feat',
    'feat-name-1': 'Whirling Step',
    'feat-level-1': '3',
    'feat-replaces-1': 'Armor Training 1',
    'feat-name-2': 'Dance Mastery',
    'feat-level-2': '7',
    'feat-replaces-2': '',
    _featureRows: [
      { dataset: { index: '0' } },
      { dataset: { index: '1' } },
      { dataset: { index: '2' } }
    ]
  });

  const multiResult = UIManager._validateManualEntry(multiForm);
  assert(multiResult.valid === true,
    'Multi-feature entry passes validation');
  assert(Object.keys(multiResult.data.entry.features).length === 3,
    'Entry has three features');

  // ================================================================
  section('8. Save custom homebrew entry to JE custom section');
  // ================================================================

  // Simulate full save flow
  const customData = validResult.data;
  const saveSuccess = await JournalEntryDB.setArchetype(
    'custom',
    customData.slug,
    customData.entry
  );
  assert(saveSuccess === true,
    'Custom archetype saved to JE custom section');

  // Verify saved data
  const savedCustom = await JournalEntryDB.readSection('custom');
  assert(savedCustom['shield-master'] !== undefined,
    'Shield Master exists in custom section');
  assert(savedCustom['shield-master'].class === 'fighter',
    'Saved entry has correct class');
  assert(Object.keys(savedCustom['shield-master'].features).length === 1,
    'Saved entry has one feature');

  // ================================================================
  section('9. Multiple custom archetypes coexist');
  // ================================================================

  const secondData = multiResult.data;
  await JournalEntryDB.setArchetype('custom', secondData.slug, secondData.entry);

  const allCustom = await JournalEntryDB.readSection('custom');
  assert(Object.keys(allCustom).length === 2,
    'Two custom archetypes coexist');
  assert(allCustom['shield-master'] !== undefined,
    'First custom archetype still exists');
  assert(allCustom['blade-dancer'] !== undefined,
    'Second custom archetype exists');

  // ================================================================
  section('10. Custom entry appears in main dialog archetype list');
  // ================================================================

  // The main dialog loads archetypes from compendium + JE missing + JE custom
  // We verify that custom entries can be read from the custom section
  // and would appear in the archetype list

  const customEntries = await JournalEntryDB.readSection('custom');
  const customArchetypes = [];
  for (const [slug, entry] of Object.entries(customEntries)) {
    customArchetypes.push({
      name: entry.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      slug,
      source: 'custom',
      class: entry.class
    });
  }

  assert(customArchetypes.length === 2,
    'Custom archetypes array built from JE custom section');

  const shieldMaster = customArchetypes.find(a => a.slug === 'shield-master');
  assert(shieldMaster !== undefined,
    'Shield Master found in custom archetypes list');
  assert(shieldMaster.source === 'custom',
    'Shield Master source is custom');

  const bladeDancer = customArchetypes.find(a => a.slug === 'blade-dancer');
  assert(bladeDancer !== undefined,
    'Blade Dancer found in custom archetypes list');

  // ================================================================
  section('11. Non-GM can save to custom section');
  // ================================================================

  game.user.isGM = false;

  const nonGmSave = await JournalEntryDB.setArchetype('custom', 'non-gm-archetype', {
    class: 'wizard',
    features: { 'test-feat': { level: 1, replaces: null, description: '' } }
  });
  assert(nonGmSave === true,
    'Non-GM can save to custom section');

  const nonGmRead = await JournalEntryDB.readSection('custom');
  assert(nonGmRead['non-gm-archetype'] !== undefined,
    'Non-GM custom archetype saved successfully');

  // ================================================================
  section('12. Non-GM cannot save to missing section');
  // ================================================================

  const nonGmMissingSave = await JournalEntryDB.setArchetype('missing', 'non-gm-missing', {
    class: 'wizard',
    features: {}
  });
  assert(nonGmMissingSave === false,
    'Non-GM cannot save to missing section');

  // Restore GM
  game.user.isGM = true;

  // ================================================================
  section('13. Validation errors for custom entry');
  // ================================================================

  // Missing name
  const noNameForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': '',
    'archetype-class': 'fighter',
    'feat-name-0': 'Test',
    'feat-level-0': '1',
    'feat-replaces-0': '',
    _featureRows: [{ dataset: { index: '0' } }]
  });
  const noNameResult = UIManager._validateManualEntry(noNameForm);
  assert(noNameResult.valid === false,
    'Empty archetype name fails validation');
  assert(noNameResult.errors.some(e => e.includes('name')),
    'Error mentions name');

  // Missing class
  const noClassForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Test Arch',
    'archetype-class': '',
    'feat-name-0': 'Test',
    'feat-level-0': '1',
    'feat-replaces-0': '',
    _featureRows: [{ dataset: { index: '0' } }]
  });
  const noClassResult = UIManager._validateManualEntry(noClassForm);
  assert(noClassResult.valid === false,
    'Empty class fails validation');
  assert(noClassResult.errors.some(e => e.includes('Class')),
    'Error mentions class');

  // No features
  const noFeatForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Test Arch',
    'archetype-class': 'fighter',
    _featureRows: []
  });
  const noFeatResult = UIManager._validateManualEntry(noFeatForm);
  assert(noFeatResult.valid === false,
    'No features fails validation');
  assert(noFeatResult.errors.some(e => e.includes('feature')),
    'Error mentions feature');

  // Invalid level
  const badLevelForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Test Arch',
    'archetype-class': 'fighter',
    'feat-name-0': 'Test Feat',
    'feat-level-0': '0',
    'feat-replaces-0': '',
    _featureRows: [{ dataset: { index: '0' } }]
  });
  const badLevelResult = UIManager._validateManualEntry(badLevelForm);
  assert(badLevelResult.valid === false,
    'Level 0 fails validation');

  // Level > 20
  const highLevelForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Test Arch',
    'archetype-class': 'fighter',
    'feat-name-0': 'Test Feat',
    'feat-level-0': '21',
    'feat-replaces-0': '',
    _featureRows: [{ dataset: { index: '0' } }]
  });
  const highLevelResult = UIManager._validateManualEntry(highLevelForm);
  assert(highLevelResult.valid === false,
    'Level 21 fails validation');

  // Duplicate feature names
  const dupeForm = createMockForm({
    'entry-type': 'custom',
    'archetype-name': 'Test Arch',
    'archetype-class': 'fighter',
    'feat-name-0': 'Same Name',
    'feat-level-0': '1',
    'feat-replaces-0': '',
    'feat-name-1': 'same name',  // case-insensitive duplicate
    'feat-level-1': '2',
    'feat-replaces-1': '',
    _featureRows: [
      { dataset: { index: '0' } },
      { dataset: { index: '1' } }
    ]
  });
  const dupeResult = UIManager._validateManualEntry(dupeForm);
  assert(dupeResult.valid === false,
    'Duplicate feature names fail validation');
  assert(dupeResult.errors.some(e => e.includes('Duplicate')),
    'Error mentions duplicate');

  // ================================================================
  section('14. _slugify generates correct slugs');
  // ================================================================

  assert(UIManager._slugify('Shield Master') === 'shield-master',
    '_slugify handles normal name');
  assert(UIManager._slugify('Two-Handed Fighter') === 'two-handed-fighter',
    '_slugify handles hyphens');
  assert(UIManager._slugify('  Spaced  Name  ') === 'spaced-name',
    '_slugify handles extra spaces');
  assert(UIManager._slugify('Special!@#$Characters') === 'special-characters',
    '_slugify handles special characters');
  assert(UIManager._slugify('CamelCase Name') === 'camelcase-name',
    '_slugify lowercases');

  // ================================================================
  section('15. Custom data persists across reload');
  // ================================================================

  resetMockEnvironment();
  await env.hooks.callAll('init');
  await env.hooks.callAll('ready');

  const reloadedCustom = await JournalEntryDB.readSection('custom');
  assert(reloadedCustom['shield-master'] !== undefined,
    'Shield Master persists after reload');
  assert(reloadedCustom['blade-dancer'] !== undefined,
    'Blade Dancer persists after reload');
  assert(reloadedCustom['shield-master'].class === 'fighter',
    'Custom entry data intact after reload');

  // ================================================================
  section('16. Delete custom archetype');
  // ================================================================

  const deleteSuccess = await JournalEntryDB.deleteArchetype('custom', 'shield-master');
  assert(deleteSuccess === true,
    'Custom archetype deleted successfully');

  const afterDelete = await JournalEntryDB.readSection('custom');
  assert(afterDelete['shield-master'] === undefined,
    'Shield Master no longer in custom section after delete');
  assert(afterDelete['blade-dancer'] !== undefined,
    'Blade Dancer still exists after deleting Shield Master');

  // ================================================================
  section('17. getArchetype returns custom entries');
  // ================================================================

  const gotArchetype = await JournalEntryDB.getArchetype('blade-dancer');
  assert(gotArchetype !== null,
    'getArchetype finds custom archetype');
  assert(gotArchetype._section === 'custom',
    'getArchetype reports custom section');
  assert(gotArchetype.class === 'fighter',
    'getArchetype returns correct class');

  // ================================================================
  section('18. Custom entry name display');
  // ================================================================

  // Custom entries in the main dialog should display properly formatted names
  const customSection = await JournalEntryDB.readSection('custom');
  for (const [slug, entry] of Object.entries(customSection)) {
    const displayName = entry.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    assert(displayName.length > 0,
      `Custom archetype "${slug}" has displayable name: "${displayName}"`);
  }

  // ================================================================
  // Summary
  // ================================================================

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Feature #28 Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
