/**
 * Test Suite for Feature #104: Actor sheet header button click opens Archetype Manager for that actor
 *
 * Verifies that:
 * 1. The header button onclick callback calls ArchetypeManager.open(actor)
 * 2. Clicking the button opens the Archetype Manager main dialog
 * 3. The dialog is pre-populated with the correct actor's class items
 * 4. The button works without needing a token selected on the canvas
 * 5. If the user lacks permission on the actor, an appropriate warning is shown
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

console.log('\n=== Feature #104: Actor sheet header button click opens Archetype Manager for that actor ===\n');

// Set up environment
const env = setupMockEnvironment();

// Import module to register hooks
await import('../scripts/module.mjs');

// Fire the init and ready hooks to set everything up
await Hooks.callAll('init');
await Hooks.callAll('ready');

// Import ArchetypeManager for spying
const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');

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
// Section 1: onclick handler retrieves actor and calls ArchetypeManager.open(actor)
// ===================================
console.log('\n--- Section 1: onclick handler retrieves actor and calls ArchetypeManager.open(actor) ---');

await asyncTest('onclick handler calls ArchetypeManager.open with the sheet actor', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Sheet Fighter', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  const app = createMockApp(actor);

  const buttons = await getHeaderButtons(app);
  assert(buttons.length > 0, 'Should have header button');

  let openCalledWith = null;
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => { openCalledWith = actorArg; };

  try {
    await buttons[0].onclick();

    assert(openCalledWith !== null, 'ArchetypeManager.open should be called on onclick');
    assertEqual(openCalledWith.name, 'Sheet Fighter', 'Should pass the sheet actor to open()');
    assertEqual(openCalledWith.id, actor.id, 'Should pass the exact same actor object (by id)');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

await asyncTest('onclick handler passes the actor from app.actor, not a token actor', async () => {
  const classItem = createMockClassItem('Wizard', 10, 'wizard');
  const actor = createMockActor('Sheet Wizard', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;

  // Set a different actor on the canvas token to prove sheet actor takes priority
  const tokenClassItem = createMockClassItem('Rogue', 3, 'rogue');
  const tokenActor = createMockActor('Token Rogue', [tokenClassItem]);
  tokenActor.isOwner = true;
  globalThis.canvas.tokens.controlled = [{ actor: tokenActor }];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let openCalledWith = null;
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => { openCalledWith = actorArg; };

  try {
    await buttons[0].onclick();

    assert(openCalledWith !== null, 'ArchetypeManager.open should be called');
    assertEqual(openCalledWith.name, 'Sheet Wizard', 'Should pass the SHEET actor, not the token actor');
  } finally {
    ArchetypeManager.open = originalOpen;
    globalThis.canvas.tokens.controlled = [];
  }
});

await asyncTest('onclick handler calls open with the actor closure, not a stale reference', async () => {
  // Create two different actors and get their header buttons
  const classItem1 = createMockClassItem('Fighter', 5, 'fighter');
  const actor1 = createMockActor('First Actor', [classItem1]);
  actor1.type = 'character';
  actor1.isOwner = true;

  const classItem2 = createMockClassItem('Rogue', 3, 'rogue');
  const actor2 = createMockActor('Second Actor', [classItem2]);
  actor2.type = 'character';
  actor2.isOwner = true;

  const buttons1 = await getHeaderButtons(createMockApp(actor1));
  const buttons2 = await getHeaderButtons(createMockApp(actor2));

  const calls = [];
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => { calls.push(actorArg); };

  try {
    await buttons1[0].onclick();
    await buttons2[0].onclick();

    assertEqual(calls.length, 2, 'Should have two calls to open');
    assertEqual(calls[0].name, 'First Actor', 'First onclick should pass first actor');
    assertEqual(calls[1].name, 'Second Actor', 'Second onclick should pass second actor');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

// ===================================
// Section 2: Clicking button opens the Archetype Manager main dialog
// ===================================
console.log('\n--- Section 2: Clicking button opens the Archetype Manager main dialog ---');

await asyncTest('onclick calls UIManager.showMainDialog', async () => {
  const classItem = createMockClassItem('Cleric', 6, 'cleric');
  const actor = createMockActor('Dialog Cleric', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let showMainDialogCalled = false;
  let capturedActor = null;
  const origShowMainDialog = UIManager.showMainDialog;
  UIManager.showMainDialog = async (a, ci) => {
    showMainDialogCalled = true;
    capturedActor = a;
    return origShowMainDialog.call(UIManager, a, ci);
  };

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    assert(showMainDialogCalled, 'UIManager.showMainDialog should be called after onclick');
    assertEqual(capturedActor.name, 'Dialog Cleric', 'Should pass the correct actor to showMainDialog');
  } finally {
    UIManager.showMainDialog = origShowMainDialog;
  }
});

await asyncTest('Dialog is created as a Dialog instance after onclick', async () => {
  const classItem = createMockClassItem('Sorcerer', 4, 'sorcerer');
  const actor = createMockActor('Dialog Sorcerer', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  // Clear last dialog
  globalThis.Dialog._lastInstance = null;

  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  assert(globalThis.Dialog._lastInstance !== null, 'A Dialog should have been created');
});

await asyncTest('Dialog contains the Archetype Manager UI content', async () => {
  const classItem = createMockClassItem('Bard', 8, 'bard');
  const actor = createMockActor('Dialog Bard', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  globalThis.Dialog._lastInstance = null;

  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Dialog should exist');
  assert(dialog.data.content, 'Dialog should have content');
  assert(dialog.data.content.includes('archetype-manager'), 'Dialog content should include archetype-manager class');
  assert(dialog.data.content.includes('class-select'), 'Dialog content should include class-select dropdown');
});

// ===================================
// Section 3: Dialog is pre-populated with the correct actor's class items
// ===================================
console.log('\n--- Section 3: Dialog is pre-populated with the correct actor\'s class items ---');

await asyncTest('Dialog class dropdown contains the actor\'s class name', async () => {
  const classItem = createMockClassItem('Monk', 9, 'monk');
  const actor = createMockActor('Dropdown Monk', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  globalThis.Dialog._lastInstance = null;

  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Dialog should exist');
  assert(dialog.data.content.includes('Monk'), 'Dialog content should contain the class name "Monk"');
});

await asyncTest('Multi-class actor: dialog dropdown contains all classes', async () => {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const wizard = createMockClassItem('Wizard', 1, 'wizard');
  const actor = createMockActor('Multiclass Hero', [fighter, rogue, wizard]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  globalThis.Dialog._lastInstance = null;

  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Dialog should exist');
  assert(dialog.data.content.includes('Fighter'), 'Dialog should contain Fighter');
  assert(dialog.data.content.includes('Rogue'), 'Dialog should contain Rogue');
  assert(dialog.data.content.includes('Wizard'), 'Dialog should contain Wizard');
});

await asyncTest('Dialog class dropdown option values match class item IDs', async () => {
  const classItem = createMockClassItem('Druid', 7, 'druid');
  const actor = createMockActor('ID Druid', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  globalThis.Dialog._lastInstance = null;

  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Dialog should exist');
  assert(dialog.data.content.includes(`value="${classItem.id}"`), `Dialog dropdown should have option value matching class item ID "${classItem.id}"`);
});

await asyncTest('Dialog class dropdown shows level for each class', async () => {
  const classItem = createMockClassItem('Barbarian', 12, 'barbarian');
  const actor = createMockActor('Level Barb', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  globalThis.Dialog._lastInstance = null;

  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Dialog should exist');
  assert(dialog.data.content.includes('Lv 12'), 'Dialog should show the class level (Lv 12)');
});

// ===================================
// Section 4: Button works without needing a token selected on the canvas
// ===================================
console.log('\n--- Section 4: Button works without needing a token selected on the canvas ---');

await asyncTest('onclick works with no tokens selected on canvas', async () => {
  globalThis.canvas.tokens.controlled = [];

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('No Token Fighter', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let warnMessages = [];
  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  let openCalled = false;
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => {
    openCalled = true;
    return originalOpen.call(ArchetypeManager, actorArg);
  };

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    assert(openCalled, 'open() should be called');
    const tokenWarns = warnMessages.filter(m => m.includes('select a token'));
    assertEqual(tokenWarns.length, 0, 'Should NOT show "select a token" warning when using header button');
  } finally {
    ArchetypeManager.open = originalOpen;
    globalThis.ui.notifications.warn = origWarn;
  }
});

await asyncTest('onclick works even when canvas.tokens is undefined', async () => {
  const origTokens = globalThis.canvas.tokens;
  globalThis.canvas.tokens = undefined;

  const classItem = createMockClassItem('Ranger', 6, 'ranger');
  const actor = createMockActor('No Canvas Ranger', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let warnMessages = [];
  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  let openCalledWithActor = null;
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => {
    openCalledWithActor = actorArg;
    return originalOpen.call(ArchetypeManager, actorArg);
  };

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    assert(openCalledWithActor !== null, 'open() should be called with the actor');
    assertEqual(openCalledWithActor.name, 'No Canvas Ranger', 'Should use the sheet actor');
    const tokenWarns = warnMessages.filter(m => m.includes('select a token'));
    assertEqual(tokenWarns.length, 0, 'Should NOT show "select a token" warning');
  } finally {
    ArchetypeManager.open = originalOpen;
    globalThis.ui.notifications.warn = origWarn;
    globalThis.canvas.tokens = origTokens;
  }
});

await asyncTest('onclick bypasses token selection entirely — uses actor param path', async () => {
  globalThis.canvas.tokens.controlled = [];

  const classItem = createMockClassItem('Witch', 5, 'witch');
  const actor = createMockActor('Bypass Witch', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let capturedActor = null;
  const origShowMainDialog = UIManager.showMainDialog;
  UIManager.showMainDialog = async (a, ci) => {
    capturedActor = a;
    return origShowMainDialog.call(UIManager, a, ci);
  };

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    assert(capturedActor !== null, 'showMainDialog should be called with actor');
    assertEqual(capturedActor.name, 'Bypass Witch', 'The actor passed should be from the sheet, not a token');
  } finally {
    UIManager.showMainDialog = origShowMainDialog;
  }
});

// ===================================
// Section 5: Permission check — user lacks permission shows warning
// ===================================
console.log('\n--- Section 5: Permission check — user lacks permission shows warning ---');

await asyncTest('Non-GM, non-owner onclick shows permission warning', async () => {
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Not My Fighter', [classItem]);
  actor.type = 'character';
  actor.isOwner = false;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  assert(buttons.length > 0, 'Header button should still be added (permission check is in open(), not in hook)');

  let warnMessages = [];
  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    assert(warnMessages.length > 0, 'Should show a permission warning');
    assert(warnMessages.some(m => m.includes('permission')), `Warning should mention "permission", got: ${warnMessages.join('; ')}`);
  } finally {
    globalThis.game.user.isGM = true;
    globalThis.ui.notifications.warn = origWarn;
  }
});

await asyncTest('GM can click button on any actor sheet (even non-owned)', async () => {
  globalThis.game.user.isGM = true;

  const classItem = createMockClassItem('Cleric', 8, 'cleric');
  const actor = createMockActor('NPC Cleric', [classItem]);
  actor.type = 'character';
  actor.isOwner = false;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let warnMessages = [];
  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    const permWarns = warnMessages.filter(m => m.includes('permission'));
    assertEqual(permWarns.length, 0, 'GM should not get permission warning');
  } finally {
    globalThis.ui.notifications.warn = origWarn;
  }
});

await asyncTest('Owner can click button on owned actor sheet', async () => {
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Rogue', 6, 'rogue');
  const actor = createMockActor('My Rogue', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let warnMessages = [];
  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    const permWarns = warnMessages.filter(m => m.includes('permission'));
    assertEqual(permWarns.length, 0, 'Owner should not get permission warning');
  } finally {
    globalThis.game.user.isGM = true;
    globalThis.ui.notifications.warn = origWarn;
  }
});

await asyncTest('Permission denied: no dialog opened', async () => {
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Wizard', 10, 'wizard');
  const actor = createMockActor('Forbidden Wizard', [classItem]);
  actor.type = 'character';
  actor.isOwner = false;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let showMainDialogCalled = false;
  const origShowMainDialog = UIManager.showMainDialog;
  UIManager.showMainDialog = async () => { showMainDialogCalled = true; };

  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = () => {};

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    assertEqual(showMainDialogCalled, false, 'showMainDialog should NOT be called when permission denied');
  } finally {
    UIManager.showMainDialog = origShowMainDialog;
    globalThis.ui.notifications.warn = origWarn;
    globalThis.game.user.isGM = true;
  }
});

// ===================================
// Section 6: Source code verification — the wiring is in module.mjs
// ===================================
console.log('\n--- Section 6: Source code verification ---');

const moduleSource = await readFile(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');

test('getActorSheetHeaderButtons hook extracts actor from app.actor', () => {
  assert(
    moduleSource.includes('app.actor') || moduleSource.includes('app?.actor'),
    'Hook should extract actor from app.actor'
  );
});

test('onclick handler calls ArchetypeManager.open(actor)', () => {
  assert(
    moduleSource.includes('ArchetypeManager.open(actor'),
    'onclick handler should call ArchetypeManager.open with the actor'
  );
});

test('Hook uses buttons.unshift to add button config', () => {
  assert(
    moduleSource.includes('buttons.unshift'),
    'Hook should use buttons.unshift to add the header button'
  );
});

// ===================================
// Section 7: End-to-end flow — header button onclick → dialog open → correct actor
// ===================================
console.log('\n--- Section 7: End-to-end flow ---');

await asyncTest('Full E2E: header button → onclick → dialog opens with correct actor and classes', async () => {
  globalThis.game.user.isGM = true;
  globalThis.canvas.tokens.controlled = [];

  const fighter = createMockClassItem('Fighter', 8, 'fighter');
  const cleric = createMockClassItem('Cleric', 4, 'cleric');
  const actor = createMockActor('E2E MultiClass', [fighter, cleric]);
  actor.type = 'character';
  actor.isOwner = true;

  const app = createMockApp(actor);

  // Step 1: Get header buttons
  const buttons = await getHeaderButtons(app);
  assert(buttons.length > 0, 'Step 1: Header button should be added');

  // Step 2: Call onclick
  globalThis.Dialog._lastInstance = null;
  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  // Step 3: Verify dialog opened
  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Step 2: Dialog should be created');

  // Step 4: Verify dialog content has both classes
  assert(dialog.data.content.includes('Fighter'), 'Step 3: Dialog should contain Fighter class');
  assert(dialog.data.content.includes('Cleric'), 'Step 3: Dialog should contain Cleric class');
  assert(dialog.data.content.includes('Lv 8'), 'Step 3: Dialog should show Fighter level (8)');
  assert(dialog.data.content.includes('Lv 4'), 'Step 3: Dialog should show Cleric level (4)');

  // Step 5: Verify archetype manager UI elements
  assert(dialog.data.content.includes('archetype-search'), 'Step 4: Dialog should have search input');
  assert(dialog.data.content.includes('archetype-list'), 'Step 4: Dialog should have archetype list');
  assert(dialog.data.content.includes('Applied Archetypes'), 'Step 4: Dialog should have applied section');
});

await asyncTest('Full E2E: onclick with no canvas tokens still opens dialog', async () => {
  globalThis.canvas.tokens.controlled = [];

  const classItem = createMockClassItem('Magus', 3, 'magus');
  const actor = createMockActor('E2E Magus', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let warnMessages = [];
  const origWarn = globalThis.ui.notifications.warn;
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  globalThis.Dialog._lastInstance = null;

  try {
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 50));

    const dialog = globalThis.Dialog._lastInstance;
    assert(dialog, 'Dialog should open even without canvas tokens');
    assertEqual(warnMessages.filter(m => m.includes('token')).length, 0, 'No token-related warnings');
    assert(dialog.data.content.includes('Magus'), 'Dialog should contain Magus class');
  } finally {
    globalThis.ui.notifications.warn = origWarn;
  }
});

// ===================================
// Section 8: Edge cases
// ===================================
console.log('\n--- Section 8: Edge cases ---');

await asyncTest('Multiple onclick calls each invoke open', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Rapid Click Fighter', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);

  let openCount = 0;
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => {
    openCount++;
    return originalOpen.call(ArchetypeManager, actorArg);
  };

  try {
    await buttons[0].onclick();
    await buttons[0].onclick();
    await buttons[0].onclick();
    await new Promise(r => setTimeout(r, 100));

    assertEqual(openCount, 3, 'Each onclick should invoke open() once');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

await asyncTest('onclick with actor whose class item has only system.levels (not level)', async () => {
  const classItem = {
    id: 'test-levels-id',
    name: 'Gunslinger',
    type: 'class',
    system: {
      levels: 7,
      tag: 'gunslinger',
      links: { classAssociations: [] }
    },
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key] ?? null; },
    async setFlag(scope, key, value) { if (!this.flags[scope]) this.flags[scope] = {}; this.flags[scope][key] = value; },
    async unsetFlag(scope, key) { if (this.flags[scope]) delete this.flags[scope][key]; },
    async update(data) {}
  };

  const actor = createMockActor('Levels Gunslinger', [classItem]);
  actor.type = 'character';
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [];

  const app = createMockApp(actor);
  const buttons = await getHeaderButtons(app);
  assert(buttons.length > 0, 'Should have header button');

  globalThis.Dialog._lastInstance = null;
  await buttons[0].onclick();
  await new Promise(r => setTimeout(r, 50));

  const dialog = globalThis.Dialog._lastInstance;
  assert(dialog, 'Dialog should open');
  assert(dialog.data.content.includes('Gunslinger'), 'Dialog should contain the class name');
});

// ===================================
// Section 9: Primary user-facing entry point verification
// ===================================
console.log('\n--- Section 9: Primary entry point verification ---');

test('The header button is the primary user-facing entry point for the module', () => {
  const headerHooks = Hooks._hooks.get('getActorSheetHeaderButtons');
  assert(headerHooks && headerHooks.length > 0, 'getActorSheetHeaderButtons hook should be registered for primary entry point');
});

test('The onclick handler does not require any token to be selected', () => {
  // Source code verification: the onclick passes actor directly via closure
  const hookSection = moduleSource.substring(
    moduleSource.indexOf("getActorSheetHeaderButtons"),
    moduleSource.length
  );
  assert(
    hookSection.includes('ArchetypeManager.open(actor'),
    'The header button onclick should pass actor directly, not rely on token selection'
  );
});

// ===================================
// Summary
// ===================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #104 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
