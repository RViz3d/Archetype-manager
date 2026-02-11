/**
 * Test Suite: Feature #8 - Flag schemas work on class items
 *
 * Verifies that the module can read/write flags on class items for tracking
 * applied archetypes. Tests setFlag, getFlag, unsetFlag with the archetype-manager
 * namespace for all three flag types: archetypes, originalAssociations, appliedAt.
 */

import { setupMockEnvironment, createMockClassItem, createMockActor, resetMockEnvironment } from './foundry-mock.mjs';

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

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message} — expected ${expectedStr}, got ${actualStr}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Feature #8: Flag schemas work on class items ===\n');

  // Set up mock environment
  setupMockEnvironment();

  // --- Test 1: Create test actor with Fighter class item ---
  console.log('Test 1: Create test actor with Fighter class item');
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Character', [fighter]);
  assert(fighter.name === 'Fighter', 'Fighter class item created');
  assert(fighter.type === 'class', 'Item type is class');
  assert(fighter.system.level === 5, 'Fighter level is 5');
  assert(fighter.system.tag === 'fighter', 'Fighter tag is correct');
  assert(actor.name === 'Test Character', 'Actor created');

  // --- Test 2: Set flag: archetypes with test data ---
  console.log('\nTest 2: Set archetypes flag on class item');
  await fighter.setFlag(MODULE_ID, 'archetypes', ['test']);
  const archetypes1 = fighter.getFlag(MODULE_ID, 'archetypes');
  assertDeepEqual(archetypes1, ['test'], 'archetypes flag set to [\"test\"]');

  // --- Test 3: Read flag back and verify ['test'] ---
  console.log('\nTest 3: Read archetypes flag back');
  const readBack = fighter.getFlag(MODULE_ID, 'archetypes');
  assert(Array.isArray(readBack), 'archetypes flag is an array');
  assert(readBack.length === 1, 'archetypes has 1 entry');
  assert(readBack[0] === 'test', 'archetypes[0] is \"test\"');

  // --- Test 4: Set originalAssociations flag ---
  console.log('\nTest 4: Set originalAssociations flag');
  const mockAssociations = [
    { id: 'uuid-1', level: 1, name: 'Bonus Feat' },
    { id: 'uuid-2', level: 2, name: 'Bravery' },
    { id: 'uuid-3', level: 3, name: 'Armor Training 1' },
    { id: 'uuid-4', level: 5, name: 'Weapon Training 1' }
  ];
  await fighter.setFlag(MODULE_ID, 'originalAssociations', mockAssociations);
  const readAssoc = fighter.getFlag(MODULE_ID, 'originalAssociations');
  assert(Array.isArray(readAssoc), 'originalAssociations is an array');
  assert(readAssoc.length === 4, 'originalAssociations has 4 entries');
  assertDeepEqual(readAssoc[0], { id: 'uuid-1', level: 1, name: 'Bonus Feat' }, 'First association correct');
  assertDeepEqual(readAssoc[3], { id: 'uuid-4', level: 5, name: 'Weapon Training 1' }, 'Last association correct');

  // --- Test 5: Set appliedAt flag with timestamp ---
  console.log('\nTest 5: Set appliedAt flag with timestamp');
  const timestamp = new Date().toISOString();
  await fighter.setFlag(MODULE_ID, 'appliedAt', timestamp);
  const readTimestamp = fighter.getFlag(MODULE_ID, 'appliedAt');
  assert(readTimestamp === timestamp, 'appliedAt timestamp matches');
  assert(typeof readTimestamp === 'string', 'appliedAt is a string');
  assert(readTimestamp.includes('T'), 'appliedAt is ISO format with T separator');

  // --- Test 6: Read all three flags back and verify ---
  console.log('\nTest 6: Read all three flags back and verify');
  const allArchetypes = fighter.getFlag(MODULE_ID, 'archetypes');
  const allAssoc = fighter.getFlag(MODULE_ID, 'originalAssociations');
  const allTimestamp = fighter.getFlag(MODULE_ID, 'appliedAt');
  assertDeepEqual(allArchetypes, ['test'], 'archetypes still correct after other flag writes');
  assert(allAssoc.length === 4, 'originalAssociations still has 4 entries');
  assert(allTimestamp === timestamp, 'appliedAt still correct');

  // --- Test 7: Unset flags and verify cleanup ---
  console.log('\nTest 7: Unset flags and verify cleanup');
  await fighter.unsetFlag(MODULE_ID, 'archetypes');
  assert(fighter.getFlag(MODULE_ID, 'archetypes') === null, 'archetypes flag is null after unset');

  await fighter.unsetFlag(MODULE_ID, 'originalAssociations');
  assert(fighter.getFlag(MODULE_ID, 'originalAssociations') === null, 'originalAssociations flag is null after unset');

  await fighter.unsetFlag(MODULE_ID, 'appliedAt');
  assert(fighter.getFlag(MODULE_ID, 'appliedAt') === null, 'appliedAt flag is null after unset');

  // --- Test 8: Flag isolation between different scope namespaces ---
  console.log('\nTest 8: Flag isolation between scopes');
  await fighter.setFlag(MODULE_ID, 'archetypes', ['scope-test']);
  await fighter.setFlag('other-module', 'archetypes', ['other-data']);
  const ours = fighter.getFlag(MODULE_ID, 'archetypes');
  const theirs = fighter.getFlag('other-module', 'archetypes');
  assertDeepEqual(ours, ['scope-test'], 'Our module flag is correct');
  assertDeepEqual(theirs, ['other-data'], 'Other module flag is correct');
  // Unset ours, theirs should remain
  await fighter.unsetFlag(MODULE_ID, 'archetypes');
  assert(fighter.getFlag(MODULE_ID, 'archetypes') === null, 'Our flag gone after unset');
  assertDeepEqual(fighter.getFlag('other-module', 'archetypes'), ['other-data'], 'Other module flag persists');
  await fighter.unsetFlag('other-module', 'archetypes');

  // --- Test 9: Overwrite existing flag value ---
  console.log('\nTest 9: Overwrite existing flag value');
  await fighter.setFlag(MODULE_ID, 'archetypes', ['first']);
  assertDeepEqual(fighter.getFlag(MODULE_ID, 'archetypes'), ['first'], 'Initial value set');
  await fighter.setFlag(MODULE_ID, 'archetypes', ['first', 'second']);
  assertDeepEqual(fighter.getFlag(MODULE_ID, 'archetypes'), ['first', 'second'], 'Overwritten with two archetypes');
  await fighter.setFlag(MODULE_ID, 'archetypes', []);
  assertDeepEqual(fighter.getFlag(MODULE_ID, 'archetypes'), [], 'Overwritten with empty array');
  await fighter.unsetFlag(MODULE_ID, 'archetypes');

  // --- Test 10: Flag on uninitialized scope returns null ---
  console.log('\nTest 10: Uninitialized flag returns null');
  const freshClassItem = createMockClassItem('Wizard', 3);
  assert(freshClassItem.getFlag(MODULE_ID, 'archetypes') === null, 'archetypes flag is null on fresh item');
  assert(freshClassItem.getFlag(MODULE_ID, 'originalAssociations') === null, 'originalAssociations is null on fresh item');
  assert(freshClassItem.getFlag(MODULE_ID, 'appliedAt') === null, 'appliedAt is null on fresh item');
  assert(freshClassItem.getFlag('nonexistent-module', 'anything') === null, 'Nonexistent module flag is null');

  // --- Test 11: Multiple class items on same actor have independent flags ---
  console.log('\nTest 11: Multiple class items have independent flags');
  const wizard = createMockClassItem('Wizard', 10, 'wizard');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const multiActor = createMockActor('Multi-class', [wizard, rogue]);

  await wizard.setFlag(MODULE_ID, 'archetypes', ['school-savant']);
  await rogue.setFlag(MODULE_ID, 'archetypes', ['knife-master']);
  assertDeepEqual(wizard.getFlag(MODULE_ID, 'archetypes'), ['school-savant'], 'Wizard has school-savant');
  assertDeepEqual(rogue.getFlag(MODULE_ID, 'archetypes'), ['knife-master'], 'Rogue has knife-master');

  // Verify independence - unsetting one doesn't affect the other
  await wizard.unsetFlag(MODULE_ID, 'archetypes');
  assert(wizard.getFlag(MODULE_ID, 'archetypes') === null, 'Wizard flag cleared');
  assertDeepEqual(rogue.getFlag(MODULE_ID, 'archetypes'), ['knife-master'], 'Rogue flag still intact');
  await rogue.unsetFlag(MODULE_ID, 'archetypes');

  // --- Test 12: Complex object in originalAssociations flag ---
  console.log('\nTest 12: Complex objects in originalAssociations');
  const complexAssoc = [
    {
      id: 'Compendium.pf1.class-abilities.Item.abc123',
      level: 1,
      name: 'Bonus Feat',
      uuid: 'Compendium.pf1.class-abilities.Item.abc123'
    },
    {
      id: 'Compendium.pf1.class-abilities.Item.def456',
      level: 2,
      name: 'Bravery',
      uuid: 'Compendium.pf1.class-abilities.Item.def456'
    }
  ];
  await fighter.setFlag(MODULE_ID, 'originalAssociations', complexAssoc);
  const readComplex = fighter.getFlag(MODULE_ID, 'originalAssociations');
  assert(readComplex.length === 2, 'Complex associations preserved');
  assert(readComplex[0].uuid === 'Compendium.pf1.class-abilities.Item.abc123', 'UUID preserved');
  assert(readComplex[1].name === 'Bravery', 'Feature name preserved in complex object');
  await fighter.unsetFlag(MODULE_ID, 'originalAssociations');

  // --- Test 13: Applicator workflow simulation ---
  console.log('\nTest 13: Applicator workflow simulation (backup → track → cleanup)');
  const appFighter = createMockClassItem('Fighter', 10, 'fighter');
  const appActor = createMockActor('Workflow Test', [appFighter]);

  // Step 1: Check no archetypes exist
  const existing = appFighter.getFlag(MODULE_ID, 'archetypes') || [];
  assert(existing.length === 0, 'No archetypes initially');

  // Step 2: Backup original associations
  const origAssoc = [
    { id: 'feat-1', level: 2, name: 'Bravery' },
    { id: 'feat-2', level: 3, name: 'Armor Training 1' }
  ];
  appFighter.system.links.classAssociations = origAssoc;
  await appFighter.setFlag(MODULE_ID, 'originalAssociations', [...origAssoc]);

  // Step 3: Track archetype
  await appFighter.setFlag(MODULE_ID, 'archetypes', ['two-handed-fighter']);
  await appFighter.setFlag(MODULE_ID, 'appliedAt', new Date().toISOString());

  // Verify state
  assertDeepEqual(appFighter.getFlag(MODULE_ID, 'archetypes'), ['two-handed-fighter'], 'Archetype tracked');
  assert(appFighter.getFlag(MODULE_ID, 'originalAssociations').length === 2, 'Backup preserved');
  assert(appFighter.getFlag(MODULE_ID, 'appliedAt') !== null, 'Timestamp set');

  // Step 4: Simulate removal — restore from backup and clean up
  const backup = appFighter.getFlag(MODULE_ID, 'originalAssociations');
  appFighter.system.links.classAssociations = [...backup];
  await appFighter.unsetFlag(MODULE_ID, 'archetypes');
  await appFighter.unsetFlag(MODULE_ID, 'originalAssociations');
  await appFighter.unsetFlag(MODULE_ID, 'appliedAt');

  assert(appFighter.getFlag(MODULE_ID, 'archetypes') === null, 'Archetypes flag cleaned up');
  assert(appFighter.getFlag(MODULE_ID, 'originalAssociations') === null, 'Backup flag cleaned up');
  assert(appFighter.getFlag(MODULE_ID, 'appliedAt') === null, 'Timestamp flag cleaned up');
  assertDeepEqual(appFighter.system.links.classAssociations, origAssoc, 'ClassAssociations restored from backup');

  // --- Test 14: Persistence across simulated reload ---
  console.log('\nTest 14: Flag values verified before simulated reload');
  const persistFighter = createMockClassItem('Fighter', 7, 'fighter');
  await persistFighter.setFlag(MODULE_ID, 'archetypes', ['persist-test']);
  await persistFighter.setFlag(MODULE_ID, 'appliedAt', '2025-01-01T00:00:00.000Z');

  // Verify before "reload"
  assertDeepEqual(persistFighter.getFlag(MODULE_ID, 'archetypes'), ['persist-test'], 'Flag set before reload check');
  assert(persistFighter.getFlag(MODULE_ID, 'appliedAt') === '2025-01-01T00:00:00.000Z', 'Timestamp set before reload check');

  // Note: In real Foundry, flags persist because they're stored in the database.
  // Our mock's setFlag writes to the object's in-memory flags store, which
  // would be reloaded from Foundry's DB on page refresh. This test verifies
  // the API works correctly — real persistence is a Foundry responsibility.

  // --- Test 15: Unset on non-existent flag doesn't error ---
  console.log('\nTest 15: Unset on non-existent flag is safe');
  const safeFighter = createMockClassItem('Fighter', 1);
  let unsetError = false;
  try {
    await safeFighter.unsetFlag(MODULE_ID, 'nonexistent');
    await safeFighter.unsetFlag(MODULE_ID, 'archetypes');
    await safeFighter.unsetFlag('fake-module', 'fake-key');
  } catch (e) {
    unsetError = true;
  }
  assert(!unsetError, 'Unsetting non-existent flags does not throw');

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
