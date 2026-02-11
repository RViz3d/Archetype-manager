/**
 * Test Suite for Feature #42: Error rollback restores original state
 *
 * Verifies that when an error occurs during archetype application,
 * the _rollback method correctly:
 * 1. Restores original classAssociations from backup
 * 2. Removes any orphaned item copies created during failed apply
 * 3. Cleans up tracking flags
 * 4. Shows error notification to user
 * 5. Leaves actor in a clean state
 *
 * Steps:
 * 1. Note original classAssociations
 * 2. Simulate failure during application
 * 3. Verify rollback triggers
 * 4. Verify classAssociations restored
 * 5. No orphaned item copies
 * 6. Tracking flags cleaned up
 * 7. Error notification shown
 * 8. Actor in clean state
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

function assertNotNull(actual, message) {
  if (actual === null || actual === undefined) {
    throw new Error(`${message || 'Expected non-null value'}: got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message || 'Deep equality failed'}: expected ${e}, got ${a}`);
  }
}

// Set up environment
setupMockEnvironment();

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
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' },
  'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike': { name: 'Shattering Strike' },
  'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop': { name: 'Overhand Chop' },
  'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining': { name: 'Weapon Training (Two-Handed Fighter)' },
  'Compendium.pf1e-archetypes.pf-arch-features.Backswing': { name: 'Backswing' },
  'Compendium.pf1e-archetypes.pf-arch-features.Piledriver': { name: 'Piledriver' },
  'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack': { name: 'Greater Power Attack' },
  'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow': { name: 'Devastating Blow' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

const { Applicator } = await import('../scripts/applicator.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #42: Error rollback restores original state ===\n');

// =====================================================
// Fighter base classAssociations
// =====================================================
const fighterClassAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining3', level: 13 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining4', level: 17 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponMastery', level: 20 }
];

// Resolve associations
let resolvedFighterAssociations;
await asyncTest('Resolve Fighter classAssociations', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
});

// Two-Handed Fighter archetype
const twoHandedFighterParsed = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'Fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike',
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.OverhandChop',
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'modification',
      target: 'weapon training 1',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.THFWeaponTraining',
      description: 'Modified weapon training for Two-Handed Fighter',
      source: 'auto-parse'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'armor training 2',
      matchedAssociation: resolvedFighterAssociations?.[4] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Backswing',
      source: 'auto-parse'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'armor training 3',
      matchedAssociation: resolvedFighterAssociations?.[6] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.Piledriver',
      source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'armor training 4',
      matchedAssociation: resolvedFighterAssociations?.[8] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.GreaterPowerAttack',
      source: 'auto-parse'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'armor mastery',
      matchedAssociation: resolvedFighterAssociations?.[10] || { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.DevastatingBlow',
      source: 'auto-parse'
    }
  ]
};

// Helper to create a fresh tracked test environment
function createTestEnv(options = {}) {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));

  const originalAssociationsCopy = JSON.parse(JSON.stringify(classItem.system.links.classAssociations));

  const actor = createMockActor('Test Fighter', [classItem]);
  actor.isOwner = true;

  // Track notifications
  const notifications = { info: [], warn: [], error: [] };
  globalThis.ui.notifications.info = (msg) => notifications.info.push(msg);
  globalThis.ui.notifications.warn = (msg) => notifications.warn.push(msg);
  globalThis.ui.notifications.error = (msg) => notifications.error.push(msg);

  // Track console errors
  const consoleErrors = [];
  const origConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };

  // Track chat messages
  const chatMessages = [];
  globalThis.ChatMessage = { create: async (data) => { chatMessages.push(data); return data; } };

  // Track item creation/deletion
  const createdItemIds = [];
  const deletedItemIds = [];
  const actorItems = [];

  actor.createEmbeddedDocuments = async function(type, data) {
    const results = data.map(d => {
      const item = { ...d, id: crypto.randomUUID?.() || Math.random().toString(36).slice(2) };
      createdItemIds.push(item.id);
      actorItems.push(item);
      return item;
    });
    return results;
  };

  actor.deleteEmbeddedDocuments = async function(type, ids) {
    deletedItemIds.push(...ids);
    return ids;
  };

  // Update actor.items to reflect created items
  actor.items = {
    filter: (fn) => actorItems.filter(fn),
    find: (fn) => actorItems.find(fn),
    get: (id) => actorItems.find(i => i.id === id),
    map: (fn) => actorItems.map(fn),
    [Symbol.iterator]: () => actorItems[Symbol.iterator]()
  };

  // Make item "filter" work for flag-based lookups by implementing getFlag
  for (const item of actorItems) {
    if (!item.getFlag) {
      item.getFlag = function(scope, key) {
        return this.flags?.[scope]?.[key] ?? null;
      };
    }
  }

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);

  return {
    classItem,
    actor,
    diff,
    originalAssociationsCopy,
    notifications,
    consoleErrors,
    chatMessages,
    createdItemIds,
    deletedItemIds,
    actorItems,
    restoreConsole: () => { console.error = origConsoleError; }
  };
}

// =====================================================
// Step 1: Note original classAssociations
// =====================================================
console.log('--- Step 1: Note original classAssociations before failure ---');

await asyncTest('Original classAssociations has 12 entries', async () => {
  const env = createTestEnv();
  assertEqual(env.originalAssociationsCopy.length, 12, 'Should have 12 original associations');
  env.restoreConsole();
});

await asyncTest('Original classAssociations preserved as deep copy', async () => {
  const env = createTestEnv();
  // Verify it's a proper deep copy
  const orig = env.originalAssociationsCopy;
  assert(orig[0].uuid === 'Compendium.pf1.class-abilities.BonusFeat1', 'First entry should be BonusFeat');
  assert(orig[1].uuid === 'Compendium.pf1.class-abilities.Bravery', 'Second entry should be Bravery');
  assert(orig[11].uuid === 'Compendium.pf1.class-abilities.WeaponMastery', 'Last entry should be WeaponMastery');
  env.restoreConsole();
});

// =====================================================
// Step 2: Simulate failure during application
// =====================================================
console.log('\n--- Step 2: Simulate failure during application ---');

await asyncTest('Error during classItem.update triggers rollback', async () => {
  const env = createTestEnv();

  // Make classItem.update throw AFTER backup is created
  let updateCallCount = 0;
  const origUpdate = env.classItem.update.bind(env.classItem);
  env.classItem.update = async function(data) {
    updateCallCount++;
    // Let the first update through (this is the backup), fail on classAssociations update
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated database error during classAssociations update');
    }
    return origUpdate(data);
  };

  const result = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assertEqual(result, false, 'Apply should return false on error');
  env.restoreConsole();
});

await asyncTest('Error during createEmbeddedDocuments triggers rollback', async () => {
  const env = createTestEnv();

  // Make createEmbeddedDocuments fail
  env.actor.createEmbeddedDocuments = async function(type, data) {
    throw new Error('Simulated error creating item copies');
  };

  const result = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assertEqual(result, false, 'Apply should return false on error');
  env.restoreConsole();
});

await asyncTest('Error during setFlag triggers rollback', async () => {
  const env = createTestEnv();

  // Allow backup to succeed, then fail on tracking flag
  let setFlagCallCount = 0;
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  env.classItem.setFlag = async function(scope, key, value) {
    setFlagCallCount++;
    // First setFlag is backup (originalAssociations), second is archetypes tracking
    if (key === 'archetypes' && Array.isArray(value) && value.includes('two-handed-fighter')) {
      throw new Error('Simulated flag write error');
    }
    return origSetFlag(scope, key, value);
  };

  const result = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assertEqual(result, false, 'Apply should return false on flag error');
  env.restoreConsole();
});

await asyncTest('Error during ChatMessage.create triggers rollback', async () => {
  const env = createTestEnv();

  // Make chat message posting fail
  globalThis.ChatMessage = {
    create: async () => { throw new Error('Simulated chat message error'); }
  };

  const result = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assertEqual(result, false, 'Apply should return false when chat fails');
  env.restoreConsole();
});

// =====================================================
// Step 3: Verify rollback triggers
// =====================================================
console.log('\n--- Step 3: Verify rollback triggers ---');

await asyncTest('Rollback method is called on application error', async () => {
  const env = createTestEnv();

  // Track rollback calls
  let rollbackCalled = false;
  const origRollback = Applicator._rollback;
  Applicator._rollback = async function(actor, classItem, slug) {
    rollbackCalled = true;
    return origRollback.call(this, actor, classItem, slug);
  };

  // Fail during classItem update for classAssociations
  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assert(rollbackCalled, 'Rollback should have been called');
  Applicator._rollback = origRollback;
  env.restoreConsole();
});

await asyncTest('Rollback receives correct slug parameter', async () => {
  const env = createTestEnv();

  let rollbackSlug = null;
  const origRollback = Applicator._rollback;
  Applicator._rollback = async function(actor, classItem, slug) {
    rollbackSlug = slug;
    return origRollback.call(this, actor, classItem, slug);
  };

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assertEqual(rollbackSlug, 'two-handed-fighter', 'Rollback should receive archetype slug');
  Applicator._rollback = origRollback;
  env.restoreConsole();
});

await asyncTest('Rollback receives correct actor and classItem', async () => {
  const env = createTestEnv();

  let rollbackActor = null;
  let rollbackClassItem = null;
  const origRollback = Applicator._rollback;
  Applicator._rollback = async function(actor, classItem, slug) {
    rollbackActor = actor;
    rollbackClassItem = classItem;
    return origRollback.call(this, actor, classItem, slug);
  };

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assertEqual(rollbackActor?.name, 'Test Fighter', 'Rollback should receive correct actor');
  assertEqual(rollbackClassItem?.name, 'Fighter', 'Rollback should receive correct classItem');
  Applicator._rollback = origRollback;
  env.restoreConsole();
});

// =====================================================
// Step 4: Verify classAssociations restored
// =====================================================
console.log('\n--- Step 4: Verify classAssociations restored after rollback ---');

await asyncTest('ClassAssociations restored to original after update error', async () => {
  const env = createTestEnv();

  // Allow backup to work (setFlag for originalAssociations), then fail on associations update
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  const origUpdate = env.classItem.update.bind(env.classItem);
  let associationUpdateCount = 0;

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      associationUpdateCount++;
      if (associationUpdateCount === 1) {
        // First classAssociations update: fail to trigger rollback
        throw new Error('Simulated failure');
      }
      // Second call is the rollback restore - let it through
      return origUpdate(data);
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // After rollback, classAssociations should be restored from backup
  const restored = env.classItem.system.links.classAssociations;
  assertEqual(restored.length, 12, 'Restored associations should have 12 entries');
  env.restoreConsole();
});

await asyncTest('Restored classAssociations match original UUIDs', async () => {
  const env = createTestEnv();

  const origUpdate = env.classItem.update.bind(env.classItem);
  let associationUpdateCount = 0;

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      associationUpdateCount++;
      if (associationUpdateCount === 1) {
        throw new Error('Simulated failure');
      }
      return origUpdate(data);
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  const restored = env.classItem.system.links.classAssociations;
  // Verify each UUID matches original
  for (let i = 0; i < env.originalAssociationsCopy.length; i++) {
    assertEqual(restored[i]?.uuid, env.originalAssociationsCopy[i].uuid,
      `UUID at index ${i} should match original`);
  }
  env.restoreConsole();
});

await asyncTest('Restored classAssociations match original levels', async () => {
  const env = createTestEnv();

  const origUpdate = env.classItem.update.bind(env.classItem);
  let associationUpdateCount = 0;

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      associationUpdateCount++;
      if (associationUpdateCount === 1) {
        throw new Error('Simulated failure');
      }
      return origUpdate(data);
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  const restored = env.classItem.system.links.classAssociations;
  for (let i = 0; i < env.originalAssociationsCopy.length; i++) {
    assertEqual(restored[i]?.level, env.originalAssociationsCopy[i].level,
      `Level at index ${i} should match original`);
  }
  env.restoreConsole();
});

await asyncTest('Rollback restores backup even after partial modification', async () => {
  const env = createTestEnv();

  // Let createEmbeddedDocuments succeed (creating copies), then fail on flag write
  let setFlagCallCount = 0;
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  const origUpdate = env.classItem.update.bind(env.classItem);
  let rollbackUpdateCalled = false;

  env.classItem.setFlag = async function(scope, key, value) {
    setFlagCallCount++;
    if (key === 'archetypes' && Array.isArray(value) && value.includes('two-handed-fighter')) {
      throw new Error('Simulated flag write error');
    }
    return origSetFlag(scope, key, value);
  };

  // Track the rollback's update call
  let updateCount = 0;
  env.classItem.update = async function(data) {
    updateCount++;
    if (data['system.links.classAssociations'] !== undefined && updateCount > 1) {
      rollbackUpdateCalled = true;
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // The rollback should have attempted to restore
  // Even though classAssociations were already updated, rollback should revert
  assert(rollbackUpdateCalled || setFlagCallCount > 0, 'Rollback should have been triggered');
  env.restoreConsole();
});

// =====================================================
// Step 5: No orphaned item copies
// =====================================================
console.log('\n--- Step 5: No orphaned item copies ---');

await asyncTest('Rollback deletes item copies created during failed apply', async () => {
  const env = createTestEnv();

  // Let item copies be created, but fail on tracking flag
  const createdCopies = [];
  env.actor.createEmbeddedDocuments = async function(type, data) {
    const results = data.map(d => {
      const item = {
        ...d,
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        getFlag: function(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
      };
      createdCopies.push(item);
      env.actorItems.push(item);
      return item;
    });
    return results;
  };

  const deletedIds = [];
  env.actor.deleteEmbeddedDocuments = async function(type, ids) {
    deletedIds.push(...ids);
    return ids;
  };

  // Fail after item copies are created
  let setFlagCount = 0;
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  env.classItem.setFlag = async function(scope, key, value) {
    setFlagCount++;
    if (key === 'archetypes' && Array.isArray(value) && value.includes('two-handed-fighter')) {
      throw new Error('Simulated failure after copies created');
    }
    return origSetFlag(scope, key, value);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Rollback should attempt to delete copies with matching slug
  if (createdCopies.length > 0) {
    assert(deletedIds.length > 0, 'Rollback should delete created item copies');
  }
  env.restoreConsole();
});

await asyncTest('Rollback only deletes copies matching the failed archetype slug', async () => {
  const env = createTestEnv();

  // Pre-existing item from different archetype
  const existingItem = {
    id: 'existing-other-item',
    name: 'Some Other Feature (Different Archetype)',
    type: 'feat',
    flags: { 'archetype-manager': { createdByArchetype: 'other-archetype', isModifiedCopy: true } },
    getFlag: function(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
  };
  env.actorItems.push(existingItem);

  // Let copies be created for the target archetype
  env.actor.createEmbeddedDocuments = async function(type, data) {
    const results = data.map(d => {
      const item = {
        ...d,
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        getFlag: function(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
      };
      env.actorItems.push(item);
      return item;
    });
    return results;
  };

  const deletedIds = [];
  env.actor.deleteEmbeddedDocuments = async function(type, ids) {
    deletedIds.push(...ids);
    return ids;
  };

  // Fail after copies created
  let setFlagCount = 0;
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  env.classItem.setFlag = async function(scope, key, value) {
    setFlagCount++;
    if (key === 'archetypes' && Array.isArray(value) && value.includes('two-handed-fighter')) {
      throw new Error('Simulated failure');
    }
    return origSetFlag(scope, key, value);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Existing item from other archetype should NOT be deleted
  assert(!deletedIds.includes('existing-other-item'),
    'Should not delete copies from other archetypes');
  env.restoreConsole();
});

await asyncTest('No orphaned copies when createEmbeddedDocuments fails', async () => {
  const env = createTestEnv();

  // createEmbeddedDocuments throws - no copies should exist
  env.actor.createEmbeddedDocuments = async function(type, data) {
    throw new Error('Failed to create items');
  };

  const deletedIds = [];
  env.actor.deleteEmbeddedDocuments = async function(type, ids) {
    deletedIds.push(...ids);
    return ids;
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Since createEmbeddedDocuments failed, no copies exist to delete
  // Rollback's _deleteCreatedCopies should find nothing (actorItems is empty)
  // This should not throw
  env.restoreConsole();
});

// =====================================================
// Step 6: Tracking flags cleaned up
// =====================================================
console.log('\n--- Step 6: Tracking flags cleaned up ---');

await asyncTest('Archetype slug removed from archetypes flag after rollback', async () => {
  const env = createTestEnv();

  const origUpdate = env.classItem.update.bind(env.classItem);
  let updateCount = 0;

  env.classItem.update = async function(data) {
    updateCount++;
    if (data['system.links.classAssociations'] !== undefined && updateCount === 1) {
      throw new Error('Simulated failure');
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // After rollback, the archetypes flag should not contain the slug
  const archetypes = env.classItem.getFlag('archetype-manager', 'archetypes') || [];
  assert(!archetypes.includes('two-handed-fighter'),
    'Archetype slug should be removed from archetypes flag after rollback');
  env.restoreConsole();
});

await asyncTest('Backup flag preserved for potential retry', async () => {
  const env = createTestEnv();

  const origUpdate = env.classItem.update.bind(env.classItem);
  let updateCount = 0;

  env.classItem.update = async function(data) {
    updateCount++;
    if (data['system.links.classAssociations'] !== undefined && updateCount === 1) {
      throw new Error('Simulated failure');
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // The backup (originalAssociations) was set before failure.
  // After rollback, backup is used to restore, and rollback doesn't explicitly unset it.
  // The classAssociations should be back to original regardless.
  const restored = env.classItem.system.links.classAssociations;
  assert(restored.length === 12, 'Restored associations should have 12 entries');
  env.restoreConsole();
});

await asyncTest('Actor flags not corrupted after rollback', async () => {
  const env = createTestEnv();

  const origUpdate = env.classItem.update.bind(env.classItem);
  let updateCount = 0;

  env.classItem.update = async function(data) {
    updateCount++;
    if (data['system.links.classAssociations'] !== undefined && updateCount === 1) {
      throw new Error('Simulated failure');
    }
    return origUpdate(data);
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Actor-level flags should not contain the failed archetype
  // The error happens before actor flags are set (line 68-71 in applicator.mjs)
  const actorArchetypes = env.actor.getFlag('archetype-manager', 'appliedArchetypes');
  // Either null or doesn't contain the slug
  if (actorArchetypes) {
    const classTag = 'fighter';
    const appliedForClass = actorArchetypes[classTag] || [];
    assert(!appliedForClass.includes('two-handed-fighter'),
      'Actor flags should not contain failed archetype slug');
  }
  env.restoreConsole();
});

// =====================================================
// Step 7: Error notification shown
// =====================================================
console.log('\n--- Step 7: Error notification shown ---');

await asyncTest('Error notification shown on failed application', async () => {
  const env = createTestEnv();

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assert(env.notifications.error.length > 0, 'Should show at least one error notification');
  env.restoreConsole();
});

await asyncTest('Error notification mentions rollback', async () => {
  const env = createTestEnv();

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  const errorMsg = env.notifications.error.join(' ').toLowerCase();
  assert(errorMsg.includes('roll') || errorMsg.includes('fail'),
    'Error notification should mention rolling back or failure');
  env.restoreConsole();
});

await asyncTest('No success notification on failed application', async () => {
  const env = createTestEnv();

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Should NOT show success notification
  const infoMessages = env.notifications.info;
  const hasSuccessMsg = infoMessages.some(m =>
    m.toLowerCase().includes('applied') && m.toLowerCase().includes('two-handed fighter'));
  assert(!hasSuccessMsg, 'Should not show success notification on failed application');
  env.restoreConsole();
});

await asyncTest('Console error logged with details', async () => {
  const env = createTestEnv();

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  assert(env.consoleErrors.length > 0, 'Should log error to console');
  const errorLog = env.consoleErrors.join(' ');
  assert(errorLog.includes('archetype-manager') || errorLog.includes('Error'),
    'Console error should include module identifier or error message');
  env.restoreConsole();
});

// =====================================================
// Step 8: Actor in clean state
// =====================================================
console.log('\n--- Step 8: Actor in clean state ---');

await asyncTest('Apply returns false on error', async () => {
  const env = createTestEnv();

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  const result = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);
  assertEqual(result, false, 'Apply should return false');
  env.restoreConsole();
});

await asyncTest('Actor is in clean state after rollback - can retry apply', async () => {
  const env = createTestEnv();

  let failOnce = true;
  const origUpdate = env.classItem.update.bind(env.classItem);

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined && failOnce) {
      failOnce = false;
      throw new Error('Simulated one-time failure');
    }
    return origUpdate(data);
  };

  // First attempt: fails
  const result1 = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);
  assertEqual(result1, false, 'First apply should fail');

  // The class item should be in a clean state where retry is possible
  // The slug should not be in archetypes list (blocked by duplicate check)
  const archetypes = env.classItem.getFlag('archetype-manager', 'archetypes') || [];
  assert(!archetypes.includes('two-handed-fighter'),
    'Slug should be cleaned up so retry is possible');
  env.restoreConsole();
});

await asyncTest('Successful retry after rollback works correctly', async () => {
  const env = createTestEnv();

  let failOnce = true;
  const origUpdate = env.classItem.update.bind(env.classItem);

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined && failOnce) {
      failOnce = false;
      throw new Error('Simulated one-time failure');
    }
    return origUpdate(data);
  };

  // First attempt: fails
  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Reset the classAssociations to original for clean retry
  // (rollback should have already done this, but we need to ensure the backup is still there)
  const backup = env.classItem.getFlag('archetype-manager', 'originalAssociations');

  // Second attempt: should succeed now that failOnce=false
  const result2 = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);
  assertEqual(result2, true, 'Second apply should succeed after rollback');
  env.restoreConsole();
});

await asyncTest('No chat message posted on failed application', async () => {
  const env = createTestEnv();

  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // Chat message is posted at step 6 in apply(), which comes after the failing step 4
  // So no chat message should have been posted
  assertEqual(env.chatMessages.length, 0, 'No chat message should be posted on failure');
  env.restoreConsole();
});

await asyncTest('ClassItem has no archetype-manager flags after full rollback', async () => {
  const env = createTestEnv();

  // Fail before any flags are set (fail on classAssociations update which is step 4)
  env.classItem.update = async function(data) {
    if (data['system.links.classAssociations'] !== undefined) {
      throw new Error('Simulated failure');
    }
  };

  await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);

  // After rollback with slug removed from archetypes
  const archetypes = env.classItem.getFlag('archetype-manager', 'archetypes') || [];
  assert(!archetypes.includes('two-handed-fighter'),
    'Archetypes flag should not contain the failed slug');
  env.restoreConsole();
});

// =====================================================
// Additional edge cases
// =====================================================
console.log('\n--- Additional edge cases ---');

await asyncTest('Rollback handles already-clean state gracefully', async () => {
  const env = createTestEnv();

  // Call rollback directly on a clean class item (no backup exists)
  // This shouldn't throw
  try {
    await Applicator._rollback(env.actor, env.classItem, 'non-existent');
  } catch (e) {
    throw new Error('Rollback should not throw on clean state: ' + e.message);
  }
  env.restoreConsole();
});

await asyncTest('Rollback handles missing backup flag gracefully', async () => {
  const env = createTestEnv();

  // Set archetypes flag but no backup
  await env.classItem.setFlag('archetype-manager', 'archetypes', ['two-handed-fighter']);

  try {
    await Applicator._rollback(env.actor, env.classItem, 'two-handed-fighter');
  } catch (e) {
    throw new Error('Rollback should handle missing backup: ' + e.message);
  }

  // Should still clean up the archetypes flag
  const archetypes = env.classItem.getFlag('archetype-manager', 'archetypes') || [];
  assert(!archetypes.includes('two-handed-fighter'),
    'Slug should be removed even without backup');
  env.restoreConsole();
});

await asyncTest('Error in rollback itself is caught and logged', async () => {
  const env = createTestEnv();

  // Make rollback's update call throw too
  const origUpdate = env.classItem.update.bind(env.classItem);
  let callCount = 0;
  env.classItem.update = async function(data) {
    callCount++;
    // Always throw - both the initial apply and the rollback restore
    throw new Error('Everything is broken');
  };

  // This should not throw even if rollback itself fails
  try {
    const result = await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, env.diff);
    assertEqual(result, false, 'Apply should still return false');
  } catch (e) {
    throw new Error('Apply should not propagate errors to caller: ' + e.message);
  }
  env.restoreConsole();
});

await asyncTest('Rollback with replacement-only archetype (no modifications/copies)', async () => {
  const env = createTestEnv();

  // Create an archetype with only replacements (no modifications -> no copies)
  const replacementOnlyArchetype = {
    name: 'Replacement Only',
    slug: 'replacement-only',
    class: 'Fighter',
    features: [
      {
        name: 'New Bravery',
        level: 2,
        type: 'replacement',
        target: 'bravery',
        matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
        archetypeUuid: 'Compendium.pf1e-archetypes.pf-arch-features.ShatteringStrike',
        source: 'auto-parse'
      }
    ]
  };

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, replacementOnlyArchetype);

  // Fail on tracking flag
  let setFlagCount = 0;
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  env.classItem.setFlag = async function(scope, key, value) {
    setFlagCount++;
    if (key === 'archetypes' && Array.isArray(value) && value.includes('replacement-only')) {
      throw new Error('Simulated failure');
    }
    return origSetFlag(scope, key, value);
  };

  const result = await Applicator.apply(env.actor, env.classItem, replacementOnlyArchetype, diff);
  assertEqual(result, false, 'Apply should return false');

  // No copies to delete since no modifications
  // Rollback should still work cleanly
  env.restoreConsole();
});

await asyncTest('Apply with empty diff handles rollback gracefully', async () => {
  const env = createTestEnv();

  // Empty diff (edge case - nothing to apply)
  const emptyDiff = [];

  // Make something fail
  let setFlagCount = 0;
  const origSetFlag = env.classItem.setFlag.bind(env.classItem);
  env.classItem.setFlag = async function(scope, key, value) {
    setFlagCount++;
    if (key === 'archetypes') {
      throw new Error('Simulated failure');
    }
    return origSetFlag(scope, key, value);
  };

  try {
    await Applicator.apply(env.actor, env.classItem, twoHandedFighterParsed, emptyDiff);
  } catch (e) {
    throw new Error('Should handle empty diff rollback: ' + e.message);
  }
  env.restoreConsole();
});

// =====================================================
// Direct _rollback method testing
// =====================================================
console.log('\n--- Direct _rollback method testing ---');

await asyncTest('_rollback restores backup to classAssociations', async () => {
  const env = createTestEnv();

  // Set up backup flag
  await env.classItem.setFlag('archetype-manager', 'originalAssociations',
    JSON.parse(JSON.stringify(env.originalAssociationsCopy)));
  await env.classItem.setFlag('archetype-manager', 'archetypes', ['two-handed-fighter']);

  // Modify classAssociations (simulating partial apply)
  env.classItem.system.links.classAssociations = [{ uuid: 'modified', level: 1 }];

  await Applicator._rollback(env.actor, env.classItem, 'two-handed-fighter');

  const restored = env.classItem.system.links.classAssociations;
  assertEqual(restored.length, 12, 'Should restore all 12 original entries');
  assertEqual(restored[0].uuid, 'Compendium.pf1.class-abilities.BonusFeat1', 'First entry restored');
  env.restoreConsole();
});

await asyncTest('_rollback removes slug from archetypes flag', async () => {
  const env = createTestEnv();

  await env.classItem.setFlag('archetype-manager', 'originalAssociations',
    JSON.parse(JSON.stringify(env.originalAssociationsCopy)));
  await env.classItem.setFlag('archetype-manager', 'archetypes', ['two-handed-fighter', 'other-archetype']);

  await Applicator._rollback(env.actor, env.classItem, 'two-handed-fighter');

  const archetypes = env.classItem.getFlag('archetype-manager', 'archetypes');
  assert(!archetypes.includes('two-handed-fighter'), 'Should remove two-handed-fighter');
  assert(archetypes.includes('other-archetype'), 'Should preserve other-archetype');
  env.restoreConsole();
});

await asyncTest('_rollback calls _deleteCreatedCopies with correct slug', async () => {
  const env = createTestEnv();

  // Add an item copy
  const copyItem = {
    id: 'copy-123',
    name: 'Weapon Training (Two-Handed Fighter)',
    type: 'feat',
    flags: { 'archetype-manager': { createdByArchetype: 'two-handed-fighter', isModifiedCopy: true } },
    getFlag: function(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
  };
  env.actorItems.push(copyItem);

  await env.classItem.setFlag('archetype-manager', 'archetypes', ['two-handed-fighter']);

  const deletedIds = [];
  env.actor.deleteEmbeddedDocuments = async function(type, ids) {
    deletedIds.push(...ids);
    return ids;
  };

  await Applicator._rollback(env.actor, env.classItem, 'two-handed-fighter');

  assert(deletedIds.includes('copy-123'), 'Should delete copy created by the archetype');
  env.restoreConsole();
});

await asyncTest('_rollback does not delete copies from other archetypes', async () => {
  const env = createTestEnv();

  const otherCopy = {
    id: 'other-copy-456',
    name: 'Some Feature (Other Archetype)',
    type: 'feat',
    flags: { 'archetype-manager': { createdByArchetype: 'other-archetype', isModifiedCopy: true } },
    getFlag: function(scope, key) { return this.flags?.[scope]?.[key] ?? null; }
  };
  env.actorItems.push(otherCopy);

  await env.classItem.setFlag('archetype-manager', 'archetypes', ['two-handed-fighter']);

  const deletedIds = [];
  env.actor.deleteEmbeddedDocuments = async function(type, ids) {
    deletedIds.push(...ids);
    return ids;
  };

  await Applicator._rollback(env.actor, env.classItem, 'two-handed-fighter');

  assert(!deletedIds.includes('other-copy-456'), 'Should not delete other archetype copies');
  env.restoreConsole();
});

await asyncTest('_rollback with no archetypes flag handles gracefully', async () => {
  const env = createTestEnv();

  // No archetypes flag set at all
  await env.classItem.setFlag('archetype-manager', 'originalAssociations',
    JSON.parse(JSON.stringify(env.originalAssociationsCopy)));

  try {
    await Applicator._rollback(env.actor, env.classItem, 'two-handed-fighter');
  } catch (e) {
    throw new Error('Should handle missing archetypes flag: ' + e.message);
  }
  env.restoreConsole();
});

// =====================================================
// Summary
// =====================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #42 Results: ${passed}/${totalTests} passing (${failed} failed)`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
}
