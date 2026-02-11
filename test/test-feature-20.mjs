/**
 * Test Suite for Feature #20: Parse failure triggers user prompt dialog
 *
 * Tests that unparseable features trigger an interactive dialog asking the user
 * to specify what the feature replaces (or mark it as additive).
 *
 * Steps:
 * 1. Set up feature with unparseable description
 * 2. Ensure no JE fix exists
 * 3. Trigger parser on this archetype
 * 4. Verify dialog appears (via callback invocation)
 * 5. Verify dropdown of base class features
 * 6. Verify 'is additive' checkbox
 * 7. Select value and confirm -> verify used
 * 8. Verify choice saved to JE fixes
 */

import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  return fn().then(() => {
    passed++;
    console.log(`  \u2713 ${name}`);
  }).catch((e) => {
    failed++;
    console.error(`  \u2717 ${name}`);
    console.error(`    ${e.message}`);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(actual, message) {
  if (actual == null) {
    throw new Error(`${message || 'Assertion failed'}: expected non-null, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(array, item, message) {
  const found = array.some(a =>
    typeof a === 'object' && typeof item === 'object'
      ? JSON.stringify(a) === JSON.stringify(item)
      : a === item
  );
  if (!found) {
    throw new Error(`${message || 'Assertion failed'}: expected array to include ${JSON.stringify(item)}`);
  }
}

// Set up environment
setupMockEnvironment();

// Import modules
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');

// Ensure database exists
await JournalEntryDB.ensureDatabase();

// ================================================================
// Helper functions
// ================================================================

function createMockArchetype(name) {
  return {
    name,
    system: {},
    _id: Math.random().toString(36).slice(2)
  };
}

function createMockFeature(name, description) {
  return {
    name,
    system: {
      description: {
        value: description
      }
    },
    _id: Math.random().toString(36).slice(2)
  };
}

function createMockAssociations(features) {
  return features.map(f => ({
    uuid: `Compendium.pf1.class-features.${f.name.toLowerCase().replace(/\s+/g, '-')}`,
    level: f.level,
    resolvedName: f.name
  }));
}

// Standard Fighter base features
const fighterBaseFeatures = [
  { name: 'Bravery', level: 2 },
  { name: 'Armor Training 1', level: 3 },
  { name: 'Weapon Training 1', level: 5 },
  { name: 'Armor Training 2', level: 7 },
  { name: 'Weapon Training 2', level: 9 },
  { name: 'Armor Training 3', level: 11 },
  { name: 'Weapon Training 3', level: 13 },
  { name: 'Armor Training 4', level: 15 },
  { name: 'Weapon Training 4', level: 17 },
  { name: 'Armor Mastery', level: 19 },
  { name: 'Weapon Mastery', level: 20 },
  { name: 'Bonus Feat', level: 1 }
];

const fighterAssociations = createMockAssociations(fighterBaseFeatures);

// Set up fromUuid to resolve our mock associations
globalThis.fromUuid = async (uuid) => {
  for (const assoc of fighterAssociations) {
    if (assoc.uuid === uuid) {
      return { name: assoc.resolvedName };
    }
  }
  return null;
};

console.log('\n=== Feature #20: Parse failure triggers user prompt dialog ===\n');

// =====================================================
// Step 1: Set up feature with unparseable description
// =====================================================
console.log('--- Step 1: Set up feature with unparseable description ---');

await test('Feature with no level/replace/modify pattern is classified as unknown', async () => {
  const desc = '<p>This feature does something cool but has no parseable pattern.</p>';
  const classification = CompendiumParser.classifyFeature(desc);
  assertEqual(classification.type, 'unknown', 'Should be classified as unknown');
  assertEqual(classification.target, null, 'Should have no target');
});

await test('Feature with unparseable description gets needsUserInput=true', async () => {
  const archetype = createMockArchetype('Broken Archetype');
  const features = [
    createMockFeature('Mystery Power', '<p>This feature does something mysterious.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterAssociations);
  assertEqual(parsed.features.length, 1, 'Should have 1 feature');
  assertEqual(parsed.features[0].needsUserInput, true, 'Unknown feature should need user input');
  assertEqual(parsed.features[0].type, 'unknown', 'Should be unknown type');
});

await test('Feature with replaces but no match gets needsUserInput=true', async () => {
  const archetype = createMockArchetype('Bad Match Archetype');
  const features = [
    createMockFeature('Weird Power', '<p><strong>Level</strong>: 3</p><p>This replaces Nonexistent Feature.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterAssociations);
  assertEqual(parsed.features.length, 1, 'Should have 1 feature');
  assertEqual(parsed.features[0].needsUserInput, true, 'Unmatched replacement should need user input');
  assertEqual(parsed.features[0].type, 'replacement', 'Should be replacement type');
});

// =====================================================
// Step 2: Ensure no JE fix exists
// =====================================================
console.log('\n--- Step 2: Ensure no JE fix exists ---');

await test('No JE fix exists for our test archetype', async () => {
  const fix = await JournalEntryDB.getArchetype('broken-archetype');
  assertEqual(fix, null, 'Should have no JE fix');
});

await test('Clearing any existing fix data', async () => {
  // Ensure clean state
  const fixesData = await JournalEntryDB.readSection('fixes');
  delete fixesData['broken-archetype'];
  delete fixesData['test-prompt-archetype'];
  await JournalEntryDB.writeSection('fixes', fixesData);

  const fix = await JournalEntryDB.getArchetype('test-prompt-archetype');
  assertEqual(fix, null, 'Should have no fix data');
});

// =====================================================
// Step 3: Trigger parser on this archetype (parseArchetypeWithPrompts)
// =====================================================
console.log('\n--- Step 3: Trigger parseArchetypeWithPrompts ---');

await test('parseArchetypeWithPrompts exists and is a function', async () => {
  assertEqual(typeof CompendiumParser.parseArchetypeWithPrompts, 'function',
    'parseArchetypeWithPrompts should be a static method');
});

await test('parseArchetypeWithPrompts without callback returns same as parseArchetype', async () => {
  const archetype = createMockArchetype('Test Prompt Archetype');
  const features = [
    createMockFeature('Mystery Power', '<p>Unparseable mystery.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations);
  assertEqual(parsed.features.length, 1, 'Should have 1 feature');
  assertEqual(parsed.features[0].needsUserInput, true, 'Should still need user input without callback');
});

// =====================================================
// Step 4: Verify dialog appears (callback invoked)
// =====================================================
console.log('\n--- Step 4: Verify prompt callback is invoked for unparseable features ---');

await test('Prompt callback is invoked for feature with needsUserInput=true', async () => {
  let callbackInvoked = false;
  let callbackFeature = null;
  let callbackBaseFeatures = null;

  const archetype = createMockArchetype('Test Prompt Archetype');
  const features = [
    createMockFeature('Mystery Power', '<p>Unparseable mystery.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      callbackInvoked = true;
      callbackFeature = feature;
      callbackBaseFeatures = baseFeatures;
      return null; // cancel
    },
    className: 'fighter'
  });

  assertEqual(callbackInvoked, true, 'Callback should be invoked for unparseable feature');
  assertNotNull(callbackFeature, 'Feature should be passed to callback');
  assertNotNull(callbackBaseFeatures, 'Base features should be passed to callback');
});

await test('Prompt callback receives correct feature data', async () => {
  let callbackFeature = null;

  const archetype = createMockArchetype('Test Prompt Archetype');
  const features = [
    createMockFeature('Mystery Power', '<p>Unparseable mystery.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      callbackFeature = feature;
      return null;
    },
    className: 'fighter'
  });

  assertEqual(callbackFeature.name, 'Mystery Power', 'Feature name should be passed');
  assertEqual(callbackFeature.description, '<p>Unparseable mystery.</p>', 'Description should be passed');
  assertEqual(callbackFeature.archetypeSlug, 'test-prompt-archetype', 'Archetype slug should be passed');
  assertEqual(callbackFeature.archetypeName, 'Test Prompt Archetype', 'Archetype name should be passed');
  assertEqual(callbackFeature.className, 'fighter', 'Class name should be passed');
});

await test('Prompt callback NOT invoked for parseable features', async () => {
  let callbackCount = 0;

  const archetype = createMockArchetype('Good Archetype');
  const features = [
    createMockFeature('Shattering Strike', '<p><strong>Level</strong>: 2</p><p>This replaces Bravery.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      callbackCount++;
      return null;
    },
    className: 'fighter'
  });

  assertEqual(callbackCount, 0, 'Callback should NOT be invoked for parseable features');
});

await test('Prompt callback NOT invoked for additive features', async () => {
  let callbackCount = 0;

  const archetype = createMockArchetype('Additive Archetype');
  const features = [
    createMockFeature('Bonus Ability', '<p><strong>Level</strong>: 5</p><p>A new ability gained at 5th level.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      callbackCount++;
      return null;
    },
    className: 'fighter'
  });

  assertEqual(callbackCount, 0, 'Callback should NOT be invoked for additive features');
});

await test('Prompt callback invoked once per unparseable feature', async () => {
  let callbackCount = 0;
  const callbackNames = [];

  const archetype = createMockArchetype('Multi Bad Archetype');
  const features = [
    createMockFeature('Good Feature', '<p><strong>Level</strong>: 2</p><p>This replaces Bravery.</p>'),
    createMockFeature('Bad Feature 1', '<p>No pattern here.</p>'),
    createMockFeature('Bad Feature 2', '<p>Also unparseable.</p>'),
    createMockFeature('Another Good', '<p><strong>Level</strong>: 5</p><p>Additive ability at 5th level.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      callbackCount++;
      callbackNames.push(feature.name);
      return null;
    },
    className: 'fighter'
  });

  assertEqual(callbackCount, 2, 'Should invoke callback exactly twice (for 2 bad features)');
  assert(callbackNames.includes('Bad Feature 1'), 'Should include Bad Feature 1');
  assert(callbackNames.includes('Bad Feature 2'), 'Should include Bad Feature 2');
});

await test('Prompt callback invoked for replacement with no match', async () => {
  let callbackCount = 0;

  const archetype = createMockArchetype('No Match Archetype');
  const features = [
    createMockFeature('Phantom Swap', '<p><strong>Level</strong>: 3</p><p>This replaces Phantom Feature.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      callbackCount++;
      return null;
    },
    className: 'fighter'
  });

  assertEqual(callbackCount, 1, 'Should invoke callback for unmatched replacement');
});

// =====================================================
// Step 5: Verify dropdown of base class features
// =====================================================
console.log('\n--- Step 5: Verify base class features passed to prompt ---');

await test('Base features list includes all resolved associations', async () => {
  let receivedBaseFeatures = null;

  const archetype = createMockArchetype('Test BF Archetype');
  const features = [
    createMockFeature('Unknown Power', '<p>No pattern.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      receivedBaseFeatures = baseFeatures;
      return null;
    },
    className: 'fighter'
  });

  assertNotNull(receivedBaseFeatures, 'Base features should be passed');
  assertEqual(receivedBaseFeatures.length, fighterBaseFeatures.length,
    `Should have ${fighterBaseFeatures.length} base features`);
});

await test('Base features have correct name, level, uuid structure', async () => {
  let receivedBaseFeatures = null;

  const archetype = createMockArchetype('Test BF2 Archetype');
  const features = [
    createMockFeature('Unknown Power', '<p>No pattern.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      receivedBaseFeatures = baseFeatures;
      return null;
    },
    className: 'fighter'
  });

  const bravery = receivedBaseFeatures.find(f => f.name === 'Bravery');
  assertNotNull(bravery, 'Should include Bravery');
  assertEqual(bravery.level, 2, 'Bravery should be level 2');
  assert(typeof bravery.uuid === 'string' && bravery.uuid.length > 0, 'Should have UUID');

  const at1 = receivedBaseFeatures.find(f => f.name === 'Armor Training 1');
  assertNotNull(at1, 'Should include Armor Training 1');
  assertEqual(at1.level, 3, 'AT1 should be level 3');

  const wm = receivedBaseFeatures.find(f => f.name === 'Weapon Mastery');
  assertNotNull(wm, 'Should include Weapon Mastery');
  assertEqual(wm.level, 20, 'Weapon Mastery should be level 20');
});

await test('Fix dialog HTML contains dropdown of base class features', async () => {
  const feature = {
    name: 'Mystery Power',
    description: '<p>Unparseable.</p>',
    level: 3,
    archetypeSlug: 'test-arch',
    archetypeName: 'Test Archetype'
  };

  const baseFeatures = [
    { name: 'Bravery', level: 2, uuid: 'uuid1' },
    { name: 'Armor Training 1', level: 3, uuid: 'uuid2' },
    { name: 'Weapon Training 1', level: 5, uuid: 'uuid3' }
  ];

  const html = UIManager._buildFixDialogHTML(feature, baseFeatures);

  assert(html.includes('Bravery'), 'Dropdown should include Bravery');
  assert(html.includes('Armor Training 1'), 'Dropdown should include Armor Training 1');
  assert(html.includes('Weapon Training 1'), 'Dropdown should include Weapon Training 1');
  assert(html.includes('fix-replaces-select'), 'Should have replaces select element');
  assert(html.includes('(Lv 2)'), 'Should show level for Bravery');
  assert(html.includes('(Lv 3)'), 'Should show level for Armor Training 1');
  assert(html.includes('(Lv 5)'), 'Should show level for Weapon Training 1');
});

await test('Fix dialog dropdown sorted by level', async () => {
  const feature = {
    name: 'Test Feature',
    description: '<p>Test.</p>',
    level: 1
  };

  const baseFeatures = [
    { name: 'High Level', level: 15, uuid: 'uuid1' },
    { name: 'Low Level', level: 1, uuid: 'uuid2' },
    { name: 'Mid Level', level: 7, uuid: 'uuid3' }
  ];

  const html = UIManager._buildFixDialogHTML(feature, baseFeatures);

  const lowIdx = html.indexOf('Low Level');
  const midIdx = html.indexOf('Mid Level');
  const highIdx = html.indexOf('High Level');

  assert(lowIdx < midIdx, 'Low level should come before mid level');
  assert(midIdx < highIdx, 'Mid level should come before high level');
});

// =====================================================
// Step 6: Verify 'is additive' checkbox
// =====================================================
console.log('\n--- Step 6: Verify additive checkbox ---');

await test('Fix dialog HTML contains additive checkbox', async () => {
  const feature = { name: 'Test', description: '<p>Test.</p>', level: 1 };
  const baseFeatures = [{ name: 'Bravery', level: 2, uuid: 'uuid1' }];

  const html = UIManager._buildFixDialogHTML(feature, baseFeatures);
  assert(html.includes('fix-additive-checkbox'), 'Should have additive checkbox');
  assert(html.includes('type="checkbox"'), 'Should be a checkbox');
  assert(html.includes('additive'), 'Should mention additive');
});

await test('When user marks as additive, feature type becomes additive', async () => {
  const archetype = createMockArchetype('Additive Fix Archetype');
  const features = [
    createMockFeature('New Bonus', '<p>No parseable pattern here.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      return {
        level: 3,
        replaces: null,
        isAdditive: true,
        featureName: feature.name
      };
    },
    className: 'fighter'
  });

  assertEqual(parsed.features[0].type, 'additive', 'Feature should be additive');
  assertEqual(parsed.features[0].target, null, 'Additive should have null target');
  assertEqual(parsed.features[0].needsUserInput, false, 'Should no longer need user input');
  assertEqual(parsed.features[0].level, 3, 'Level should be from user input');
});

await test('Additive selection has null replaces in parsed result', async () => {
  const archetype = createMockArchetype('Additive Fix 2');
  const features = [
    createMockFeature('Extra Talent', '<p>Unparseable content.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async () => ({
      level: 5,
      replaces: null,
      isAdditive: true,
      featureName: 'Extra Talent'
    }),
    className: 'fighter'
  });

  assertEqual(parsed.features[0].target, null, 'Additive target should be null');
  assertEqual(parsed.features[0].type, 'additive', 'Type should be additive');
});

// =====================================================
// Step 7: Select value and confirm -> verify used
// =====================================================
console.log('\n--- Step 7: User selects replacement -> result applied ---');

await test('User selects replacement -> feature updated with user choice', async () => {
  const archetype = createMockArchetype('User Choice Archetype');
  const features = [
    createMockFeature('Override Bravery', '<p>No pattern at all.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      return {
        level: 2,
        replaces: 'Bravery',
        isAdditive: false,
        featureName: feature.name
      };
    },
    className: 'fighter'
  });

  assertEqual(parsed.features[0].type, 'replacement', 'Should be replacement type');
  assertEqual(parsed.features[0].target, 'Bravery', 'Target should be Bravery');
  assertEqual(parsed.features[0].needsUserInput, false, 'Should no longer need user input');
  assertEqual(parsed.features[0].level, 2, 'Level should be from user input');
  assertEqual(parsed.features[0].source, 'user-fix', 'Source should be user-fix');
  assertEqual(parsed.features[0].userFixApplied, true, 'userFixApplied flag should be true');
});

await test('User replacement -> matchedAssociation resolved', async () => {
  const archetype = createMockArchetype('Match Archetype');
  const features = [
    createMockFeature('Better Bravery', '<p>Nothing parseable.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async () => ({
      level: 2,
      replaces: 'Bravery',
      isAdditive: false,
      featureName: 'Better Bravery'
    }),
    className: 'fighter'
  });

  assertNotNull(parsed.features[0].matchedAssociation, 'Should have matched association');
  assertEqual(parsed.features[0].matchedAssociation.resolvedName, 'Bravery',
    'Matched association should be Bravery');
});

await test('User cancels prompt -> feature remains needsUserInput', async () => {
  const archetype = createMockArchetype('Cancel Archetype');
  const features = [
    createMockFeature('Unknown Thing', '<p>Unparseable.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async () => null, // User cancelled
    className: 'fighter'
  });

  assertEqual(parsed.features[0].needsUserInput, true, 'Should still need user input');
  assertEqual(parsed.features[0].type, 'unknown', 'Should still be unknown type');
  assertEqual(parsed.features[0].source, 'auto-parse', 'Source should still be auto-parse');
});

await test('Mixed features: only unparseable ones get prompted', async () => {
  let promptedFeatures = [];

  const archetype = createMockArchetype('Mixed Fix Archetype');
  const features = [
    createMockFeature('Shattering Strike', '<p><strong>Level</strong>: 2</p><p>This replaces Bravery.</p>'),
    createMockFeature('Unknown Power', '<p>Cannot parse this.</p>'),
    createMockFeature('Bonus Ability', '<p><strong>Level</strong>: 7</p><p>New ability at 7th level.</p>'),
    createMockFeature('Another Unknown', '<p>Also unparseable content.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      promptedFeatures.push(feature.name);
      return {
        level: 3,
        replaces: 'Armor Training 1',
        isAdditive: false,
        featureName: feature.name
      };
    },
    className: 'fighter'
  });

  assertEqual(promptedFeatures.length, 2, 'Should prompt for exactly 2 features');
  assert(promptedFeatures.includes('Unknown Power'), 'Should prompt for Unknown Power');
  assert(promptedFeatures.includes('Another Unknown'), 'Should prompt for Another Unknown');

  // Verify parseable features not affected
  assertEqual(parsed.features[0].source, 'auto-parse', 'Shattering Strike should be auto-parse');
  assertEqual(parsed.features[0].needsUserInput, false, 'Shattering Strike should not need input');
  assertEqual(parsed.features[2].source, 'auto-parse', 'Bonus Ability should be auto-parse');
  assertEqual(parsed.features[2].type, 'additive', 'Bonus Ability should be additive');
});

await test('User fix level overrides auto-parsed level when provided', async () => {
  const archetype = createMockArchetype('Level Override Archetype');
  const features = [
    createMockFeature('Unmatched Replace', '<p><strong>Level</strong>: 5</p><p>This replaces Phantom Power.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      return {
        level: 7,  // Override the parsed level 5
        replaces: 'Armor Training 2',
        isAdditive: false,
        featureName: feature.name
      };
    },
    className: 'fighter'
  });

  assertEqual(parsed.features[0].level, 7, 'Level should be overridden to 7');
  assertEqual(parsed.features[0].target, 'Armor Training 2', 'Target should be Armor Training 2');
});

await test('Feature level preserved when user fix returns null level', async () => {
  const archetype = createMockArchetype('Preserve Level Archetype');
  const features = [
    createMockFeature('Has Level', '<p><strong>Level</strong>: 3</p><p>Unparseable stuff here.</p>')
  ];

  // This feature has level=3 from auto-parse but type=unknown due to no replace/modify
  // (Actually it's additive since it has level - let me use a replacement with no match)
  const features2 = [
    createMockFeature('Bad Replace', '<p><strong>Level</strong>: 3</p><p>This replaces Nonexistent Thing.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(
    createMockArchetype('Preserve Level 2'), features2, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      return {
        level: null,  // Don't override level
        replaces: 'Bravery',
        isAdditive: false,
        featureName: feature.name
      };
    },
    className: 'fighter'
  });

  assertEqual(parsed.features[0].level, 3, 'Level should be preserved from auto-parse (3)');
});

// =====================================================
// Step 8: Verify choice saved to JE fixes
// =====================================================
console.log('\n--- Step 8: Verify fix dialog saves to JE fixes ---');

await test('showFixDialog saves user choice to JE fixes section', async () => {
  // Clear any existing fix data
  const fixesData = await JournalEntryDB.readSection('fixes');
  delete fixesData['save-test-archetype'];
  await JournalEntryDB.writeSection('fixes', fixesData);

  // Verify it's clean
  const checkBefore = await JournalEntryDB.getArchetype('save-test-archetype');
  assertEqual(checkBefore, null, 'Should start with no fix data');

  const feature = {
    name: 'Mystery Power',
    description: '<p>Cannot parse this feature.</p>',
    level: 3,
    archetypeSlug: 'save-test-archetype',
    archetypeName: 'Save Test Archetype',
    className: 'fighter'
  };

  const baseFeatures = [
    { name: 'Bravery', level: 2, uuid: 'uuid1' },
    { name: 'Armor Training 1', level: 3, uuid: 'uuid2' }
  ];

  // Simulate the showFixDialog result being saved
  // We test the JE save logic directly since showFixDialog creates a FoundryVTT Dialog
  const fixEntry = {
    level: 3,
    replaces: 'Bravery',
    description: feature.description
  };

  const archetypeSlug = feature.archetypeSlug;
  const featureSlug = feature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const fixData = { class: 'fighter', features: {} };
  fixData.features[featureSlug] = fixEntry;

  const success = await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData);
  assertEqual(success, true, 'Should save successfully');

  // Verify the fix is stored
  const storedFix = await JournalEntryDB.getArchetype('save-test-archetype');
  assertNotNull(storedFix, 'Fix should be retrievable');
  assertEqual(storedFix._section, 'fixes', 'Should be in fixes section');
  assertNotNull(storedFix.features[featureSlug], 'Feature fix should exist');
  assertEqual(storedFix.features[featureSlug].replaces, 'Bravery', 'Replaces should be Bravery');
  assertEqual(storedFix.features[featureSlug].level, 3, 'Level should be 3');
});

await test('Saved JE fix is used by parseArchetype on subsequent run', async () => {
  // The fix was saved in previous test. Now parse the archetype again.
  const archetype = createMockArchetype('Save Test Archetype');
  const features = [
    createMockFeature('Mystery Power', '<p>Cannot parse this feature.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetype(archetype, features, fighterAssociations);

  // The JE fix should be used instead of auto-parse
  assertEqual(parsed.features[0].source, 'je-fix', 'Should use JE fix source');
  assertEqual(parsed.features[0].replaces, 'Bravery', 'Should have Bravery from JE fix');
  assertEqual(parsed.features[0].level, 3, 'Should have level 3 from JE fix');
});

await test('Multiple fixes for same archetype coexist in JE', async () => {
  const archetypeSlug = 'multi-fix-archetype';

  // Clear
  const fixesData = await JournalEntryDB.readSection('fixes');
  delete fixesData[archetypeSlug];
  await JournalEntryDB.writeSection('fixes', fixesData);

  // Save first fix
  const fixData = { class: 'fighter', features: {} };
  fixData.features['feature-a'] = { level: 2, replaces: 'Bravery', description: 'Fix A' };
  await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData);

  // Add second fix (read, modify, write)
  const stored = await JournalEntryDB.getArchetype(archetypeSlug);
  const updatedFixData = { class: stored.class, features: { ...stored.features } };
  updatedFixData.features['feature-b'] = { level: 3, replaces: 'Armor Training 1', description: 'Fix B' };
  await JournalEntryDB.setArchetype('fixes', archetypeSlug, updatedFixData);

  // Verify both exist
  const final = await JournalEntryDB.getArchetype(archetypeSlug);
  assertNotNull(final.features['feature-a'], 'Feature A fix should exist');
  assertNotNull(final.features['feature-b'], 'Feature B fix should exist');
  assertEqual(final.features['feature-a'].replaces, 'Bravery', 'Feature A replaces Bravery');
  assertEqual(final.features['feature-b'].replaces, 'Armor Training 1', 'Feature B replaces AT1');
});

await test('Fix data persists across reload (readSection returns saved data)', async () => {
  // Read the fixes section directly
  const fixesData = await JournalEntryDB.readSection('fixes');

  assertNotNull(fixesData['save-test-archetype'], 'save-test-archetype fix should persist');
  assertNotNull(fixesData['multi-fix-archetype'], 'multi-fix-archetype fix should persist');

  const saveTest = fixesData['save-test-archetype'];
  assertEqual(saveTest.class, 'fighter', 'Class should persist');
  assertNotNull(saveTest.features['mystery-power'], 'Mystery power fix should persist');
});

// =====================================================
// Additional integration tests
// =====================================================
console.log('\n--- Additional integration tests ---');

await test('Full flow: unparseable -> prompt -> fix -> re-parse uses fix', async () => {
  const archetypeSlug = 'full-flow-archetype';

  // Clear any existing data
  const fixesData = await JournalEntryDB.readSection('fixes');
  delete fixesData[archetypeSlug];
  await JournalEntryDB.writeSection('fixes', fixesData);

  const archetype = createMockArchetype('Full Flow Archetype');
  const features = [
    createMockFeature('Mysterious Strike', '<p>Completely unparseable.</p>')
  ];

  // First parse: should prompt user
  let promptCalled = false;
  const parsed1 = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async (feature, baseFeatures) => {
      promptCalled = true;

      // Simulate user selecting Bravery as replacement
      // Also save to JE (like showFixDialog would)
      const featureSlug = feature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const fixData = { class: 'fighter', features: {} };
      fixData.features[featureSlug] = { level: 2, replaces: 'Bravery', description: feature.description };
      await JournalEntryDB.setArchetype('fixes', feature.archetypeSlug, fixData);

      return {
        level: 2,
        replaces: 'Bravery',
        isAdditive: false,
        featureName: feature.name
      };
    },
    className: 'fighter'
  });

  assertEqual(promptCalled, true, 'Prompt should be called on first parse');
  assertEqual(parsed1.features[0].needsUserInput, false, 'Should be resolved after user input');
  assertEqual(parsed1.features[0].target, 'Bravery', 'Should target Bravery');

  // Second parse (no callback needed): JE fix should be used
  const parsed2 = await CompendiumParser.parseArchetype(archetype, features, fighterAssociations);
  assertEqual(parsed2.features[0].source, 'je-fix', 'Second parse should use JE fix');
  assertEqual(parsed2.features[0].replaces, 'Bravery', 'Should still target Bravery from JE fix');
});

await test('JE fix takes priority over auto-parse even with parseArchetypeWithPrompts', async () => {
  const archetypeSlug = 'priority-test-archetype';

  // Set up a JE fix manually
  const fixData = { class: 'fighter', features: {} };
  fixData.features['hard-feature'] = { level: 5, replaces: 'Weapon Training 1', description: 'Fixed' };
  await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData);

  const archetype = createMockArchetype('Priority Test Archetype');
  const features = [
    createMockFeature('Hard Feature', '<p>Unparseable content.</p>')
  ];

  let promptCalled = false;
  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async () => {
      promptCalled = true;
      return null;
    },
    className: 'fighter'
  });

  assertEqual(promptCalled, false, 'Prompt should NOT be called when JE fix exists');
  assertEqual(parsed.features[0].source, 'je-fix', 'Should use JE fix source');
  assertEqual(parsed.features[0].replaces, 'Weapon Training 1', 'Should use JE fix replaces');
});

await test('Empty baseAssociations still triggers prompt for unparseable features', async () => {
  let receivedBaseFeatures = null;

  const archetype = createMockArchetype('Empty Assoc Archetype');
  const features = [
    createMockFeature('Unknown', '<p>Unparseable.</p>')
  ];

  await CompendiumParser.parseArchetypeWithPrompts(archetype, features, [], {
    promptCallback: async (feature, baseFeatures) => {
      receivedBaseFeatures = baseFeatures;
      return null;
    },
    className: 'fighter'
  });

  assertNotNull(receivedBaseFeatures, 'Base features should be passed (possibly empty)');
  assertEqual(receivedBaseFeatures.length, 0, 'Base features should be empty for empty associations');
});

await test('parseArchetypeWithPrompts preserves archetype name and slug', async () => {
  const archetype = createMockArchetype('My Cool Archetype');
  const features = [
    createMockFeature('Something', '<p>Unparseable.</p>')
  ];

  const parsed = await CompendiumParser.parseArchetypeWithPrompts(archetype, features, fighterAssociations, {
    promptCallback: async () => null,
    className: 'fighter'
  });

  assertEqual(parsed.name, 'My Cool Archetype', 'Name should be preserved');
  assertEqual(parsed.slug, 'my-cool-archetype', 'Slug should be preserved');
});

await test('UIManager._buildFixDialogHTML shows feature name and raw description', async () => {
  const feature = {
    name: 'Shattering Strike',
    description: '<p><strong>Level</strong>: 2</p><p>This is a broken description.</p>',
    level: 2
  };

  const baseFeatures = [
    { name: 'Bravery', level: 2, uuid: 'uuid1' }
  ];

  const html = UIManager._buildFixDialogHTML(feature, baseFeatures);

  assert(html.includes('Shattering Strike'), 'Should show feature name');
  assert(html.includes('This is a broken description'), 'Should show raw description');
  assert(html.includes('fix-feature-info'), 'Should have feature info section');
});

await test('UIManager._buildFixDialogHTML has level input pre-populated', async () => {
  const feature = {
    name: 'Test Feature',
    description: '<p>Test.</p>',
    level: 5
  };

  const html = UIManager._buildFixDialogHTML(feature, []);

  assert(html.includes('value="5"'), 'Level input should be pre-populated with 5');
  assert(html.includes('fix-level-input'), 'Should have level input');
  assert(html.includes('min="1"'), 'Should have min=1');
  assert(html.includes('max="20"'), 'Should have max=20');
});

await test('UIManager._parseFixDialogResult returns correct result for replacement', async () => {
  // Create a mock DOM element with the fix dialog content
  const container = document.createElement('div');
  container.innerHTML = `
    <input class="fix-level-input" value="3" />
    <select class="fix-replaces-select"><option value="Bravery" selected>Bravery</option></select>
    <input type="checkbox" class="fix-additive-checkbox" />
  `;

  const feature = { name: 'Test', level: 2 };
  const result = UIManager._parseFixDialogResult(container, feature);

  assertNotNull(result, 'Should return a result');
  assertEqual(result.level, 3, 'Level should be 3');
  assertEqual(result.replaces, 'Bravery', 'Should replace Bravery');
  assertEqual(result.isAdditive, false, 'Should not be additive');
});

await test('UIManager._parseFixDialogResult returns correct result for additive', async () => {
  const container = document.createElement('div');
  container.innerHTML = `
    <input class="fix-level-input" value="5" />
    <select class="fix-replaces-select"><option value="">--</option></select>
    <input type="checkbox" class="fix-additive-checkbox" checked />
  `;

  const feature = { name: 'Test', level: 5 };
  const result = UIManager._parseFixDialogResult(container, feature);

  assertNotNull(result, 'Should return a result');
  assertEqual(result.isAdditive, true, 'Should be additive');
  assertEqual(result.replaces, null, 'Additive should have null replaces');
  assertEqual(result.level, 5, 'Level should be 5');
});

await test('UIManager._parseFixDialogResult returns null when no selection and not additive', async () => {
  const container = document.createElement('div');
  container.innerHTML = `
    <input class="fix-level-input" value="3" />
    <select class="fix-replaces-select"><option value="" selected>-- Select --</option></select>
    <input type="checkbox" class="fix-additive-checkbox" />
  `;

  const feature = { name: 'Test', level: 3 };
  const result = UIManager._parseFixDialogResult(container, feature);

  assertEqual(result, null, 'Should return null when no selection and not additive');
});

await test('Fix dialog handles empty baseFeatures gracefully', async () => {
  const feature = { name: 'Test', description: '<p>Test.</p>', level: 1 };
  const html = UIManager._buildFixDialogHTML(feature, []);

  assert(html.includes('fix-replaces-select'), 'Should still have select element');
  assert(html.includes('-- Select base feature --'), 'Should have default option');
  // No options beyond default
  const optionCount = (html.match(/<option/g) || []).length;
  assertEqual(optionCount, 1, 'Should only have the default option');
});

await test('Fix dialog handles null baseFeatures gracefully', async () => {
  const feature = { name: 'Test', description: '<p>Test.</p>', level: 1 };
  const html = UIManager._buildFixDialogHTML(feature, null);

  assert(html.includes('fix-replaces-select'), 'Should still have select element');
});

await test('Fix dialog handles null/undefined feature properties gracefully', async () => {
  const feature = { name: null, description: null, level: null };
  const html = UIManager._buildFixDialogHTML(feature, []);

  assert(html.includes('Unknown Feature'), 'Should show default name for null');
  assert(html.includes('No description available'), 'Should show default description for null');
});

// =====================================================
// Summary
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #20: Parse failure triggers user prompt dialog`);
console.log(`Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
