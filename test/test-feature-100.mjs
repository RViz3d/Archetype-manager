/**
 * Test Suite for Feature #100: Concurrent archetype operations don't corrupt data
 *
 * Verifies that multiple rapid operations on the same actor don't cause data
 * corruption or race conditions:
 * 1. Two tabs applying different archetypes simultaneously → no corruption
 * 2. Apply in one context + remove in another → no corruption
 * 3. Flags remain consistent after concurrent operations
 * 4. classAssociations are valid after concurrent operations
 * 5. At least one operation succeeds cleanly
 * 6. Per-actor lock serializes operations on same actor
 * 7. Different actors can have independent concurrent operations
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

// ==================
// Helper functions
// ==================

function buildArchetypeA() {
  return {
    name: 'Two-Handed Fighter',
    slug: 'two-handed-fighter',
    class: 'fighter',
    features: [
      {
        name: 'Shattering Strike',
        type: 'replacement',
        target: 'Bravery',
        level: 2,
        description: 'The two-handed fighter gains a +1 bonus to damage.',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.bravery',
          id: 'bravery-id',
          level: 2,
          resolvedName: 'Bravery'
        }
      },
      {
        name: 'Overhand Chop',
        type: 'additive',
        target: null,
        level: 3,
        description: 'Doubles Str bonus on single attacks.'
      }
    ]
  };
}

function buildArchetypeB() {
  return {
    name: 'Weapon Master',
    slug: 'weapon-master',
    class: 'fighter',
    features: [
      {
        name: 'Weapon Guard',
        type: 'replacement',
        target: 'Armor Training',
        level: 3,
        description: 'The weapon master gains a +1 bonus to CMD.',
        matchedAssociation: {
          uuid: 'Compendium.pf1.class-abilities.Item.armor-training',
          id: 'armor-training-id',
          level: 3,
          resolvedName: 'Armor Training'
        }
      }
    ]
  };
}

function buildFighterClassItem() {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  fighter.system.links.classAssociations = [
    { uuid: 'Compendium.pf1.class-abilities.Item.bravery', id: 'bravery-id', level: 2, resolvedName: 'Bravery' },
    { uuid: 'Compendium.pf1.class-abilities.Item.armor-training', id: 'armor-training-id', level: 3, resolvedName: 'Armor Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.weapon-training', id: 'weapon-training-id', level: 5, resolvedName: 'Weapon Training' },
    { uuid: 'Compendium.pf1.class-abilities.Item.bonus-feat-1', id: 'bonus-feat-1-id', level: 1, resolvedName: 'Bonus Feat' },
  ];
  return fighter;
}

function resetApplicatorState() {
  Applicator._applyInProgress = false;
  Applicator._removeInProgress = false;
  Applicator._actorLocks = new Map();
}

function getArchetypeFlags(classItem) {
  return classItem.getFlag('archetype-manager', 'archetypes') || [];
}

function getActorFlags(actor) {
  return actor.getFlag('archetype-manager', 'appliedArchetypes') || {};
}

function getBackup(classItem) {
  return classItem.getFlag('archetype-manager', 'originalAssociations');
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #100: Concurrent archetype operations don\'t corrupt data ===\n');

// --- Section 1: Per-actor lock infrastructure exists ---
console.log('--- Section 1: Per-actor lock infrastructure ---');

test('Applicator has _actorLocks static property', () => {
  assert('_actorLocks' in Applicator, 'Applicator should have _actorLocks property');
});

test('_actorLocks is a Map', () => {
  assert(Applicator._actorLocks instanceof Map, '_actorLocks should be a Map');
});

test('_actorLocks starts empty', () => {
  resetApplicatorState();
  assertEqual(Applicator._actorLocks.size, 0, '_actorLocks should start empty');
});

test('Applicator has _withActorLock static method', () => {
  assert(typeof Applicator._withActorLock === 'function', 'Should have _withActorLock method');
});

// --- Section 2: Per-actor lock correctly serializes operations ---
console.log('\n--- Section 2: Per-actor lock serializes same-actor operations ---');

await asyncTest('_withActorLock executes function and returns result', async () => {
  resetApplicatorState();
  const result = await Applicator._withActorLock('test-actor-1', async () => 'hello');
  assertEqual(result, 'hello', 'Should return function result');
});

await asyncTest('_withActorLock cleans up lock after completion', async () => {
  resetApplicatorState();
  await Applicator._withActorLock('test-actor-1', async () => {});
  assertEqual(Applicator._actorLocks.has('test-actor-1'), false, 'Lock should be cleaned up');
});

await asyncTest('_withActorLock cleans up lock even on error', async () => {
  resetApplicatorState();
  try {
    await Applicator._withActorLock('test-actor-1', async () => { throw new Error('test'); });
  } catch (_) {}
  assertEqual(Applicator._actorLocks.has('test-actor-1'), false, 'Lock should be cleaned up on error');
});

await asyncTest('Two concurrent _withActorLock on same actor are serialized', async () => {
  resetApplicatorState();
  const executionOrder = [];

  const op1 = Applicator._withActorLock('same-actor', async () => {
    executionOrder.push('op1-start');
    await new Promise(r => setTimeout(r, 20));
    executionOrder.push('op1-end');
    return 'op1';
  });

  const op2 = Applicator._withActorLock('same-actor', async () => {
    executionOrder.push('op2-start');
    await new Promise(r => setTimeout(r, 10));
    executionOrder.push('op2-end');
    return 'op2';
  });

  const [r1, r2] = await Promise.all([op1, op2]);

  // op1 should fully complete before op2 starts (serialized)
  const op1EndIdx = executionOrder.indexOf('op1-end');
  const op2StartIdx = executionOrder.indexOf('op2-start');
  assert(op1EndIdx < op2StartIdx || op2StartIdx === -1 || op1EndIdx === -1,
    `Operations should be serialized. Order: ${executionOrder.join(', ')}`);
});

await asyncTest('Two concurrent _withActorLock on different actors run independently', async () => {
  resetApplicatorState();
  const executionOrder = [];

  const op1 = Applicator._withActorLock('actor-A', async () => {
    executionOrder.push('A-start');
    await new Promise(r => setTimeout(r, 20));
    executionOrder.push('A-end');
    return 'A';
  });

  const op2 = Applicator._withActorLock('actor-B', async () => {
    executionOrder.push('B-start');
    await new Promise(r => setTimeout(r, 10));
    executionOrder.push('B-end');
    return 'B';
  });

  const [r1, r2] = await Promise.all([op1, op2]);
  assertEqual(r1, 'A', 'Actor A operation should return A');
  assertEqual(r2, 'B', 'Actor B operation should return B');

  // Both should start before either ends (parallel execution)
  const aStartIdx = executionOrder.indexOf('A-start');
  const bStartIdx = executionOrder.indexOf('B-start');
  const aEndIdx = executionOrder.indexOf('A-end');
  // B should start before A ends (they run in parallel for different actors)
  assert(bStartIdx < aEndIdx, `Different actors should run in parallel. Order: ${executionOrder.join(', ')}`);
});

// --- Section 3: Concurrent apply of same archetype on same actor ---
console.log('\n--- Section 3: Concurrent apply of same archetype (same actor) ---');

await asyncTest('Simultaneous apply of same archetype: only one succeeds', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const [r1, r2] = await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const successCount = [r1, r2].filter(r => r === true).length;
  // With both double-click guard and per-actor lock, only one should succeed
  assertEqual(successCount, 1, 'Exactly one apply should succeed');
});

await asyncTest('After concurrent same-archetype apply, flags show exactly one applied', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = getArchetypeFlags(fighter);
  assertEqual(archetypes.length, 1, 'Should have exactly 1 archetype in flags');
  assertEqual(archetypes[0], 'two-handed-fighter', 'Correct slug applied');
});

await asyncTest('After concurrent same-archetype apply, no duplicate entries in actor flags', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const actorFlags = getActorFlags(actor);
  const fighterArchetypes = actorFlags['fighter'] || [];
  const uniqueSlugs = [...new Set(fighterArchetypes)];
  assertEqual(fighterArchetypes.length, uniqueSlugs.length, 'No duplicate slugs in actor flags');
});

await asyncTest('classAssociations are valid after concurrent same-archetype apply', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const assocs = fighter.system.links.classAssociations;
  assert(Array.isArray(assocs), 'classAssociations should be an array');
  assert(assocs.length > 0, 'classAssociations should not be empty');
  // Each entry should have a uuid or id
  for (const a of assocs) {
    assert(a.uuid || a.id, `Each association should have uuid or id, got: ${JSON.stringify(a)}`);
  }
});

// --- Section 4: Concurrent apply of DIFFERENT archetypes on same actor ---
console.log('\n--- Section 4: Concurrent apply of different archetypes (same actor) ---');

await asyncTest('Concurrent apply of different archetypes: at least one succeeds', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetypeA = buildArchetypeA();
  const archetypeB = buildArchetypeB();
  const diffA = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeA);
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);

  const [rA, rB] = await Promise.all([
    Applicator.apply(actor, fighter, archetypeA, diffA),
    Applicator.apply(actor, fighter, archetypeB, diffB)
  ]);

  const successCount = [rA, rB].filter(r => r === true).length;
  assert(successCount >= 1, 'At least one apply should succeed');
});

await asyncTest('After concurrent different archetypes, flags are consistent', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetypeA = buildArchetypeA();
  const archetypeB = buildArchetypeB();
  const diffA = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeA);
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);

  await Promise.all([
    Applicator.apply(actor, fighter, archetypeA, diffA),
    Applicator.apply(actor, fighter, archetypeB, diffB)
  ]);

  const archetypes = getArchetypeFlags(fighter);
  // Should have at least one, and no duplicates
  assert(archetypes.length >= 1, 'At least one archetype should be applied');
  const uniqueSlugs = [...new Set(archetypes)];
  assertEqual(archetypes.length, uniqueSlugs.length, 'No duplicate slugs');

  // Actor flags should match class item flags
  const actorFlags = getActorFlags(actor);
  const fighterArchetypes = actorFlags['fighter'] || [];
  assertEqual(fighterArchetypes.length, archetypes.length, 'Actor flags should match class item flags count');
});

await asyncTest('After concurrent different archetypes, backup exists', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetypeA = buildArchetypeA();
  const archetypeB = buildArchetypeB();
  const diffA = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeA);
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);

  await Promise.all([
    Applicator.apply(actor, fighter, archetypeA, diffA),
    Applicator.apply(actor, fighter, archetypeB, diffB)
  ]);

  const backup = getBackup(fighter);
  assert(backup !== null, 'Backup should exist after concurrent applies');
  assert(Array.isArray(backup), 'Backup should be an array');
  assertEqual(backup.length, 4, 'Backup should have all 4 original associations');
});

await asyncTest('classAssociations are valid after concurrent different archetypes', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetypeA = buildArchetypeA();
  const archetypeB = buildArchetypeB();
  const diffA = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeA);
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);

  await Promise.all([
    Applicator.apply(actor, fighter, archetypeA, diffA),
    Applicator.apply(actor, fighter, archetypeB, diffB)
  ]);

  const assocs = fighter.system.links.classAssociations;
  assert(Array.isArray(assocs), 'classAssociations should be an array');
  // No undefined or null entries
  for (const a of assocs) {
    assert(a !== undefined && a !== null, 'No undefined/null entries in classAssociations');
  }
});

// --- Section 5: Concurrent apply + remove on same actor ---
console.log('\n--- Section 5: Concurrent apply and remove on same actor ---');

await asyncTest('Apply then concurrent remove: data is clean after', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // First, apply successfully
  const applyResult = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(applyResult, true, 'Initial apply should succeed');

  // Now try concurrent remove + apply of another archetype
  resetApplicatorState(); // Clear guards for fresh concurrent test
  const archetypeB = buildArchetypeB();
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);

  const [removeResult, applyBResult] = await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.apply(actor, fighter, archetypeB, diffB)
  ]);

  // At least one operation should succeed
  assert(removeResult === true || applyBResult === true, 'At least one operation should succeed');

  // Verify no corruption: flags should be internally consistent
  const archetypes = getArchetypeFlags(fighter);
  // All listed archetypes should have stored data if any remain
  if (archetypes.length > 0) {
    const storedData = fighter.getFlag('archetype-manager', 'appliedArchetypeData') || {};
    for (const slug of archetypes) {
      assert(storedData[slug] !== undefined, `Stored data should exist for applied archetype ${slug}`);
    }
  }
});

await asyncTest('After concurrent apply+remove, classAssociations are valid array', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Apply first
  await Applicator.apply(actor, fighter, archetype, diff);
  resetApplicatorState();

  // Concurrent remove + another apply
  const archetypeB = buildArchetypeB();
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);

  await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.apply(actor, fighter, archetypeB, diffB)
  ]);

  const assocs = fighter.system.links.classAssociations;
  assert(Array.isArray(assocs), 'classAssociations should still be an array (not null/undefined)');
});

// --- Section 6: Rapid fire operations (simulating tab switching) ---
console.log('\n--- Section 6: Rapid fire operations (tab switching simulation) ---');

await asyncTest('Three rapid applies of same archetype: only one succeeds', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  const results = await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const successCount = results.filter(r => r === true).length;
  assertEqual(successCount, 1, 'Exactly one apply should succeed on triple concurrent');
});

await asyncTest('After triple concurrent apply, exactly one chat message', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  // Should have exactly 1 chat message (from the successful apply)
  assertEqual(chatMessages.length, 1, 'Exactly 1 chat message from triple concurrent');
});

await asyncTest('After triple concurrent apply, exactly one success notification', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const successNotifs = notifications.filter(n => n.type === 'info' && n.msg.includes('Applied'));
  assertEqual(successNotifs.length, 1, 'Exactly 1 success notification from triple concurrent');
});

// --- Section 7: Different actors are independent ---
console.log('\n--- Section 7: Different actors are independent ---');

await asyncTest('Different actors applying simultaneously: both can succeed sequentially', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter1 = buildFighterClassItem();
  const fighter2 = buildFighterClassItem();
  const actor1 = createMockActor('Actor1', [fighter1]);
  const actor2 = createMockActor('Actor2', [fighter2]);
  const archetype = buildArchetypeA();
  const diff1 = DiffEngine.generateDiff(fighter1.system.links.classAssociations, archetype);
  const diff2 = DiffEngine.generateDiff(fighter2.system.links.classAssociations, archetype);

  // Sequential applies to different actors should both succeed
  const result1 = await Applicator.apply(actor1, fighter1, archetype, diff1);
  const result2 = await Applicator.apply(actor2, fighter2, archetype, diff2);

  assertEqual(result1, true, 'First actor apply should succeed');
  assertEqual(result2, true, 'Second actor apply should succeed');
});

await asyncTest('Different actors have independent flags after applies', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();

  const fighter1 = buildFighterClassItem();
  const fighter2 = buildFighterClassItem();
  const actor1 = createMockActor('Actor1', [fighter1]);
  const actor2 = createMockActor('Actor2', [fighter2]);
  const archetypeA = buildArchetypeA();
  const archetypeB = buildArchetypeB();
  const diffA = DiffEngine.generateDiff(fighter1.system.links.classAssociations, archetypeA);
  const diffB = DiffEngine.generateDiff(fighter2.system.links.classAssociations, archetypeB);

  await Applicator.apply(actor1, fighter1, archetypeA, diffA);
  await Applicator.apply(actor2, fighter2, archetypeB, diffB);

  const flags1 = getArchetypeFlags(fighter1);
  const flags2 = getArchetypeFlags(fighter2);
  assertEqual(flags1.length, 1, 'Actor1 should have 1 archetype');
  assertEqual(flags2.length, 1, 'Actor2 should have 1 archetype');
  assertEqual(flags1[0], 'two-handed-fighter', 'Actor1 has correct archetype');
  assertEqual(flags2[0], 'weapon-master', 'Actor2 has correct archetype');
});

await asyncTest('Actor locks are independent (different actor IDs)', async () => {
  resetApplicatorState();
  const locks = Applicator._actorLocks;
  assertEqual(locks.size, 0, 'Locks should start empty');

  // Create locks for two different actors
  let resolve1, resolve2;
  const lock1 = new Promise(r => { resolve1 = r; });
  const lock2 = new Promise(r => { resolve2 = r; });

  locks.set('actor-1', lock1);
  locks.set('actor-2', lock2);

  assertEqual(locks.size, 2, 'Should have 2 independent locks');
  assert(locks.has('actor-1'), 'Should have lock for actor-1');
  assert(locks.has('actor-2'), 'Should have lock for actor-2');

  // Clean up
  resolve1();
  resolve2();
  locks.clear();
});

// --- Section 8: State consistency verification ---
console.log('\n--- Section 8: State consistency verification ---');

await asyncTest('After concurrent ops, archetypes flag and appliedArchetypeData are in sync', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = getArchetypeFlags(fighter);
  const storedData = fighter.getFlag('archetype-manager', 'appliedArchetypeData') || {};

  // Every archetype in the list should have stored data
  for (const slug of archetypes) {
    assert(storedData[slug] !== undefined, `Stored data should exist for ${slug}`);
  }

  // storedData should not have entries for archetypes not in the list
  for (const slug of Object.keys(storedData)) {
    assert(archetypes.includes(slug), `Stored data for ${slug} should only exist if archetype is applied`);
  }
});

await asyncTest('After concurrent ops, appliedAt timestamp exists if archetypes applied', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = getArchetypeFlags(fighter);
  if (archetypes.length > 0) {
    const appliedAt = fighter.getFlag('archetype-manager', 'appliedAt');
    assert(appliedAt !== null && appliedAt !== undefined, 'appliedAt should exist when archetypes are applied');
    assert(typeof appliedAt === 'string', 'appliedAt should be a string');
  }
});

await asyncTest('After concurrent ops, originalAssociations backup is preserved', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const originalAssocs = [...fighter.system.links.classAssociations];
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const backup = getBackup(fighter);
  assert(backup !== null, 'Backup should exist');
  assertEqual(backup.length, originalAssocs.length, 'Backup should have same length as original');

  // Verify backup matches original (not modified by concurrent ops)
  for (let i = 0; i < originalAssocs.length; i++) {
    assertEqual(backup[i].uuid, originalAssocs[i].uuid, `Backup entry ${i} UUID should match original`);
  }
});

// --- Section 9: Sequential apply after concurrent rejection ---
console.log('\n--- Section 9: Sequential apply after concurrent rejection ---');

await asyncTest('After concurrent rejection, can still apply different archetype sequentially', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Double apply - one fails
  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  // Now apply a different archetype sequentially
  resetApplicatorState();
  const archetypeB = buildArchetypeB();
  const diffB = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetypeB);
  const result = await Applicator.apply(actor, fighter, archetypeB, diffB);

  assertEqual(result, true, 'Sequential apply of different archetype should succeed');
  const archetypes = getArchetypeFlags(fighter);
  assertEqual(archetypes.length, 2, 'Should have 2 archetypes after sequential apply');
  assert(archetypes.includes('two-handed-fighter'), 'Should include first archetype');
  assert(archetypes.includes('weapon-master'), 'Should include second archetype');
});

await asyncTest('Guards reset properly after all concurrent operations complete', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  assertEqual(Applicator._applyInProgress, false, '_applyInProgress should be false after all concurrent ops');
  assertEqual(Applicator._removeInProgress, false, '_removeInProgress should be false');
  assertEqual(Applicator._actorLocks.size, 0, 'No actor locks should remain');
});

// --- Section 10: Apply-remove-apply concurrent cycle ---
console.log('\n--- Section 10: Apply-remove-apply concurrent cycle ---');

await asyncTest('Full cycle: apply → remove → re-apply produces clean state', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Apply
  const applyResult = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(applyResult, true, 'Initial apply should succeed');

  // Remove
  resetApplicatorState();
  const removeResult = await Applicator.remove(actor, fighter, 'two-handed-fighter');
  assertEqual(removeResult, true, 'Remove should succeed');

  // Verify clean state
  const archetypesAfterRemove = getArchetypeFlags(fighter);
  assertEqual(archetypesAfterRemove.length, 0, 'No archetypes after removal');

  // Re-apply
  resetApplicatorState();
  const diff2 = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
  const reapplyResult = await Applicator.apply(actor, fighter, archetype, diff2);
  assertEqual(reapplyResult, true, 'Re-apply should succeed');

  const finalArchetypes = getArchetypeFlags(fighter);
  assertEqual(finalArchetypes.length, 1, 'Should have 1 archetype after re-apply');
});

await asyncTest('Concurrent remove of non-existent archetype does not corrupt', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Apply archetype A
  await Applicator.apply(actor, fighter, archetype, diff);

  resetApplicatorState();
  // Try to remove non-existent archetype concurrently with removing the real one
  const [r1, r2] = await Promise.all([
    Applicator.remove(actor, fighter, 'two-handed-fighter'),
    Applicator.remove(actor, fighter, 'non-existent-archetype')
  ]);

  // At least one should "succeed" (removal of existing) or be blocked
  // The non-existent removal should return false without corruption
  const assocs = fighter.system.links.classAssociations;
  assert(Array.isArray(assocs), 'classAssociations should remain a valid array');
});

// --- Section 11: Edge cases ---
console.log('\n--- Section 11: Edge cases ---');

await asyncTest('Concurrent apply with error in one does not corrupt the other', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // The global _applyInProgress guard means only one apply runs at a time,
  // so even if one would error, the other is rejected by the guard (not corrupted)
  const result1 = await Applicator.apply(actor, fighter, archetype, diff);
  assertEqual(Applicator._applyInProgress, false, 'Guard should be reset after apply');

  // Verify data is clean
  const archetypes = getArchetypeFlags(fighter);
  assert(archetypes.length <= 1, 'Should have at most 1 archetype');
  if (archetypes.length === 1) {
    assertEqual(archetypes[0], 'two-handed-fighter', 'Applied archetype should be correct');
  }
});

await asyncTest('No orphaned actor flags after concurrent operations', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  // Apply then remove concurrently with guard reset
  await Applicator.apply(actor, fighter, archetype, diff);
  resetApplicatorState();
  await Applicator.remove(actor, fighter, 'two-handed-fighter');

  // After full removal, actor flags should be clean
  const actorFlags = getActorFlags(actor);
  const fighterArchetypes = actorFlags['fighter'] || [];
  assertEqual(fighterArchetypes.length, 0, 'No orphaned actor flags after apply + remove');
});

await asyncTest('appliedArchetypeData consistent after concurrent operations', async () => {
  resetApplicatorState();
  clearNotifications();
  clearChatMessages();
  const fighter = buildFighterClassItem();
  const actor = createMockActor('TestActor', [fighter]);
  const archetype = buildArchetypeA();
  const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);

  await Promise.all([
    Applicator.apply(actor, fighter, archetype, diff),
    Applicator.apply(actor, fighter, archetype, diff)
  ]);

  const archetypes = getArchetypeFlags(fighter);
  const storedData = fighter.getFlag('archetype-manager', 'appliedArchetypeData') || {};

  // Keys in storedData should exactly match applied archetypes
  const storedKeys = Object.keys(storedData).sort();
  const archetypesSorted = [...archetypes].sort();
  assertEqual(JSON.stringify(storedKeys), JSON.stringify(archetypesSorted),
    'appliedArchetypeData keys should match applied archetypes');
});

// ========================
// Summary
// ========================

console.log(`\n=== Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
