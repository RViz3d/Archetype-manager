/**
 * Test Suite for Feature #103: Actor sheet header button via getActorSheetHeaderButtons hook
 *
 * Verifies that:
 * 1. A Hooks.on('getActorSheetHeaderButtons', ...) listener is registered in module.mjs
 * 2. The hook checks that the actor has class items before adding the button
 * 3. A header button config object is added to the buttons array
 * 4. The button config has the correct class, icon, label, and onclick
 * 5. The button does NOT appear on actors without class items
 * 6. The CSS class is defined in styles/archetype-manager.css
 */

import { setupMockEnvironment, createMockActor, createMockClassItem } from './foundry-mock.mjs';
import { readFile } from 'fs/promises';

let passed = 0;
let failed = 0;
let totalTests = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

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

async function asyncTest(name, fn) {
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

console.log('\n=== Feature #103: Actor sheet header button via getActorSheetHeaderButtons hook ===\n');

// Set up environment
const env = setupMockEnvironment();

// Import module to register hooks
await import('../scripts/module.mjs');

// Fire the init and ready hooks
await Hooks.callAll('init');
await Hooks.callAll('ready');

// Helper: create a mock "app" object (actor sheet instance) with an actor
function createMockApp(actor) {
  return {
    actor,
    element: null
  };
}

// Helper: call the getActorSheetHeaderButtons hook and return the buttons array
async function getHeaderButtons(app) {
  const buttons = [];
  await Hooks.callAll('getActorSheetHeaderButtons', app, buttons);
  return buttons;
}

// ===================================
// Section 1: Hook registration
// ===================================
console.log('\n--- Section 1: Hook Registration ---');

test('getActorSheetHeaderButtons hook is registered', () => {
  const hooks = Hooks._hooks.get('getActorSheetHeaderButtons');
  assert(hooks, 'getActorSheetHeaderButtons hooks should be registered');
  assert(hooks.length > 0, 'getActorSheetHeaderButtons should have at least one listener');
});

test('getActorSheetHeaderButtons hook is a function', () => {
  const hooks = Hooks._hooks.get('getActorSheetHeaderButtons');
  assert(typeof hooks[0] === 'function', 'getActorSheetHeaderButtons hook should be a function');
});

// ===================================
// Section 2: Header button added for character with class items
// ===================================
console.log('\n--- Section 2: Header button added for character with class items ---');

await asyncTest('Header button is added when actor has class items', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 1, 'Should have exactly one header button');
});

await asyncTest('Button config has correct class name', async () => {
  const classItem = createMockClassItem('Wizard', 3, 'wizard');
  const actor = createMockActor('Test Wizard', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons[0].class, 'archetype-manager-header-btn', 'Button class should be archetype-manager-header-btn');
});

await asyncTest('Button config has hat-wizard icon', async () => {
  const classItem = createMockClassItem('Rogue', 4, 'rogue');
  const actor = createMockActor('Test Rogue', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons[0].icon, 'fas fa-hat-wizard', 'Button icon should be fas fa-hat-wizard');
});

await asyncTest('Button config has label "Archetypes"', async () => {
  const classItem = createMockClassItem('Cleric', 2, 'cleric');
  const actor = createMockActor('Test Cleric', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons[0].label, 'Archetypes', 'Button label should be "Archetypes"');
});

await asyncTest('Button config has onclick function', async () => {
  const classItem = createMockClassItem('Bard', 6, 'bard');
  const actor = createMockActor('Test Bard', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assert(typeof buttons[0].onclick === 'function', 'Button should have an onclick function');
});

await asyncTest('Button works with multi-class actor', async () => {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Multiclass', [fighter, rogue]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 1, 'Should have exactly one header button for multi-class actor');
});

// ===================================
// Section 3: Button NOT added for actors without class items
// ===================================
console.log('\n--- Section 3: Button NOT added for actors without class items ---');

await asyncTest('No button when actor has no class items', async () => {
  const actor = createMockActor('No Classes', []);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'Should have no header buttons when actor has no class items');
});

await asyncTest('No button when actor has only non-class items', async () => {
  const actor = createMockActor('No Classes', []);
  const fakeItems = [
    { type: 'feat', name: 'Power Attack' },
    { type: 'weapon', name: 'Longsword' }
  ];
  actor.items = {
    filter: (fn) => fakeItems.filter(fn),
    find: (fn) => fakeItems.find(fn),
    get: (id) => fakeItems.find(i => i.id === id),
    map: (fn) => fakeItems.map(fn),
    [Symbol.iterator]: () => fakeItems[Symbol.iterator]()
  };
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'Should have no header buttons when actor has only non-class items');
});

await asyncTest('No button when actor is null', async () => {
  const app = { actor: null };

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'Should have no header buttons when actor is null');
});

await asyncTest('No button when app has no actor', async () => {
  const app = {};

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'Should have no header buttons when app has no actor');
});

// ===================================
// Section 4: Button onclick handler
// ===================================
console.log('\n--- Section 4: Button onclick handler ---');

await asyncTest('onclick calls ArchetypeManager.open with actor', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Click Test', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);

  let openCalledWith = null;
  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => { openCalledWith = actorArg; };

  try {
    await buttons[0].onclick();

    assert(openCalledWith !== null, 'ArchetypeManager.open should be called on onclick');
    assertEqual(openCalledWith.name, 'Click Test', 'Should pass the correct actor to open()');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

await asyncTest('onclick passes the specific actor via closure', async () => {
  const classItem1 = createMockClassItem('Fighter', 5, 'fighter');
  const actor1 = createMockActor('Actor One', [classItem1]);
  actor1.type = 'character';

  const classItem2 = createMockClassItem('Wizard', 3, 'wizard');
  const actor2 = createMockActor('Actor Two', [classItem2]);
  actor2.type = 'character';

  const buttons1 = await getHeaderButtons(createMockApp(actor1));
  const buttons2 = await getHeaderButtons(createMockApp(actor2));

  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  const originalOpen = ArchetypeManager.open;
  let openCalledWith = null;
  ArchetypeManager.open = async (actorArg) => { openCalledWith = actorArg; };

  try {
    await buttons2[0].onclick();

    assert(openCalledWith !== null, 'open should be called');
    assertEqual(openCalledWith.name, 'Actor Two', 'Should pass actor2 to open()');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

// ===================================
// Section 5: Fresh buttons array each call (no duplicate accumulation)
// ===================================
console.log('\n--- Section 5: Fresh buttons array each call ---');

await asyncTest('Each hook call with a fresh array produces exactly one button', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Fresh Array Test', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  // Call twice with fresh arrays
  const buttons1 = await getHeaderButtons(app);
  const buttons2 = await getHeaderButtons(app);

  assertEqual(buttons1.length, 1, 'First call should produce one button');
  assertEqual(buttons2.length, 1, 'Second call should also produce one button');
});

// ===================================
// Section 6: CSS styling verification
// ===================================
console.log('\n--- Section 6: CSS styling verification ---');

const cssContent = await readFile(new URL('../styles/archetype-manager.css', import.meta.url), 'utf-8');

test('CSS file contains .archetype-manager-header-btn class', () => {
  assert(cssContent.includes('.archetype-manager-header-btn'), 'CSS should contain .archetype-manager-header-btn');
});

test('CSS file does NOT contain old .archetype-manager-sheet-btn class', () => {
  assert(!cssContent.includes('.archetype-manager-sheet-btn'), 'CSS should NOT contain old .archetype-manager-sheet-btn');
});

test('CSS header button has hover state', () => {
  assert(cssContent.includes('.archetype-manager-header-btn:hover'), 'CSS should include hover state');
});

// ===================================
// Section 7: Source code verification
// ===================================
console.log('\n--- Section 7: Source code verification ---');

const moduleSource = await readFile(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');

test('module.mjs contains Hooks.on("getActorSheetHeaderButtons")', () => {
  assert(
    moduleSource.includes("Hooks.on('getActorSheetHeaderButtons'") || moduleSource.includes('Hooks.on("getActorSheetHeaderButtons"'),
    'module.mjs should register getActorSheetHeaderButtons hook with Hooks.on'
  );
});

test('module.mjs does NOT contain renderActorSheet hook', () => {
  assert(
    !moduleSource.includes("Hooks.on('renderActorSheet'") && !moduleSource.includes('Hooks.on("renderActorSheet"'),
    'module.mjs should NOT contain old renderActorSheet hook'
  );
});

test('module.mjs does NOT contain renderTokenHUD hook', () => {
  assert(
    !moduleSource.includes("Hooks.on('renderTokenHUD'") && !moduleSource.includes('Hooks.on("renderTokenHUD"'),
    'module.mjs should NOT contain renderTokenHUD hook'
  );
});

test('Hook uses buttons.unshift to add button', () => {
  assert(
    moduleSource.includes('buttons.unshift'),
    'Hook should use buttons.unshift to add the header button'
  );
});

test('Hook creates button with archetype-manager-header-btn class', () => {
  assert(
    moduleSource.includes('archetype-manager-header-btn'),
    'Hook should create button with archetype-manager-header-btn class'
  );
});

test('Hook calls ArchetypeManager.open with actor', () => {
  assert(
    moduleSource.includes('ArchetypeManager.open(actor') || moduleSource.includes('ArchetypeManager.open( actor'),
    'Hook should call ArchetypeManager.open with the actor'
  );
});

test('Hook checks for class items', () => {
  assert(
    moduleSource.includes("type === 'class'") || moduleSource.includes('type === "class"'),
    'Hook callback should check for class item type'
  );
});

// ===================================
// Section 8: Edge cases
// ===================================
console.log('\n--- Section 8: Edge cases ---');

await asyncTest('Actor with type undefined but has class items gets button', async () => {
  const classItem = createMockClassItem('Sorcerer', 6, 'sorcerer');
  const actor = createMockActor('Typeless', [classItem]);
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 1, 'Actor with class items should get header button even without explicit type');
});

await asyncTest('Actor with items.filter as undefined is handled gracefully', async () => {
  const actor = { name: 'Broken', type: 'character', items: null };
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'Should not add button when items is null');
});

await asyncTest('Actor with empty items array gets no button', async () => {
  const actor = createMockActor('Empty Items', []);
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'No button for actor with empty items array');
});

await asyncTest('Actor with only feats gets no button', async () => {
  const items = [
    { type: 'feat', name: 'Power Attack' },
    { type: 'feat', name: 'Cleave' }
  ];
  const actor = createMockActor('Feats Only', []);
  actor.items = {
    filter: (fn) => items.filter(fn),
    find: (fn) => items.find(fn),
    get: (id) => null,
    map: (fn) => items.map(fn),
    [Symbol.iterator]: () => items[Symbol.iterator]()
  };
  actor.type = 'character';
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assertEqual(buttons.length, 0, 'No button for actor with only feat-type items');
});

// ===================================
// Summary
// ===================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #103 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
