/**
 * Test Suite for Feature #79: Success notification after archetype removal
 *
 * Verifies that ui.notifications shows success after removing archetype:
 * 1. Remove archetype
 * 2. Verify success notification
 * 3. Confirms what was removed
 * 4. Auto-dismisses (uses standard info notification)
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

function assertIncludes(str, sub, message) {
  if (!str || !str.includes(sub)) {
    throw new Error(`${message || 'String inclusion failed'}: "${str && str.substring(0, 200)}" does not include "${sub}"`);
  }
}

function assertNotIncludes(str, sub, message) {
  if (str && str.includes(sub)) {
    throw new Error(`${message || 'String exclusion failed'}: string should not include "${sub}"`);
  }
}

// Set up environment
setupMockEnvironment();

// Capture notifications
let notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', message: msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', message: msg }); },
  error: (msg) => { notifications.push({ type: 'error', message: msg }); }
};

// Capture ChatMessage.create calls (needed by applicator)
let chatMessages = [];
globalThis.ChatMessage = {
  create: async (data) => {
    chatMessages.push(data);
    return data;
  }
};

// UUID resolution map
const uuidMap = {
  'Compendium.pf1.class-abilities.BonusFeat1': { name: 'Bonus Feat' },
  'Compendium.pf1.class-abilities.Bravery': { name: 'Bravery' },
  'Compendium.pf1.class-abilities.ArmorTraining1': { name: 'Armor Training 1' },
  'Compendium.pf1.class-abilities.ArmorTraining2': { name: 'Armor Training 2' },
  'Compendium.pf1.class-abilities.ArmorTraining3': { name: 'Armor Training 3' },
  'Compendium.pf1.class-abilities.ArmorTraining4': { name: 'Armor Training 4' },
  'Compendium.pf1.class-abilities.ArmorMastery': { name: 'Armor Mastery' },
  'Compendium.pf1.class-abilities.WeaponTraining1': { name: 'Weapon Training 1' },
  'Compendium.pf1.class-abilities.WeaponTraining2': { name: 'Weapon Training 2' },
  'Compendium.pf1.class-abilities.WeaponTraining3': { name: 'Weapon Training 3' },
  'Compendium.pf1.class-abilities.WeaponTraining4': { name: 'Weapon Training 4' },
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' }
};

globalThis.fromUuid = async (uuid) => uuidMap[uuid] || null;

// Import Applicator and DiffEngine
const { Applicator } = await import('../scripts/applicator.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');

const MODULE_ID = 'archetype-manager';

// Helper: create a standard Fighter class item with 12 associations
function createFighterClassItem() {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
    { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
    { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
    { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
    { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
    { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
    { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
    { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
    { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
    { uuid: 'Compendium.pf1.class-abilities.WeaponTraining3', level: 13 },
    { uuid: 'Compendium.pf1.class-abilities.WeaponTraining4', level: 17 },
    { uuid: 'Compendium.pf1.class-abilities.WeaponMastery', level: 20 }
  ];
  return classItem;
}

// Helper: create a two-handed fighter archetype that replaces Bravery
function createTwoHandedFighterArchetype() {
  return {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'Fighter',
    features: [
      {
        name: 'Shattering Strike',
        level: 2,
        type: 'replacement',
        target: 'Bravery',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Bravery',
          level: 2
        },
        description: '<p>Replaces Bravery. Adds +1 to CMB for sunder.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
}

// Helper: apply an archetype and then clear notifications/chat for removal tests
async function applyArchetypeAndReset(actor, classItem, archetype) {
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);
  await Applicator.apply(actor, classItem, archetype, diff);
  notifications = [];
  chatMessages = [];
}

function resetState() {
  notifications = [];
  chatMessages = [];
}

console.log('\n=== Feature #79: Success notification after archetype removal ===\n');

// ============================================================
// Section 1: Basic success notification on removal
// ============================================================
console.log('\n--- Section 1: Basic success notification on removal ---');

await asyncTest('Success notification appears after successful removal', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest1', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  const result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result === true, 'remove() should return true');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'At least one info notification should appear');
});

await asyncTest('Success notification uses info level (auto-dismissing)', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest2', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should use info notification type (auto-dismissing)');
});

await asyncTest('No error notifications on successful removal', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest3', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assertEqual(errorNotifs.length, 0, 'No error notifications on success');
});

await asyncTest('No warning notifications on successful removal', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest4', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assertEqual(warnNotifs.length, 0, 'No warning notifications on success');
});

// ============================================================
// Section 2: Notification confirms what was removed
// ============================================================
console.log('\n--- Section 2: Notification confirms what was removed ---');

await asyncTest('Notification includes the class item name', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest5', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Fighter', 'Notification should include class name');
});

await asyncTest('Notification includes module title', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest6', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'PF1e Archetype Manager', 'Notification should include module title');
});

await asyncTest('Notification includes "Removed" action word', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest7', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  // Check for either "Removed" or "removed" (case-insensitive)
  assert(msg.toLowerCase().includes('removed') || msg.toLowerCase().includes('remov'),
    `Notification should indicate removal action, got: ${msg}`);
});

await asyncTest('Notification uses pipe separator format', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest8', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, '|', 'Notification should use pipe separator');
  assertIncludes(msg, 'PF1e Archetype Manager |', 'Should start with module title and pipe');
});

// ============================================================
// Section 3: No success notification on failure scenarios
// ============================================================
console.log('\n--- Section 3: No success notification on failure scenarios ---');

await asyncTest('No success notification when archetype not applied', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest9', [classItem]);

  const result = await Applicator.remove(actor, classItem, 'nonexistent-archetype');
  assert(result === false, 'Should return false for non-applied archetype');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification for non-applied');
});

await asyncTest('Warning shown when archetype not applied', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest10', [classItem]);

  await Applicator.remove(actor, classItem, 'nonexistent-archetype');

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length >= 1, 'Should show warning for non-applied');
  assertIncludes(warnNotifs[0].message, 'not applied', 'Warning should mention "not applied"');
});

await asyncTest('No success notification when permission denied', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest11', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  actor.isOwner = false;
  game.user.isGM = false;

  const result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result === false, 'Permission denied should return false');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification on permission denied');

  // Restore
  game.user.isGM = true;
});

await asyncTest('Error notification shown for permission denied on removal', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest12', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  actor.isOwner = false;
  game.user.isGM = false;

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assert(errorNotifs.length >= 1, 'Should show error for permission denied');
  assertIncludes(errorNotifs[0].message, 'permission', 'Error should mention permission');

  // Restore
  game.user.isGM = true;
});

// ============================================================
// Section 4: Selective removal notifications
// ============================================================
console.log('\n--- Section 4: Selective removal notifications ---');

await asyncTest('Selective removal from multi-archetype stack shows success notification', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest13', [classItem]);

  // Apply first archetype
  const arch1 = createTwoHandedFighterArchetype();
  await applyArchetypeAndReset(actor, classItem, arch1);

  // Apply second archetype
  const arch2 = {
    name: 'Armor Master',
    slug: 'armor-master',
    class: 'Fighter',
    features: [
      {
        name: 'Deflective Shield',
        level: 5,
        type: 'replacement',
        target: 'Weapon Training 1',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.WeaponTraining1',
          level: 5
        },
        description: '<p>Replaces Weapon Training 1.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, arch2);
  await Applicator.apply(actor, classItem, arch2, diff2);
  notifications = [];
  chatMessages = [];

  // Remove first archetype (selective removal)
  const result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result === true, 'Selective removal should succeed');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should show success notification on selective removal');
});

await asyncTest('Each removal produces its own success notification', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest14', [classItem]);

  // Apply two archetypes
  const arch1 = createTwoHandedFighterArchetype();
  await applyArchetypeAndReset(actor, classItem, arch1);

  const arch2 = {
    name: 'Armor Master',
    slug: 'armor-master',
    class: 'Fighter',
    features: [
      {
        name: 'Deflective Shield',
        level: 5,
        type: 'replacement',
        target: 'Weapon Training 1',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.WeaponTraining1',
          level: 5
        },
        description: '<p>Replaces Weapon Training 1.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, arch2);
  await Applicator.apply(actor, classItem, arch2, diff2);
  notifications = [];

  // Remove first
  await Applicator.remove(actor, classItem, 'two-handed-fighter');
  const afterFirst = notifications.filter(n => n.type === 'info').length;
  assert(afterFirst >= 1, 'Should have success notification after first removal');

  // Remove second
  await Applicator.remove(actor, classItem, 'armor-master');
  const afterSecond = notifications.filter(n => n.type === 'info').length;
  assert(afterSecond >= 2, 'Should have success notifications for both removals');
});

// ============================================================
// Section 5: Notification content is clean
// ============================================================
console.log('\n--- Section 5: Notification content is clean ---');

await asyncTest('Notification contains no "undefined" string', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest15', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  for (const notif of successNotifs) {
    assertNotIncludes(notif.message, 'undefined', 'Should not contain "undefined"');
  }
});

await asyncTest('Notification contains no "null" string', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest16', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  for (const notif of successNotifs) {
    assertNotIncludes(notif.message, 'null', 'Should not contain "null"');
  }
});

await asyncTest('Notification contains no "[object Object]" string', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest17', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  for (const notif of successNotifs) {
    assertNotIncludes(notif.message, '[object Object]', 'Should not contain "[object Object]"');
  }
});

await asyncTest('Notification is plain text (no HTML)', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest18', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertNotIncludes(msg, '<', 'Should not contain HTML tags');
  assertNotIncludes(msg, '>', 'Should not contain HTML tags');
});

// ============================================================
// Section 6: Notification timing
// ============================================================
console.log('\n--- Section 6: Notification timing ---');

await asyncTest('Success notification appears after chat message is posted', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest19', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  // Track order of operations
  const operationOrder = [];
  globalThis.ChatMessage = {
    create: async (data) => {
      operationOrder.push('chat');
      chatMessages.push(data);
      return data;
    }
  };
  const origInfo = globalThis.ui.notifications.info;
  globalThis.ui.notifications.info = (msg) => {
    operationOrder.push('notification');
    notifications.push({ type: 'info', message: msg });
  };

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  assert(operationOrder.includes('chat'), 'Chat message should be posted');
  assert(operationOrder.includes('notification'), 'Notification should appear');

  const chatIdx = operationOrder.indexOf('chat');
  const notifIdx = operationOrder.indexOf('notification');
  assert(chatIdx < notifIdx, 'Chat message should be posted before success notification');

  // Restore
  globalThis.ui.notifications.info = origInfo;
});

await asyncTest('Exactly one success notification per successful removal', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest20', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const infoNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(infoNotifs.length, 1, 'Should have exactly one success notification per removal');
});

// ============================================================
// Section 7: Error during removal shows error, not success
// ============================================================
console.log('\n--- Section 7: Error during removal shows error, not success ---');

await asyncTest('Failed removal shows error notification, not success', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest21', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  // Make classItem.update throw
  const originalUpdate = classItem.update;
  classItem.update = async () => { throw new Error('Simulated removal failure'); };

  const result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result === false, 'remove() should return false on error');

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assert(errorNotifs.length >= 1, 'Should show error notification on failure');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification on failure');

  // Restore
  classItem.update = originalUpdate;
});

// ============================================================
// Section 8: Different class names in notifications
// ============================================================
console.log('\n--- Section 8: Different class names in notifications ---');

await asyncTest('Rogue class name appears in removal notification', async () => {
  const classItem = createMockClassItem('Rogue', 8, 'rogue');
  classItem.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
    { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 }
  ];
  const actor = createMockActor('RemoveTest22', [classItem]);
  const archetype = {
    name: 'Knife Master',
    slug: 'knife-master',
    features: [
      {
        name: 'Hidden Blade',
        level: 2,
        type: 'replacement',
        target: 'Bravery',
        matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
        description: '<p>Replaces Bravery.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
  await applyArchetypeAndReset(actor, classItem, archetype);

  await Applicator.remove(actor, classItem, 'knife-master');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Rogue', 'Notification should include Rogue class name');
});

await asyncTest('Wizard class name appears in removal notification', async () => {
  const classItem = createMockClassItem('Wizard', 6, 'wizard');
  classItem.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
    { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 }
  ];
  const actor = createMockActor('RemoveTest23', [classItem]);
  const archetype = {
    name: 'Diviner',
    slug: 'diviner',
    features: [
      {
        name: "Diviner's Fortune",
        level: 2,
        type: 'replacement',
        target: 'Bravery',
        matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
        description: '<p>Replaces Bravery.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
  await applyArchetypeAndReset(actor, classItem, archetype);

  await Applicator.remove(actor, classItem, 'diviner');

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Wizard', 'Notification should include Wizard class name');
});

// ============================================================
// Section 9: Apply-remove cycle notifications
// ============================================================
console.log('\n--- Section 9: Apply-remove cycle notifications ---');

await asyncTest('Apply-remove-apply-remove cycle: each step produces correct notification', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest24', [classItem]);

  // Apply
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);
  await Applicator.apply(actor, classItem, archetype, diff);
  const applyNotifs = notifications.filter(n => n.type === 'info');
  assert(applyNotifs.length >= 1, 'Apply should produce success notification');
  assertIncludes(applyNotifs[applyNotifs.length - 1].message, 'Applied', 'Apply notification should say Applied');

  // Remove
  notifications = [];
  await Applicator.remove(actor, classItem, 'two-handed-fighter');
  const removeNotifs = notifications.filter(n => n.type === 'info');
  assert(removeNotifs.length >= 1, 'Remove should produce success notification');
  const removeMsg = removeNotifs[removeNotifs.length - 1].message.toLowerCase();
  assert(removeMsg.includes('removed') || removeMsg.includes('remov'),
    'Remove notification should indicate removal');

  // Apply again
  notifications = [];
  const classItem2 = createFighterClassItem(); // fresh
  classItem2.id = classItem.id;
  classItem2.name = classItem.name;
  classItem2.system.tag = classItem.system.tag;
  classItem2.system.links.classAssociations = classItem.system.links.classAssociations;
  const diff2 = DiffEngine.generateDiff(classItem2.system.links.classAssociations, archetype);
  await Applicator.apply(actor, classItem2, archetype, diff2);
  const reapplyNotifs = notifications.filter(n => n.type === 'info');
  assert(reapplyNotifs.length >= 1, 'Re-apply should produce success notification');
});

// ============================================================
// Section 10: Additive-only archetype removal notification
// ============================================================
console.log('\n--- Section 10: Edge cases ---');

await asyncTest('Additive-only archetype removal shows success notification', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest25', [classItem]);
  const archetype = {
    name: 'Additive Only',
    slug: 'additive-only',
    features: [
      {
        name: 'Extra Ability',
        level: 3,
        type: 'additive',
        target: null,
        matchedAssociation: null,
        description: '<p>New ability.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
  await applyArchetypeAndReset(actor, classItem, archetype);

  await Applicator.remove(actor, classItem, 'additive-only');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should show success for additive-only removal');
});

await asyncTest('Removing already-removed archetype shows warning, not success', async () => {
  const classItem = createFighterClassItem();
  const actor = createMockActor('RemoveTest26', [classItem]);
  await applyArchetypeAndReset(actor, classItem, createTwoHandedFighterArchetype());

  // Remove once (should succeed)
  await Applicator.remove(actor, classItem, 'two-handed-fighter');
  notifications = [];

  // Remove again (should fail)
  const result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assert(result === false, 'Should fail on double removal');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification on double removal');

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length >= 1, 'Should show warning on double removal');
});

// Print summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #79 Results: ${passed}/${totalTests} passing`);
if (failed > 0) {
  console.log(`  ${failed} FAILED`);
  process.exit(1);
} else {
  console.log('  All tests passed!');
}
