/**
 * Test Suite for Features #63, #64, #65 - Security & Access Control
 *
 * Feature #63: GM can edit all JE sections
 * Feature #64: Players cannot edit fixes or missing JE sections
 * Feature #65: Players can only apply archetypes to owned characters
 */

import { setupMockEnvironment, resetMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  total++;
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
  }
}

function assertNotNull(actual, message) {
  total++;
  if (actual !== null && actual !== undefined) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message} (got: ${JSON.stringify(actual)})`);
  }
}

function assertDeepEqual(actual, expected, message) {
  total++;
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}\n    expected: ${expectedStr}\n    got: ${actualStr}`);
  }
}

// ============================================================
// Feature #63: GM can edit all JE sections
// ============================================================
async function testFeature63() {
  console.log('\n=== Feature #63: GM can edit all JE sections ===\n');

  // --- Test 1: Setup as GM ---
  console.log('Test 1: GM user setup');
  const env = setupMockEnvironment();
  game.user.isGM = true;

  // Initialize module
  const moduleImport = await import('../scripts/module.mjs');
  await Hooks.callAll('init');
  await Hooks.callAll('ready');

  assert(game.user.isGM === true, 'User is confirmed as GM');

  // Ensure the JE database exists
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  const db = JournalEntryDB.getDatabase();
  assertNotNull(db, 'JournalEntry database exists');

  // --- Test 2: GM can edit fixes section ---
  console.log('\nTest 2: GM can edit fixes section');
  const fixData = {
    'two-handed-fighter': {
      class: 'fighter',
      features: {
        'shattering-strike': { level: 2, replaces: 'Bravery', description: 'Test fix' }
      }
    }
  };
  const fixResult = await JournalEntryDB.writeSection('fixes', fixData);
  assertEqual(fixResult, true, 'GM can write to fixes section (returns true)');

  // Verify write persisted
  const fixesRead = await JournalEntryDB.readSection('fixes');
  assertNotNull(fixesRead['two-handed-fighter'], 'Fix entry persists after write');
  assertEqual(fixesRead['two-handed-fighter'].class, 'fighter', 'Fix entry has correct class');
  assertEqual(
    fixesRead['two-handed-fighter'].features['shattering-strike'].level,
    2,
    'Fix entry feature has correct level'
  );
  assertEqual(
    fixesRead['two-handed-fighter'].features['shattering-strike'].replaces,
    'Bravery',
    'Fix entry feature has correct replaces'
  );

  // --- Test 3: GM can edit missing section ---
  console.log('\nTest 3: GM can edit missing section');
  const missingData = {
    'divine-tracker': {
      class: 'ranger',
      features: {
        'blessings': { level: 4, replaces: 'Spells', description: 'Grants blessings' }
      }
    }
  };
  const missingResult = await JournalEntryDB.writeSection('missing', missingData);
  assertEqual(missingResult, true, 'GM can write to missing section (returns true)');

  // Verify write persisted
  const missingRead = await JournalEntryDB.readSection('missing');
  assertNotNull(missingRead['divine-tracker'], 'Missing entry persists after write');
  assertEqual(missingRead['divine-tracker'].class, 'ranger', 'Missing entry has correct class');
  assertEqual(
    missingRead['divine-tracker'].features['blessings'].level,
    4,
    'Missing entry feature has correct level'
  );

  // --- Test 4: GM can edit custom section ---
  console.log('\nTest 4: GM can edit custom section');
  const customData = {
    'shield-master': {
      class: 'fighter',
      features: {
        'shield-bash': { level: 1, replaces: null, description: 'Homebrew shield bash' }
      }
    }
  };
  const customResult = await JournalEntryDB.writeSection('custom', customData);
  assertEqual(customResult, true, 'GM can write to custom section (returns true)');

  // Verify write persisted
  const customRead = await JournalEntryDB.readSection('custom');
  assertNotNull(customRead['shield-master'], 'Custom entry persists after write');
  assertEqual(customRead['shield-master'].class, 'fighter', 'Custom entry has correct class');

  // --- Test 5: GM can use setArchetype on all sections ---
  console.log('\nTest 5: GM can use setArchetype on all sections');

  // setArchetype on fixes
  const setFixResult = await JournalEntryDB.setArchetype('fixes', 'armor-master', {
    class: 'fighter',
    features: { 'deflective-shield': { level: 5, replaces: 'Weapon Training 1' } }
  });
  assertEqual(setFixResult, true, 'GM setArchetype on fixes returns true');

  // setArchetype on missing
  const setMissingResult = await JournalEntryDB.setArchetype('missing', 'sword-saint', {
    class: 'samurai',
    features: { 'iaijutsu-strike': { level: 1, replaces: null } }
  });
  assertEqual(setMissingResult, true, 'GM setArchetype on missing returns true');

  // setArchetype on custom
  const setCustomResult = await JournalEntryDB.setArchetype('custom', 'homebrew-test', {
    class: 'wizard',
    features: { 'arcane-blast': { level: 3, replaces: null } }
  });
  assertEqual(setCustomResult, true, 'GM setArchetype on custom returns true');

  // --- Test 6: GM can use deleteArchetype on all sections ---
  console.log('\nTest 6: GM can use deleteArchetype on all sections');

  const delFixResult = await JournalEntryDB.deleteArchetype('fixes', 'armor-master');
  assertEqual(delFixResult, true, 'GM deleteArchetype from fixes returns true');

  // Verify deletion
  const afterDelFix = await JournalEntryDB.readSection('fixes');
  assert(!afterDelFix['armor-master'], 'Deleted fix entry is gone');

  const delMissingResult = await JournalEntryDB.deleteArchetype('missing', 'sword-saint');
  assertEqual(delMissingResult, true, 'GM deleteArchetype from missing returns true');

  const afterDelMissing = await JournalEntryDB.readSection('missing');
  assert(!afterDelMissing['sword-saint'], 'Deleted missing entry is gone');

  const delCustomResult = await JournalEntryDB.deleteArchetype('custom', 'homebrew-test');
  assertEqual(delCustomResult, true, 'GM deleteArchetype from custom returns true');

  const afterDelCustom = await JournalEntryDB.readSection('custom');
  assert(!afterDelCustom['homebrew-test'], 'Deleted custom entry is gone');

  // --- Test 7: Verify all edits persist across reload ---
  console.log('\nTest 7: All edits persist across reload');

  // Write fresh data to all sections
  await JournalEntryDB.setArchetype('fixes', 'persist-fix', { class: 'fighter', features: { 'f1': { level: 1 } } });
  await JournalEntryDB.setArchetype('missing', 'persist-missing', { class: 'rogue', features: { 'f2': { level: 2 } } });
  await JournalEntryDB.setArchetype('custom', 'persist-custom', { class: 'cleric', features: { 'f3': { level: 3 } } });

  // Simulate reload
  const env2 = resetMockEnvironment();
  game.user.isGM = true;

  // Re-import to reset module state
  const { JournalEntryDB: JournalEntryDB2 } = await import('../scripts/journal-db.mjs');

  const reloadedFixes = await JournalEntryDB2.readSection('fixes');
  assertNotNull(reloadedFixes['persist-fix'], 'Fix entry persists after reload');

  const reloadedMissing = await JournalEntryDB2.readSection('missing');
  assertNotNull(reloadedMissing['persist-missing'], 'Missing entry persists after reload');

  const reloadedCustom = await JournalEntryDB2.readSection('custom');
  assertNotNull(reloadedCustom['persist-custom'], 'Custom entry persists after reload');

  // --- Test 8: GM can overwrite existing entries in all sections ---
  console.log('\nTest 8: GM can overwrite existing entries');

  await JournalEntryDB2.setArchetype('fixes', 'persist-fix', { class: 'paladin', features: { 'f1-updated': { level: 5 } } });
  const overwrittenFix = await JournalEntryDB2.readSection('fixes');
  assertEqual(overwrittenFix['persist-fix'].class, 'paladin', 'Fix entry overwritten with new class');

  await JournalEntryDB2.setArchetype('missing', 'persist-missing', { class: 'bard', features: { 'f2-updated': { level: 7 } } });
  const overwrittenMissing = await JournalEntryDB2.readSection('missing');
  assertEqual(overwrittenMissing['persist-missing'].class, 'bard', 'Missing entry overwritten with new class');

  await JournalEntryDB2.setArchetype('custom', 'persist-custom', { class: 'monk', features: { 'f3-updated': { level: 9 } } });
  const overwrittenCustom = await JournalEntryDB2.readSection('custom');
  assertEqual(overwrittenCustom['persist-custom'].class, 'monk', 'Custom entry overwritten with new class');

  // --- Test 9: GM can perform multiple CRUD operations without corruption ---
  console.log('\nTest 9: Multiple CRUD operations without corruption');

  // Create multiple entries
  await JournalEntryDB2.setArchetype('fixes', 'fix-a', { class: 'fighter', features: {} });
  await JournalEntryDB2.setArchetype('fixes', 'fix-b', { class: 'fighter', features: {} });
  await JournalEntryDB2.setArchetype('fixes', 'fix-c', { class: 'fighter', features: {} });

  // Delete one
  await JournalEntryDB2.deleteArchetype('fixes', 'fix-b');

  // Read and verify
  const afterMulti = await JournalEntryDB2.readSection('fixes');
  assertNotNull(afterMulti['fix-a'], 'Entry fix-a still exists');
  assert(!afterMulti['fix-b'], 'Entry fix-b was deleted');
  assertNotNull(afterMulti['fix-c'], 'Entry fix-c still exists');
  assertNotNull(afterMulti['persist-fix'], 'Entry persist-fix still exists from earlier');

  // --- Test 10: GM getArchetype respects priority chain ---
  console.log('\nTest 10: GM getArchetype respects priority chain (fixes > missing > custom)');

  // Put same slug in all three sections
  await JournalEntryDB2.setArchetype('fixes', 'priority-test', { class: 'fix-class', features: {} });
  await JournalEntryDB2.setArchetype('missing', 'priority-test', { class: 'missing-class', features: {} });
  await JournalEntryDB2.setArchetype('custom', 'priority-test', { class: 'custom-class', features: {} });

  const priorityResult = await JournalEntryDB2.getArchetype('priority-test');
  assertEqual(priorityResult._section, 'fixes', 'getArchetype returns from fixes first (highest priority)');
  assertEqual(priorityResult.class, 'fix-class', 'getArchetype data from fixes section');

  // Remove from fixes, should get missing
  await JournalEntryDB2.deleteArchetype('fixes', 'priority-test');
  const priorityResult2 = await JournalEntryDB2.getArchetype('priority-test');
  assertEqual(priorityResult2._section, 'missing', 'After deleting fix, getArchetype returns from missing');

  // Remove from missing, should get custom
  await JournalEntryDB2.deleteArchetype('missing', 'priority-test');
  const priorityResult3 = await JournalEntryDB2.getArchetype('priority-test');
  assertEqual(priorityResult3._section, 'custom', 'After deleting missing, getArchetype returns from custom');
}

// ============================================================
// Feature #64: Players cannot edit fixes or missing JE sections
// ============================================================
async function testFeature64() {
  console.log('\n=== Feature #64: Players cannot edit fixes or missing JE sections ===\n');

  // Fresh setup with GM to create database
  const env = setupMockEnvironment();
  game.user.isGM = true;
  await Hooks.callAll('init');
  await Hooks.callAll('ready');

  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

  // Pre-populate all sections with some data as GM
  await JournalEntryDB.setArchetype('fixes', 'existing-fix', { class: 'fighter', features: { 'f1': { level: 1 } } });
  await JournalEntryDB.setArchetype('missing', 'existing-missing', { class: 'ranger', features: { 'f2': { level: 2 } } });
  await JournalEntryDB.setArchetype('custom', 'existing-custom', { class: 'wizard', features: { 'f3': { level: 3 } } });

  // --- Switch to player ---
  console.log('Test 1: Switch to player role');
  game.user.isGM = false;
  assert(game.user.isGM === false, 'User is now a player (not GM)');

  // --- Test 2: Player cannot write to fixes section ---
  console.log('\nTest 2: Player attempt to edit fixes section → blocked');
  let errorMessages = [];
  const origError = ui.notifications.error;
  ui.notifications.error = (msg) => { errorMessages.push(msg); };

  const fixWriteResult = await JournalEntryDB.writeSection('fixes', {
    'player-fix-attempt': { class: 'fighter', features: {} }
  });
  assertEqual(fixWriteResult, false, 'Player writeSection to fixes returns false');
  assert(errorMessages.length > 0, 'Error notification shown for fixes write attempt');
  assert(
    errorMessages.some(m => m.includes('GM') || m.includes('fixes')),
    'Error message mentions GM or fixes restriction'
  );

  // Verify original data unchanged
  const fixesData = await JournalEntryDB.readSection('fixes');
  assert(!fixesData['player-fix-attempt'], 'Player fix attempt was NOT written');
  assertNotNull(fixesData['existing-fix'], 'Existing fix data unchanged');

  // --- Test 3: Player cannot write to missing section ---
  console.log('\nTest 3: Player attempt to edit missing section → blocked');
  errorMessages = [];

  const missingWriteResult = await JournalEntryDB.writeSection('missing', {
    'player-missing-attempt': { class: 'ranger', features: {} }
  });
  assertEqual(missingWriteResult, false, 'Player writeSection to missing returns false');
  assert(errorMessages.length > 0, 'Error notification shown for missing write attempt');

  // Verify original data unchanged
  const missingData = await JournalEntryDB.readSection('missing');
  assert(!missingData['player-missing-attempt'], 'Player missing attempt was NOT written');
  assertNotNull(missingData['existing-missing'], 'Existing missing data unchanged');

  // --- Test 4: Player CAN edit custom section ---
  console.log('\nTest 4: Player CAN edit custom section');
  errorMessages = [];

  const customWriteResult = await JournalEntryDB.writeSection('custom', {
    'existing-custom': { class: 'wizard', features: { 'f3': { level: 3 } } },
    'player-custom': { class: 'sorcerer', features: { 'blast': { level: 1, replaces: null } } }
  });
  assertEqual(customWriteResult, true, 'Player writeSection to custom returns true');
  assertEqual(errorMessages.length, 0, 'No error notification for custom write');

  // Verify player's custom data was written
  const customData = await JournalEntryDB.readSection('custom');
  assertNotNull(customData['player-custom'], 'Player custom entry exists');
  assertEqual(customData['player-custom'].class, 'sorcerer', 'Player custom entry has correct class');

  // --- Test 5: Player cannot use setArchetype on fixes ---
  console.log('\nTest 5: Player setArchetype on fixes → blocked');
  errorMessages = [];

  const setFixResult = await JournalEntryDB.setArchetype('fixes', 'player-set-fix', {
    class: 'fighter', features: {}
  });
  assertEqual(setFixResult, false, 'Player setArchetype on fixes returns false');
  assert(errorMessages.length > 0, 'Error notification for setArchetype on fixes');

  // --- Test 6: Player cannot use setArchetype on missing ---
  console.log('\nTest 6: Player setArchetype on missing → blocked');
  errorMessages = [];

  const setMissingResult = await JournalEntryDB.setArchetype('missing', 'player-set-missing', {
    class: 'ranger', features: {}
  });
  assertEqual(setMissingResult, false, 'Player setArchetype on missing returns false');
  assert(errorMessages.length > 0, 'Error notification for setArchetype on missing');

  // --- Test 7: Player CAN use setArchetype on custom ---
  console.log('\nTest 7: Player setArchetype on custom → allowed');
  errorMessages = [];

  const setCustomResult = await JournalEntryDB.setArchetype('custom', 'player-homebrew', {
    class: 'monk', features: { 'ki-blast': { level: 4, replaces: null } }
  });
  assertEqual(setCustomResult, true, 'Player setArchetype on custom returns true');
  assertEqual(errorMessages.length, 0, 'No error notification for setArchetype on custom');

  // Verify it was saved
  const savedCustom = await JournalEntryDB.getArchetype('player-homebrew');
  assertNotNull(savedCustom, 'Player homebrew entry retrievable via getArchetype');
  assertEqual(savedCustom._section, 'custom', 'Player homebrew is in custom section');

  // --- Test 8: Player cannot use deleteArchetype on fixes ---
  console.log('\nTest 8: Player deleteArchetype on fixes → blocked');
  errorMessages = [];

  const delFixResult = await JournalEntryDB.deleteArchetype('fixes', 'existing-fix');
  assertEqual(delFixResult, false, 'Player deleteArchetype from fixes returns false');
  assert(errorMessages.length > 0, 'Error notification for deleteArchetype on fixes');

  // Verify data not deleted
  const afterDelFixAttempt = await JournalEntryDB.readSection('fixes');
  assertNotNull(afterDelFixAttempt['existing-fix'], 'Existing fix entry NOT deleted by player');

  // --- Test 9: Player cannot use deleteArchetype on missing ---
  console.log('\nTest 9: Player deleteArchetype on missing → blocked');
  errorMessages = [];

  const delMissingResult = await JournalEntryDB.deleteArchetype('missing', 'existing-missing');
  assertEqual(delMissingResult, false, 'Player deleteArchetype from missing returns false');

  const afterDelMissingAttempt = await JournalEntryDB.readSection('missing');
  assertNotNull(afterDelMissingAttempt['existing-missing'], 'Existing missing entry NOT deleted by player');

  // --- Test 10: Player CAN use deleteArchetype on custom ---
  console.log('\nTest 10: Player deleteArchetype on custom → allowed');
  errorMessages = [];

  const delCustomResult = await JournalEntryDB.deleteArchetype('custom', 'player-homebrew');
  assertEqual(delCustomResult, true, 'Player deleteArchetype from custom returns true');

  const afterDelCustom = await JournalEntryDB.readSection('custom');
  assert(!afterDelCustom['player-homebrew'], 'Player homebrew entry deleted from custom');

  // --- Test 11: Player CAN read all sections (read access is unrestricted) ---
  console.log('\nTest 11: Player can read all sections');

  const playerFixRead = await JournalEntryDB.readSection('fixes');
  assertNotNull(playerFixRead, 'Player can read fixes section (returns object)');
  assertNotNull(playerFixRead['existing-fix'], 'Player can see existing fix data');

  const playerMissingRead = await JournalEntryDB.readSection('missing');
  assertNotNull(playerMissingRead, 'Player can read missing section (returns object)');
  assertNotNull(playerMissingRead['existing-missing'], 'Player can see existing missing data');

  const playerCustomRead = await JournalEntryDB.readSection('custom');
  assertNotNull(playerCustomRead, 'Player can read custom section (returns object)');

  // --- Test 12: Error message is clear and user-friendly ---
  console.log('\nTest 12: Error messages are clear');
  errorMessages = [];

  await JournalEntryDB.writeSection('fixes', {});
  assert(errorMessages.length > 0, 'Error message generated for fixes write');
  const fixesErrorMsg = errorMessages[0];
  assert(
    fixesErrorMsg.includes('GM') && (fixesErrorMsg.includes('fixes') || fixesErrorMsg.includes('missing')),
    `Error message is clear: "${fixesErrorMsg}"`
  );

  errorMessages = [];
  await JournalEntryDB.writeSection('missing', {});
  assert(errorMessages.length > 0, 'Error message generated for missing write');

  // Restore original
  ui.notifications.error = origError;

  // --- Test 13: Player getArchetype still works (read-only) ---
  console.log('\nTest 13: Player getArchetype (read-only) works');
  const playerGetArch = await JournalEntryDB.getArchetype('existing-fix');
  assertNotNull(playerGetArch, 'Player can getArchetype');
  assertEqual(playerGetArch._section, 'fixes', 'Player sees correct section for getArchetype');
}

// ============================================================
// Feature #65: Players can only apply archetypes to owned characters
// ============================================================
async function testFeature65() {
  console.log('\n=== Feature #65: Players can only apply archetypes to owned characters ===\n');

  // Fresh setup as GM first to initialize settings
  const env = setupMockEnvironment();
  game.user.isGM = true;

  // Manually register settings since Hooks.once('init') only fires once per module cache
  game.settings.register('archetype-manager', 'lastSelectedClass', {
    name: 'Last Selected Class',
    hint: 'Remembers the last selected class within a session',
    scope: 'client',
    config: false,
    type: String,
    default: ''
  });
  game.settings.register('archetype-manager', 'showParseWarnings', {
    name: 'Show Parse Warnings',
    hint: 'Display warnings when archetype features cannot be automatically parsed',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Create JE database
  const { JournalEntryDB } = await import('../scripts/journal-db.mjs');
  await JournalEntryDB.ensureDatabase();

  // Now switch to player
  game.user.isGM = false;

  // Import modules
  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  const { Applicator } = await import('../scripts/applicator.mjs');

  // Track notifications
  let warnMessages = [];
  let errorMessages = [];
  let infoMessages = [];
  const origWarn = ui.notifications.warn;
  const origError = ui.notifications.error;
  const origInfo = ui.notifications.info;
  ui.notifications.warn = (msg) => { warnMessages.push(msg); };
  ui.notifications.error = (msg) => { errorMessages.push(msg); };
  ui.notifications.info = (msg) => { infoMessages.push(msg); };

  // --- Test 1: Player with owned character → ArchetypeManager.open works ---
  console.log('Test 1: Player selects own character → archetype manager opens');

  const ownedClassItem = createMockClassItem('Fighter', 5);
  const ownedActor = createMockActor('PlayerHero', [ownedClassItem]);
  ownedActor.isOwner = true;

  const ownedToken = { actor: ownedActor, id: 'owned-token-1' };
  canvas.tokens.controlled = [ownedToken];
  warnMessages = [];
  errorMessages = [];

  // open() should NOT produce a permission warning for owned actors
  await ArchetypeManager.open();
  const permWarnings = warnMessages.filter(m => m.includes('permission'));
  assertEqual(permWarnings.length, 0, 'No permission warning for owned character');
  assert(ownedActor.isOwner === true, 'Actor is confirmed as owned by player');

  // --- Test 2: Player with unowned actor → ArchetypeManager.open blocked ---
  console.log('\nTest 2: Player selects NPC/other character → blocked');

  const unownedClassItem = createMockClassItem('Wizard', 10);
  const unownedActor = createMockActor('NPC_Boss', [unownedClassItem]);
  unownedActor.isOwner = false;

  const unownedToken = { actor: unownedActor, id: 'unowned-token-1' };
  canvas.tokens.controlled = [unownedToken];
  warnMessages = [];
  errorMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning shown when player selects unowned actor');
  assert(
    warnMessages.some(m => m.includes('permission') || m.includes('Permission')),
    `Permission warning message shown: "${warnMessages[0]}"`
  );

  // --- Test 3: Player cannot apply archetype to unowned actor ---
  console.log('\nTest 3: Player Applicator.apply on unowned actor → blocked');
  warnMessages = [];
  errorMessages = [];

  const testArchetype = { slug: 'test-archetype', name: 'Test Archetype' };
  const testDiff = [
    { status: 'unchanged', name: 'Feature1', original: { uuid: 'test-uuid-1', level: 1 } }
  ];

  const unownedApplyResult = await Applicator.apply(unownedActor, unownedClassItem, testArchetype, testDiff);
  assertEqual(unownedApplyResult, false, 'Applicator.apply returns false for unowned actor');
  assert(errorMessages.length > 0, 'Error notification shown for apply on unowned actor');
  assert(
    errorMessages.some(m => m.includes('permission')),
    `Permission error message: "${errorMessages[0]}"`
  );

  // --- Test 4: Player cannot remove archetype from unowned actor ---
  console.log('\nTest 4: Player Applicator.remove on unowned actor → blocked');
  warnMessages = [];
  errorMessages = [];

  const unownedRemoveResult = await Applicator.remove(unownedActor, unownedClassItem, 'some-archetype');
  assertEqual(unownedRemoveResult, false, 'Applicator.remove returns false for unowned actor');
  assert(errorMessages.length > 0, 'Error notification shown for remove on unowned actor');
  assert(
    errorMessages.some(m => m.includes('permission')),
    `Permission error message for remove: "${errorMessages[0]}"`
  );

  // --- Test 5: Player CAN apply archetype to owned actor ---
  console.log('\nTest 5: Player Applicator.apply on owned actor → allowed (proceeds past permission check)');
  warnMessages = [];
  errorMessages = [];
  infoMessages = [];

  // Apply to owned actor: permission check should pass, even though it may fail later
  // due to mock limitations (we just verify the ownership check doesn't block it)
  const ownedApplyResult = await Applicator.apply(ownedActor, ownedClassItem, testArchetype, testDiff);

  // Should NOT have a permission error
  const permErrors = errorMessages.filter(m => m.includes('permission'));
  assertEqual(permErrors.length, 0, 'No permission error for owned actor apply');

  // The apply should succeed (or fail for non-permission reasons)
  // Check that it got past the permission check by seeing the info message
  const applyInfoMsgs = infoMessages.filter(m => m.includes('Applied'));
  assert(applyInfoMsgs.length > 0 || errorMessages.some(m => !m.includes('permission')),
    'Apply proceeded past permission check (succeeded or failed for non-permission reason)');

  // --- Test 6: No token selected → appropriate warning ---
  console.log('\nTest 6: No token selected → warning');
  canvas.tokens.controlled = [];
  warnMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning when no token selected');
  assert(warnMessages.some(m => m.includes('token')), 'Warning mentions token');

  // --- Test 7: Token without actor → appropriate warning ---
  console.log('\nTest 7: Token without actor → warning');
  canvas.tokens.controlled = [{ actor: null, id: 'empty-token' }];
  warnMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning for token without actor');
  assert(warnMessages.some(m => m.includes('actor')), 'Warning mentions actor');

  // --- Test 8: GM can access any actor (bypass ownership check) ---
  console.log('\nTest 8: GM can access any actor → no ownership restrictions');
  game.user.isGM = true;
  canvas.tokens.controlled = [unownedToken];
  warnMessages = [];
  errorMessages = [];

  await ArchetypeManager.open();
  const gmPermWarnings = warnMessages.filter(m => m.includes('permission'));
  assertEqual(gmPermWarnings.length, 0, 'GM gets no permission warnings for unowned actor');

  // --- Test 9: GM Applicator.apply bypasses ownership check ---
  console.log('\nTest 9: GM Applicator.apply bypasses ownership check');
  warnMessages = [];
  errorMessages = [];
  infoMessages = [];

  // Need a clean class item for GM apply test
  const gmClassItem = createMockClassItem('Rogue', 8);
  const gmActor = createMockActor('NPC_Target', [gmClassItem]);
  gmActor.isOwner = false; // GM doesn't "own" it per FoundryVTT but has isGM=true

  const gmApplyResult = await Applicator.apply(gmActor, gmClassItem, testArchetype, [
    { status: 'unchanged', name: 'Feature1', original: { uuid: 'test-uuid-1', level: 1 } }
  ]);

  // Should NOT get permission error
  const gmPermErrors = errorMessages.filter(m => m.includes('permission'));
  assertEqual(gmPermErrors.length, 0, 'GM gets no permission errors on apply');

  // --- Test 10: GM Applicator.remove bypasses ownership check ---
  console.log('\nTest 10: GM Applicator.remove bypasses ownership check');
  warnMessages = [];
  errorMessages = [];

  // Apply first so we can remove
  await gmClassItem.setFlag('archetype-manager', 'archetypes', ['test-archetype']);

  const gmRemoveResult = await Applicator.remove(gmActor, gmClassItem, 'test-archetype');
  const gmRemovePermErrors = errorMessages.filter(m => m.includes('permission'));
  assertEqual(gmRemovePermErrors.length, 0, 'GM gets no permission errors on remove');

  // --- Test 11: Player with LIMITED permission (not owner) → blocked ---
  console.log('\nTest 11: Player with LIMITED permission (not owner) → blocked');
  game.user.isGM = false;

  const limitedActor = createMockActor('OtherPC', [createMockClassItem('Cleric', 3)]);
  limitedActor.isOwner = false; // LIMITED permission, not owner
  limitedActor.permission = 1; // LIMITED

  canvas.tokens.controlled = [{ actor: limitedActor, id: 'limited-token' }];
  warnMessages = [];
  errorMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning for LIMITED permission actor');
  assert(
    warnMessages.some(m => m.includes('permission')),
    'Warning mentions permission for LIMITED actor'
  );

  // --- Test 12: Player with OBSERVER permission (not owner) → blocked ---
  console.log('\nTest 12: Player with OBSERVER permission (not owner) → blocked');

  const observerActor = createMockActor('ObservedPC', [createMockClassItem('Bard', 7)]);
  observerActor.isOwner = false; // OBSERVER, not owner
  observerActor.permission = 2; // OBSERVER

  canvas.tokens.controlled = [{ actor: observerActor, id: 'observer-token' }];
  warnMessages = [];
  errorMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning for OBSERVER permission actor');
  assert(
    warnMessages.some(m => m.includes('permission')),
    'Warning mentions permission for OBSERVER actor'
  );

  // --- Test 13: Actor with no class items → class warning (not permission) ---
  console.log('\nTest 13: Actor with no classes → class warning, not permission warning');
  const noClassActor = createMockActor('Commoner', []);
  noClassActor.isOwner = true; // Owned but no classes

  canvas.tokens.controlled = [{ actor: noClassActor, id: 'no-class-token' }];
  warnMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning shown for actor with no classes');
  assert(
    warnMessages.some(m => m.includes('class')),
    'Warning mentions class items (not permission)'
  );

  // --- Test 14: Clear permission error message ---
  console.log('\nTest 14: Permission error message is clear and user-friendly');
  game.user.isGM = false;
  canvas.tokens.controlled = [unownedToken];
  warnMessages = [];

  await ArchetypeManager.open();
  assert(warnMessages.length > 0, 'Warning generated for permission denial');
  const permMsg = warnMessages.find(m => m.includes('permission'));
  assertNotNull(permMsg, 'Permission warning message exists');
  assert(permMsg.includes('permission'), `Message mentions "permission": "${permMsg}"`);

  // Restore
  ui.notifications.warn = origWarn;
  ui.notifications.error = origError;
  ui.notifications.info = origInfo;
}

// ============================================================
// Run all tests
// ============================================================
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Features #63, #64, #65 - Security & Access Control  ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  try {
    await testFeature63();
    console.log(`\n--- Feature #63 subtotal: ${passed}/${total} ---`);
    const f63Passed = passed;
    const f63Total = total;

    await testFeature64();
    console.log(`\n--- Feature #64 subtotal: ${passed - f63Passed}/${total - f63Total} ---`);
    const f64Passed = passed;
    const f64Total = total;

    await testFeature65();
    console.log(`\n--- Feature #65 subtotal: ${passed - f64Passed}/${total - f64Total} ---`);

  } catch (e) {
    console.error('\n!!! Test suite error:', e);
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`Total: ${passed}/${total} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
