/**
 * Test Suite for Features #21, #23, #24
 *
 * Feature #21: CRUD operations on JE fixes section
 * Feature #23: CRUD operations on JE custom section
 * Feature #24: JE data validation handles corrupted JSON
 *
 * Uses mock FoundryVTT environment since no live Foundry instance is available.
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';

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

async function testAsync(name, fn) {
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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(message || `Expected ${e}, got ${a}`);
  }
}

// =====================================================
// SETUP: Initialize mock environment and module
// =====================================================
const { hooks } = setupMockEnvironment();
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// Verify setup
const setupJE = game.journal.getName('Archetype Manager DB');
if (!setupJE) {
  console.error('FATAL: JournalEntry database was not created during setup');
  process.exit(1);
}
console.log('Setup complete: JournalEntry database created\n');

// =====================================================
// FEATURE #21: CRUD operations on JE fixes section
// =====================================================
console.log('=== Feature #21: CRUD operations on JE fixes section ===\n');

// Step 1: Create fix entry with archetype data
await testAsync('Step 1: Create fix entry with archetype data', async () => {
  const entry = {
    class: 'fighter',
    features: {
      'shattering-strike': {
        level: 2,
        replaces: 'bravery',
        description: 'The two-handed fighter gains a +1 bonus on attack rolls...'
      },
      'overhand-chop': {
        level: 3,
        replaces: 'armor-training-1',
        description: 'At 3rd level, when a two-handed fighter makes a single attack...'
      }
    }
  };

  const success = await JournalEntryDB.setArchetype('fixes', 'two-handed-fighter', entry);
  assert(success === true, 'setArchetype should return true on success');
});

// Step 2: Read fixes section and verify
await testAsync('Step 2: Read fixes section and verify entry exists', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  assert(data['two-handed-fighter'], 'two-handed-fighter should exist in fixes section');
  assertEqual(data['two-handed-fighter'].class, 'fighter', 'Class should be fighter');
  assert(data['two-handed-fighter'].features['shattering-strike'], 'shattering-strike feature should exist');
  assertEqual(data['two-handed-fighter'].features['shattering-strike'].level, 2, 'Level should be 2');
  assertEqual(data['two-handed-fighter'].features['shattering-strike'].replaces, 'bravery', 'Should replace bravery');
  assert(data['two-handed-fighter'].features['overhand-chop'], 'overhand-chop feature should exist');
  assertEqual(data['two-handed-fighter'].features['overhand-chop'].level, 3, 'Level should be 3');
});

// Step 3: Update entry (change level)
await testAsync('Step 3: Update entry (change level for shattering-strike)', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  const entry = data['two-handed-fighter'];

  // Update the level of shattering-strike
  entry.features['shattering-strike'].level = 4;

  // Add a new feature
  entry.features['backswing'] = {
    level: 7,
    replaces: 'armor-training-2',
    description: 'At 7th level, when a two-handed fighter makes a full-attack...'
  };

  const success = await JournalEntryDB.setArchetype('fixes', 'two-handed-fighter', entry);
  assert(success === true, 'setArchetype update should return true');
});

// Step 4: Read and verify update
await testAsync('Step 4: Read and verify update applied correctly', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  const entry = data['two-handed-fighter'];

  assertEqual(entry.features['shattering-strike'].level, 4, 'Level should be updated to 4');
  assert(entry.features['backswing'], 'backswing feature should now exist');
  assertEqual(entry.features['backswing'].level, 7, 'Backswing level should be 7');
  assertEqual(entry.features['backswing'].replaces, 'armor-training-2', 'Should replace armor-training-2');

  // Verify original data still intact
  assertEqual(entry.class, 'fighter', 'Class should still be fighter');
  assert(entry.features['overhand-chop'], 'overhand-chop should still exist');
});

// Step 5: Delete entry
await testAsync('Step 5: Delete entry from fixes section', async () => {
  const success = await JournalEntryDB.deleteArchetype('fixes', 'two-handed-fighter');
  assert(success === true, 'deleteArchetype should return true');
});

// Step 6: Read and verify deletion
await testAsync('Step 6: Read and verify deletion completed', async () => {
  const data = await JournalEntryDB.readSection('fixes');
  assert(!data['two-handed-fighter'], 'two-handed-fighter should not exist after deletion');

  // Also verify via getArchetype
  const result = await JournalEntryDB.getArchetype('two-handed-fighter');
  assert(!result, 'getArchetype should return null after deletion');
});

// Step 7: Verify all ops use JournalEntryPage.update()
await testAsync('Step 7: Verify all ops use JournalEntryPage.update()', async () => {
  // Trace the actual page update by monitoring the JE page
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');

  // Write data through API
  const testEntry = { class: 'rogue', features: {} };
  await JournalEntryDB.setArchetype('fixes', 'test-trace', testEntry);

  // Read directly from the page to confirm it was written via update
  const rawContent = fixesPage.text.content;
  const parsed = JSON.parse(rawContent);
  assert(parsed['test-trace'], 'Data should be written to the actual JE page via update()');
  assertEqual(parsed['test-trace'].class, 'rogue', 'Data should match what was written');

  // Clean up
  await JournalEntryDB.deleteArchetype('fixes', 'test-trace');
});

// Step 8: Verify no data corruption
await testAsync('Step 8: Verify no data corruption after multiple CRUD operations', async () => {
  // Create multiple entries
  await JournalEntryDB.setArchetype('fixes', 'archetype-a', {
    class: 'wizard', features: { 'arcane-bond': { level: 1, replaces: null } }
  });
  await JournalEntryDB.setArchetype('fixes', 'archetype-b', {
    class: 'cleric', features: { 'channel-energy': { level: 1, replaces: null } }
  });
  await JournalEntryDB.setArchetype('fixes', 'archetype-c', {
    class: 'fighter', features: { 'bonus-feat': { level: 1, replaces: null } }
  });

  // Verify all exist
  let data = await JournalEntryDB.readSection('fixes');
  assert(data['archetype-a'], 'archetype-a should exist');
  assert(data['archetype-b'], 'archetype-b should exist');
  assert(data['archetype-c'], 'archetype-c should exist');

  // Delete middle one
  await JournalEntryDB.deleteArchetype('fixes', 'archetype-b');

  // Verify remaining entries are intact
  data = await JournalEntryDB.readSection('fixes');
  assert(data['archetype-a'], 'archetype-a should still exist');
  assert(!data['archetype-b'], 'archetype-b should be deleted');
  assert(data['archetype-c'], 'archetype-c should still exist');
  assertEqual(data['archetype-a'].class, 'wizard', 'archetype-a class should be intact');
  assertEqual(data['archetype-c'].class, 'fighter', 'archetype-c class should be intact');

  // Update one
  data['archetype-a'].features['arcane-bond'].level = 5;
  await JournalEntryDB.setArchetype('fixes', 'archetype-a', data['archetype-a']);

  // Verify update didn't corrupt anything
  data = await JournalEntryDB.readSection('fixes');
  assertEqual(data['archetype-a'].features['arcane-bond'].level, 5, 'Level should be updated');
  assert(data['archetype-c'], 'archetype-c should still exist after sibling update');

  // Clean up all
  await JournalEntryDB.deleteArchetype('fixes', 'archetype-a');
  await JournalEntryDB.deleteArchetype('fixes', 'archetype-c');

  data = await JournalEntryDB.readSection('fixes');
  assertEqual(Object.keys(data).length, 0, 'Fixes section should be empty after cleanup');
});

// Additional: Verify getArchetype returns fixes section data
await testAsync('getArchetype returns fix entry from fixes section', async () => {
  await JournalEntryDB.setArchetype('fixes', 'get-test', {
    class: 'paladin', features: { 'smite-evil': { level: 1, replaces: null } }
  });

  const result = await JournalEntryDB.getArchetype('get-test');
  assert(result, 'Should find the archetype');
  assertEqual(result._section, 'fixes', 'Should come from fixes section');
  assertEqual(result.class, 'paladin', 'Class should be paladin');

  // Clean up
  await JournalEntryDB.deleteArchetype('fixes', 'get-test');
});

// =====================================================
// FEATURE #23: CRUD operations on JE custom section
// =====================================================
console.log('\n=== Feature #23: CRUD operations on JE custom section ===\n');

// Step 1: Create custom homebrew entry
await testAsync('Step 1: Create custom homebrew entry', async () => {
  const entry = {
    class: 'fighter',
    features: {
      'shield-bash-expert': {
        level: 2,
        replaces: 'bravery',
        description: 'A homebrew feature that replaces bravery with shield bash expertise'
      },
      'fortified-stance': {
        level: 5,
        replaces: null,
        description: 'Additive homebrew feature for defensive stance'
      }
    }
  };

  const success = await JournalEntryDB.setArchetype('custom', 'homebrew-shield-master', entry);
  assert(success === true, 'setArchetype should return true for custom section');
});

// Step 2: Read section and verify
await testAsync('Step 2: Read custom section and verify entry exists', async () => {
  const data = await JournalEntryDB.readSection('custom');
  assert(data['homebrew-shield-master'], 'homebrew-shield-master should exist in custom section');
  assertEqual(data['homebrew-shield-master'].class, 'fighter', 'Class should be fighter');
  assert(data['homebrew-shield-master'].features['shield-bash-expert'], 'shield-bash-expert should exist');
  assertEqual(data['homebrew-shield-master'].features['shield-bash-expert'].level, 2);
  assertEqual(data['homebrew-shield-master'].features['shield-bash-expert'].replaces, 'bravery');
  assert(data['homebrew-shield-master'].features['fortified-stance'], 'fortified-stance should exist');
  assertEqual(data['homebrew-shield-master'].features['fortified-stance'].replaces, null, 'Additive feature has null replaces');
});

// Step 3: Update feature list
await testAsync('Step 3: Update feature list (add new feature, modify existing)', async () => {
  const data = await JournalEntryDB.readSection('custom');
  const entry = data['homebrew-shield-master'];

  // Modify existing feature
  entry.features['shield-bash-expert'].level = 3;
  entry.features['shield-bash-expert'].description = 'Updated description for shield bash expertise';

  // Add new feature
  entry.features['shield-wall'] = {
    level: 9,
    replaces: 'weapon-training-2',
    description: 'Creates a defensive shield wall'
  };

  // Remove a feature
  delete entry.features['fortified-stance'];

  const success = await JournalEntryDB.setArchetype('custom', 'homebrew-shield-master', entry);
  assert(success === true, 'Update should succeed');
});

// Step 4: Read and verify
await testAsync('Step 4: Read and verify feature list update', async () => {
  const data = await JournalEntryDB.readSection('custom');
  const entry = data['homebrew-shield-master'];

  // Verify modified feature
  assertEqual(entry.features['shield-bash-expert'].level, 3, 'Level should be updated to 3');
  assert(entry.features['shield-bash-expert'].description.includes('Updated'), 'Description should be updated');

  // Verify added feature
  assert(entry.features['shield-wall'], 'shield-wall should exist');
  assertEqual(entry.features['shield-wall'].level, 9);
  assertEqual(entry.features['shield-wall'].replaces, 'weapon-training-2');

  // Verify removed feature
  assert(!entry.features['fortified-stance'], 'fortified-stance should no longer exist');
});

// Step 5: Delete entry
await testAsync('Step 5: Delete custom entry', async () => {
  const success = await JournalEntryDB.deleteArchetype('custom', 'homebrew-shield-master');
  assert(success === true, 'deleteArchetype should return true');
});

// Step 6: Verify removal
await testAsync('Step 6: Verify removal of custom entry', async () => {
  const data = await JournalEntryDB.readSection('custom');
  assert(!data['homebrew-shield-master'], 'homebrew-shield-master should not exist after deletion');

  const result = await JournalEntryDB.getArchetype('homebrew-shield-master');
  assert(!result, 'getArchetype should return null for deleted custom entry');
});

// Step 7: Verify players can write to custom section
await testAsync('Step 7: Verify players can write to custom section', async () => {
  // Switch to player mode
  game.user.isGM = false;

  const entry = {
    class: 'ranger',
    features: {
      'beast-companion': {
        level: 4,
        replaces: 'hunters-bond',
        description: 'Player-created custom archetype feature'
      }
    }
  };

  const success = await JournalEntryDB.setArchetype('custom', 'player-homebrew', entry);
  assert(success === true, 'Player should be able to write to custom section');

  // Verify it was written
  const data = await JournalEntryDB.readSection('custom');
  assert(data['player-homebrew'], 'Player custom entry should exist');
  assertEqual(data['player-homebrew'].class, 'ranger');

  // Clean up
  await JournalEntryDB.deleteArchetype('custom', 'player-homebrew');

  // Restore GM mode
  game.user.isGM = true;
});

// Additional: Verify players CANNOT write to fixes section (GM-only)
await testAsync('Players cannot write to fixes section (GM-only)', async () => {
  // Switch to player mode
  game.user.isGM = false;

  const entry = { class: 'fighter', features: {} };
  const success = await JournalEntryDB.setArchetype('fixes', 'player-fix-attempt', entry);
  assert(success === false, 'Player should not be able to write to fixes section');

  // Verify it was NOT written
  game.user.isGM = true;
  const data = await JournalEntryDB.readSection('fixes');
  assert(!data['player-fix-attempt'], 'Player fix attempt should not exist');
});

// Additional: Verify players CANNOT write to missing section (GM-only)
await testAsync('Players cannot write to missing section (GM-only)', async () => {
  // Switch to player mode
  game.user.isGM = false;

  const entry = { class: 'wizard', features: {} };
  const success = await JournalEntryDB.setArchetype('missing', 'player-missing-attempt', entry);
  assert(success === false, 'Player should not be able to write to missing section');

  // Verify it was NOT written
  game.user.isGM = true;
  const data = await JournalEntryDB.readSection('missing');
  assert(!data['player-missing-attempt'], 'Player missing attempt should not exist');
});

// Additional: Multiple custom entries don't interfere with each other
await testAsync('Multiple custom entries coexist without interference', async () => {
  await JournalEntryDB.setArchetype('custom', 'custom-1', { class: 'barbarian', features: {} });
  await JournalEntryDB.setArchetype('custom', 'custom-2', { class: 'bard', features: {} });
  await JournalEntryDB.setArchetype('custom', 'custom-3', { class: 'sorcerer', features: {} });

  let data = await JournalEntryDB.readSection('custom');
  assert(data['custom-1'] && data['custom-2'] && data['custom-3'], 'All three should exist');

  // Delete middle one
  await JournalEntryDB.deleteArchetype('custom', 'custom-2');

  data = await JournalEntryDB.readSection('custom');
  assert(data['custom-1'], 'custom-1 still exists');
  assert(!data['custom-2'], 'custom-2 deleted');
  assert(data['custom-3'], 'custom-3 still exists');
  assertEqual(data['custom-1'].class, 'barbarian');
  assertEqual(data['custom-3'].class, 'sorcerer');

  // Clean up
  await JournalEntryDB.deleteArchetype('custom', 'custom-1');
  await JournalEntryDB.deleteArchetype('custom', 'custom-3');
});

// =====================================================
// FEATURE #24: JE data validation handles corrupted JSON
// =====================================================
console.log('\n=== Feature #24: JE data validation handles corrupted JSON ===\n');

// Step 1: Set JE page content to invalid JSON
await testAsync('Step 1: Set JE page content to invalid JSON string', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');

  // Corrupt the page with invalid JSON
  await fixesPage.update({ 'text.content': '{ this is not valid JSON !!!' });

  // Verify it was corrupted
  const raw = fixesPage.text.content;
  let threw = false;
  try {
    JSON.parse(raw);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Page content should be invalid JSON');
});

// Step 2: Trigger module to read page (should not crash)
await testAsync('Step 2: readSection does not crash on corrupted JSON', async () => {
  // This should NOT throw - it should recover gracefully
  const data = await JournalEntryDB.readSection('fixes');
  assert(data !== undefined && data !== null, 'Should return a value (not undefined/null)');
});

// Step 3: Verify no crash, parse error caught
await testAsync('Step 3: readSection returns empty object for corrupted JSON', async () => {
  // First corrupt again for a fresh test
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');
  await fixesPage.update({ 'text.content': 'TOTALLY BROKEN JSON }{]' });

  const data = await JournalEntryDB.readSection('fixes');
  assertEqual(typeof data, 'object', 'Should return an object');
  assertEqual(Object.keys(data).length, 0, 'Should return empty object');
});

// Step 4: Verify page reset to valid empty JSON
await testAsync('Step 4: Corrupted page is reset to valid empty JSON after read', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');

  // After readSection triggered recovery, the page should now have valid JSON
  const rawContent = fixesPage.text.content;
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    throw new Error(`Page content should be valid JSON after recovery, but got: ${rawContent}`);
  }
  assertEqual(typeof parsed, 'object', 'Parsed content should be an object');
  assertEqual(Object.keys(parsed).length, 0, 'Should be empty object');
});

// Step 5: Verify warning notification shown
await testAsync('Step 5: Warning notification shown for corrupted JSON', async () => {
  // Track warning calls
  let warningCalled = false;
  const originalWarn = ui.notifications.warn;
  ui.notifications.warn = (msg) => {
    warningCalled = true;
    // Verify the message mentions corruption/reset
    assert(
      msg.includes('Corrupted') || msg.includes('corrupted') || msg.includes('reset'),
      `Warning message should mention corruption, got: ${msg}`
    );
    originalWarn(msg);
  };

  // Corrupt and trigger read
  const je = game.journal.getName('Archetype Manager DB');
  const customPage = je.pages.getName('custom');
  await customPage.update({ 'text.content': '<not json at all>' });

  await JournalEntryDB.readSection('custom');

  assert(warningCalled, 'ui.notifications.warn should have been called');

  // Restore
  ui.notifications.warn = originalWarn;
});

// Step 6: Verify subsequent reads return clean object
await testAsync('Step 6: Subsequent reads after recovery return clean data', async () => {
  // After step 5 recovery, reading again should work fine
  const data = await JournalEntryDB.readSection('custom');
  assertEqual(typeof data, 'object', 'Should be an object');
  assertEqual(Object.keys(data).length, 0, 'Should be empty');

  // And we should be able to write new data after recovery
  const success = await JournalEntryDB.setArchetype('custom', 'post-recovery-test', {
    class: 'fighter', features: {}
  });
  assert(success === true, 'Should be able to write after recovery');

  const data2 = await JournalEntryDB.readSection('custom');
  assert(data2['post-recovery-test'], 'New data should be readable after recovery');

  // Clean up
  await JournalEntryDB.deleteArchetype('custom', 'post-recovery-test');
});

// Additional corruption scenarios
await testAsync('Handles empty string content gracefully', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const missingPage = je.pages.getName('missing');
  await missingPage.update({ 'text.content': '' });

  const data = await JournalEntryDB.readSection('missing');
  assertEqual(typeof data, 'object', 'Should return object for empty string');
  // Empty string produces {} via the '||' fallback in readSection
  assertEqual(Object.keys(data).length, 0, 'Should return empty object');
});

await testAsync('Handles null-like content gracefully', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const missingPage = je.pages.getName('missing');
  await missingPage.update({ 'text.content': 'null' });

  // 'null' is valid JSON but not a useful object for our key/value storage
  // readSection should detect this and reset to empty object
  const data = await JournalEntryDB.readSection('missing');
  assertEqual(typeof data, 'object', 'Should return an object');
  assert(data !== null, 'Should not return null');
  assertEqual(Object.keys(data).length, 0, 'Should return empty object for null JSON');
});

await testAsync('Handles array JSON content gracefully', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const missingPage = je.pages.getName('missing');
  await missingPage.update({ 'text.content': '[1, 2, 3]' });

  // Arrays are valid JSON but not the expected object format
  const data = await JournalEntryDB.readSection('missing');
  assertEqual(typeof data, 'object', 'Should return an object');
  assert(!Array.isArray(data), 'Should not return an array');
  assertEqual(Object.keys(data).length, 0, 'Should return empty object for array JSON');
});

await testAsync('Handles primitive JSON content gracefully', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const missingPage = je.pages.getName('missing');
  await missingPage.update({ 'text.content': '42' });

  const data = await JournalEntryDB.readSection('missing');
  assertEqual(typeof data, 'object', 'Should return an object');
  assertEqual(Object.keys(data).length, 0, 'Should return empty object for primitive JSON');
});

await testAsync('Handles various corrupted JSON formats', async () => {
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');

  const corruptedValues = [
    'undefined',
    '{"incomplete": ',
    '[1, 2, 3',
    '<!-- HTML comment -->',
    '<?xml version="1.0"?>',
    'function() { return true; }',
  ];

  for (const corrupt of corruptedValues) {
    await fixesPage.update({ 'text.content': corrupt });
    const data = await JournalEntryDB.readSection('fixes');
    assertEqual(typeof data, 'object', `Should return object for corrupted: ${corrupt.slice(0, 20)}`);
    assertEqual(Object.keys(data).length, 0, `Should return empty for corrupted: ${corrupt.slice(0, 20)}`);
  }
});

await testAsync('Recovery does not affect other sections', async () => {
  // Write valid data to custom section
  await JournalEntryDB.setArchetype('custom', 'safe-data', {
    class: 'monk', features: { 'flurry': { level: 1, replaces: null } }
  });

  // Corrupt fixes section
  const je = game.journal.getName('Archetype Manager DB');
  const fixesPage = je.pages.getName('fixes');
  await fixesPage.update({ 'text.content': 'CORRUPT!!!' });

  // Read fixes (triggers recovery)
  const fixesData = await JournalEntryDB.readSection('fixes');
  assertEqual(Object.keys(fixesData).length, 0, 'Fixes should be recovered to empty');

  // Custom section should be unaffected
  const customData = await JournalEntryDB.readSection('custom');
  assert(customData['safe-data'], 'Custom section data should be unaffected');
  assertEqual(customData['safe-data'].class, 'monk', 'Custom data should be intact');

  // Clean up
  await JournalEntryDB.deleteArchetype('custom', 'safe-data');
});

await testAsync('Invalid section name throws error', async () => {
  let threw = false;
  try {
    await JournalEntryDB.readSection('invalid-section');
  } catch (e) {
    threw = true;
    assert(e.message.includes('Invalid section'), `Error should mention invalid section: ${e.message}`);
  }
  assert(threw, 'Should throw for invalid section name');
});

await testAsync('Data persists across simulated reload after corruption recovery', async () => {
  // Write some data
  await JournalEntryDB.setArchetype('fixes', 'reload-test', {
    class: 'druid', features: {}
  });

  // Simulate reload
  resetMockEnvironment();

  // Verify data persists
  const data = await JournalEntryDB.readSection('fixes');
  assert(data['reload-test'], 'Data should persist after reload');
  assertEqual(data['reload-test'].class, 'druid');

  // Clean up
  await JournalEntryDB.deleteArchetype('fixes', 'reload-test');
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
