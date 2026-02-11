/**
 * Test Suite: Feature #9 - Flag schemas work on actors
 *
 * Verifies that the module can read/write flags on actors for quick-lookup
 * of applied archetypes. Tests the appliedArchetypes flag structure:
 *   flags["archetype-manager"].appliedArchetypes = { classTag: [slug1, slug2], ... }
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

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
  console.log('=== Feature #9: Flag schemas work on actors ===\n');

  // Set up mock environment
  setupMockEnvironment();

  // --- Test 1: Create a test actor ---
  console.log('Test 1: Create a test actor');
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Character', [fighter]);
  assert(actor.name === 'Test Character', 'Actor created successfully');
  assert(actor.getFlag(MODULE_ID, 'appliedArchetypes') === null, 'No applied archetypes initially');

  // --- Test 2: Set appliedArchetypes flag with structure ---
  console.log('\nTest 2: Set appliedArchetypes flag with structure');
  const archetypeData = {
    fighter: ['two-handed-fighter']
  };
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', archetypeData);
  const readData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(readData !== null, 'appliedArchetypes flag is set');
  assert(typeof readData === 'object', 'appliedArchetypes is an object');
  assert(!Array.isArray(readData), 'appliedArchetypes is not an array');

  // --- Test 3: Read flag back and verify ---
  console.log('\nTest 3: Read flag back and verify');
  const verifyData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert('fighter' in verifyData, 'fighter key exists');
  assert(Array.isArray(verifyData.fighter), 'fighter value is an array');
  assert(verifyData.fighter.length === 1, 'fighter has 1 archetype');
  assert(verifyData.fighter[0] === 'two-handed-fighter', 'fighter archetype is two-handed-fighter');

  // --- Test 4: Update flag to add another class ---
  console.log('\nTest 4: Update flag to add another class');
  const currentData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  currentData.rogue = ['knife-master'];
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', currentData);
  const updatedData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert('fighter' in updatedData, 'fighter class still present after update');
  assert('rogue' in updatedData, 'rogue class added');

  // --- Test 5: Verify both entries exist ---
  console.log('\nTest 5: Verify both entries exist');
  const bothData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assertDeepEqual(bothData.fighter, ['two-handed-fighter'], 'Fighter archetype intact');
  assertDeepEqual(bothData.rogue, ['knife-master'], 'Rogue archetype intact');
  assert(Object.keys(bothData).length === 2, 'Exactly 2 class entries');

  // --- Test 6: Unset flag and verify cleanup ---
  console.log('\nTest 6: Unset flag and verify cleanup');
  await actor.unsetFlag(MODULE_ID, 'appliedArchetypes');
  assert(actor.getFlag(MODULE_ID, 'appliedArchetypes') === null, 'appliedArchetypes is null after unset');

  // --- Test 7: Multi-archetype stacking on single class ---
  console.log('\nTest 7: Multi-archetype stacking on single class');
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', {
    fighter: ['two-handed-fighter', 'weapon-master']
  });
  const stacked = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(stacked.fighter.length === 2, 'Fighter has 2 stacked archetypes');
  assert(stacked.fighter[0] === 'two-handed-fighter', 'First archetype correct');
  assert(stacked.fighter[1] === 'weapon-master', 'Second archetype correct');
  await actor.unsetFlag(MODULE_ID, 'appliedArchetypes');

  // --- Test 8: Multiple classes with multiple archetypes ---
  console.log('\nTest 8: Multiple classes with multiple archetypes');
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', {
    fighter: ['two-handed-fighter', 'weapon-master'],
    wizard: ['school-savant'],
    rogue: ['knife-master', 'scout']
  });
  const multiData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(Object.keys(multiData).length === 3, 'Three class entries');
  assert(multiData.fighter.length === 2, 'Fighter has 2 archetypes');
  assert(multiData.wizard.length === 1, 'Wizard has 1 archetype');
  assert(multiData.rogue.length === 2, 'Rogue has 2 archetypes');
  await actor.unsetFlag(MODULE_ID, 'appliedArchetypes');

  // --- Test 9: Incremental add of archetypes (simulates Applicator.apply) ---
  console.log('\nTest 9: Incremental add simulating Applicator.apply workflow');
  // First archetype applied
  const actorArchetypes1 = actor.getFlag(MODULE_ID, 'appliedArchetypes') || {};
  const classTag = 'fighter';
  actorArchetypes1[classTag] = [...(actorArchetypes1[classTag] || []), 'two-handed-fighter'];
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', actorArchetypes1);

  assert(actor.getFlag(MODULE_ID, 'appliedArchetypes').fighter.length === 1, 'One archetype after first apply');

  // Second archetype applied
  const actorArchetypes2 = actor.getFlag(MODULE_ID, 'appliedArchetypes') || {};
  actorArchetypes2[classTag] = [...(actorArchetypes2[classTag] || []), 'weapon-master'];
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', actorArchetypes2);

  assert(actor.getFlag(MODULE_ID, 'appliedArchetypes').fighter.length === 2, 'Two archetypes after second apply');
  assertDeepEqual(actor.getFlag(MODULE_ID, 'appliedArchetypes').fighter, ['two-handed-fighter', 'weapon-master'], 'Both archetypes present');
  await actor.unsetFlag(MODULE_ID, 'appliedArchetypes');

  // --- Test 10: Selective removal simulating Applicator.remove ---
  console.log('\nTest 10: Selective removal simulating Applicator.remove');
  await actor.setFlag(MODULE_ID, 'appliedArchetypes', {
    fighter: ['two-handed-fighter', 'weapon-master'],
    rogue: ['knife-master']
  });

  // Remove weapon-master from fighter
  const removeData = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  removeData.fighter = removeData.fighter.filter(a => a !== 'weapon-master');
  if (removeData.fighter.length === 0) {
    delete removeData.fighter;
  }
  await actor.setFlag(MODULE_ID, 'appliedArchetypes',
    Object.keys(removeData).length > 0 ? removeData : null
  );

  const afterRemove = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assertDeepEqual(afterRemove.fighter, ['two-handed-fighter'], 'weapon-master removed, two-handed-fighter remains');
  assertDeepEqual(afterRemove.rogue, ['knife-master'], 'Rogue not affected by fighter removal');

  // Remove last fighter archetype
  const removeData2 = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  removeData2.fighter = removeData2.fighter.filter(a => a !== 'two-handed-fighter');
  if (removeData2.fighter.length === 0) {
    delete removeData2.fighter;
  }
  await actor.setFlag(MODULE_ID, 'appliedArchetypes',
    Object.keys(removeData2).length > 0 ? removeData2 : null
  );

  const afterRemove2 = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  assert(!('fighter' in afterRemove2), 'Fighter class removed when empty');
  assertDeepEqual(afterRemove2.rogue, ['knife-master'], 'Rogue still intact');

  // Remove last rogue archetype — should null the whole flag
  const removeData3 = actor.getFlag(MODULE_ID, 'appliedArchetypes');
  removeData3.rogue = removeData3.rogue.filter(a => a !== 'knife-master');
  if (removeData3.rogue.length === 0) {
    delete removeData3.rogue;
  }
  const finalValue = Object.keys(removeData3).length > 0 ? removeData3 : null;
  if (finalValue === null) {
    await actor.unsetFlag(MODULE_ID, 'appliedArchetypes');
  } else {
    await actor.setFlag(MODULE_ID, 'appliedArchetypes', finalValue);
  }

  assert(actor.getFlag(MODULE_ID, 'appliedArchetypes') === null, 'Flag is null after all archetypes removed');

  // --- Test 11: Flag isolation between actors ---
  console.log('\nTest 11: Flag isolation between actors');
  const actor1 = createMockActor('Actor 1', []);
  const actor2 = createMockActor('Actor 2', []);

  await actor1.setFlag(MODULE_ID, 'appliedArchetypes', { fighter: ['archetype-a'] });
  await actor2.setFlag(MODULE_ID, 'appliedArchetypes', { wizard: ['archetype-b'] });

  const data1 = actor1.getFlag(MODULE_ID, 'appliedArchetypes');
  const data2 = actor2.getFlag(MODULE_ID, 'appliedArchetypes');

  assert('fighter' in data1 && !('wizard' in data1), 'Actor 1 has fighter only');
  assert('wizard' in data2 && !('fighter' in data2), 'Actor 2 has wizard only');

  await actor1.unsetFlag(MODULE_ID, 'appliedArchetypes');
  assert(actor1.getFlag(MODULE_ID, 'appliedArchetypes') === null, 'Actor 1 flag cleared');
  assertDeepEqual(actor2.getFlag(MODULE_ID, 'appliedArchetypes'), { wizard: ['archetype-b'] }, 'Actor 2 flag unaffected');

  await actor2.unsetFlag(MODULE_ID, 'appliedArchetypes');

  // --- Test 12: Flag scope isolation (our module vs others) ---
  console.log('\nTest 12: Flag scope isolation between modules');
  const scopeActor = createMockActor('Scope Test', []);
  await scopeActor.setFlag(MODULE_ID, 'appliedArchetypes', { fighter: ['test'] });
  await scopeActor.setFlag('other-module', 'appliedArchetypes', { different: ['data'] });

  const ours = scopeActor.getFlag(MODULE_ID, 'appliedArchetypes');
  const theirs = scopeActor.getFlag('other-module', 'appliedArchetypes');

  assertDeepEqual(ours, { fighter: ['test'] }, 'Our module data correct');
  assertDeepEqual(theirs, { different: ['data'] }, 'Other module data correct');

  await scopeActor.unsetFlag(MODULE_ID, 'appliedArchetypes');
  assert(scopeActor.getFlag(MODULE_ID, 'appliedArchetypes') === null, 'Our flag cleared');
  assertDeepEqual(scopeActor.getFlag('other-module', 'appliedArchetypes'), { different: ['data'] }, 'Other module flag persists');

  await scopeActor.unsetFlag('other-module', 'appliedArchetypes');

  // --- Test 13: Unset on non-existent actor flag is safe ---
  console.log('\nTest 13: Unset on non-existent actor flag is safe');
  const safeActor = createMockActor('Safe Test', []);
  let unsetError = false;
  try {
    await safeActor.unsetFlag(MODULE_ID, 'appliedArchetypes');
    await safeActor.unsetFlag(MODULE_ID, 'nonexistent');
    await safeActor.unsetFlag('fake-module', 'fake-key');
  } catch (e) {
    unsetError = true;
  }
  assert(!unsetError, 'Unsetting non-existent actor flags does not throw');

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
