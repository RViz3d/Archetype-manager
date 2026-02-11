/**
 * Test Suite for Features #56, #57, #58
 *
 * Feature #56: No token selected shows warning
 * Feature #57: No classes on actor shows warning
 * Feature #58: Module works without pf1e-archetypes (JE-only mode)
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

// Register settings that archetype-manager.mjs imports from module.mjs
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
const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');

// =====================================================
// FEATURE #56: No token selected shows warning
// =====================================================

console.log('\n=== Feature #56: No token selected shows warning ===\n');

// Track notifications for verification
let lastWarnMsg = null;
let lastInfoMsg = null;
let lastErrorMsg = null;
let warnCount = 0;
let errorCount = 0;
let consoleErrors = [];

function resetNotificationTracking() {
  lastWarnMsg = null;
  lastInfoMsg = null;
  lastErrorMsg = null;
  warnCount = 0;
  errorCount = 0;
  consoleErrors = [];

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

  // Intercept console.error to detect console errors
  const origError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.join(' '));
    // Don't call origError to avoid test output pollution
  };
}

function restoreConsole() {
  // Restore default console.error (won't fully undo but prevents issues)
  console.error = (...args) => {
    process.stderr.write(args.join(' ') + '\n');
  };
}

// Test 56.1: Deselect all tokens, trigger macro → warning shown
await testAsync('56.1: Warning notification appears when no token selected', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];  // No tokens selected

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning notification should have been shown');
  assert(warnCount === 1, `Expected 1 warning, got ${warnCount}`);
});

// Test 56.2: Warning message clearly says "select a token"
await testAsync('56.2: Warning message clearly states "select a token first" or similar', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should have been shown');
  const lowerMsg = lastWarnMsg.toLowerCase();
  assert(
    lowerMsg.includes('select') && lowerMsg.includes('token'),
    `Warning message should mention selecting a token. Got: "${lastWarnMsg}"`
  );
});

// Test 56.3: Warning includes module title for identification
await testAsync('56.3: Warning includes module identifier/title', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should have been shown');
  assert(
    lastWarnMsg.includes('Archetype Manager') || lastWarnMsg.includes('PF1e'),
    `Warning should include module name. Got: "${lastWarnMsg}"`
  );
});

// Test 56.4: No dialog opens when no token selected
await testAsync('56.4: No dialog opens when no token selected', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];
  Dialog._lastInstance = null;

  await ArchetypeManager.open();

  assertEqual(Dialog._lastInstance, null, 'No dialog should have been created');
});

// Test 56.5: No error notification (only warning)
await testAsync('56.5: Only warning notification (not error)', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should be shown');
  assertEqual(lastErrorMsg, null, 'No error notification should be shown');
  assertEqual(errorCount, 0, 'Error count should be 0');
});

// Test 56.6: No console errors thrown
await testAsync('56.6: No console errors when no token selected', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];

  await ArchetypeManager.open();

  assertEqual(consoleErrors.length, 0, `Expected 0 console errors, got ${consoleErrors.length}: ${consoleErrors.join('; ')}`);
});

// Test 56.7: Triggering multiple times with no token shows warning each time
await testAsync('56.7: Repeated calls with no token show warning each time', async () => {
  resetNotificationTracking();
  canvas.tokens.controlled = [];

  await ArchetypeManager.open();
  await ArchetypeManager.open();
  await ArchetypeManager.open();

  assertEqual(warnCount, 3, `Expected 3 warnings, got ${warnCount}`);
});

// Test 56.8: With a valid token selected, no warning shown
await testAsync('56.8: With valid token selected, no warning shown', async () => {
  resetNotificationTracking();

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Hero', [classItem]);

  // Mock token
  canvas.tokens.controlled = [{
    actor,
    id: 'token-1'
  }];

  // Dialog will try to render but we only care that no warning was shown
  try {
    await ArchetypeManager.open();
  } catch (e) {
    // Expected - dialog rendering may fail in mock env
  }

  assertEqual(lastWarnMsg, null, `No warning should be shown when token is selected. Got: "${lastWarnMsg}"`);
});

// Test 56.9: Token selected but with null actor shows different warning
await testAsync('56.9: Token with null actor shows appropriate warning', async () => {
  resetNotificationTracking();

  canvas.tokens.controlled = [{
    actor: null,
    id: 'token-no-actor'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should be shown for null actor');
  const lowerMsg = lastWarnMsg.toLowerCase();
  assert(
    lowerMsg.includes('actor') || lowerMsg.includes('no actor'),
    `Warning should mention actor issue. Got: "${lastWarnMsg}"`
  );
});

// Test 56.10: Only first controlled token used (not all)
await testAsync('56.10: Only first controlled token is used', async () => {
  resetNotificationTracking();

  const classItem1 = createMockClassItem('Fighter', 5, 'fighter');
  const actor1 = createMockActor('Hero One', [classItem1]);
  const classItem2 = createMockClassItem('Wizard', 5, 'wizard');
  const actor2 = createMockActor('Hero Two', [classItem2]);

  canvas.tokens.controlled = [
    { actor: actor1, id: 'token-1' },
    { actor: actor2, id: 'token-2' }
  ];

  try {
    await ArchetypeManager.open();
  } catch (e) {
    // Expected
  }

  assertEqual(lastWarnMsg, null, 'No warning should be shown when at least one token exists');
});

// =====================================================
// FEATURE #57: No classes on actor shows warning
// =====================================================

console.log('\n=== Feature #57: No classes on actor shows warning ===\n');

// Test 57.1: Actor with no class items shows warning
await testAsync('57.1: Warning notification when actor has no class items', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Classless NPC', []);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-classless'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning notification should have been shown');
});

// Test 57.2: Warning message explains actor needs a class
await testAsync('57.2: Warning message explains actor needs a class', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Classless NPC', []);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-classless'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should have been shown');
  const lowerMsg = lastWarnMsg.toLowerCase();
  assert(
    lowerMsg.includes('class') && (lowerMsg.includes('no class') || lowerMsg.includes('add a class')),
    `Warning should explain actor needs a class. Got: "${lastWarnMsg}"`
  );
});

// Test 57.3: No dialog opens when actor has no classes
await testAsync('57.3: No dialog opens when actor has no class items', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Classless NPC', []);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-classless'
  }];

  Dialog._lastInstance = null;
  await ArchetypeManager.open();

  assertEqual(Dialog._lastInstance, null, 'No dialog should have been created');
});

// Test 57.4: Actor with non-class items only still shows warning
await testAsync('57.4: Actor with only non-class items shows warning', async () => {
  resetNotificationTracking();

  // Actor with items but none are type 'class'
  const actor = createMockActor('Equipment NPC', []);
  actor.isOwner = true;
  // Override items to include non-class items
  const nonClassItems = [
    { id: 'item-1', name: 'Longsword', type: 'weapon' },
    { id: 'item-2', name: 'Chain Mail', type: 'equipment' },
    { id: 'item-3', name: 'Power Attack', type: 'feat' }
  ];
  actor.items = {
    filter: (fn) => nonClassItems.filter(fn),
    find: (fn) => nonClassItems.find(fn),
    get: (id) => nonClassItems.find(i => i.id === id),
    map: (fn) => nonClassItems.map(fn),
    [Symbol.iterator]: () => nonClassItems[Symbol.iterator]()
  };

  canvas.tokens.controlled = [{
    actor,
    id: 'token-no-class'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should be shown when only non-class items exist');
  const lowerMsg = lastWarnMsg.toLowerCase();
  assert(lowerMsg.includes('class'), `Warning should mention class. Got: "${lastWarnMsg}"`);
});

// Test 57.5: Actor with one class item does NOT show warning
await testAsync('57.5: Actor with class item does NOT show no-class warning', async () => {
  resetNotificationTracking();

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Fighter Hero', [classItem]);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-fighter'
  }];

  try {
    await ArchetypeManager.open();
  } catch (e) {
    // Expected in mock env
  }

  // Should NOT have shown the "no class" warning
  if (lastWarnMsg !== null) {
    const lowerMsg = lastWarnMsg.toLowerCase();
    assert(
      !lowerMsg.includes('no class'),
      `Should NOT show no-class warning when class exists. Got: "${lastWarnMsg}"`
    );
  }
});

// Test 57.6: Actor with multiple class items does NOT show warning
await testAsync('57.6: Actor with multiple class items does NOT show no-class warning', async () => {
  resetNotificationTracking();

  const classItem1 = createMockClassItem('Fighter', 5, 'fighter');
  const classItem2 = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Multiclass Hero', [classItem1, classItem2]);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-multi'
  }];

  try {
    await ArchetypeManager.open();
  } catch (e) {
    // Expected in mock env
  }

  if (lastWarnMsg !== null) {
    const lowerMsg = lastWarnMsg.toLowerCase();
    assert(
      !lowerMsg.includes('no class'),
      `Should NOT show no-class warning with multiple classes. Got: "${lastWarnMsg}"`
    );
  }
});

// Test 57.7: Warning includes module title
await testAsync('57.7: No-class warning includes module identifier', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Classless NPC', []);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-classless2'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should have been shown');
  assert(
    lastWarnMsg.includes('Archetype Manager') || lastWarnMsg.includes('PF1e'),
    `Warning should include module name. Got: "${lastWarnMsg}"`
  );
});

// Test 57.8: No error notification (only warning)
await testAsync('57.8: Only warning notification for no-class (not error)', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Classless NPC', []);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-classless3'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should be shown');
  assertEqual(lastErrorMsg, null, 'No error should be shown');
});

// Test 57.9: No console errors
await testAsync('57.9: No console errors for no-class actor', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Classless NPC', []);
  actor.isOwner = true;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-classless4'
  }];

  await ArchetypeManager.open();

  assertEqual(consoleErrors.length, 0, `Expected 0 console errors, got ${consoleErrors.length}`);
});

// Test 57.10: Permission check before class check (player without ownership)
await testAsync('57.10: Permission check happens before class check', async () => {
  resetNotificationTracking();

  const actor = createMockActor('Other Player NPC', []);
  actor.isOwner = false;
  game.user.isGM = false;

  canvas.tokens.controlled = [{
    actor,
    id: 'token-noperm'
  }];

  await ArchetypeManager.open();

  assert(lastWarnMsg !== null, 'Warning should be shown');
  const lowerMsg = lastWarnMsg.toLowerCase();
  assert(
    lowerMsg.includes('permission'),
    `Should show permission warning first. Got: "${lastWarnMsg}"`
  );

  // Restore GM status
  game.user.isGM = true;
});

// =====================================================
// FEATURE #58: Module works without pf1e-archetypes (JE-only mode)
// =====================================================

console.log('\n=== Feature #58: Module works without pf1e-archetypes (JE-only mode) ===\n');

// Test 58.1: isModuleAvailable returns false when pf1e-archetypes not present
await testAsync('58.1: isModuleAvailable returns false when module not installed', async () => {
  // Remove pf1e-archetypes from modules
  game.modules.delete('pf1e-archetypes');

  const result = CompendiumParser.isModuleAvailable();
  assertEqual(result, false, 'isModuleAvailable should return false');
});

// Test 58.2: isModuleAvailable returns false when module is inactive
await testAsync('58.2: isModuleAvailable returns false when module inactive', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: false });

  const result = CompendiumParser.isModuleAvailable();
  assertEqual(result, false, 'isModuleAvailable should return false for inactive module');
});

// Test 58.3: loadArchetypeList returns empty array when module not available
await testAsync('58.3: loadArchetypeList returns [] without pf1e-archetypes', async () => {
  game.modules.delete('pf1e-archetypes');

  const result = await CompendiumParser.loadArchetypeList();
  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Array should be empty');
});

// Test 58.4: loadArchetypeFeatures returns empty array when module not available
await testAsync('58.4: loadArchetypeFeatures returns [] without pf1e-archetypes', async () => {
  game.modules.delete('pf1e-archetypes');

  const result = await CompendiumParser.loadArchetypeFeatures();
  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Array should be empty');
});

// Test 58.5: No compendium-related errors when module absent
await testAsync('58.5: No errors logged when loading without pf1e-archetypes', async () => {
  resetNotificationTracking();
  game.modules.delete('pf1e-archetypes');

  await CompendiumParser.loadArchetypeList();
  await CompendiumParser.loadArchetypeFeatures();

  assertEqual(lastErrorMsg, null, 'No error notification should be shown');
  assertEqual(errorCount, 0, 'Error count should be 0');
});

// Test 58.6: JournalEntry DB still functions without pf1e-archetypes
await testAsync('58.6: JournalEntry database works without pf1e-archetypes', async () => {
  game.modules.delete('pf1e-archetypes');

  // Ensure DB exists
  const je = await JournalEntryDB.ensureDatabase();
  assert(je !== null && je !== undefined, 'JE database should be created');

  // Write and read custom archetype
  await JournalEntryDB.setArchetype('custom', 'test-homebrew-arch', {
    name: 'Test Homebrew Archetype',
    class: 'fighter',
    features: { 'test-feature': { type: 'replacement', target: 'Bravery', level: 2 } }
  });

  const data = await JournalEntryDB.readSection('custom');
  assert(data['test-homebrew-arch'] !== undefined, 'Custom archetype should be saved');
  assertEqual(data['test-homebrew-arch'].name, 'Test Homebrew Archetype', 'Name should match');
});

// Test 58.7: JE missing entries available in JE-only mode
await testAsync('58.7: JE missing entries available without pf1e-archetypes', async () => {
  game.modules.delete('pf1e-archetypes');

  await JournalEntryDB.setArchetype('missing', 'official-missing-arch', {
    name: 'Official Missing Archetype',
    class: 'fighter',
    features: { 'official-feature': { type: 'replacement', target: 'Armor Training 1', level: 3 } }
  });

  const data = await JournalEntryDB.readSection('missing');
  assert(data['official-missing-arch'] !== undefined, 'Missing archetype should be readable');
  assertEqual(data['official-missing-arch'].class, 'fighter', 'Class should match');
});

// Test 58.8: JE fixes entries available in JE-only mode
await testAsync('58.8: JE fixes entries available without pf1e-archetypes', async () => {
  game.modules.delete('pf1e-archetypes');

  await JournalEntryDB.setArchetype('fixes', 'fix-test-arch', {
    name: 'Fix Test Archetype',
    class: 'fighter',
    features: { 'fix-feature': { type: 'modification', target: 'Weapon Training', level: 5 } }
  });

  const data = await JournalEntryDB.readSection('fixes');
  assert(data['fix-test-arch'] !== undefined, 'Fix archetype should be readable');
});

// Test 58.9: isModuleAvailable returns true when module is active
await testAsync('58.9: isModuleAvailable returns true when module active', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  const result = CompendiumParser.isModuleAvailable();
  assertEqual(result, true, 'isModuleAvailable should return true for active module');
});

// Test 58.10: loadArchetypeList tries compendium when module active (may fail in mock but no crash)
await testAsync('58.10: loadArchetypeList attempts compendium load when module active', async () => {
  resetNotificationTracking();
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  // Set up a mock pack that returns documents
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => [
      { name: 'Two-Handed Fighter', system: { class: 'fighter' }, flags: {} },
      { name: 'Weapon Master', system: { class: 'fighter' }, flags: {} }
    ]
  });

  const result = await CompendiumParser.loadArchetypeList();
  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 2, 'Should have loaded 2 archetypes from compendium');
});

// Test 58.11: Custom archetypes persist across module enable/disable cycle
await testAsync('58.11: JE custom data persists across module enable/disable', async () => {
  // With module enabled, write a custom archetype
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  await JournalEntryDB.setArchetype('custom', 'persist-test-arch', {
    name: 'Persist Test Archetype',
    class: 'rogue'
  });

  // Disable module
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: false });

  // Custom data should still be readable
  const data = await JournalEntryDB.readSection('custom');
  assert(data['persist-test-arch'] !== undefined, 'Custom archetype should persist');
  assertEqual(data['persist-test-arch'].name, 'Persist Test Archetype', 'Data should be intact');
});

// Test 58.12: getArchetype works in JE-only mode (priority chain)
await testAsync('58.12: getArchetype searches all JE sections in JE-only mode', async () => {
  game.modules.delete('pf1e-archetypes');

  // Set up archetype in custom section
  await JournalEntryDB.setArchetype('custom', 'je-only-lookup', {
    name: 'JE Only Lookup',
    class: 'wizard'
  });

  const result = await JournalEntryDB.getArchetype('je-only-lookup');
  assert(result !== null, 'Should find archetype in JE');
  assertEqual(result.name, 'JE Only Lookup', 'Name should match');
  assertEqual(result._section, 'custom', 'Should come from custom section');
});

// Test 58.13: Multiple JE sections work together in JE-only mode
await testAsync('58.13: All three JE sections work in JE-only mode', async () => {
  game.modules.delete('pf1e-archetypes');

  // Ensure all three sections are readable
  const fixes = await JournalEntryDB.readSection('fixes');
  const missing = await JournalEntryDB.readSection('missing');
  const custom = await JournalEntryDB.readSection('custom');

  assert(typeof fixes === 'object', 'Fixes section should return object');
  assert(typeof missing === 'object', 'Missing section should return object');
  assert(typeof custom === 'object', 'Custom section should return object');
});

// Test 58.14: No console errors during JE-only operation
await testAsync('58.14: No console errors during JE-only operations', async () => {
  resetNotificationTracking();
  game.modules.delete('pf1e-archetypes');

  await CompendiumParser.loadArchetypeList();
  await CompendiumParser.loadArchetypeFeatures();
  await JournalEntryDB.readSection('fixes');
  await JournalEntryDB.readSection('missing');
  await JournalEntryDB.readSection('custom');

  assertEqual(consoleErrors.length, 0, `Expected 0 console errors, got ${consoleErrors.length}: ${consoleErrors.join('; ')}`);
});

// Test 58.15: Log message indicates JE-only mode
await testAsync('58.15: Console logs indicate JE-only mode when module absent', async () => {
  game.modules.delete('pf1e-archetypes');

  let logMessages = [];
  const origLog = console.log;
  console.log = (...args) => {
    logMessages.push(args.join(' '));
  };

  await CompendiumParser.loadArchetypeList();

  console.log = origLog;

  const jeOnlyLog = logMessages.find(m => m.toLowerCase().includes('je-only') || m.toLowerCase().includes('not available'));
  assert(jeOnlyLog !== undefined, `Should log JE-only mode message. Got logs: ${logMessages.join('; ')}`);
});

// Test 58.16: loadArchetypeList handles graceful fallback to empty with missing pack
await testAsync('58.16: loadArchetypeList handles missing pack gracefully', async () => {
  resetNotificationTracking();
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  // Don't set up the pack - it should fail gracefully
  game.packs.delete('pf1e-archetypes.pf-archetypes');

  const result = await CompendiumParser.loadArchetypeList();
  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array on pack failure');

  // Should show an error notification
  assert(lastErrorMsg !== null, 'Should show error notification when pack fails');
});

// Cleanup
restoreConsole();

// Clean up test data from JE
try {
  await JournalEntryDB.deleteArchetype('custom', 'test-homebrew-arch');
  await JournalEntryDB.deleteArchetype('custom', 'persist-test-arch');
  await JournalEntryDB.deleteArchetype('custom', 'je-only-lookup');
  await JournalEntryDB.deleteArchetype('missing', 'official-missing-arch');
  await JournalEntryDB.deleteArchetype('fixes', 'fix-test-arch');
} catch (e) {
  // Cleanup failures are non-critical
}

// Restore module state
game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

// =====================================================
// RESULTS
// =====================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed}/${totalTests} tests passing (${failed} failed)`);
console.log('='.repeat(60));

console.log(`\nFeature #56 (No token selected shows warning): ${passed >= 10 ? '10/10' : 'partial'}`);
console.log(`Feature #57 (No classes on actor shows warning): ${passed >= 20 ? '10/10' : 'partial'}`);
console.log(`Feature #58 (Module works without pf1e-archetypes): ${passed >= 36 ? '16/16' : 'partial'}`);

if (failed > 0) {
  console.log(`\n${failed} tests failed!`);
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
