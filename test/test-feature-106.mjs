/**
 * Test Suite for Feature #106: Register entry point location setting
 *
 * Verifies that:
 * 1. A 'entryPointLocation' setting is registered with game.settings.register
 * 2. Type: String, default: 'both', scope: 'world', config: true
 * 3. Choices: 'actor-sheet', 'token-hud', 'both'
 * 4. Descriptive name and hint
 * 5. renderActorSheet hook checks this setting and only injects when value is 'actor-sheet' or 'both'
 * 6. renderTokenHUD hook checks this setting and only injects when value is 'token-hud' or 'both'
 * 7. Changing the setting controls which buttons appear
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

console.log('\n=== Feature #106: Register entry point location setting ===\n');

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

// Helper: create a mock PF1e character sheet HTML structure
function createMockSheetHTML(options = {}) {
  const div = document.createElement('div');
  div.classList.add('sheet', 'actor-sheet');

  if (options.hasFeaturesTab !== false) {
    const featuresTab = document.createElement('div');
    featuresTab.classList.add('tab');
    featuresTab.setAttribute('data-tab', 'features');

    if (options.hasInventoryHeader !== false) {
      const invHeader = document.createElement('div');
      invHeader.classList.add('inventory-header');
      invHeader.textContent = 'Features';
      featuresTab.appendChild(invHeader);
    }

    div.appendChild(featuresTab);
  }

  if (options.hasSheetBody !== false) {
    const sheetBody = document.createElement('div');
    sheetBody.classList.add('sheet-body');
    div.appendChild(sheetBody);
  }

  return div;
}

// Helper: create a mock Token HUD HTML structure
function createMockTokenHUDHTML() {
  const div = document.createElement('div');
  div.classList.add('token-hud');

  const colRight = document.createElement('div');
  colRight.classList.add('col', 'right');
  div.appendChild(colRight);

  const colLeft = document.createElement('div');
  colLeft.classList.add('col', 'left');
  div.appendChild(colLeft);

  return div;
}

// Helper: create a mock Token HUD app
function createMockTokenHUD(actor) {
  return {
    object: {
      actor,
      name: actor?.name || 'Token'
    }
  };
}

// Helper: call the renderActorSheet hooks
async function triggerRenderActorSheet(app, html, data = {}) {
  await Hooks.callAll('renderActorSheet', app, html, data);
}

// Helper: call the renderTokenHUD hooks
async function triggerRenderTokenHUD(hud, html, tokenData = {}) {
  await Hooks.callAll('renderTokenHUD', hud, html, tokenData);
}

// ===================================
// Section 1: Setting registration in init hook
// ===================================
console.log('\n--- Section 1: Setting Registration ---');

test('entryPointLocation setting is registered', () => {
  assert(
    game.settings.isRegistered('archetype-manager', 'entryPointLocation'),
    'entryPointLocation setting should be registered'
  );
});

test('Setting type is String', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg, 'Registration should exist');
  assertEqual(reg.type, String, 'Setting type should be String');
});

test('Setting default is "both"', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assertEqual(reg.default, 'both', 'Default value should be "both"');
});

test('Default value returned via game.settings.get', () => {
  const value = game.settings.get('archetype-manager', 'entryPointLocation');
  assertEqual(value, 'both', 'game.settings.get should return default "both"');
});

test('Setting scope is "world"', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assertEqual(reg.scope, 'world', 'Scope should be "world" (GM-controlled)');
});

test('Setting config is true (appears in Module Settings)', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assertEqual(reg.config, true, 'config should be true so it appears in Module Settings');
});

test('Setting has descriptive name', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg.name, 'Setting should have a name');
  assert(reg.name.length > 0, 'Name should not be empty');
});

test('Setting has descriptive hint', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg.hint, 'Setting should have a hint');
  assert(reg.hint.length > 0, 'Hint should not be empty');
});

// ===================================
// Section 2: Choices object
// ===================================
console.log('\n--- Section 2: Choices Object ---');

test('Setting has choices object', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg.choices, 'Setting should have choices object');
  assert(typeof reg.choices === 'object', 'Choices should be an object');
});

test('Choices contains "actor-sheet" option', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg.choices['actor-sheet'] !== undefined, 'Choices should include "actor-sheet"');
  assert(typeof reg.choices['actor-sheet'] === 'string', 'actor-sheet label should be a string');
});

test('Choices contains "token-hud" option', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg.choices['token-hud'] !== undefined, 'Choices should include "token-hud"');
  assert(typeof reg.choices['token-hud'] === 'string', 'token-hud label should be a string');
});

test('Choices contains "both" option', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assert(reg.choices['both'] !== undefined, 'Choices should include "both"');
  assert(typeof reg.choices['both'] === 'string', 'both label should be a string');
});

test('Choices has exactly 3 options', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  assertEqual(Object.keys(reg.choices).length, 3, 'Choices should have exactly 3 options');
});

test('Choice labels are descriptive', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'entryPointLocation');
  // Each label should mention the location
  assert(reg.choices['actor-sheet'].toLowerCase().includes('actor') || reg.choices['actor-sheet'].toLowerCase().includes('sheet'),
    'actor-sheet label should mention actor or sheet');
  assert(reg.choices['token-hud'].toLowerCase().includes('token') || reg.choices['token-hud'].toLowerCase().includes('hud'),
    'token-hud label should mention token or hud');
  assert(reg.choices['both'].toLowerCase().includes('both'),
    'both label should mention both');
});

// ===================================
// Section 3: renderActorSheet respects setting - 'both' (default)
// ===================================
console.log('\n--- Section 3: renderActorSheet with "both" (default) ---');

await asyncTest('Actor sheet button injected when setting is "both"', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Sheet Both', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Actor sheet button should be injected when setting is "both"');
});

// ===================================
// Section 4: renderActorSheet respects setting - 'actor-sheet'
// ===================================
console.log('\n--- Section 4: renderActorSheet with "actor-sheet" ---');

await asyncTest('Actor sheet button injected when setting is "actor-sheet"', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');
  const classItem = createMockClassItem('Wizard', 5, 'wizard');
  const actor = createMockActor('Sheet ActorOnly', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Actor sheet button should be injected when setting is "actor-sheet"');
});

// ===================================
// Section 5: renderActorSheet respects setting - 'token-hud'
// ===================================
console.log('\n--- Section 5: renderActorSheet with "token-hud" (should NOT inject) ---');

await asyncTest('Actor sheet button NOT injected when setting is "token-hud"', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'token-hud');
  const classItem = createMockClassItem('Rogue', 5, 'rogue');
  const actor = createMockActor('Sheet TokenOnly', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'Actor sheet button should NOT be injected when setting is "token-hud"');
});

// ===================================
// Section 6: renderTokenHUD respects setting - 'both' (default)
// ===================================
console.log('\n--- Section 6: renderTokenHUD with "both" (default) ---');

await asyncTest('Token HUD button injected when setting is "both"', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');
  const classItem = createMockClassItem('Paladin', 5, 'paladin');
  const actor = createMockActor('Token Both', [classItem]);
  actor.type = 'character';
  const hud = createMockTokenHUD(actor);
  const html = createMockTokenHUDHTML();

  await triggerRenderTokenHUD(hud, html, {});

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn, 'Token HUD button should be injected when setting is "both"');
});

// ===================================
// Section 7: renderTokenHUD respects setting - 'token-hud'
// ===================================
console.log('\n--- Section 7: renderTokenHUD with "token-hud" ---');

await asyncTest('Token HUD button injected when setting is "token-hud"', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'token-hud');
  const classItem = createMockClassItem('Cleric', 5, 'cleric');
  const actor = createMockActor('Token HUDOnly', [classItem]);
  actor.type = 'character';
  const hud = createMockTokenHUD(actor);
  const html = createMockTokenHUDHTML();

  await triggerRenderTokenHUD(hud, html, {});

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn, 'Token HUD button should be injected when setting is "token-hud"');
});

// ===================================
// Section 8: renderTokenHUD respects setting - 'actor-sheet'
// ===================================
console.log('\n--- Section 8: renderTokenHUD with "actor-sheet" (should NOT inject) ---');

await asyncTest('Token HUD button NOT injected when setting is "actor-sheet"', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');
  const classItem = createMockClassItem('Bard', 5, 'bard');
  const actor = createMockActor('Token ActorOnly', [classItem]);
  actor.type = 'character';
  const hud = createMockTokenHUD(actor);
  const html = createMockTokenHUDHTML();

  await triggerRenderTokenHUD(hud, html, {});

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(!btn, 'Token HUD button should NOT be injected when setting is "actor-sheet"');
});

// ===================================
// Section 9: Changing setting dynamically controls which buttons appear
// ===================================
console.log('\n--- Section 9: Dynamic setting changes ---');

await asyncTest('Switching from "both" to "actor-sheet" disables Token HUD button', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');

  // Verify token HUD works with "both"
  const classItem1 = createMockClassItem('Monk', 5, 'monk');
  const actor1 = createMockActor('Dynamic Token 1', [classItem1]);
  actor1.type = 'character';
  const hud1 = createMockTokenHUD(actor1);
  const html1 = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud1, html1, {});
  assert(html1.querySelector('.archetype-manager-token-btn'), 'Token HUD button should exist with "both"');

  // Switch to actor-sheet only
  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');

  // Now token HUD should NOT inject
  const classItem2 = createMockClassItem('Monk', 5, 'monk');
  const actor2 = createMockActor('Dynamic Token 2', [classItem2]);
  actor2.type = 'character';
  const hud2 = createMockTokenHUD(actor2);
  const html2 = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud2, html2, {});
  assert(!html2.querySelector('.archetype-manager-token-btn'), 'Token HUD button should NOT exist after switching to "actor-sheet"');
});

await asyncTest('Switching from "both" to "token-hud" disables actor sheet button', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');

  // Verify actor sheet works with "both"
  const classItem1 = createMockClassItem('Druid', 5, 'druid');
  const actor1 = createMockActor('Dynamic Sheet 1', [classItem1]);
  actor1.type = 'character';
  const app1 = createMockApp(actor1);
  const html1 = createMockSheetHTML();
  await triggerRenderActorSheet(app1, html1, {});
  assert(html1.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet button should exist with "both"');

  // Switch to token-hud only
  game.settings.set('archetype-manager', 'entryPointLocation', 'token-hud');

  // Now actor sheet should NOT inject
  const classItem2 = createMockClassItem('Druid', 5, 'druid');
  const actor2 = createMockActor('Dynamic Sheet 2', [classItem2]);
  actor2.type = 'character';
  const app2 = createMockApp(actor2);
  const html2 = createMockSheetHTML();
  await triggerRenderActorSheet(app2, html2, {});
  assert(!html2.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet button should NOT exist after switching to "token-hud"');
});

await asyncTest('Switching from "actor-sheet" to "both" re-enables Token HUD', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');

  // Verify token HUD is disabled
  const classItem1 = createMockClassItem('Ranger', 5, 'ranger');
  const actor1 = createMockActor('Re-enable Token 1', [classItem1]);
  actor1.type = 'character';
  const hud1 = createMockTokenHUD(actor1);
  const html1 = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud1, html1, {});
  assert(!html1.querySelector('.archetype-manager-token-btn'), 'Token HUD should be disabled with "actor-sheet"');

  // Switch to both
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');

  // Token HUD should now work
  const classItem2 = createMockClassItem('Ranger', 5, 'ranger');
  const actor2 = createMockActor('Re-enable Token 2', [classItem2]);
  actor2.type = 'character';
  const hud2 = createMockTokenHUD(actor2);
  const html2 = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud2, html2, {});
  assert(html2.querySelector('.archetype-manager-token-btn'), 'Token HUD should work again with "both"');
});

await asyncTest('Switching from "token-hud" to "both" re-enables actor sheet button', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'token-hud');

  // Verify actor sheet is disabled
  const classItem1 = createMockClassItem('Sorcerer', 5, 'sorcerer');
  const actor1 = createMockActor('Re-enable Sheet 1', [classItem1]);
  actor1.type = 'character';
  const app1 = createMockApp(actor1);
  const html1 = createMockSheetHTML();
  await triggerRenderActorSheet(app1, html1, {});
  assert(!html1.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet should be disabled with "token-hud"');

  // Switch to both
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');

  // Actor sheet should now work
  const classItem2 = createMockClassItem('Sorcerer', 5, 'sorcerer');
  const actor2 = createMockActor('Re-enable Sheet 2', [classItem2]);
  actor2.type = 'character';
  const app2 = createMockApp(actor2);
  const html2 = createMockSheetHTML();
  await triggerRenderActorSheet(app2, html2, {});
  assert(html2.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet should work again with "both"');
});

// ===================================
// Section 10: Source code verification
// ===================================
console.log('\n--- Section 10: Source code verification ---');

const moduleSource = await readFile(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');

test('module.mjs contains entryPointLocation registration', () => {
  assert(
    moduleSource.includes("'entryPointLocation'") || moduleSource.includes('"entryPointLocation"'),
    'module.mjs should register entryPointLocation setting'
  );
});

test('module.mjs contains game.settings.register for entryPointLocation', () => {
  assert(
    moduleSource.includes("game.settings.register") && moduleSource.includes('entryPointLocation'),
    'module.mjs should use game.settings.register for entryPointLocation'
  );
});

test('renderActorSheet hook checks entryPointLocation setting', () => {
  // Find the renderActorSheet section and check it references entryPointLocation
  const actorSheetIdx = moduleSource.indexOf("renderActorSheet");
  assert(actorSheetIdx > -1, 'renderActorSheet hook should exist');
  // Find the code block after renderActorSheet
  const afterHook = moduleSource.substring(actorSheetIdx);
  const nextHookIdx = afterHook.indexOf("renderTokenHUD");
  const hookBlock = nextHookIdx > 0 ? afterHook.substring(0, nextHookIdx) : afterHook;
  assert(
    hookBlock.includes('entryPointLocation'),
    'renderActorSheet hook should check entryPointLocation setting'
  );
});

test('renderTokenHUD hook checks entryPointLocation setting', () => {
  // Find the renderTokenHUD section and check it references entryPointLocation
  const tokenHUDIdx = moduleSource.indexOf("renderTokenHUD");
  assert(tokenHUDIdx > -1, 'renderTokenHUD hook should exist');
  const afterHook = moduleSource.substring(tokenHUDIdx);
  assert(
    afterHook.includes('entryPointLocation'),
    'renderTokenHUD hook should check entryPointLocation setting'
  );
});

test('renderActorSheet checks for "actor-sheet" or "both"', () => {
  const actorSheetIdx = moduleSource.indexOf("renderActorSheet");
  const afterHook = moduleSource.substring(actorSheetIdx);
  const nextHookIdx = afterHook.indexOf("renderTokenHUD");
  const hookBlock = nextHookIdx > 0 ? afterHook.substring(0, nextHookIdx) : afterHook;
  assert(
    (hookBlock.includes("'actor-sheet'") || hookBlock.includes('"actor-sheet"')) &&
    (hookBlock.includes("'both'") || hookBlock.includes('"both"')),
    'renderActorSheet should check for "actor-sheet" and "both" values'
  );
});

test('renderTokenHUD checks for "token-hud" or "both"', () => {
  const tokenHUDIdx = moduleSource.indexOf("renderTokenHUD");
  const afterHook = moduleSource.substring(tokenHUDIdx);
  assert(
    (afterHook.includes("'token-hud'") || afterHook.includes('"token-hud"')) &&
    (afterHook.includes("'both'") || afterHook.includes('"both"')),
    'renderTokenHUD should check for "token-hud" and "both" values'
  );
});

// ===================================
// Section 11: Integration with existing settings
// ===================================
console.log('\n--- Section 11: Integration with existing settings ---');

test('entryPointLocation coexists with all other module settings', () => {
  // Verify all settings are registered
  const settings = ['lastSelectedClass', 'showParseWarnings', 'autoCreateJEDB',
    'chatNotifications', 'defaultCompendiumSource', 'entryPointLocation', 'debugLogging'];
  for (const key of settings) {
    assert(
      game.settings.isRegistered('archetype-manager', key),
      `Setting "${key}" should be registered`
    );
  }
});

test('Module registers at least 7 settings after init', () => {
  const registeredCount = [...game.settings._registered.keys()].filter(k => k.startsWith('archetype-manager.')).length;
  assert(registeredCount >= 7, `Module should register at least 7 settings, found ${registeredCount}`);
});

test('Changing entryPointLocation does not affect other settings', () => {
  const showParseWarningsBefore = game.settings.get('archetype-manager', 'showParseWarnings');
  const chatNotificationsBefore = game.settings.get('archetype-manager', 'chatNotifications');
  const autoCreateBefore = game.settings.get('archetype-manager', 'autoCreateJEDB');

  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');

  assertEqual(game.settings.get('archetype-manager', 'showParseWarnings'), showParseWarningsBefore,
    'showParseWarnings should not change when entryPointLocation changes');
  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), chatNotificationsBefore,
    'chatNotifications should not change when entryPointLocation changes');
  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), autoCreateBefore,
    'autoCreateJEDB should not change when entryPointLocation changes');

  // Restore default
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');
});

// ===================================
// Section 12: Edge cases
// ===================================
console.log('\n--- Section 12: Edge cases ---');

await asyncTest('With "actor-sheet": actor sheet button appears AND token HUD button does not', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');

  // Actor sheet should inject
  const classItem1 = createMockClassItem('Fighter', 5, 'fighter');
  const actor1 = createMockActor('Edge Actor Sheet', [classItem1]);
  actor1.type = 'character';
  const app = createMockApp(actor1);
  const sheetHtml = createMockSheetHTML();
  await triggerRenderActorSheet(app, sheetHtml, {});
  assert(sheetHtml.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet button should appear with "actor-sheet"');

  // Token HUD should NOT inject
  const classItem2 = createMockClassItem('Fighter', 5, 'fighter');
  const actor2 = createMockActor('Edge Token HUD', [classItem2]);
  actor2.type = 'character';
  const hud = createMockTokenHUD(actor2);
  const hudHtml = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud, hudHtml, {});
  assert(!hudHtml.querySelector('.archetype-manager-token-btn'), 'Token HUD button should NOT appear with "actor-sheet"');
});

await asyncTest('With "token-hud": token HUD button appears AND actor sheet button does not', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'token-hud');

  // Token HUD should inject
  const classItem1 = createMockClassItem('Wizard', 5, 'wizard');
  const actor1 = createMockActor('Edge Token HUD 2', [classItem1]);
  actor1.type = 'character';
  const hud = createMockTokenHUD(actor1);
  const hudHtml = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud, hudHtml, {});
  assert(hudHtml.querySelector('.archetype-manager-token-btn'), 'Token HUD button should appear with "token-hud"');

  // Actor sheet should NOT inject
  const classItem2 = createMockClassItem('Wizard', 5, 'wizard');
  const actor2 = createMockActor('Edge Actor Sheet 2', [classItem2]);
  actor2.type = 'character';
  const app = createMockApp(actor2);
  const sheetHtml = createMockSheetHTML();
  await triggerRenderActorSheet(app, sheetHtml, {});
  assert(!sheetHtml.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet button should NOT appear with "token-hud"');
});

await asyncTest('With "both": both buttons appear simultaneously', async () => {
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');

  // Actor sheet should inject
  const classItem1 = createMockClassItem('Barbarian', 5, 'barbarian');
  const actor1 = createMockActor('Both Sheet', [classItem1]);
  actor1.type = 'character';
  const app = createMockApp(actor1);
  const sheetHtml = createMockSheetHTML();
  await triggerRenderActorSheet(app, sheetHtml, {});
  assert(sheetHtml.querySelector('.archetype-manager-sheet-btn'), 'Actor sheet button should appear with "both"');

  // Token HUD should inject
  const classItem2 = createMockClassItem('Barbarian', 5, 'barbarian');
  const actor2 = createMockActor('Both Token', [classItem2]);
  actor2.type = 'character';
  const hud = createMockTokenHUD(actor2);
  const hudHtml = createMockTokenHUDHTML();
  await triggerRenderTokenHUD(hud, hudHtml, {});
  assert(hudHtml.querySelector('.archetype-manager-token-btn'), 'Token HUD button should appear with "both"');
});

await asyncTest('Setting can be toggled multiple times in sequence', async () => {
  const values = ['actor-sheet', 'token-hud', 'both', 'actor-sheet', 'both'];
  for (const val of values) {
    game.settings.set('archetype-manager', 'entryPointLocation', val);
    assertEqual(
      game.settings.get('archetype-manager', 'entryPointLocation'),
      val,
      `Setting should hold value "${val}" after being set`
    );
  }

  // Restore
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');
});

await asyncTest('Setting only affects button injection, not other hook behavior', async () => {
  // With "token-hud", renderActorSheet still fires but does not inject button
  // Other actors without class items should still correctly NOT get buttons
  game.settings.set('archetype-manager', 'entryPointLocation', 'actor-sheet');

  const actorNoClass = createMockActor('No Class Edge', []);
  actorNoClass.type = 'character';
  const appNoClass = createMockApp(actorNoClass);
  const htmlNoClass = createMockSheetHTML();
  await triggerRenderActorSheet(appNoClass, htmlNoClass, {});
  assert(!htmlNoClass.querySelector('.archetype-manager-sheet-btn'),
    'Actor without class items should still NOT get button even with "actor-sheet" setting');

  // Restore
  game.settings.set('archetype-manager', 'entryPointLocation', 'both');
});

// ===================================
// Summary
// ===================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #106 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
