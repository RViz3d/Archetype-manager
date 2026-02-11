/**
 * Test Suite for Feature #97: AppliedAt timestamp is accurate
 *
 * Verifies that the appliedAt flag records an accurate timestamp:
 * 1. Note current time
 * 2. Apply archetype
 * 3. Read appliedAt flag
 * 4. Within few seconds of noted time
 * 5. Valid ISO 8601 or Unix ms format
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

// Setup mock environment
const { hooks, settings } = setupMockEnvironment();

// Import module to register settings and hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import modules under test
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
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
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

  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);

  return { classItem, actor, parsedArchetype, diff };
}

// Helper: Create Rogue test environment
function createRogueTestEnvironment() {
  const classItem = createMockClassItem('Rogue', 8, 'rogue');
  classItem.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.sneakAttack1', level: 1, name: 'Sneak Attack' },
    { uuid: 'Compendium.pf1.class-abilities.Item.sneakAttack3', level: 3, name: 'Sneak Attack' },
    { uuid: 'Compendium.pf1.class-abilities.Item.trapfinding', level: 1, name: 'Trapfinding' },
    { uuid: 'Compendium.pf1.class-abilities.Item.evasion', level: 2, name: 'Evasion' },
    { uuid: 'Compendium.pf1.class-abilities.Item.trapSense1', level: 3, name: 'Trap Sense' },
  ];

  const actor = createMockActor('Test Rogue', [classItem]);

  const parsedArchetype = {
    name: 'Scout',
    slug: 'scout',
    class: 'rogue',
    features: [
      {
        name: 'Scout\'s Charge',
        level: 2,
        replaces: 'Evasion',
        description: 'The scout can charge and apply sneak attack.'
      }
    ]
  };

  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);

  return { classItem, actor, parsedArchetype, diff };
}

console.log('\n=== Feature #97: AppliedAt timestamp is accurate ===\n');

// ============================================================
// Section 1: appliedAt flag exists and is set after application
// ============================================================
console.log('\n--- Section 1: appliedAt flag exists after application ---');

await asyncTest('1.1 - appliedAt flag is set after successful archetype application', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assert(result === true, 'Apply should succeed');

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt !== null, 'appliedAt flag should be set');
  assert(appliedAt !== undefined, 'appliedAt flag should not be undefined');
});

await asyncTest('1.2 - appliedAt flag is a string', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assertEqual(typeof appliedAt, 'string', 'appliedAt should be a string');
});

await asyncTest('1.3 - appliedAt flag is not empty string', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt.length > 0, 'appliedAt should not be empty');
});

await asyncTest('1.4 - appliedAt flag not set before application', async () => {
  const { classItem } = createTestEnvironment();

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt === null || appliedAt === undefined, 'appliedAt should not exist before application');
});

// ============================================================
// Section 2: Timestamp accuracy — within a few seconds of current time
// ============================================================
console.log('\n--- Section 2: Timestamp accuracy ---');

await asyncTest('2.1 - appliedAt is within 5 seconds of noted time (before)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const beforeTime = Date.now();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedAtMs = new Date(appliedAt).getTime();

  assert(appliedAtMs >= beforeTime, 'appliedAt should be >= time noted before apply');
});

await asyncTest('2.2 - appliedAt is within 5 seconds of noted time (after)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const afterTime = Date.now();

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedAtMs = new Date(appliedAt).getTime();

  assert(appliedAtMs <= afterTime, 'appliedAt should be <= time noted after apply');
});

await asyncTest('2.3 - appliedAt is within 5 seconds of current time', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const beforeTime = Date.now();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const afterTime = Date.now();

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedAtMs = new Date(appliedAt).getTime();
  const elapsed = afterTime - beforeTime;

  // The timestamp should be between before and after, and the total operation
  // should complete in well under 5 seconds
  assert(elapsed < 5000, `Application should complete in under 5 seconds (took ${elapsed}ms)`);
  assert(appliedAtMs >= beforeTime && appliedAtMs <= afterTime,
    `appliedAt (${appliedAtMs}) should be between before (${beforeTime}) and after (${afterTime})`);
});

await asyncTest('2.4 - appliedAt difference from noted time is less than 5 seconds', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const notedTime = new Date();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedAtDate = new Date(appliedAt);
  const diffMs = Math.abs(appliedAtDate.getTime() - notedTime.getTime());

  assert(diffMs < 5000, `Timestamp should be within 5 seconds of noted time (diff was ${diffMs}ms)`);
});

await asyncTest('2.5 - appliedAt records accurate current time (not hardcoded/stale)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const currentYear = new Date().getFullYear();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedYear = new Date(appliedAt).getFullYear();

  assertEqual(appliedYear, currentYear, 'appliedAt year should match current year');
});

// ============================================================
// Section 3: ISO 8601 format validation
// ============================================================
console.log('\n--- Section 3: ISO 8601 format validation ---');

await asyncTest('3.1 - appliedAt is valid ISO 8601 format', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  // ISO 8601 pattern: YYYY-MM-DDTHH:mm:ss.sssZ or similar
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
  assert(iso8601Regex.test(appliedAt), `appliedAt '${appliedAt}' should match ISO 8601 format`);
});

await asyncTest('3.2 - appliedAt contains T separator between date and time', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt.includes('T'), 'ISO 8601 should contain T separator');
});

await asyncTest('3.3 - appliedAt ends with Z (UTC timezone)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt.endsWith('Z'), 'ISO 8601 from toISOString() should end with Z');
});

await asyncTest('3.4 - appliedAt parseable by new Date()', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const parsed = new Date(appliedAt);
  assert(!isNaN(parsed.getTime()), 'appliedAt should be parseable by new Date()');
});

await asyncTest('3.5 - appliedAt has valid date components (month 1-12, day 1-31, etc.)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const parsed = new Date(appliedAt);

  const month = parsed.getUTCMonth() + 1; // 0-indexed
  const day = parsed.getUTCDate();
  const hours = parsed.getUTCHours();
  const minutes = parsed.getUTCMinutes();
  const seconds = parsed.getUTCSeconds();

  assert(month >= 1 && month <= 12, `Month ${month} should be 1-12`);
  assert(day >= 1 && day <= 31, `Day ${day} should be 1-31`);
  assert(hours >= 0 && hours <= 23, `Hours ${hours} should be 0-23`);
  assert(minutes >= 0 && minutes <= 59, `Minutes ${minutes} should be 0-59`);
  assert(seconds >= 0 && seconds <= 59, `Seconds ${seconds} should be 0-59`);
});

await asyncTest('3.6 - appliedAt roundtrips to same value via Date constructor', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const roundTripped = new Date(appliedAt).toISOString();
  assertEqual(roundTripped, appliedAt, 'Roundtripped ISO string should match original');
});

await asyncTest('3.7 - appliedAt convertible to Unix ms (valid numeric value)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const unixMs = new Date(appliedAt).getTime();

  assert(typeof unixMs === 'number', 'Unix ms should be a number');
  assert(!isNaN(unixMs), 'Unix ms should not be NaN');
  assert(unixMs > 0, 'Unix ms should be positive');
  // Should be a reasonable Unix timestamp (after year 2020)
  const year2020 = new Date('2020-01-01T00:00:00Z').getTime();
  assert(unixMs > year2020, 'Unix ms should be after year 2020');
});

// ============================================================
// Section 4: Timestamp with different class types
// ============================================================
console.log('\n--- Section 4: Timestamp with different class types ---');

await asyncTest('4.1 - appliedAt accurate for Rogue class archetype', async () => {
  const { classItem, actor, parsedArchetype, diff } = createRogueTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const beforeTime = Date.now();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const afterTime = Date.now();

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt !== null, 'appliedAt should exist for Rogue archetype');

  const appliedAtMs = new Date(appliedAt).getTime();
  assert(appliedAtMs >= beforeTime && appliedAtMs <= afterTime,
    'appliedAt should be between before and after for Rogue');
});

await asyncTest('4.2 - appliedAt in ISO 8601 for Rogue class archetype', async () => {
  const { classItem, actor, parsedArchetype, diff } = createRogueTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
  assert(iso8601Regex.test(appliedAt), `Rogue appliedAt '${appliedAt}' should match ISO 8601`);
});

// ============================================================
// Section 5: Timestamp updates on subsequent applications
// ============================================================
console.log('\n--- Section 5: Timestamp updates on subsequent applications ---');

await asyncTest('5.1 - appliedAt updates when second archetype is applied', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Apply first archetype
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const firstAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');

  // Small delay to ensure different timestamp
  await new Promise(r => setTimeout(r, 10));

  // Create a second archetype
  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        level: 5,
        replaces: 'Weapon Training',
        description: 'A weapon master can add his weapon training bonus.'
      }
    ]
  };

  // Get the current associations for the second diff
  const currentAssociations = classItem.system.links.classAssociations;
  const secondDiff = DiffEngine.generateDiff(currentAssociations, secondArchetype);

  clearNotifications();
  clearChatMessages();
  await Applicator.apply(actor, classItem, secondArchetype, secondDiff);

  const secondAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(secondAppliedAt !== null, 'appliedAt should exist after second application');

  // The second timestamp should be different from (and later than) the first
  const firstMs = new Date(firstAppliedAt).getTime();
  const secondMs = new Date(secondAppliedAt).getTime();
  assert(secondMs >= firstMs, 'Second appliedAt should be >= first appliedAt');
});

await asyncTest('5.2 - each application records a fresh timestamp', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const beforeFirst = Date.now();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const firstAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const firstMs = new Date(firstAppliedAt).getTime();

  assert(firstMs >= beforeFirst, 'First appliedAt should be >= time before first apply');

  // Small delay
  await new Promise(r => setTimeout(r, 10));

  // Apply a second archetype
  const secondArchetype = {
    name: 'Polearm Master',
    slug: 'polearm-master',
    class: 'fighter',
    features: [
      {
        name: 'Pole Fighting',
        level: 5,
        replaces: 'Weapon Training',
        description: 'A polearm master can shorten grip.'
      }
    ]
  };

  const currentAssociations = classItem.system.links.classAssociations;
  const secondDiff = DiffEngine.generateDiff(currentAssociations, secondArchetype);

  const beforeSecond = Date.now();
  clearNotifications();
  clearChatMessages();
  await Applicator.apply(actor, classItem, secondArchetype, secondDiff);

  const secondAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const secondMs = new Date(secondAppliedAt).getTime();

  assert(secondMs >= beforeSecond, 'Second appliedAt should be >= time before second apply');
});

// ============================================================
// Section 6: Timestamp cleared on removal
// ============================================================
console.log('\n--- Section 6: Timestamp cleared on removal ---');

await asyncTest('6.1 - appliedAt cleared when last archetype is removed', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Apply archetype
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assert(classItem.getFlag(MODULE_ID, 'appliedAt') !== null, 'appliedAt should exist after apply');

  // Remove archetype
  clearNotifications();
  clearChatMessages();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const appliedAtAfterRemove = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAtAfterRemove === null || appliedAtAfterRemove === undefined,
    'appliedAt should be cleared after last archetype removed');
});

await asyncTest('6.2 - appliedAt persists when one of two archetypes is removed', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Apply first archetype
  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  // Apply second archetype
  const secondArchetype = {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        level: 5,
        replaces: 'Weapon Training',
        description: 'A weapon master can add his weapon training bonus.'
      }
    ]
  };
  const currentAssociations = classItem.system.links.classAssociations;
  const secondDiff = DiffEngine.generateDiff(currentAssociations, secondArchetype);
  clearNotifications();
  clearChatMessages();
  await Applicator.apply(actor, classItem, secondArchetype, secondDiff);

  // Remove only the first archetype
  clearNotifications();
  clearChatMessages();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // appliedAt should still exist since one archetype remains
  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt !== null && appliedAt !== undefined,
    'appliedAt should persist when archetypes still remain');
});

// ============================================================
// Section 7: Timestamp not set on failed applications
// ============================================================
console.log('\n--- Section 7: Timestamp not set on failed applications ---');

await asyncTest('7.1 - appliedAt not set when duplicate application is blocked', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Apply first time
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const firstAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');

  // Small delay
  await new Promise(r => setTimeout(r, 10));

  // Try to apply the same archetype again (should be rejected)
  clearNotifications();
  clearChatMessages();
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assert(result === false, 'Duplicate apply should return false');

  // appliedAt should remain unchanged from first application
  const afterDuplicate = classItem.getFlag(MODULE_ID, 'appliedAt');
  assertEqual(afterDuplicate, firstAppliedAt, 'appliedAt should not change on duplicate rejection');
});

await asyncTest('7.2 - appliedAt not set when permission is denied', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Set user as non-GM, non-owner
  const savedIsGM = game.user.isGM;
  game.user.isGM = false;
  // Ensure actor is not owned
  const savedIsOwner = actor.isOwner;
  actor.isOwner = false;

  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assert(result === false, 'Permission denied apply should return false');

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt === null || appliedAt === undefined,
    'appliedAt should not be set when permission is denied');

  // Restore
  game.user.isGM = savedIsGM;
  actor.isOwner = savedIsOwner;
});

await asyncTest('7.3 - appliedAt not set when wrong class archetype is blocked', async () => {
  const { classItem, actor } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Create a rogue archetype for a fighter class
  const wrongClassArchetype = {
    name: 'Scout',
    slug: 'scout',
    class: 'rogue',
    features: [
      {
        name: 'Scout\'s Charge',
        level: 2,
        replaces: 'Evasion',
        description: 'The scout can charge and apply sneak attack.'
      }
    ]
  };

  const diff = DiffEngine.generateDiff(classItem.system.links.classAssociations, wrongClassArchetype);

  const result = await Applicator.apply(actor, classItem, wrongClassArchetype, diff);
  assert(result === false, 'Wrong class apply should return false');

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt === null || appliedAt === undefined,
    'appliedAt should not be set when wrong class blocked');
});

// ============================================================
// Section 8: Timestamp format — convertible to Unix ms
// ============================================================
console.log('\n--- Section 8: Timestamp convertible to Unix ms ---');

await asyncTest('8.1 - appliedAt can be converted to Unix ms via Date.parse', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const unixMs = Date.parse(appliedAt);
  assert(!isNaN(unixMs), 'Date.parse should return a valid number');
  assert(unixMs > 0, 'Unix ms should be positive');
});

await asyncTest('8.2 - Unix ms from appliedAt matches new Date().getTime()', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const fromDateParse = Date.parse(appliedAt);
  const fromGetTime = new Date(appliedAt).getTime();

  assertEqual(fromDateParse, fromGetTime, 'Date.parse and getTime should agree');
});

await asyncTest('8.3 - Unix ms from appliedAt within 5s of Date.now()', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const beforeMs = Date.now();
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const afterMs = Date.now();

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedMs = new Date(appliedAt).getTime();

  assert(appliedMs >= beforeMs, 'appliedMs should be >= beforeMs');
  assert(appliedMs <= afterMs, 'appliedMs should be <= afterMs');
  assert(afterMs - beforeMs < 5000, 'Total operation should be under 5 seconds');
});

// ============================================================
// Section 9: Edge cases and consistency
// ============================================================
console.log('\n--- Section 9: Edge cases and consistency ---');

await asyncTest('9.1 - appliedAt is consistent string format across multiple calls', async () => {
  // Apply to two different environments and compare formats
  const env1 = createTestEnvironment();
  const env2 = createRogueTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(env1.actor, env1.classItem, env1.parsedArchetype, env1.diff);
  clearNotifications();
  clearChatMessages();
  await Applicator.apply(env2.actor, env2.classItem, env2.parsedArchetype, env2.diff);

  const at1 = env1.classItem.getFlag(MODULE_ID, 'appliedAt');
  const at2 = env2.classItem.getFlag(MODULE_ID, 'appliedAt');

  // Both should have same format (length may differ by ms precision, but regex should match)
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
  assert(iso8601Regex.test(at1), `First appliedAt '${at1}' should match ISO 8601`);
  assert(iso8601Regex.test(at2), `Second appliedAt '${at2}' should match ISO 8601`);
});

await asyncTest('9.2 - appliedAt contains no undefined, null, or NaN strings', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(!appliedAt.includes('undefined'), 'appliedAt should not contain "undefined"');
  assert(!appliedAt.includes('null'), 'appliedAt should not contain "null"');
  assert(!appliedAt.includes('NaN'), 'appliedAt should not contain "NaN"');
  assert(!appliedAt.includes('[object'), 'appliedAt should not contain "[object"');
});

await asyncTest('9.3 - appliedAt can be used to compute time elapsed since application', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedTime = new Date(appliedAt).getTime();
  const now = Date.now();
  const elapsed = now - appliedTime;

  assert(typeof elapsed === 'number', 'Elapsed should be a number');
  assert(!isNaN(elapsed), 'Elapsed should not be NaN');
  assert(elapsed >= 0, 'Elapsed should be non-negative (applied in the past)');
  assert(elapsed < 10000, 'Elapsed should be reasonable (under 10 seconds)');
});

await asyncTest('9.4 - appliedAt re-apply after remove records fresh timestamp', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Apply → remove → apply cycle
  await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const firstAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');

  clearNotifications();
  clearChatMessages();
  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  // Small delay to ensure different timestamp
  await new Promise(r => setTimeout(r, 15));

  // Re-apply
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, parsedArchetype);
  clearNotifications();
  clearChatMessages();
  await Applicator.apply(actor, classItem, parsedArchetype, diff2);

  const secondAppliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(secondAppliedAt !== null, 'appliedAt should exist after re-apply');

  const firstMs = new Date(firstAppliedAt).getTime();
  const secondMs = new Date(secondAppliedAt).getTime();
  assert(secondMs > firstMs, 'Re-applied timestamp should be later than first');
});

await asyncTest('9.5 - appliedAt is JSON-serializable (for flag storage)', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');

  // Should survive JSON roundtrip
  const jsonStr = JSON.stringify(appliedAt);
  const parsed = JSON.parse(jsonStr);
  assertEqual(parsed, appliedAt, 'appliedAt should survive JSON roundtrip');
});

await asyncTest('9.6 - appliedAt value produced by Date.toISOString()', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  await Applicator.apply(actor, classItem, parsedArchetype, diff);

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');

  // Date.toISOString() always produces exactly this format: YYYY-MM-DDTHH:mm:ss.sssZ
  // with exactly 3 decimal places for milliseconds
  const toISOStringFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  assert(toISOStringFormat.test(appliedAt),
    `appliedAt '${appliedAt}' should match Date.toISOString() format (YYYY-MM-DDTHH:mm:ss.sssZ)`);
});

// ============================================================
// Section 10: Comprehensive end-to-end timestamp flow
// ============================================================
console.log('\n--- Section 10: End-to-end timestamp flow ---');

await asyncTest('10.1 - Full E2E: note time → apply → read flag → verify accuracy and format', async () => {
  const { classItem, actor, parsedArchetype, diff } = createTestEnvironment();
  clearNotifications();
  clearChatMessages();

  // Step 1: Note current time
  const notedTime = new Date();
  const notedMs = notedTime.getTime();

  // Step 2: Apply archetype
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  assert(result === true, 'Apply should succeed');

  // Step 3: Read appliedAt flag
  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  assert(appliedAt !== null, 'appliedAt should be set');

  // Step 4: Within few seconds of noted time
  const appliedAtMs = new Date(appliedAt).getTime();
  const diffMs = Math.abs(appliedAtMs - notedMs);
  assert(diffMs < 5000, `appliedAt should be within 5 seconds of noted time (diff was ${diffMs}ms)`);

  // Step 5: Valid ISO 8601 format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  assert(iso8601Regex.test(appliedAt), `appliedAt '${appliedAt}' should be valid ISO 8601`);

  // Additional: convertible to Unix ms
  const unixMs = new Date(appliedAt).getTime();
  assert(!isNaN(unixMs) && unixMs > 0, 'Should be convertible to valid Unix ms');
});

await asyncTest('10.2 - E2E with Rogue: note time → apply → verify', async () => {
  const { classItem, actor, parsedArchetype, diff } = createRogueTestEnvironment();
  clearNotifications();
  clearChatMessages();

  const beforeMs = Date.now();
  const result = await Applicator.apply(actor, classItem, parsedArchetype, diff);
  const afterMs = Date.now();
  assert(result === true, 'Apply should succeed');

  const appliedAt = classItem.getFlag(MODULE_ID, 'appliedAt');
  const appliedAtMs = new Date(appliedAt).getTime();

  // Accurate
  assert(appliedAtMs >= beforeMs && appliedAtMs <= afterMs, 'Within time window');

  // ISO 8601
  assert(appliedAt.includes('T'), 'Contains T separator');
  assert(appliedAt.endsWith('Z'), 'Ends with Z');

  // Unix ms valid
  assert(!isNaN(appliedAtMs), 'Valid Unix ms');
});

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
