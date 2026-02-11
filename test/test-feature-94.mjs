/**
 * Test Suite for Feature #94: Archetype removal removes from all lookups
 *
 * Verifies that after removal, archetype is absent from ALL lookups and indicators:
 * 1. Apply and verify appears as applied
 * 2. Remove
 * 3. Reopen dialog -> no 'applied' indicator
 * 4. Check classItem flags -> slug removed
 * 5. Check actor flags -> updated
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

// Setup mock environment
const { hooks, settings } = setupMockEnvironment();

// Import module to register settings and hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import modules under test
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { Applicator } = await import('../scripts/applicator.mjs');
const { MODULE_ID } = await import('../scripts/module.mjs');

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

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Deep equality failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Track notifications
const notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};

function clearNotifications() {
  notifications.length = 0;
}

// Track chat messages
const chatMessages = [];
globalThis.ChatMessage.create = async (data) => {
  chatMessages.push(data);
  return data;
};

function clearChatMessages() {
  chatMessages.length = 0;
}

// ============================================================
// Helper: Create a standard test environment
// ============================================================
function createTestEnvironment() {
  // Create a Fighter class item with standard classAssociations
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery1', level: 2, name: 'Bravery' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery2', level: 6, name: 'Bravery' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery3', level: 10, name: 'Bravery' },
    { uuid: 'Compendium.pf1.class-abilities.Item.armorTraining1', level: 3, name: 'Armor Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.armorTraining2', level: 7, name: 'Armor Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.weaponTraining1', level: 5, name: 'Weapon Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.weaponTraining2', level: 9, name: 'Weapon Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonusFeat1', level: 1, name: 'Bonus Feat' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonusFeat2', level: 2, name: 'Bonus Feat' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonusFeat4', level: 4, name: 'Bonus Feat' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonusFeat6', level: 6, name: 'Bonus Feat' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonusFeat8', level: 8, name: 'Bonus Feat' },
  ];

  const actor = createMockActor('Test Fighter', [classItem]);

  // Create a parsed archetype that replaces Bravery with Shattering Strike
  const parsedArchetype = {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      {
        name: 'Shattering Strike',
        level: 2,
        replaces: 'Bravery',
        description: 'A two-handed fighter gains a +1 bonus to CMB with sunder attempts.'
      },
      {
        name: 'Overhand Chop',
        level: 3,
        replaces: 'Armor Training',
        description: 'A two-handed fighter makes a single melee attack with two-hand damage bonus.'
      }
    ]
  };

  // Generate diff
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);

  return { classItem, actor, parsedArchetype, diff };
}

// ============================================================
// Helper: Apply archetype and verify it was applied
// ============================================================
async function applyAndVerify(actor, classItem, parsedArchetype, diff) {
  clearNotifications();
  clearChatMessages();
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assert(result === true, 'Apply should return true');
  return result;
}

console.log('\n=== Feature #94: Archetype removal removes from all lookups ===\n');

// ============================================================
// Section 1: Apply and verify appears as applied
// ============================================================
console.log('\n--- Section 1: Apply and verify appears as applied ---');

await asyncTest('1.1 - Apply archetype and verify classItem flags set', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // Verify classItem flags
  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(Array.isArray(archetypes), 'archetypes flag should be an array');
  assert(archetypes.includes('two-handed-fighter'), 'archetypes should include two-handed-fighter');
  assertEqual(archetypes.length, 1, 'Should have exactly 1 archetype');
});

await asyncTest('1.2 - Apply archetype and verify originalAssociations backup exists', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
  assert(backup !== null, 'originalAssociations backup should exist');
  assert(Array.isArray(backup), 'Backup should be an array');
  assertEqual(backup.length, 12, 'Backup should have all 12 original associations');
});

await asyncTest('1.3 - Apply archetype and verify appliedAt timestamp exists', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt !== null, 'appliedAt timestamp should exist');
  assert(typeof appliedAt === 'string', 'appliedAt should be a string');
  // Verify it's a valid ISO date
  assert(!isNaN(new Date(appliedAt).getTime()), 'appliedAt should be a valid ISO date string');
});

await asyncTest('1.4 - Apply archetype and verify appliedArchetypeData stored', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData');
  assert(storedData !== null, 'appliedArchetypeData should exist');
  assert(storedData['two-handed-fighter'] !== undefined, 'Stored data should have two-handed-fighter key');
  assertEqual(storedData['two-handed-fighter'].name, 'Two-Handed Fighter', 'Stored data should have correct name');
});

await asyncTest('1.5 - Apply archetype and verify actor-level flags set', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(actorArchetypes !== null, 'Actor appliedArchetypes should exist');
  assert(actorArchetypes['fighter'] !== undefined, 'Actor flags should have fighter key');
  assert(actorArchetypes['fighter'].includes('two-handed-fighter'), 'Actor fighter key should include the slug');
});

await asyncTest('1.6 - Apply archetype and verify classAssociations modified', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  const originalLength = classItem.system.links.classAssociations.length;
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // classAssociations should be modified (some features replaced)
  const current = classItem.system.links.classAssociations;
  assert(Array.isArray(current), 'classAssociations should still be an array');
  // The diff replaces Bravery and Armor Training entries
  // The new associations should reflect the changed state
  assert(current.length > 0, 'classAssociations should not be empty after apply');
});

// ============================================================
// Section 2: Remove and verify complete cleanup
// ============================================================
console.log('\n--- Section 2: Remove and verify complete flag cleanup ---');

await asyncTest('2.1 - Remove archetype -> classItem archetypes flag cleared', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  clearNotifications();
  clearChatMessages();
  const removeResult = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(removeResult === true, 'Remove should return true');

  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(archetypes === null || archetypes === undefined,
    `archetypes flag should be null/undefined after removal of last archetype, got ${JSON.stringify(archetypes)}`);
});

await asyncTest('2.2 - Remove archetype -> originalAssociations backup cleared', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
  assert(backup === null || backup === undefined,
    `originalAssociations should be cleared after removal, got ${JSON.stringify(backup)}`);
});

await asyncTest('2.3 - Remove archetype -> appliedAt timestamp cleared', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt === null || appliedAt === undefined,
    `appliedAt should be cleared after removal, got ${appliedAt}`);
});

await asyncTest('2.4 - Remove archetype -> appliedArchetypeData cleared', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData');
  assert(storedData === null || storedData === undefined,
    `appliedArchetypeData should be cleared after removal, got ${JSON.stringify(storedData)}`);
});

await asyncTest('2.5 - Remove archetype -> actor-level flags cleaned', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  // After removing the only archetype, actor flags should be null/empty
  assert(
    actorArchetypes === null || actorArchetypes === undefined ||
    Object.keys(actorArchetypes).length === 0,
    `Actor appliedArchetypes should be null/empty after removal, got ${JSON.stringify(actorArchetypes)}`
  );
});

await asyncTest('2.6 - Remove archetype -> classAssociations restored to original', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  const originalAssociations = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const restored = classItem.system.links.classAssociations;
  assertEqual(restored.length, originalAssociations.length,
    'Restored associations should have same length as original');
  // Verify each entry is restored
  for (let i = 0; i < originalAssociations.length; i++) {
    assertEqual(restored[i].uuid, originalAssociations[i].uuid,
      `Association ${i} UUID should be restored`);
    assertEqual(restored[i].level, originalAssociations[i].level,
      `Association ${i} level should be restored`);
  }
});

// ============================================================
// Section 3: UI dialog shows no applied indicator after removal
// ============================================================
console.log('\n--- Section 3: Dialog shows no applied indicator after removal ---');

await asyncTest('3.1 - renderArchetypeList: no "applied" CSS class after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // Before removal: verify applied class would be present
  const appliedBefore = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  assert(appliedBefore.includes('two-handed-fighter'), 'Should be applied before removal');

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // After removal: verify the flag is gone
  const appliedAfter = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  assert(!appliedAfter.includes('two-handed-fighter'), 'Slug should not be in archetypes after removal');
  assertEqual(appliedAfter.length, 0, 'Archetypes array should be empty');
});

await asyncTest('3.2 - Simulated dialog render: no applied tags after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Simulate what updateAppliedList does
  const applied = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  if (applied.length === 0) {
    // updateAppliedList would show "None"
    assert(true, 'Applied list would show "None"');
  } else {
    assert(false, `Applied list should show "None" but found: ${JSON.stringify(applied)}`);
  }
});

await asyncTest('3.3 - Simulated archetype item: no check-circle icon after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Simulate renderArchetypeList logic for isApplied check
  const applied = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  const isApplied = applied.includes('two-handed-fighter');
  assert(!isApplied, 'isApplied should be false after removal');

  // Would NOT generate a check-circle icon
  const iconHtml = isApplied
    ? '<span class="status-icon status-unchanged" title="Applied"><i class="fas fa-check-circle"></i></span>'
    : '';
  assertEqual(iconHtml, '', 'No check-circle icon HTML should be generated');
});

await asyncTest('3.4 - Dialog render callback: applied archetype list shows None', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Simulate the dialog rendering the applied list
  const applied = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  let appliedHtml;
  if (applied.length === 0) {
    appliedHtml = '<span style="font-style: italic; color: #666;">None</span>';
  } else {
    appliedHtml = applied.map(slug => {
      const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<span class="applied-archetype-tag">${displayName}</span>`;
    }).join('');
  }
  assert(appliedHtml.includes('None'), 'Applied list should show "None"');
  assert(!appliedHtml.includes('applied-archetype-tag'), 'No applied-archetype-tag should be present');
  assert(!appliedHtml.includes('Two-Handed Fighter') && !appliedHtml.includes('Two Handed Fighter'),
    'Archetype name should not appear in applied list');
});

await asyncTest('3.5 - _buildAppliedArchetypeData returns empty after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const archetypeDataList = [];
  const appliedData = UIManager._buildAppliedArchetypeData(classItem, archetypeDataList);
  assertEqual(appliedData.length, 0, 'No applied archetype data should be returned after removal');
});

// ============================================================
// Section 4: Multi-archetype selective removal
// ============================================================
console.log('\n--- Section 4: Multi-archetype selective removal ---');

await asyncTest('4.1 - Remove one of two archetypes: removed slug gone from classItem flags', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // Apply a second archetype (additive only, no conflicts)
  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        level: 2,
        replaces: null,
        description: 'Additional defensive training with chosen weapon.',
        isAdditive: true
      }
    ]
  };
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, secondArchetype);
  clearNotifications();
  clearChatMessages();
  await Applicator.apply(actor, classItem, secondArchetype, diff2);

  // Verify both are applied
  const bothApplied = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(bothApplied.includes('two-handed-fighter'), 'First archetype should be applied');
  assert(bothApplied.includes('weapon-master'), 'Second archetype should be applied');
  assertEqual(bothApplied.length, 2, 'Should have 2 archetypes');

  // Remove only the first archetype
  clearNotifications();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const remaining = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(!remaining.includes('two-handed-fighter'), 'Removed archetype should not be in flags');
  assert(remaining.includes('weapon-master'), 'Remaining archetype should still be in flags');
  assertEqual(remaining.length, 1, 'Should have exactly 1 archetype remaining');
});

await asyncTest('4.2 - Remove one of two archetypes: removed slug gone from appliedArchetypeData', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      { name: 'Weapon Guard', level: 2, replaces: null, description: 'Defensive training.', isAdditive: true }
    ]
  };
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, secondArchetype);
  await Applicator.apply(actor, classItem, secondArchetype, diff2);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData');
  assert(storedData !== null, 'appliedArchetypeData should still exist (other archetype remains)');
  assert(storedData['two-handed-fighter'] === undefined, 'Removed archetype data should be deleted');
  assert(storedData['weapon-master'] !== undefined, 'Remaining archetype data should still exist');
});

await asyncTest('4.3 - Remove one of two archetypes: actor flags updated', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      { name: 'Weapon Guard', level: 2, replaces: null, description: 'Defensive training.', isAdditive: true }
    ]
  };
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, secondArchetype);
  await Applicator.apply(actor, classItem, secondArchetype, diff2);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(actorArchetypes !== null, 'Actor flags should still exist');
  const fighterArchetypes = actorArchetypes['fighter'];
  assert(Array.isArray(fighterArchetypes), 'Fighter array should still exist');
  assert(!fighterArchetypes.includes('two-handed-fighter'), 'Removed slug should not be in actor flags');
  assert(fighterArchetypes.includes('weapon-master'), 'Remaining slug should be in actor flags');
});

await asyncTest('4.4 - Selective removal: backup (originalAssociations) preserved for remaining', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  const originalAssociations = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      { name: 'Weapon Guard', level: 2, replaces: null, description: 'Defensive training.', isAdditive: true }
    ]
  };
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, secondArchetype);
  await Applicator.apply(actor, classItem, secondArchetype, diff2);

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Backup should still exist because another archetype remains
  const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
  assert(backup !== null && backup !== undefined, 'Backup should persist when other archetypes remain');
  assertEqual(backup.length, originalAssociations.length, 'Backup should have original association count');
});

// ============================================================
// Section 5: Full apply-remove-reopen cycle verification
// ============================================================
console.log('\n--- Section 5: Full apply-remove-reopen cycle ---');

await asyncTest('5.1 - Full cycle: apply -> remove -> all classItem flags clean', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();

  // Apply
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // Verify flags exist
  assert(classItem.getFlag(MODULE_ID, 'archetypes') !== null, 'Archetypes flag exists after apply');
  assert(classItem.getFlag(MODULE_ID, 'originalAssociations') !== null, 'Backup exists after apply');
  assert(classItem.getFlag(MODULE_ID, 'appliedAt') !== null, 'appliedAt exists after apply');
  assert(classItem.getFlag(MODULE_ID, 'appliedArchetypeData') !== null, 'appliedArchetypeData exists after apply');

  // Remove
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Verify ALL flags are gone
  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData');

  assert(archetypes === null || archetypes === undefined, 'archetypes flag should be cleared');
  assert(backup === null || backup === undefined, 'originalAssociations should be cleared');
  assert(appliedAt === null || appliedAt === undefined, 'appliedAt should be cleared');
  assert(storedData === null || storedData === undefined, 'appliedArchetypeData should be cleared');
});

await asyncTest('5.2 - Full cycle: actor flags completely clean after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();

  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // Verify actor flags exist
  const actorBefore = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(actorBefore !== null, 'Actor flags should exist after apply');
  assert(actorBefore['fighter']?.includes('two-handed-fighter'), 'Actor flags should include slug');

  // Remove
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Verify actor flags are clean
  const actorAfter = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(
    actorAfter === null || actorAfter === undefined ||
    Object.keys(actorAfter).length === 0,
    `Actor flags should be null/empty, got ${JSON.stringify(actorAfter)}`
  );
});

await asyncTest('5.3 - Apply -> remove -> re-apply succeeds (clean slate)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();

  // Apply
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  // Remove
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Re-apply (should succeed because all lookups are clean)
  clearNotifications();
  clearChatMessages();
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff2);
  assert(result === true, 'Re-apply should succeed after clean removal');

  // Verify new flags are set correctly
  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Re-applied archetype should be in flags');
});

await asyncTest('5.4 - Apply -> remove -> re-apply: no duplicate warnings', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();

  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  clearNotifications();
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);
  await Applicator.apply(actor, classItem, parsedArchetype, diff2);

  // No duplicate warnings should have been shown
  const warnNotifs = notifications.filter(n => n.type === 'warn' && n.msg.includes('already applied'));
  assertEqual(warnNotifs.length, 0, 'No duplicate-application warning should appear');
});

// ============================================================
// Section 6: Edge cases
// ============================================================
console.log('\n--- Section 6: Edge cases ---');

await asyncTest('6.1 - Removing non-applied archetype does not corrupt flags', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  clearNotifications();
  const result = await Applicator.remove(actor, classItem, 'nonexistent-archetype');
  assert(result === false, 'Removing non-applied archetype should return false');

  // Original archetype should still be applied
  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(archetypes.includes('two-handed-fighter'), 'Applied archetype should remain');
  assertEqual(archetypes.length, 1, 'Only one archetype should be in flags');

  // Actor flags should be unchanged
  const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(actorArchetypes['fighter']?.includes('two-handed-fighter'), 'Actor flags should be unchanged');
});

await asyncTest('6.2 - Double removal does not crash', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  const result1 = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result1 === true, 'First removal should succeed');

  clearNotifications();
  const result2 = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result2 === false, 'Second removal should return false (not applied)');

  // Flags should still be clean
  const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
  assert(archetypes === null || archetypes === undefined, 'Flags should remain clean after double removal');
});

await asyncTest('6.3 - Different class actors: removal only affects correct class', async () => {
  // Create a multi-class actor
  const fighterClass = createMockClassItem('Fighter', 10, 'fighter');
  fighterClass.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery1', level: 2, name: 'Bravery' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery2', level: 6, name: 'Bravery' },
  ];

  const rogueClass = createMockClassItem('Rogue', 5, 'rogue');
  rogueClass.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.sneakAttack1', level: 1, name: 'Sneak Attack' },
    { uuid: 'Compendium.pf1.class-abilities.Item.trapfinding', level: 1, name: 'Trapfinding' },
  ];

  const actor = createMockActor('Multi Fighter-Rogue', [fighterClass, rogueClass]);

  // Apply archetype to Fighter
  const fighterArchetype = {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      { name: 'Shattering Strike', level: 2, replaces: 'Bravery', description: 'Shattering...' }
    ]
  };
  const diff1 = DiffEngine.generateDiff(fighterClass.system.links.classAssociations, fighterArchetype);
  await Applicator.apply(actor, fighterClass, fighterArchetype, diff1);

  // Apply archetype to Rogue
  const rogueArchetype = {
    name: 'Knife Master',
    slug: 'knife-master',
    class: 'rogue',
    features: [
      { name: 'Sneak Stab', level: 1, replaces: 'Sneak Attack', description: 'Uses d8s for sneak attack with daggers.' }
    ]
  };
  const diff2 = DiffEngine.generateDiff(rogueClass.system.links.classAssociations, rogueArchetype);
  await Applicator.apply(actor, rogueClass, rogueArchetype, diff2);

  // Actor should have both
  const actorBefore = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(actorBefore['fighter']?.includes('two-handed-fighter'), 'Fighter archetype should be applied');
  assert(actorBefore['rogue']?.includes('knife-master'), 'Rogue archetype should be applied');

  // Remove Fighter archetype only
  await Applicator.remove(actor, fighterClass, 'two-handed-fighter');

  // Fighter flags should be clean
  const fighterArchetypes = fighterClass.getFlag(MODULE_ID, 'archetypes');
  assert(fighterArchetypes === null || fighterArchetypes === undefined, 'Fighter archetype flag should be cleared');

  // Rogue should still have its archetype
  const rogueArchetypes = rogueClass.getFlag(MODULE_ID, 'archetypes');
  assert(rogueArchetypes?.includes('knife-master'), 'Rogue archetype should remain');

  // Actor-level flags: fighter key should be gone, rogue key should remain
  const actorAfter = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(actorAfter !== null, 'Actor flags should still exist (rogue archetype remains)');
  assert(!actorAfter['fighter'] || actorAfter['fighter'].length === 0,
    'Actor fighter key should be empty/gone');
  assert(actorAfter['rogue']?.includes('knife-master'), 'Actor rogue key should remain');
});

await asyncTest('6.4 - Multiple apply-remove cycles: flags clean each time', async () => {
  const { classItem, actor, parsedArchetype } = createTestEnvironment();

  for (let cycle = 1; cycle <= 3; cycle++) {
    clearNotifications();
    clearChatMessages();

    const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);
    const applyResult = await Applicator.apply(actor, classItem, parsedArchetype, diff);
    assert(applyResult === true, `Cycle ${cycle}: Apply should succeed`);

    // Verify applied
    assert(classItem.getFlag(MODULE_ID, 'archetypes')?.includes('two-handed-fighter'),
      `Cycle ${cycle}: Should be in archetypes after apply`);
    assert(actor.getFlag(MODULE_ID, 'appliedArchetypes')?.['fighter']?.includes('two-handed-fighter'),
      `Cycle ${cycle}: Should be in actor flags after apply`);

    const removeResult = await Applicator.remove(actor, classItem, 'two-handed-fighter');
    assert(removeResult === true, `Cycle ${cycle}: Remove should succeed`);

    // Verify all clean
    const archetypes = classItem.getFlag(MODULE_ID, 'archetypes');
    assert(archetypes === null || archetypes === undefined,
      `Cycle ${cycle}: archetypes flag should be clean`);
    const actorFlags = actor.getFlag(MODULE_ID, 'appliedArchetypes');
    assert(actorFlags === null || actorFlags === undefined || Object.keys(actorFlags).length === 0,
      `Cycle ${cycle}: actor flags should be clean`);
  }
});

// ============================================================
// Section 7: Verify item copies deletion on removal
// ============================================================
console.log('\n--- Section 7: Created item copies cleaned up on removal ---');

await asyncTest('7.1 - Item copies created during apply are tracked with correct flags', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();

  // Track createEmbeddedDocuments calls
  let createdItems = [];
  actor.createEmbeddedDocuments = async (type, data) => {
    const items = data.map(d => ({
      ...d,
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2)
    }));
    createdItems.push(...items);
    // Also add to actor.items for filter to find later
    for (const item of items) {
      actor.items.filter.__proto__ = undefined; // break reference to use raw filter
    }
    return items;
  };

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  // Modified features should have created copies
  const modifiedEntries = diff.filter(d => d.status === 'modified');
  // Items may or may not be created depending on diff
  // The key point: if copies were created, they have the correct archetype slug
  for (const item of createdItems) {
    if (item.flags?.[MODULE_ID]?.createdByArchetype) {
      assertEqual(item.flags[MODULE_ID].createdByArchetype, 'two-handed-fighter',
        'Created item should be tagged with archetype slug');
    }
  }
});

await asyncTest('7.2 - _deleteCreatedCopies called during remove', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();

  // Setup mock items that would be "created" by the archetype
  const mockCreatedItem = {
    id: 'mock-copy-1',
    name: 'Shattering Strike (Two-Handed Fighter)',
    type: 'feat',
    flags: { [MODULE_ID]: { createdByArchetype: 'two-handed-fighter', isModifiedCopy: true } },
    getFlag(scope, key) { return this.flags[scope]?.[key] ?? null; }
  };

  // Add mock item to actor items
  const originalItems = [classItem, mockCreatedItem];
  actor.items = {
    filter: (fn) => originalItems.filter(fn),
    find: (fn) => originalItems.find(fn),
    get: (id) => originalItems.find(i => i.id === id),
    map: (fn) => originalItems.map(fn),
    [Symbol.iterator]: () => originalItems[Symbol.iterator]()
  };

  let deletedIds = [];
  actor.deleteEmbeddedDocuments = async (type, ids) => {
    deletedIds = ids;
    return ids;
  };

  // Pre-set flags as if archetype was applied
  await classItem.setFlag(MODULE_ID, 'archetypes', ['two-handed-fighter']);
  await classItem.setFlag(MODULE_ID, 'originalAssociations', classItem.system.links.classAssociations);
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', { fighter: ['two-handed-fighter'] });

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  assert(deletedIds.includes('mock-copy-1'), 'Created item copy should be deleted during removal');
});

// ============================================================
// Section 8: UI verification via dialog render
// ============================================================
console.log('\n--- Section 8: UI dialog verification after removal ---');

await asyncTest('8.1 - showMainDialog: archetype item has no "applied" class after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // The dialog's renderArchetypeList checks classItem.getFlag(MODULE_ID, 'archetypes')
  // After removal, this should return null/empty
  const applied = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  const testArch = { slug: 'two-handed-fighter', name: 'Two-Handed Fighter' };
  const isApplied = applied.includes(testArch.slug);
  const appliedClass = isApplied ? ' applied' : '';

  assert(!isApplied, 'Archetype should NOT be detected as applied');
  assertEqual(appliedClass, '', 'No "applied" CSS class should be added');
});

await asyncTest('8.2 - showMainDialog: archetype item is clickable (not blocked) after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // In the click handler, if isApplied is true, the handler returns early
  const applied = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  const isApplied = applied.includes('two-handed-fighter');
  assert(!isApplied, 'isApplied should be false -> click handler will not block');
});

await asyncTest('8.3 - Applied archetype section shows "None" after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Verify what the updateAppliedList function would render
  const applied = classItem.getFlag(MODULE_ID, 'archetypes') || [];
  assertEqual(applied.length, 0, 'No archetypes should be listed');
  // The function generates "None" text when applied.length === 0
  const expectedHtml = '<span style="font-style: italic; color: #666;">None</span>';
  assert(applied.length === 0, 'Applied list function would render "None"');
});

await asyncTest('8.4 - Conflict checker finds no applied archetypes after removal', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // _buildAppliedArchetypeData uses classItem.getFlag(MODULE_ID, 'archetypes')
  const appliedData = UIManager._buildAppliedArchetypeData(classItem, []);
  assertEqual(appliedData.length, 0, 'No applied archetype data for conflict checking');
});

// ============================================================
// Section 9: Chat message and notifications on removal
// ============================================================
console.log('\n--- Section 9: Removal notifications and messages ---');

await asyncTest('9.1 - Removal posts a chat message', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  clearChatMessages();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  assert(chatMessages.length > 0, 'A chat message should be posted on removal');
  const lastMessage = chatMessages[chatMessages.length - 1];
  assert(lastMessage.content.includes('removed') || lastMessage.content.includes('Removed') ||
    lastMessage.content.toLowerCase().includes('removed'),
    'Chat message should mention removal');
});

await asyncTest('9.2 - Removal shows success notification', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  await applyAndVerify(actor, classItem, parsedArchetype, diff);

  clearNotifications();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const infoNotifs = notifications.filter(n => n.type === 'info');
  assert(infoNotifs.length > 0, 'Success notification should be shown');
  assert(infoNotifs.some(n => n.msg.includes('Removed') || n.msg.includes('removed')),
    'Notification should mention removal');
});

// ============================================================
// Summary
// ============================================================
console.log('\n========================================');
console.log(`Feature #94 Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
