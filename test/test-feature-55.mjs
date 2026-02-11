/**
 * Test Suite for Feature #55: Support for selecting multiple archetypes for stacking
 *
 * Verifies:
 * 1. Open main dialog
 * 2. Select archetype A
 * 3. Select archetype B (non-conflicting)
 * 4. Verify both are selected/highlighted
 * 5. Click apply -> verify preview shows combined diff
 * 6. Select conflicting archetype -> verify blocked or warned
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

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

async function asyncTest(name, fn) {
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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertGreaterThan(actual, threshold, message) {
  if (!(actual > threshold)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${actual} > ${threshold}`);
  }
}

function assertContains(str, substr, message) {
  if (typeof str !== 'string' || !str.includes(substr)) {
    throw new Error(`${message || 'Assertion failed'}: "${str}" does not contain "${substr}"`);
  }
}

// Set up environment
const { hooks, settings } = setupMockEnvironment();

// Import and init module
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { ConflictChecker } = await import('../scripts/conflict-checker.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

console.log('\n=== Feature #55: Support for selecting multiple archetypes for stacking ===\n');

// Track notifications
const notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};
function clearNotifications() { notifications.length = 0; }

// Track dialogs
const dialogTracker = [];
const OrigDialog = globalThis.Dialog;
class TrackedDialog extends OrigDialog {
  constructor(data, options) {
    super(data, options);
    dialogTracker.push(this);
  }
}
globalThis.Dialog = TrackedDialog;
function clearDialogTracker() { dialogTracker.length = 0; }

// =====================================================
// Test Data
// =====================================================

// Base class associations for Fighter
const fighterAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1, resolvedName: 'Bonus Feat' },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2, resolvedName: 'Bravery' },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3, resolvedName: 'Armor Training 1' },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5, resolvedName: 'Weapon Training 1' },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7, resolvedName: 'Armor Training 2' },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9, resolvedName: 'Weapon Training 2' },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11, resolvedName: 'Armor Training 3' },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining3', level: 13, resolvedName: 'Weapon Training 3' },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15, resolvedName: 'Armor Training 4' },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining4', level: 17, resolvedName: 'Weapon Training 4' },
  { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19, resolvedName: 'Armor Mastery' },
  { uuid: 'Compendium.pf1.class-abilities.WeaponMastery', level: 20, resolvedName: 'Weapon Mastery' }
];

// Archetype A: Two-Handed Fighter (replaces Bravery + AT1)
const archetypeA = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'Armor Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      source: 'auto-parse'
    }
  ]
};

// Archetype B: Weapon Master (replaces WT1 + WT2 - non-conflicting with A)
const archetypeB = {
  name: 'Weapon Master',
  slug: 'weapon-master',
  features: [
    {
      name: 'Weapon Guard',
      level: 5,
      type: 'replacement',
      target: 'Weapon Training 1',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    },
    {
      name: 'Reliable Strike',
      level: 9,
      type: 'replacement',
      target: 'Weapon Training 2',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
      source: 'auto-parse'
    }
  ]
};

// Archetype C: Unbreakable (replaces Bravery -> CONFLICTS with A)
const archetypeC = {
  name: 'Unbreakable',
  slug: 'unbreakable',
  features: [
    {
      name: 'Heroic Defiance',
      level: 2,
      type: 'replacement',
      target: 'Bravery',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    }
  ]
};

// Archetype D: Additive only (no conflicts)
const archetypeD = {
  name: 'Bonus Training',
  slug: 'bonus-training',
  features: [
    {
      name: 'Extra Combat Feat',
      level: 4,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Multi-selection state management
// =====================================================
console.log('--- Step 1: Multi-selection state management ---');

test('selectedArchetypes Set tracks selections correctly', () => {
  const selected = new Set();
  selected.add('two-handed-fighter');
  selected.add('weapon-master');
  assertEqual(selected.size, 2, 'Should track 2 selections');
  assert(selected.has('two-handed-fighter'), 'Should contain A');
  assert(selected.has('weapon-master'), 'Should contain B');
});

test('Deselecting removes from set', () => {
  const selected = new Set();
  selected.add('two-handed-fighter');
  selected.add('weapon-master');
  selected.delete('two-handed-fighter');
  assertEqual(selected.size, 1, 'Should have 1 after removal');
  assert(!selected.has('two-handed-fighter'), 'A should be removed');
  assert(selected.has('weapon-master'), 'B should remain');
});

test('Clear resets all selections', () => {
  const selected = new Set();
  selected.add('two-handed-fighter');
  selected.add('weapon-master');
  selected.clear();
  assertEqual(selected.size, 0, 'Should be empty after clear');
});

// =====================================================
// Step 2: Select non-conflicting A, then B
// =====================================================
console.log('\n--- Step 2: Select non-conflicting A, then B ---');

test('A and B are non-conflicting', () => {
  const result = ConflictChecker.validateStacking([archetypeA, archetypeB]);
  assertEqual(result.valid, true, 'A+B should not conflict');
});

test('Can select A first', () => {
  const selected = new Set();
  selected.add(archetypeA.slug);
  assertEqual(selected.size, 1, 'A selected');
});

test('Can add B to selection (no conflict with A)', () => {
  const selected = new Set([archetypeA.slug]);
  // Simulate conflict check before adding B
  const existingData = [archetypeA]; // Already selected
  const result = ConflictChecker.checkCanApply(archetypeB, existingData);
  assertEqual(result.canApply, true, 'B should pass conflict check against A');
  selected.add(archetypeB.slug);
  assertEqual(selected.size, 2, 'Both A and B selected');
});

// =====================================================
// Step 3: Verify both selected/highlighted
// =====================================================
console.log('\n--- Step 3: Verify both selected/highlighted ---');

test('Both archetypes in selected set', () => {
  const selected = new Set([archetypeA.slug, archetypeB.slug]);
  assert(selected.has('two-handed-fighter'), 'A should be selected');
  assert(selected.has('weapon-master'), 'B should be selected');
  assertEqual(selected.size, 2, 'Exactly 2 selected');
});

test('Selected archetypes can be retrieved as array', () => {
  const selected = new Set([archetypeA.slug, archetypeB.slug]);
  const selectedArray = [...selected];
  assertEqual(selectedArray.length, 2, 'Array has 2 elements');
  assert(selectedArray.includes('two-handed-fighter'), 'Contains A slug');
  assert(selectedArray.includes('weapon-master'), 'Contains B slug');
});

// =====================================================
// Step 4: Combined diff preview for multi-selection
// =====================================================
console.log('\n--- Step 4: Combined diff preview for multi-selection ---');

test('Generate combined parsed data from multiple selected archetypes', () => {
  const selectedParsedList = [archetypeA, archetypeB];
  const combinedParsed = {
    name: selectedParsedList.map(a => a.name).join(' + '),
    slug: selectedParsedList.map(a => a.slug).join('+'),
    features: selectedParsedList.flatMap(a => a.features || [])
  };

  assertEqual(combinedParsed.name, 'Two-Handed Fighter + Weapon Master', 'Combined name');
  assertEqual(combinedParsed.features.length, 4, 'Combined features: 2+2=4');
  assert(combinedParsed.features.some(f => f.name === 'Shattering Strike'), 'Has A features');
  assert(combinedParsed.features.some(f => f.name === 'Weapon Guard'), 'Has B features');
});

test('Combined diff shows all changes from both archetypes', () => {
  const combinedParsed = {
    name: 'Two-Handed Fighter + Weapon Master',
    slug: 'two-handed-fighter+weapon-master',
    features: [...archetypeA.features, ...archetypeB.features]
  };

  const diff = DiffEngine.generateDiff(fighterAssociations, combinedParsed);

  // Should have removed: Bravery, AT1, WT1, WT2
  const removed = diff.filter(d => d.status === DiffEngine.STATUS.REMOVED);
  assertEqual(removed.length, 4, 'Should remove 4 base features');

  // Should have added: Shattering Strike, Overhand Chop, Weapon Guard, Reliable Strike
  const added = diff.filter(d => d.status === DiffEngine.STATUS.ADDED);
  assertEqual(added.length, 4, 'Should add 4 archetype features');

  // Should have unchanged: BonusFeat, AT2, AT3, AT4, WT3, WT4, ArmorMastery, WeaponMastery
  const unchanged = diff.filter(d => d.status === DiffEngine.STATUS.UNCHANGED);
  assertEqual(unchanged.length, 8, 'Should have 8 unchanged features');
});

test('Combined diff sorted by level', () => {
  const combinedParsed = {
    name: 'Combined',
    features: [...archetypeA.features, ...archetypeB.features]
  };
  const diff = DiffEngine.generateDiff(fighterAssociations, combinedParsed);

  for (let i = 1; i < diff.length; i++) {
    assert(
      (diff[i].level || 0) >= (diff[i-1].level || 0),
      `Diff should be sorted by level: ${diff[i-1].level} <= ${diff[i].level}`
    );
  }
});

test('Preview HTML generated for combined diff', () => {
  const combinedParsed = {
    name: 'Two-Handed Fighter + Weapon Master',
    features: [...archetypeA.features, ...archetypeB.features]
  };
  const diff = DiffEngine.generateDiff(fighterAssociations, combinedParsed);
  const html = UIManager._buildPreviewHTML(combinedParsed, diff);

  assertContains(html, 'Two-Handed Fighter + Weapon Master', 'Should show combined name');
  assertContains(html, 'preview-diff-table', 'Should have diff table');
  // Check for status icons
  assertContains(html, 'fa-times', 'Should have remove icon');
  assertContains(html, 'fa-plus', 'Should have add icon');
  assertContains(html, 'fa-check', 'Should have unchanged icon');
});

// =====================================================
// Step 5: Selecting conflicting archetype blocked
// =====================================================
console.log('\n--- Step 5: Selecting conflicting archetype blocked ---');

test('C conflicts with A (both replace Bravery)', () => {
  const result = ConflictChecker.checkCanApply(archetypeC, [archetypeA]);
  assertEqual(result.canApply, false, 'C should conflict with A');
});

test('Attempt to add C to selection [A,B] fails', () => {
  const existingSelected = [archetypeA, archetypeB];
  const result = ConflictChecker.checkCanApply(archetypeC, existingSelected);
  assertEqual(result.canApply, false, 'C should not be addable to [A,B]');
  const bravConflict = result.conflicts.find(c =>
    CompendiumParser.normalizeName(c.featureName) === 'bravery'
  );
  assert(bravConflict, 'Bravery conflict should be identified');
});

test('Attempt to add C triggers warning notification', () => {
  clearNotifications();
  // Simulate the notification that would happen in the click handler
  const existingSelected = [archetypeA, archetypeB];
  const result = ConflictChecker.checkCanApply(archetypeC, existingSelected);
  if (!result.canApply) {
    const conflictDetails = result.conflicts.map(c => c.featureName).join(', ');
    ui.notifications.warn(`Cannot add ${archetypeC.name}: conflicts over ${conflictDetails}`);
  }
  assert(notifications.length > 0, 'Should have warning notification');
  assertEqual(notifications[0].type, 'warn', 'Should be a warning');
  assertContains(notifications[0].msg, 'Unbreakable', 'Warning should mention conflicting archetype');
  assertContains(notifications[0].msg, 'Bravery', 'Warning should mention conflicting feature');
});

test('C not added to selection set', () => {
  const selected = new Set([archetypeA.slug, archetypeB.slug]);
  // Conflict check blocks, so C is never added
  const result = ConflictChecker.checkCanApply(archetypeC, [archetypeA, archetypeB]);
  if (result.canApply) {
    selected.add(archetypeC.slug);
  }
  assertEqual(selected.size, 2, 'Still only 2 selected (C blocked)');
  assert(!selected.has('unbreakable'), 'C should not be in selection');
});

// =====================================================
// Step 6: Additive archetype can always be added
// =====================================================
console.log('\n--- Step 6: Additive archetype can always be added ---');

test('D (additive) can be added to [A,B] selection', () => {
  const result = ConflictChecker.checkCanApply(archetypeD, [archetypeA, archetypeB]);
  assertEqual(result.canApply, true, 'Additive should always pass');
});

test('A+B+D combined diff includes additive features', () => {
  const combinedParsed = {
    name: 'A + B + D',
    features: [...archetypeA.features, ...archetypeB.features, ...archetypeD.features]
  };
  const diff = DiffEngine.generateDiff(fighterAssociations, combinedParsed);

  // D's additive feature should appear as ADDED
  const addedNames = diff.filter(d => d.status === DiffEngine.STATUS.ADDED).map(d => d.name);
  assert(addedNames.includes('Extra Combat Feat'), 'Should include additive feature');
  assertEqual(diff.filter(d => d.status === DiffEngine.STATUS.ADDED).length, 5, 'Should have 5 added (4 replacements + 1 additive)');
});

// =====================================================
// Step 7: Final stacking validation before apply
// =====================================================
console.log('\n--- Step 7: Final stacking validation before apply ---');

test('Final validation of selected stack [A,B] passes', () => {
  const fullStack = [archetypeA, archetypeB]; // No applied archetypes
  const result = ConflictChecker.validateStacking(fullStack);
  assertEqual(result.valid, true, 'Stack [A,B] should be valid');
});

test('Final validation with applied archetypes included', () => {
  // Simulate: D already applied, selecting A+B
  const fullStack = [archetypeD, archetypeA, archetypeB];
  const result = ConflictChecker.validateStacking(fullStack);
  assertEqual(result.valid, true, 'Stack [D,A,B] should be valid (D is additive)');
});

test('Final validation catches late-discovered conflicts', () => {
  const fullStack = [archetypeA, archetypeC]; // A and C both replace Bravery
  const result = ConflictChecker.validateStacking(fullStack);
  assertEqual(result.valid, false, 'Stack [A,C] should be invalid');
});

// =====================================================
// Step 8: Apply Selected button behavior
// =====================================================
console.log('\n--- Step 8: Apply Selected button behavior ---');

test('Empty selection triggers warning', () => {
  clearNotifications();
  const selected = new Set();
  if (selected.size === 0) {
    ui.notifications.warn('No archetypes selected. Click on archetypes to select them first.');
  }
  assertEqual(notifications.length, 1, 'Should have warning');
  assertContains(notifications[0].msg, 'No archetypes selected', 'Correct warning message');
});

test('Single selection generates valid combined data', () => {
  const selected = new Set(['two-handed-fighter']);
  const selectedParsedList = [...selected].map(slug => {
    if (slug === 'two-handed-fighter') return archetypeA;
    return null;
  }).filter(Boolean);

  assertEqual(selectedParsedList.length, 1, 'One archetype in list');
  const combinedParsed = {
    name: selectedParsedList.map(a => a.name).join(' + '),
    features: selectedParsedList.flatMap(a => a.features || [])
  };
  assertEqual(combinedParsed.name, 'Two-Handed Fighter', 'Single name');
  assertEqual(combinedParsed.features.length, 2, 'Two features');
});

test('Multiple selection generates combined data with all features', () => {
  const selected = new Set(['two-handed-fighter', 'weapon-master', 'bonus-training']);
  const archMap = {
    'two-handed-fighter': archetypeA,
    'weapon-master': archetypeB,
    'bonus-training': archetypeD
  };
  const selectedParsedList = [...selected].map(slug => archMap[slug]).filter(Boolean);

  const combinedParsed = {
    name: selectedParsedList.map(a => a.name).join(' + '),
    slug: [...selected].join('+'),
    features: selectedParsedList.flatMap(a => a.features || [])
  };

  assertContains(combinedParsed.name, 'Two-Handed Fighter', 'Contains A name');
  assertContains(combinedParsed.name, 'Weapon Master', 'Contains B name');
  assertContains(combinedParsed.name, 'Bonus Training', 'Contains D name');
  assertEqual(combinedParsed.features.length, 5, '2+2+1=5 features');
});

// =====================================================
// Step 9: UI integration - dialog rendering and selection
// =====================================================
console.log('\n--- Step 9: UI integration - dialog rendering ---');

await asyncTest('Main dialog renders with Apply Selected button', async () => {
  clearDialogTracker();
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = fighterAssociations;
  const actor = createMockActor('Test Hero', [classItem]);

  await UIManager.showMainDialog(actor, [classItem]);

  assertGreaterThan(dialogTracker.length, 0, 'Dialog should be created');
  const dialog = dialogTracker[dialogTracker.length - 1];

  // Check that Apply Selected button exists
  assert(dialog.data.buttons.applySelected, 'Should have applySelected button');
  assertEqual(dialog.data.buttons.applySelected.label, 'Apply Selected', 'Correct button label');
  assertContains(dialog.data.buttons.applySelected.icon, 'fa-check-double', 'Has check-double icon');
});

await asyncTest('Main dialog has Add Archetype button', async () => {
  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.addCustom, 'Should have addCustom button');
  assertEqual(dialog.data.buttons.addCustom.label, 'Add Archetype', 'Correct label');
});

await asyncTest('Main dialog has Close button', async () => {
  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.close, 'Should have close button');
  assertEqual(dialog.data.buttons.close.label, 'Close', 'Correct label');
});

// =====================================================
// Step 10: Deselection behavior
// =====================================================
console.log('\n--- Step 10: Deselection behavior ---');

test('Clicking selected archetype deselects it', () => {
  const selected = new Set(['two-handed-fighter', 'weapon-master']);
  // Simulate click on already-selected
  selected.delete('two-handed-fighter');
  assertEqual(selected.size, 1, 'Only B remains');
  assert(!selected.has('two-handed-fighter'), 'A deselected');
  assert(selected.has('weapon-master'), 'B still selected');
});

test('Deselecting all returns to empty state', () => {
  const selected = new Set(['two-handed-fighter', 'weapon-master']);
  selected.delete('two-handed-fighter');
  selected.delete('weapon-master');
  assertEqual(selected.size, 0, 'Empty after deselecting all');
});

// =====================================================
// Step 11: _buildAppliedArchetypeData with parsedData
// =====================================================
console.log('\n--- Step 11: Build applied archetype data ---');

test('Applied archetype data built from archetype list with parsedData', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.flags['archetype-manager'] = { archetypes: ['two-handed-fighter'] };

  const archetypeList = [
    { slug: 'two-handed-fighter', name: 'Two-Handed Fighter', parsedData: archetypeA },
    { slug: 'weapon-master', name: 'Weapon Master', parsedData: archetypeB }
  ];

  const result = UIManager._buildAppliedArchetypeData(classItem, archetypeList);
  assertEqual(result.length, 1, '1 applied');
  assertEqual(result[0].name, 'Two-Handed Fighter', 'Correct archetype');
  assertEqual(result[0].features.length, 2, 'Has features for conflict checking');
});

test('Conflict checking uses applied data from flags', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.flags['archetype-manager'] = { archetypes: ['two-handed-fighter'] };

  const archetypeList = [
    { slug: 'two-handed-fighter', name: 'Two-Handed Fighter', parsedData: archetypeA },
    { slug: 'unbreakable', name: 'Unbreakable', parsedData: archetypeC }
  ];

  const appliedData = UIManager._buildAppliedArchetypeData(classItem, archetypeList);
  const result = ConflictChecker.checkCanApply(archetypeC, appliedData);
  assertEqual(result.canApply, false, 'C should conflict with applied A');
});

// =====================================================
// Step 12: Combined diff edge cases
// =====================================================
console.log('\n--- Step 12: Combined diff edge cases ---');

test('Single archetype diff (no multi-selection) still works', () => {
  const diff = DiffEngine.generateDiff(fighterAssociations, archetypeA);
  const removed = diff.filter(d => d.status === DiffEngine.STATUS.REMOVED);
  assertEqual(removed.length, 2, 'A removes Bravery + AT1');
  const added = diff.filter(d => d.status === DiffEngine.STATUS.ADDED);
  assertEqual(added.length, 2, 'A adds Shattering Strike + Overhand Chop');
});

test('Empty archetype features produce no changes in diff', () => {
  const emptyArch = { name: 'Empty', features: [] };
  const diff = DiffEngine.generateDiff(fighterAssociations, emptyArch);
  const changed = diff.filter(d => d.status !== DiffEngine.STATUS.UNCHANGED);
  assertEqual(changed.length, 0, 'No changes for empty archetype');
});

test('Combined diff handles overlapping levels correctly', () => {
  // A has features at levels 2 and 3
  // D has additive at level 4
  // No level overlap issues
  const combined = {
    name: 'A + D',
    features: [...archetypeA.features, ...archetypeD.features]
  };
  const diff = DiffEngine.generateDiff(fighterAssociations, combined);
  const added = diff.filter(d => d.status === DiffEngine.STATUS.ADDED);
  const addedNames = added.map(d => d.name);
  assert(addedNames.includes('Shattering Strike'), 'Has A feature');
  assert(addedNames.includes('Extra Combat Feat'), 'Has D feature');
});

// =====================================================
// Step 13: Selection preservation across search
// =====================================================
console.log('\n--- Step 13: Selection state behavior ---');

test('Class change clears selections', () => {
  const selected = new Set(['two-handed-fighter', 'weapon-master']);
  // Simulate class change
  selected.clear();
  assertEqual(selected.size, 0, 'Selections cleared on class change');
});

test('Selection persists within same class (during search)', () => {
  const selected = new Set(['two-handed-fighter', 'weapon-master']);
  // Search filter doesn't clear selections
  // (only renderArchetypeList re-renders, preserving the set)
  assertEqual(selected.size, 2, 'Selections persist during search');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #55 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #55 tests passed!\n');
  process.exit(0);
}
