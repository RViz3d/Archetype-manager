/**
 * Test Suite for Feature #22: CRUD operations on JE missing section
 *
 * Tests Create, Read, Update, Delete operations on the JournalEntry
 * "missing" section, and verifies GM-only access control.
 *
 * Uses mock FoundryVTT environment since no live Foundry instance is available.
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function testAsync(name, fn) {
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

// =====================================================
// Setup: Initialize mock environment and module
// =====================================================
console.log('\n=== Feature #22: CRUD operations on JE missing section ===\n');

const { hooks } = setupMockEnvironment();

// Import module to register hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import JournalEntryDB
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// Verify JE DB exists before tests
const jeDb = game.journal.getName('Archetype Manager DB');
assert(jeDb, 'Archetype Manager DB must exist before running tests');

// =====================================================
// Step 1: Create missing entry with archetype data
// =====================================================

await testAsync('Step 1: Create missing entry with archetype data', async () => {
  const entry = {
    class: 'ranger',
    features: {
      'divine-tracker': {
        level: 1,
        replaces: 'wild empathy',
        description: 'A divine tracker trades an animal companion for access to divine tracking.'
      },
      'blessings': {
        level: 4,
        replaces: 'hunter\'s bond',
        description: 'The divine tracker gains a minor blessing at 4th level.'
      },
      'divine-pursuance': {
        level: 12,
        replaces: 'camouflage',
        description: 'At 12th level, the divine tracker gains divine pursuance.'
      }
    }
  };

  const result = await JournalEntryDB.setArchetype('missing', 'divine-tracker', entry);
  assert(result === true, 'setArchetype should return true for GM user');
});

// =====================================================
// Step 2: Read section and verify
// =====================================================

await testAsync('Step 2: Read missing section and verify entry exists', async () => {
  const data = await JournalEntryDB.readSection('missing');
  assert(data['divine-tracker'], 'divine-tracker archetype should exist in missing section');
  assertEqual(data['divine-tracker'].class, 'ranger', 'Class should be ranger');

  // Verify feature count
  const featureKeys = Object.keys(data['divine-tracker'].features);
  assertEqual(featureKeys.length, 3, 'Should have 3 features');

  // Verify specific feature data
  const divineTrackerFeature = data['divine-tracker'].features['divine-tracker'];
  assertEqual(divineTrackerFeature.level, 1, 'divine-tracker feature level should be 1');
  assertEqual(divineTrackerFeature.replaces, 'wild empathy', 'Should replace wild empathy');

  const blessingsFeature = data['divine-tracker'].features['blessings'];
  assertEqual(blessingsFeature.level, 4, 'blessings feature level should be 4');
  assertEqual(blessingsFeature.replaces, 'hunter\'s bond', 'Should replace hunter\'s bond');
});

await testAsync('Step 2b: getArchetype returns correct data with section tag', async () => {
  const result = await JournalEntryDB.getArchetype('divine-tracker');
  assert(result, 'getArchetype should find divine-tracker');
  assertEqual(result._section, 'missing', 'Should come from missing section');
  assertEqual(result.class, 'ranger', 'Class should be ranger');
});

// =====================================================
// Step 3: Update a feature within the entry
// =====================================================

await testAsync('Step 3: Update a feature in the missing entry', async () => {
  // Read current entry
  const data = await JournalEntryDB.readSection('missing');
  const entry = data['divine-tracker'];

  // Update blessings feature level from 4 to 5
  entry.features['blessings'].level = 5;
  entry.features['blessings'].description = 'Updated: The divine tracker gains a minor blessing at 5th level.';

  // Add a new feature to the entry
  entry.features['aligned-weapon'] = {
    level: 8,
    replaces: 'swift tracker',
    description: 'At 8th level, the divine tracker treats her weapon as aligned.'
  };

  const result = await JournalEntryDB.setArchetype('missing', 'divine-tracker', entry);
  assert(result === true, 'setArchetype update should return true');
});

// =====================================================
// Step 4: Read and verify update
// =====================================================

await testAsync('Step 4: Read and verify the update was saved correctly', async () => {
  const data = await JournalEntryDB.readSection('missing');
  const entry = data['divine-tracker'];

  assert(entry, 'divine-tracker entry should still exist');
  assertEqual(entry.class, 'ranger', 'Class should still be ranger');

  // Verify updated feature
  assertEqual(entry.features['blessings'].level, 5, 'Blessings level should be updated to 5');
  assert(entry.features['blessings'].description.includes('Updated:'), 'Description should be updated');

  // Verify new feature was added
  assert(entry.features['aligned-weapon'], 'aligned-weapon feature should exist');
  assertEqual(entry.features['aligned-weapon'].level, 8, 'aligned-weapon level should be 8');
  assertEqual(entry.features['aligned-weapon'].replaces, 'swift tracker', 'Should replace swift tracker');

  // Verify total feature count
  const featureKeys = Object.keys(entry.features);
  assertEqual(featureKeys.length, 4, 'Should now have 4 features');
});

await testAsync('Step 4b: Can add a second archetype to missing section', async () => {
  const entry = {
    class: 'wizard',
    features: {
      'shadow-casting': {
        level: 1,
        replaces: 'arcane bond',
        description: 'Shadow adepts cast with shadow magic.'
      }
    }
  };

  const result = await JournalEntryDB.setArchetype('missing', 'shadow-adept', entry);
  assert(result === true, 'setArchetype should succeed for second entry');

  // Verify both archetypes exist
  const data = await JournalEntryDB.readSection('missing');
  assert(data['divine-tracker'], 'divine-tracker should still exist');
  assert(data['shadow-adept'], 'shadow-adept should now exist');
  assertEqual(Object.keys(data).length, 2, 'Should have 2 archetypes in missing section');
});

// =====================================================
// Step 5: Delete entry
// =====================================================

await testAsync('Step 5: Delete an entry from the missing section', async () => {
  const result = await JournalEntryDB.deleteArchetype('missing', 'shadow-adept');
  assert(result === true, 'deleteArchetype should return true');
});

// =====================================================
// Step 6: Verify removal
// =====================================================

await testAsync('Step 6: Verify deleted entry is gone', async () => {
  const data = await JournalEntryDB.readSection('missing');
  assert(!data['shadow-adept'], 'shadow-adept should be deleted');

  // Verify other entry is untouched
  assert(data['divine-tracker'], 'divine-tracker should still exist');
  assertEqual(data['divine-tracker'].class, 'ranger', 'divine-tracker class should still be ranger');
});

await testAsync('Step 6b: getArchetype returns null for deleted entry', async () => {
  const result = await JournalEntryDB.getArchetype('shadow-adept');
  assert(!result, 'getArchetype should return null for deleted entry');
});

await testAsync('Step 6c: Delete remaining entry and verify section is empty', async () => {
  await JournalEntryDB.deleteArchetype('missing', 'divine-tracker');

  const data = await JournalEntryDB.readSection('missing');
  assertEqual(Object.keys(data).length, 0, 'Missing section should be empty after deleting all entries');
});

// =====================================================
// Step 7: Verify GM-only access
// =====================================================

await testAsync('Step 7a: Non-GM user cannot write to missing section', async () => {
  // Switch to non-GM user
  game.user.isGM = false;

  const entry = {
    class: 'fighter',
    features: {
      'test-feature': { level: 1, replaces: 'bravery', description: 'Test' }
    }
  };

  const result = await JournalEntryDB.setArchetype('missing', 'gm-test', entry);
  assert(result === false, 'setArchetype should return false for non-GM user');

  // Verify entry was NOT written
  // Need to switch back to GM to read
  game.user.isGM = true;
  const data = await JournalEntryDB.readSection('missing');
  assert(!data['gm-test'], 'Entry should not exist when created by non-GM');
});

await testAsync('Step 7b: Non-GM user cannot delete from missing section', async () => {
  // First, create an entry as GM
  game.user.isGM = true;
  await JournalEntryDB.setArchetype('missing', 'gm-delete-test', {
    class: 'fighter',
    features: { 'test': { level: 1, replaces: null, description: 'Test' } }
  });

  // Try to delete as non-GM
  game.user.isGM = false;
  const result = await JournalEntryDB.deleteArchetype('missing', 'gm-delete-test');
  assert(result === false, 'deleteArchetype should return false for non-GM');

  // Verify entry still exists
  game.user.isGM = true;
  const data = await JournalEntryDB.readSection('missing');
  assert(data['gm-delete-test'], 'Entry should still exist after failed non-GM delete');

  // Clean up
  await JournalEntryDB.deleteArchetype('missing', 'gm-delete-test');
});

await testAsync('Step 7c: Non-GM user cannot write to missing via writeSection', async () => {
  // Try writeSection directly as non-GM
  game.user.isGM = false;
  const result = await JournalEntryDB.writeSection('missing', { 'hacked': { class: 'fighter' } });
  assert(result === false, 'writeSection should return false for non-GM user on missing section');

  // Verify nothing was written
  game.user.isGM = true;
  const data = await JournalEntryDB.readSection('missing');
  assert(!data['hacked'], 'hacked entry should not exist');
});

await testAsync('Step 7d: Non-GM user CAN read missing section', async () => {
  // Create data as GM
  game.user.isGM = true;
  await JournalEntryDB.setArchetype('missing', 'readable-test', {
    class: 'cleric',
    features: { 'test': { level: 1, replaces: null, description: 'Test' } }
  });

  // Read as non-GM (should work — reading is allowed)
  game.user.isGM = false;
  const data = await JournalEntryDB.readSection('missing');
  assert(data['readable-test'], 'Non-GM should be able to read missing section');
  assertEqual(data['readable-test'].class, 'cleric', 'Data should be correct');

  // Clean up as GM
  game.user.isGM = true;
  await JournalEntryDB.deleteArchetype('missing', 'readable-test');
});

await testAsync('Step 7e: GM user retains full access to missing section', async () => {
  game.user.isGM = true;

  // Create
  const createResult = await JournalEntryDB.setArchetype('missing', 'gm-full-test', {
    class: 'paladin',
    features: { 'smite': { level: 1, replaces: null, description: 'Smite evil' } }
  });
  assert(createResult === true, 'GM should create successfully');

  // Read
  const readData = await JournalEntryDB.readSection('missing');
  assert(readData['gm-full-test'], 'GM should read successfully');

  // Update
  readData['gm-full-test'].features['smite'].level = 2;
  const updateResult = await JournalEntryDB.writeSection('missing', readData);
  assert(updateResult === true, 'GM should update successfully');

  // Verify update
  const updatedData = await JournalEntryDB.readSection('missing');
  assertEqual(updatedData['gm-full-test'].features['smite'].level, 2, 'Update should persist');

  // Delete
  const deleteResult = await JournalEntryDB.deleteArchetype('missing', 'gm-full-test');
  assert(deleteResult === true, 'GM should delete successfully');

  // Verify deletion
  const afterDelete = await JournalEntryDB.readSection('missing');
  assert(!afterDelete['gm-full-test'], 'Entry should be gone after GM delete');
});

// =====================================================
// Additional edge-case tests
// =====================================================

await testAsync('Persists across simulated reload', async () => {
  game.user.isGM = true;

  // Write data
  const uniqueKey = `RESTART_TEST_${Date.now()}`;
  await JournalEntryDB.setArchetype('missing', uniqueKey, {
    class: 'bard',
    features: { 'bardic-performance': { level: 1, replaces: null, description: 'Perform' } }
  });

  // Verify
  const before = await JournalEntryDB.getArchetype(uniqueKey);
  assert(before, 'Should exist before reload');
  assertEqual(before.class, 'bard');

  // Simulate reload
  resetMockEnvironment();
  game.user.isGM = true;

  // Verify persistence
  const after = await JournalEntryDB.getArchetype(uniqueKey);
  assert(after, `${uniqueKey} should persist after reload`);
  assertEqual(after.class, 'bard', 'Data should be intact');
  assertEqual(after._section, 'missing', 'Should still be in missing section');

  // Clean up
  await JournalEntryDB.deleteArchetype('missing', uniqueKey);
});

await testAsync('Invalid section name throws error', async () => {
  game.user.isGM = true;

  let threw = false;
  try {
    await JournalEntryDB.readSection('invalid');
  } catch (e) {
    threw = true;
    assert(e.message.includes('Invalid section'), 'Error message should mention invalid section');
  }
  assert(threw, 'readSection with invalid section should throw');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
