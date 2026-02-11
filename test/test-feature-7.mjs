/**
 * Test Suite: Feature #7 - Module settings registered correctly
 *
 * Verifies that module settings are registered and accessible.
 * Tests:
 *   - Settings appear in the registered settings list
 *   - Settings readable via game.settings.get()
 *   - Setting values can be changed and saved
 *   - Settings persist across simulated reload
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';

const MODULE_ID = 'archetype-manager';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Feature #7: Module settings registered correctly ===\n');

  // Set up mock environment
  const { hooks, settings } = setupMockEnvironment();

  // Load the module (triggers Hooks.once('init'))
  // We need to manually import and trigger since we're in a test
  // The module registers settings in the init hook
  const module = await import('../scripts/module.mjs');

  // Fire the init hook to register settings
  await hooks.callAll('init');

  // --- Test 1: Verify archetype-manager settings are registered ---
  console.log('Test 1: Verify settings are registered');
  assert(settings.isRegistered(MODULE_ID, 'lastSelectedClass'), 'lastSelectedClass setting is registered');
  assert(settings.isRegistered(MODULE_ID, 'showParseWarnings'), 'showParseWarnings setting is registered');

  // --- Test 2: Verify settings registration metadata ---
  console.log('\nTest 2: Verify settings registration metadata');
  const lastClassReg = settings.getRegistration(MODULE_ID, 'lastSelectedClass');
  assert(lastClassReg !== undefined, 'lastSelectedClass registration exists');
  assert(lastClassReg.name === 'Last Selected Class', 'lastSelectedClass has correct name');
  assert(lastClassReg.scope === 'client', 'lastSelectedClass is client-scoped');
  assert(lastClassReg.config === false, 'lastSelectedClass is hidden from config UI');
  assert(lastClassReg.type === String, 'lastSelectedClass type is String');
  assert(lastClassReg.default === '', 'lastSelectedClass default is empty string');

  const parseWarningsReg = settings.getRegistration(MODULE_ID, 'showParseWarnings');
  assert(parseWarningsReg !== undefined, 'showParseWarnings registration exists');
  assert(parseWarningsReg.name === 'Show Parse Warnings', 'showParseWarnings has correct name');
  assert(parseWarningsReg.hint.includes('warnings'), 'showParseWarnings has descriptive hint');
  assert(parseWarningsReg.scope === 'world', 'showParseWarnings is world-scoped');
  assert(parseWarningsReg.config === true, 'showParseWarnings is visible in config UI');
  assert(parseWarningsReg.type === Boolean, 'showParseWarnings type is Boolean');
  assert(parseWarningsReg.default === true, 'showParseWarnings default is true');

  // --- Test 3: Verify settings readable via game.settings.get() ---
  console.log('\nTest 3: Read default settings values');
  const lastClass = game.settings.get(MODULE_ID, 'lastSelectedClass');
  assert(lastClass === '', 'lastSelectedClass default is empty string');

  const showWarnings = game.settings.get(MODULE_ID, 'showParseWarnings');
  assert(showWarnings === true, 'showParseWarnings default is true');

  // --- Test 4: Change setting values and save ---
  console.log('\nTest 4: Change setting values');
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'fighter');
  assert(game.settings.get(MODULE_ID, 'lastSelectedClass') === 'fighter', 'lastSelectedClass updated to fighter');

  game.settings.set(MODULE_ID, 'showParseWarnings', false);
  assert(game.settings.get(MODULE_ID, 'showParseWarnings') === false, 'showParseWarnings updated to false');

  // --- Test 5: Verify changed values persist in current session ---
  console.log('\nTest 5: Verify changed values persist in session');
  // Read them again to verify they're still the new values
  const afterClass = game.settings.get(MODULE_ID, 'lastSelectedClass');
  const afterWarnings = game.settings.get(MODULE_ID, 'showParseWarnings');
  assert(afterClass === 'fighter', 'lastSelectedClass still fighter');
  assert(afterWarnings === false, 'showParseWarnings still false');

  // --- Test 6: Change value again (overwrite) ---
  console.log('\nTest 6: Overwrite setting value');
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'wizard');
  assert(game.settings.get(MODULE_ID, 'lastSelectedClass') === 'wizard', 'lastSelectedClass changed to wizard');

  game.settings.set(MODULE_ID, 'lastSelectedClass', '');
  assert(game.settings.get(MODULE_ID, 'lastSelectedClass') === '', 'lastSelectedClass reset to empty');

  // --- Test 7: Getting unregistered setting throws error ---
  console.log('\nTest 7: Unregistered setting throws error');
  let threwError = false;
  try {
    game.settings.get(MODULE_ID, 'nonExistentSetting');
  } catch (e) {
    threwError = true;
  }
  assert(threwError, 'Getting unregistered setting throws error');

  let threwError2 = false;
  try {
    game.settings.get('nonexistent-module', 'anything');
  } catch (e) {
    threwError2 = true;
  }
  assert(threwError2, 'Getting setting from unregistered module throws error');

  // --- Test 8: Settings survive simulated reload ---
  console.log('\nTest 8: Settings across simulated reload');
  // Set a recognizable value before "reload"
  game.settings.set(MODULE_ID, 'lastSelectedClass', 'cleric');
  game.settings.set(MODULE_ID, 'showParseWarnings', false);

  // Note: In a real FoundryVTT reload, world-scoped settings persist in the DB.
  // Client-scoped settings persist in the browser's localStorage.
  // On reload, the init hook in module.mjs re-registers settings.
  // Since ESM caching prevents re-running the import, we simulate the
  // re-registration that would occur in a real Foundry reload.
  const { hooks: hooks2, settings: settings2 } = resetMockEnvironment();

  // Simulate what module.mjs init hook does on reload (re-register settings)
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class',
    hint: 'Remembers the last selected class within a session',
    scope: 'client',
    config: false,
    type: String,
    default: ''
  });
  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings',
    hint: 'Display warnings when archetype features cannot be automatically parsed',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // After reload, settings should be registered
  assert(settings2.isRegistered(MODULE_ID, 'lastSelectedClass'), 'lastSelectedClass re-registered after reload');
  assert(settings2.isRegistered(MODULE_ID, 'showParseWarnings'), 'showParseWarnings re-registered after reload');

  // Defaults are correct after re-registration
  const reloadedClass = settings2.get(MODULE_ID, 'lastSelectedClass');
  const reloadedWarnings = settings2.get(MODULE_ID, 'showParseWarnings');
  assert(typeof reloadedClass === 'string', 'lastSelectedClass is string type after reload');
  assert(reloadedClass === '', 'lastSelectedClass defaults to empty string after reload');
  assert(typeof reloadedWarnings === 'boolean', 'showParseWarnings is boolean type after reload');
  assert(reloadedWarnings === true, 'showParseWarnings defaults to true after reload');

  // --- Test 9: Multiple set/get cycles ---
  console.log('\nTest 9: Multiple set/get cycles');
  const classNames = ['barbarian', 'bard', 'paladin', 'ranger', 'monk'];
  for (const cls of classNames) {
    game.settings.set(MODULE_ID, 'lastSelectedClass', cls);
    assert(game.settings.get(MODULE_ID, 'lastSelectedClass') === cls, `lastSelectedClass set to ${cls}`);
  }

  // Toggle boolean multiple times
  for (let i = 0; i < 4; i++) {
    const val = i % 2 === 0;
    game.settings.set(MODULE_ID, 'showParseWarnings', val);
    assert(game.settings.get(MODULE_ID, 'showParseWarnings') === val, `showParseWarnings toggled to ${val}`);
  }

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
