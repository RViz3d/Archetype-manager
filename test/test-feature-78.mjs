/**
 * Test Suite for Feature #78: Success notification after archetype application
 *
 * Verifies that ui.notifications shows success after applying archetype:
 * 1. Apply archetype
 * 2. Verify success notification
 * 3. Includes archetype name
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

// Helper: create an archetype with multiple features
function createComplexArchetype() {
  return {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'Fighter',
    features: [
      {
        name: 'Weapon Guard',
        level: 2,
        type: 'replacement',
        target: 'Bravery',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Bravery',
          level: 2
        },
        description: '<p>Replaces Bravery.</p>',
        source: 'auto-parse',
        needsUserInput: false
      },
      {
        name: 'Reliable Strike',
        level: 5,
        type: 'additive',
        target: null,
        matchedAssociation: null,
        description: '<p>New strike ability.</p>',
        source: 'auto-parse',
        needsUserInput: false
      }
    ]
  };
}

function resetState() {
  notifications = [];
  chatMessages = [];
}

console.log('\n=== Feature #78: Success notification after archetype application ===\n');

// ============================================================
// Section 1: Basic success notification on apply
// ============================================================
console.log('\n--- Section 1: Basic success notification on apply ---');

await asyncTest('Success notification appears after successful apply', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  const result = await Applicator.apply(actor, classItem, archetype, diff);
  assert(result === true, 'apply() should return true');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'At least one info notification should appear');
});

await asyncTest('Success notification uses info level (auto-dismissing)', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter2', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should use info notification type (auto-dismissing)');
  // info notifications auto-dismiss in FoundryVTT
});

await asyncTest('No error notifications on successful apply', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter3', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assertEqual(errorNotifs.length, 0, 'No error notifications on success');
});

await asyncTest('No warning notifications on successful apply', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter4', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assertEqual(warnNotifs.length, 0, 'No warning notifications on success');
});

// ============================================================
// Section 2: Notification includes archetype name
// ============================================================
console.log('\n--- Section 2: Notification includes archetype name ---');

await asyncTest('Notification includes the archetype name', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter5', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should have success notification');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Two-Handed Fighter', 'Notification should include archetype name');
});

await asyncTest('Notification includes the class item name', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter6', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Fighter', 'Notification should include class name');
});

await asyncTest('Notification includes module title', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter7', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'PF1e Archetype Manager', 'Notification should include module title');
});

await asyncTest('Notification includes "Applied" action word', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter8', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Applied', 'Notification should indicate "Applied" action');
});

// ============================================================
// Section 3: Different archetype names correctly reflected
// ============================================================
console.log('\n--- Section 3: Different archetype names correctly reflected ---');

await asyncTest('Different archetype name appears in notification (Weapon Master)', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter9', [classItem]);
  const archetype = createComplexArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'Weapon Master', 'Notification should include specific archetype name');
});

await asyncTest('Custom archetype name appears in notification', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter10', [classItem]);
  const archetype = {
    name: 'My Custom Archetype',
    slug: 'my-custom-archetype',
    class: 'Fighter',
    features: [
      {
        name: 'Custom Strike',
        level: 2,
        type: 'replacement',
        target: 'Bravery',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Bravery',
          level: 2
        },
        description: '<p>Replaces Bravery.</p>',
        source: 'je-custom',
        needsUserInput: false
      }
    ]
  };
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, 'My Custom Archetype', 'Notification should include custom archetype name');
});

// ============================================================
// Section 4: No success notification on failure scenarios
// ============================================================
console.log('\n--- Section 4: No success notification on failure scenarios ---');

await asyncTest('No success notification when duplicate archetype applied', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter11', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  // Apply once
  await Applicator.apply(actor, classItem, archetype, diff);
  resetState();

  // Apply again (duplicate)
  const result = await Applicator.apply(actor, classItem, archetype, diff);
  assert(result === false, 'Duplicate apply should return false');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification on duplicate');
});

await asyncTest('Warning notification shown for duplicate application', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter12', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  // Apply once
  await Applicator.apply(actor, classItem, archetype, diff);
  resetState();

  // Attempt duplicate
  await Applicator.apply(actor, classItem, archetype, diff);

  const warnNotifs = notifications.filter(n => n.type === 'warn');
  assert(warnNotifs.length >= 1, 'Should show warning for duplicate');
  assertIncludes(warnNotifs[0].message, 'already applied', 'Warning should mention already applied');
});

await asyncTest('No success notification when permission denied', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter13', [classItem]);
  actor.isOwner = false;
  game.user.isGM = false;

  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  const result = await Applicator.apply(actor, classItem, archetype, diff);
  assert(result === false, 'Permission denied should return false');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification on permission denied');

  // Restore GM
  game.user.isGM = true;
});

await asyncTest('Error notification shown for permission denied', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter14', [classItem]);
  actor.isOwner = false;
  game.user.isGM = false;

  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assert(errorNotifs.length >= 1, 'Should show error for permission denied');
  assertIncludes(errorNotifs[0].message, 'permission', 'Error should mention permission');

  // Restore GM
  game.user.isGM = true;
});

await asyncTest('No success notification when wrong class archetype', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter15', [classItem]);
  const archetype = {
    name: 'Wizard Archetype',
    slug: 'wizard-archetype',
    class: 'Wizard',
    features: []
  };
  const diff = [];

  const result = await Applicator.apply(actor, classItem, archetype, diff);
  assert(result === false, 'Wrong class should return false');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification for wrong class');
});

// ============================================================
// Section 5: Multiple archetype application notifications
// ============================================================
console.log('\n--- Section 5: Multiple archetype application notifications ---');

await asyncTest('Each archetype application produces its own success notification', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter16', [classItem]);

  // First archetype
  const archetype1 = createTwoHandedFighterArchetype();
  const diff1 = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype1);
  await Applicator.apply(actor, classItem, archetype1, diff1);

  const successAfterFirst = notifications.filter(n => n.type === 'info').length;
  assert(successAfterFirst >= 1, 'Should have success notification after first apply');

  // Second archetype (different, replaces different feature)
  const archetype2 = {
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
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype2);
  await Applicator.apply(actor, classItem, archetype2, diff2);

  const successAfterSecond = notifications.filter(n => n.type === 'info').length;
  assert(successAfterSecond >= 2, 'Should have success notifications for both applies');
});

await asyncTest('Second notification contains second archetype name', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter17', [classItem]);

  const archetype1 = createTwoHandedFighterArchetype();
  const diff1 = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype1);
  await Applicator.apply(actor, classItem, archetype1, diff1);

  const archetype2 = {
    name: 'Shield Champion',
    slug: 'shield-champion',
    class: 'Fighter',
    features: [
      {
        name: 'Champion Strike',
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
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype2);
  await Applicator.apply(actor, classItem, archetype2, diff2);

  const successNotifs = notifications.filter(n => n.type === 'info');
  // Last notification should reference Shield Champion
  const lastNotif = successNotifs[successNotifs.length - 1].message;
  assertIncludes(lastNotif, 'Shield Champion', 'Second notification should contain second archetype name');
});

// ============================================================
// Section 6: Notification does not contain "undefined" or "null"
// ============================================================
console.log('\n--- Section 6: Notification content is clean ---');

await asyncTest('Notification contains no "undefined" string', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter18', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  for (const notif of successNotifs) {
    assertNotIncludes(notif.message, 'undefined', 'Notification should not contain "undefined"');
  }
});

await asyncTest('Notification contains no "null" string', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter19', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  for (const notif of successNotifs) {
    assertNotIncludes(notif.message, 'null', 'Notification should not contain "null"');
  }
});

await asyncTest('Notification contains no "[object Object]" string', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter20', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  for (const notif of successNotifs) {
    assertNotIncludes(notif.message, '[object Object]', 'Notification should not contain "[object Object]"');
  }
});

// ============================================================
// Section 7: Error rollback produces error notification, not success
// ============================================================
console.log('\n--- Section 7: Error rollback produces error notification, not success ---');

await asyncTest('Failed apply (classItem.update error) shows error notification, not success', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter21', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  // Make classItem.update throw
  const originalUpdate = classItem.update;
  classItem.update = async () => { throw new Error('Simulated update failure'); };

  const result = await Applicator.apply(actor, classItem, archetype, diff);
  assert(result === false, 'apply() should return false on error');

  const errorNotifs = notifications.filter(n => n.type === 'error');
  assert(errorNotifs.length >= 1, 'Should show error notification on failure');

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 0, 'No success notification on failure');

  // Restore
  classItem.update = originalUpdate;
});

// ============================================================
// Section 8: Notification timing relative to other operations
// ============================================================
console.log('\n--- Section 8: Notification timing relative to other operations ---');

await asyncTest('Success notification appears after chat message is posted', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter22', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

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

  await Applicator.apply(actor, classItem, archetype, diff);

  assert(operationOrder.includes('chat'), 'Chat message should be posted');
  assert(operationOrder.includes('notification'), 'Notification should appear');

  // Chat message comes before the notification in Applicator.apply
  const chatIdx = operationOrder.indexOf('chat');
  const notifIdx = operationOrder.indexOf('notification');
  assert(chatIdx < notifIdx, 'Chat message should be posted before success notification');

  // Restore
  globalThis.ui.notifications.info = origInfo;
});

await asyncTest('Success notification is the last ui.notifications.info call in apply()', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter23', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const infoNotifs = notifications.filter(n => n.type === 'info');
  assert(infoNotifs.length >= 1, 'At least one info notification');
  const lastInfo = infoNotifs[infoNotifs.length - 1];
  assertIncludes(lastInfo.message, 'Applied', 'Last info notification should be the success message');
  assertIncludes(lastInfo.message, 'Two-Handed Fighter', 'Last info notification should contain archetype name');
});

// ============================================================
// Section 9: Notification format and structure
// ============================================================
console.log('\n--- Section 9: Notification format and structure ---');

await asyncTest('Notification uses pipe separator format: MODULE_TITLE | message', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter24', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, '|', 'Notification should use pipe separator');
  assertIncludes(msg, 'PF1e Archetype Manager |', 'Notification should start with module title and pipe');
});

await asyncTest('Notification message is a single-line string (not HTML)', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter25', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertNotIncludes(msg, '<', 'Notification should not contain HTML tags');
  assertNotIncludes(msg, '>', 'Notification should not contain HTML tags');
});

// ============================================================
// Section 10: Edge cases
// ============================================================
console.log('\n--- Section 10: Edge cases ---');

await asyncTest('Archetype with no features still shows success notification', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter26', [classItem]);
  const archetype = {
    name: 'Empty Archetype',
    slug: 'empty-archetype',
    features: []
  };
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should show success even for empty archetype');
  assertIncludes(successNotifs[successNotifs.length - 1].message, 'Empty Archetype', 'Should include the empty archetype name');
});

await asyncTest('Archetype with special characters in name shows in notification', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter27', [classItem]);
  const archetype = {
    name: "Knight of the Wall (Shelyn's Order)",
    slug: 'knight-of-the-wall-shelyn-s-order',
    features: []
  };
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  const msg = successNotifs[successNotifs.length - 1].message;
  assertIncludes(msg, "Knight of the Wall (Shelyn's Order)", 'Notification should include special char name');
});

await asyncTest('Additive-only archetype shows success notification', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter28', [classItem]);
  const archetype = {
    name: 'Additive Master',
    slug: 'additive-master',
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
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  assert(successNotifs.length >= 1, 'Should show success for additive-only');
  assertIncludes(successNotifs[successNotifs.length - 1].message, 'Additive Master', 'Should include additive archetype name');
});

// ============================================================
// Section 11: Exactly one success notification per apply call
// ============================================================
console.log('\n--- Section 11: Exactly one success notification per apply ---');

await asyncTest('Exactly one success notification per successful apply call', async () => {
  resetState();
  const classItem = createFighterClassItem();
  const actor = createMockActor('TestFighter29', [classItem]);
  const archetype = createTwoHandedFighterArchetype();
  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetype);

  await Applicator.apply(actor, classItem, archetype, diff);

  const successNotifs = notifications.filter(n => n.type === 'info');
  assertEqual(successNotifs.length, 1, 'Should have exactly one success notification per apply');
});

// Print summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #78 Results: ${passed}/${totalTests} passing`);
if (failed > 0) {
  console.log(`  ${failed} FAILED`);
  process.exit(1);
} else {
  console.log('  All tests passed!');
}
