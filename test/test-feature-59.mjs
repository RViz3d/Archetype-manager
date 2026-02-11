/**
 * Test Suite for Feature #59: Compendium load failure shows error notification
 *
 * Verifies that when compendium loading fails, users see clear error messages
 * with guidance, the module doesn't crash, and JE-only mode still works.
 *
 * Uses mock FoundryVTT environment since no live Foundry instance is available.
 */

import { setupMockEnvironment, resetMockEnvironment, createMockActor, createMockClassItem } from './foundry-mock.mjs';

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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(str, substr, message) {
  if (!str || !str.includes(substr)) {
    throw new Error(message || `Expected "${str}" to include "${substr}"`);
  }
}

// =====================================================
// Setup
// =====================================================

setupMockEnvironment();

// Register settings
game.settings.register('archetype-manager', 'lastSelectedClass', {
  name: 'Last Selected Class',
  scope: 'client',
  config: false,
  type: String,
  default: ''
});
game.settings.register('archetype-manager', 'showParseWarnings', {
  name: 'Show Parse Warnings',
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});

// Import modules after mock is set up
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

// Notification tracking
let lastWarnMsg = null;
let lastInfoMsg = null;
let lastErrorMsg = null;
let warnCount = 0;
let errorCount = 0;
let consoleErrors = [];
let consoleLogs = [];

function resetNotificationTracking() {
  lastWarnMsg = null;
  lastInfoMsg = null;
  lastErrorMsg = null;
  warnCount = 0;
  errorCount = 0;
  consoleErrors = [];
  consoleLogs = [];

  ui.notifications.warn = (msg) => {
    lastWarnMsg = msg;
    warnCount++;
  };
  ui.notifications.info = (msg) => {
    lastInfoMsg = msg;
  };
  ui.notifications.error = (msg) => {
    lastErrorMsg = msg;
    errorCount++;
  };

  const origLog = console.log;
  console.log = (...args) => {
    consoleLogs.push(args.join(' '));
  };

  console.error = (...args) => {
    consoleErrors.push(args.join(' '));
  };
}

function restoreConsole() {
  console.error = (...args) => {
    process.stderr.write(args.join(' ') + '\n');
  };
  console.log = (...args) => {
    process.stdout.write(args.join(' ') + '\n');
  };
}

// =====================================================
// FEATURE #59: Compendium load failure shows error notification
// =====================================================

console.log('\n=== Feature #59: Compendium load failure shows error notification ===\n');

// -----------------------------------------------------------
// Step 1: Simulate compendium access failure
// -----------------------------------------------------------

// Test 59.1: Pack throws error → error notification for archetype list
await testAsync('59.1: loadArchetypeList shows error notification when pack throws', async () => {
  resetNotificationTracking();

  // Module is active but pack throws an error
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Simulated compendium access failure'); }
  });

  const result = await CompendiumParser.loadArchetypeList();

  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array on failure');
  assert(lastErrorMsg !== null, 'Error notification should have been shown');
});

// Test 59.2: Pack throws error → error notification for features
await testAsync('59.2: loadArchetypeFeatures shows error notification when pack throws', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => { throw new Error('Simulated feature compendium failure'); }
  });

  const result = await CompendiumParser.loadArchetypeFeatures();

  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array on failure');
  assert(lastErrorMsg !== null, 'Error notification should have been shown');
});

// Test 59.3: Missing pack (null) → error notification
await testAsync('59.3: Missing pack (null) shows error notification', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.delete('pf1e-archetypes.pf-archetypes');

  const result = await CompendiumParser.loadArchetypeList();

  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array');
  assert(lastErrorMsg !== null, 'Error notification should have been shown for missing pack');
});

// -----------------------------------------------------------
// Step 2: Verify error notification appears
// -----------------------------------------------------------

// Test 59.4: Error notification contains relevant guidance text
await testAsync('59.4: Error notification message provides guidance', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Pack inaccessible'); }
  });

  await CompendiumParser.loadArchetypeList();

  assert(lastErrorMsg !== null, 'Error notification should exist');
  const lowerMsg = lastErrorMsg.toLowerCase();
  // Should mention the module or compendium or archetype
  assert(
    lowerMsg.includes('archetype') || lowerMsg.includes('compendium') || lowerMsg.includes('pf1e'),
    `Error message should reference archetypes or compendium. Got: "${lastErrorMsg}"`
  );
});

// Test 59.5: Error message mentions checking module status
await testAsync('59.5: Error message mentions checking module is enabled', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Pack inaccessible'); }
  });

  await CompendiumParser.loadArchetypeList();

  assert(lastErrorMsg !== null, 'Error notification should exist');
  const lowerMsg = lastErrorMsg.toLowerCase();
  assert(
    lowerMsg.includes('enabled') || lowerMsg.includes('check') || lowerMsg.includes('module'),
    `Error message should provide guidance about module. Got: "${lastErrorMsg}"`
  );
});

// Test 59.6: Error uses error level notification (not warn)
await testAsync('59.6: Error uses error-level notification (not warn)', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Pack inaccessible'); }
  });

  await CompendiumParser.loadArchetypeList();

  assert(errorCount > 0, 'Should use error-level notification');
  assertEqual(warnCount, 0, 'Should not use warn-level notification');
});

// -----------------------------------------------------------
// Step 3: Verify module doesn't crash
// -----------------------------------------------------------

// Test 59.7: Module doesn't crash on archetype list failure
await testAsync('59.7: loadArchetypeList returns gracefully (no throw)', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new TypeError('Cannot read property of null'); }
  });

  let didThrow = false;
  try {
    const result = await CompendiumParser.loadArchetypeList();
    assert(Array.isArray(result), 'Should still return an array');
  } catch (e) {
    didThrow = true;
  }
  assertEqual(didThrow, false, 'loadArchetypeList should not throw');
});

// Test 59.8: Module doesn't crash on archetype features failure
await testAsync('59.8: loadArchetypeFeatures returns gracefully (no throw)', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => { throw new RangeError('Index out of bounds'); }
  });

  let didThrow = false;
  try {
    const result = await CompendiumParser.loadArchetypeFeatures();
    assert(Array.isArray(result), 'Should still return an array');
  } catch (e) {
    didThrow = true;
  }
  assertEqual(didThrow, false, 'loadArchetypeFeatures should not throw');
});

// Test 59.9: Console.error is logged for debugging
await testAsync('59.9: Console.error logged on failure for debugging', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Specific error message for debug'); }
  });

  await CompendiumParser.loadArchetypeList();

  assert(consoleErrors.length > 0, 'Console.error should have been called for debugging');
  const errorOutput = consoleErrors.join(' ');
  assert(
    errorOutput.includes('archetype') || errorOutput.includes('Failed'),
    `Console error should describe the failure. Got: "${errorOutput}"`
  );
});

// Test 59.10: Error for archetype features also shows notification
await testAsync('59.10: loadArchetypeFeatures also shows error notification with guidance', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => { throw new Error('Features pack failure'); }
  });

  await CompendiumParser.loadArchetypeFeatures();

  assert(lastErrorMsg !== null, 'Error notification should appear');
  const lowerMsg = lastErrorMsg.toLowerCase();
  assert(
    lowerMsg.includes('archetype') || lowerMsg.includes('feature'),
    `Should mention archetype features. Got: "${lastErrorMsg}"`
  );
});

// -----------------------------------------------------------
// Step 4: Verify JE-only mode still works after failure
// -----------------------------------------------------------

// Test 59.11: JE database functional after compendium failure
await testAsync('59.11: JE database works after compendium failure', async () => {
  resetNotificationTracking();

  // Simulate compendium failure
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Compendium failure'); }
  });

  await CompendiumParser.loadArchetypeList();
  assert(lastErrorMsg !== null, 'Error notification shown');

  // Now verify JE still works
  resetNotificationTracking();

  const je = await JournalEntryDB.ensureDatabase();
  assert(je !== null, 'JE database should be available');

  await JournalEntryDB.setArchetype('custom', 'post-failure-test', {
    name: 'Post Failure Test',
    class: 'fighter'
  });

  const data = await JournalEntryDB.readSection('custom');
  assert(data['post-failure-test'] !== undefined, 'Should be able to write to JE after compendium failure');
  assertEqual(data['post-failure-test'].name, 'Post Failure Test', 'Data should be correct');

  // Cleanup
  await JournalEntryDB.deleteArchetype('custom', 'post-failure-test');
});

// Test 59.12: JE custom archetypes accessible after compendium failure
await testAsync('59.12: JE custom archetypes still accessible after failure', async () => {
  // Write data first
  await JournalEntryDB.setArchetype('custom', 'resilient-arch', {
    name: 'Resilient Archetype',
    class: 'rogue',
    features: { 'test-feat': { level: 2, replaces: null } }
  });

  // Simulate compendium failure
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('DB corruption'); }
  });

  resetNotificationTracking();
  await CompendiumParser.loadArchetypeList();

  // JE data should still be readable
  const result = await JournalEntryDB.getArchetype('resilient-arch');
  assert(result !== null, 'JE archetype should still be findable');
  assertEqual(result.name, 'Resilient Archetype', 'Name should match');
  assertEqual(result._section, 'custom', 'Should come from custom section');

  // Cleanup
  await JournalEntryDB.deleteArchetype('custom', 'resilient-arch');
});

// Test 59.13: All three JE sections work after compendium failure
await testAsync('59.13: All JE sections (fixes, missing, custom) work after failure', async () => {
  // Simulate compendium failure
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Total failure'); }
  });

  resetNotificationTracking();
  await CompendiumParser.loadArchetypeList();

  // All three sections should work
  const fixes = await JournalEntryDB.readSection('fixes');
  const missing = await JournalEntryDB.readSection('missing');
  const custom = await JournalEntryDB.readSection('custom');

  assert(typeof fixes === 'object', 'Fixes section should return object');
  assert(typeof missing === 'object', 'Missing section should return object');
  assert(typeof custom === 'object', 'Custom section should return object');
});

// Test 59.14: Successful load after failure recovery
await testAsync('59.14: Successful load works after prior failure (recovery)', async () => {
  resetNotificationTracking();

  // First: failure
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Temporary failure'); }
  });

  const failResult = await CompendiumParser.loadArchetypeList();
  assertEqual(failResult.length, 0, 'First call should fail');
  assert(lastErrorMsg !== null, 'Error shown on failure');

  // Second: success (pack fixed)
  resetNotificationTracking();
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => [
      { name: 'Recovery Archetype', system: { class: 'fighter' }, flags: {} }
    ]
  });

  const successResult = await CompendiumParser.loadArchetypeList();
  assertEqual(successResult.length, 1, 'Second call should succeed');
  assertEqual(successResult[0].name, 'Recovery Archetype', 'Should load the archetype');
  assertEqual(lastErrorMsg, null, 'No error on successful load');
});

// Test 59.15: Features pack failure independent of archetype list
await testAsync('59.15: Features pack failure independent of archetype list', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  // Archetype list works
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => [
      { name: 'Test Archetype', system: { class: 'fighter' }, flags: {} }
    ]
  });

  // Features pack fails
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => { throw new Error('Features only failure'); }
  });

  const archetypes = await CompendiumParser.loadArchetypeList();
  assertEqual(archetypes.length, 1, 'Archetype list should load successfully');

  resetNotificationTracking();
  const features = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(features.length, 0, 'Features should fail');
  assert(lastErrorMsg !== null, 'Error notification shown for features failure');

  // Both can fail independently without affecting each other
});

// Test 59.16: Multiple sequential failures each show separate notifications
await testAsync('59.16: Multiple failures show separate notifications', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Failure 1'); }
  });
  game.packs.set('pf1e-archetypes.pf-arch-features', {
    getDocuments: async () => { throw new Error('Failure 2'); }
  });

  await CompendiumParser.loadArchetypeList();
  await CompendiumParser.loadArchetypeFeatures();

  assertEqual(errorCount, 2, `Should have shown 2 error notifications, got ${errorCount}`);
});

// Test 59.17: Error notification includes module identifier
await testAsync('59.17: Error notification includes module identifier', async () => {
  resetNotificationTracking();

  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Identified failure'); }
  });

  await CompendiumParser.loadArchetypeList();

  assert(lastErrorMsg !== null, 'Error notification should appear');
  assert(
    lastErrorMsg.includes('Archetype Manager') || lastErrorMsg.includes('archetype-manager'),
    `Error should include module identifier. Got: "${lastErrorMsg}"`
  );
});

// Test 59.18: Module with absent module → no error, just console log (graceful degradation)
await testAsync('59.18: Absent module (not installed) → no error notification, just log', async () => {
  resetNotificationTracking();

  game.modules.delete('pf1e-archetypes');

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 0, 'Should return empty array');
  assertEqual(lastErrorMsg, null, 'No error notification for absent module (not a failure)');
  assertEqual(errorCount, 0, 'No errors for absent module');

  // Should log JE-only mode message
  const jeOnlyLog = consoleLogs.find(m => m.toLowerCase().includes('je-only') || m.toLowerCase().includes('not available'));
  assert(jeOnlyLog !== undefined, 'Should log JE-only mode message');
});

// Cleanup
restoreConsole();

// Restore module state
game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

// =====================================================
// RESULTS
// =====================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed}/${totalTests} tests passing (${failed} failed)`);
console.log('='.repeat(60));

console.log(`\nFeature #59 (Compendium load failure shows error notification): ${passed}/${totalTests}`);

if (failed > 0) {
  console.log(`\n${failed} tests failed!`);
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
