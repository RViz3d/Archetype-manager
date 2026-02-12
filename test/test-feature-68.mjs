/**
 * Test Suite for Feature #68: Main dialog opens from macro on hotbar
 *
 * Verifies:
 * 1. Module registers API accessible via game.modules.get('archetype-manager').api
 * 2. api.open() is a callable function
 * 3. Macro script game.modules.get('archetype-manager').api.open() works
 * 4. Dialog opens when token with class is selected
 * 5. Warning shown when no token selected
 * 6. Warning shown when actor has no classes
 * 7. Dialog is positioned with appropriate width
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

// Setup mock environment
const { hooks, settings } = setupMockEnvironment();

// Import module to register settings and hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import modules under test
const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// Track notifications
const notifications = [];
const origNotify = globalThis.ui.notifications;
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};

function clearNotifications() {
  notifications.length = 0;
}

// Track dialogs
const dialogTracker = [];
const OrigDialog = globalThis.Dialog;

class TrackedDialog extends OrigDialog {
  constructor(data, options) {
    super(data, options);
    dialogTracker.push(this);
  }
}

globalThis.Dialog = TrackedDialog;

function clearDialogTracker() {
  dialogTracker.length = 0;
}

// ========================
// Test Suite
// ========================

console.log('\n=== Feature #68: Main dialog opens from macro on hotbar ===\n');

// --- Module API Registration ---
console.log('--- Module API Registration ---');

// Test 1: Module API is accessible via game.modules
{
  const mod = game.modules.get('archetype-manager');
  assert(mod !== undefined && mod !== null, 'Module is registered in game.modules');
  assert(mod.api !== undefined && mod.api !== null, 'Module API is registered');
}

// Test 2: api.open is a function
{
  const mod = game.modules.get('archetype-manager');
  assert(typeof mod.api.open === 'function', 'api.open is a function');
}

// Test 3: api.MODULE_ID is set correctly
{
  const mod = game.modules.get('archetype-manager');
  assert(mod.api.MODULE_ID === 'archetype-manager', 'api.MODULE_ID is "archetype-manager"');
}

// Test 4: api.JE_DB_NAME is set correctly
{
  const mod = game.modules.get('archetype-manager');
  assert(mod.api.JE_DB_NAME === 'Archetype Manager DB', 'api.JE_DB_NAME is "Archetype Manager DB"');
}

// --- Macro Script Execution ---
console.log('\n--- Macro Script Execution ---');

// Test 5: Macro script pattern works with no token selected (shows warning)
{
  clearNotifications();
  clearDialogTracker();

  // Ensure no token is selected
  globalThis.canvas.tokens.controlled = [];

  // Execute the macro
  await game.modules.get('archetype-manager').api.open();

  assert(notifications.length > 0, 'Warning notification shown when no token selected');
  assert(notifications[0].type === 'warn', 'Notification type is warn');
  assert(notifications[0].msg.includes('select a token'), 'Warning message mentions selecting a token');
}

// Test 6: Macro shows warning when actor has no classes
{
  clearNotifications();
  clearDialogTracker();

  // Create actor with no class items
  const actor = createMockActor('Classless NPC', []);
  const token = { actor };
  globalThis.canvas.tokens.controlled = [token];

  await game.modules.get('archetype-manager').api.open();

  assert(notifications.length > 0, 'Warning shown for actor without classes');
  assert(notifications[0].type === 'warn', 'Notification type is warn');
  assert(notifications[0].msg.includes('no class'), 'Warning mentions no class items');
}

// Test 7: Macro shows warning when token has no actor
{
  clearNotifications();
  clearDialogTracker();

  // Create token without actor
  const token = { actor: null };
  globalThis.canvas.tokens.controlled = [token];

  await game.modules.get('archetype-manager').api.open();

  assert(notifications.length > 0, 'Warning shown for token without actor');
  assert(notifications[0].type === 'warn', 'Notification type is warn');
  assert(notifications[0].msg.includes('no actor'), 'Warning mentions no actor');
}

// Test 8: Macro opens dialog when valid token with class is selected
{
  clearNotifications();
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Brave Hero', [fighter]);
  const token = { actor };
  globalThis.canvas.tokens.controlled = [token];

  await game.modules.get('archetype-manager').api.open();

  assert(dialogTracker.length > 0, 'Dialog is created when valid token selected');
  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.title.includes('Brave Hero'), 'Dialog title includes actor name');
}

// Test 9: Dialog has correct width
{
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Test Hero', [fighter]);
  const token = { actor };
  globalThis.canvas.tokens.controlled = [token];

  await game.modules.get('archetype-manager').api.open();

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.options.width >= 400, `Dialog width is reasonable (${dialog.options.width})`);
}

// --- ArchetypeManager.open() Direct Call ---
console.log('\n--- ArchetypeManager.open() Direct Call ---');

// Test 10: ArchetypeManager.open() works the same as api.open
{
  clearNotifications();
  clearDialogTracker();

  // No token
  globalThis.canvas.tokens.controlled = [];
  await ArchetypeManager.open();

  assert(notifications.length > 0, 'ArchetypeManager.open() shows warning when no token');
  assert(notifications[0].msg.includes('select a token'), 'Same warning message for no token');
}

// Test 11: ArchetypeManager.open() opens dialog with valid token
{
  clearNotifications();
  clearDialogTracker();

  const wizard = createMockClassItem('Wizard', 3);
  const actor = createMockActor('Gandalf', [wizard]);
  const token = { actor };
  globalThis.canvas.tokens.controlled = [token];

  await ArchetypeManager.open();

  assert(dialogTracker.length > 0, 'ArchetypeManager.open() creates dialog for valid token');
  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.title.includes('Gandalf'), 'Dialog title includes actor name');
}

// Test 12: api.open references the same function as ArchetypeManager.open
{
  const mod = game.modules.get('archetype-manager');
  assert(mod.api.open === ArchetypeManager.open, 'api.open is the same function reference as ArchetypeManager.open');
}

// --- Multi-Class Support ---
console.log('\n--- Multi-Class Support ---');

// Test 13: Dialog opens correctly for multi-class actor
{
  clearNotifications();
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const rogue = createMockClassItem('Rogue', 3);
  const actor = createMockActor('Multi-Class Hero', [fighter, rogue]);
  const token = { actor };
  globalThis.canvas.tokens.controlled = [token];

  await game.modules.get('archetype-manager').api.open();

  assert(dialogTracker.length > 0, 'Dialog opens for multi-class actor');
  const dialog = dialogTracker[dialogTracker.length - 1];
  const content = dialog.data.content;
  assert(content.includes('Fighter'), 'Dialog content includes Fighter class');
  assert(content.includes('Rogue'), 'Dialog content includes Rogue class');
}

// --- Macro Content Verification ---
console.log('\n--- Macro Content ---');

// Test 14: Standard macro script syntax is correct
{
  const macroScript = `game.modules.get('archetype-manager').api.open()`;

  // Verify the script can be evaluated in our mock environment
  clearNotifications();
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Macro Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  // Evaluate the macro script
  const fn = new Function(macroScript);
  await fn();

  assert(dialogTracker.length > 0, 'Standard macro script opens dialog');
}

// Test 15: Alternative macro script with error handling works
{
  const macroScript = `
    const mod = game.modules.get('archetype-manager');
    if (mod?.api?.open) {
      mod.api.open();
    } else {
      ui.notifications.error('Archetype Manager module not active');
    }
  `;

  clearNotifications();
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Safe Macro Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  const fn = new Function(macroScript);
  await fn();

  assert(dialogTracker.length > 0, 'Error-handling macro script opens dialog');
}

// Test 16: Macro shows error when module not available
{
  clearNotifications();

  // Temporarily remove the module
  const savedApi = game.modules.get('archetype-manager').api;
  game.modules.get('archetype-manager').api = undefined;

  const macroScript = `
    const mod = game.modules.get('archetype-manager');
    if (mod?.api?.open) {
      mod.api.open();
    } else {
      ui.notifications.error('Archetype Manager module not active');
    }
  `;

  const fn = new Function(macroScript);
  fn();

  assert(notifications.some(n => n.type === 'error' && n.msg.includes('not active')),
    'Error-handling macro shows error when module API not available');

  // Restore
  game.modules.get('archetype-manager').api = savedApi;
}

// --- Dialog CSS Classes ---
console.log('\n--- Dialog Styling ---');

// Test 17: Dialog has archetype-manager CSS class
{
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('CSS Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  await game.modules.get('archetype-manager').api.open();

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.options.classes && dialog.options.classes.some(c => c.includes('archetype')),
    'Dialog has archetype-related CSS class');
}

// Test 18: Dialog has proper buttons (Add Archetype + Close)
{
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Button Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  await game.modules.get('archetype-manager').api.open();

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.buttons.addCustom !== undefined, 'Dialog has Add Archetype button');
  assert(dialog.data.buttons.close !== undefined, 'Dialog has Close button');
  assert(dialog.data.buttons.addCustom.label === 'Add Archetype', 'Add Archetype button labeled correctly');
  assert(dialog.data.buttons.close.label === 'Close', 'Close button labeled correctly');
}

// Test 19: Dialog has search input
{
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Search Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  await game.modules.get('archetype-manager').api.open();

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.content.includes('archetype-search'), 'Dialog has search input element');
  assert(dialog.data.content.includes('class-select'), 'Dialog has class selector element');
}

// Test 20: Dialog has class dropdown with correct class
{
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Dropdown Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  await game.modules.get('archetype-manager').api.open();

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.content.includes('Fighter (Lv 5)'), 'Dialog shows "Fighter (Lv 5)" in class dropdown');
}

// --- Edge Cases ---
console.log('\n--- Edge Cases ---');

// Test 21: Multiple tokens selected - uses first controlled token
{
  clearNotifications();
  clearDialogTracker();

  const fighter1 = createMockClassItem('Fighter', 5);
  const fighter2 = createMockClassItem('Fighter', 10);
  const actor1 = createMockActor('First Token', [fighter1]);
  const actor2 = createMockActor('Second Token', [fighter2]);
  globalThis.canvas.tokens.controlled = [{ actor: actor1 }, { actor: actor2 }];

  await game.modules.get('archetype-manager').api.open();

  const dialog = dialogTracker[dialogTracker.length - 1];
  assert(dialog.data.title.includes('First Token'), 'Uses first controlled token (not second)');
}

// Test 22: Opening multiple times doesn't crash
{
  clearNotifications();
  clearDialogTracker();

  const fighter = createMockClassItem('Fighter', 5);
  const actor = createMockActor('Repeat Test', [fighter]);
  globalThis.canvas.tokens.controlled = [{ actor }];

  let noError = true;
  try {
    await game.modules.get('archetype-manager').api.open();
    await game.modules.get('archetype-manager').api.open();
    await game.modules.get('archetype-manager').api.open();
  } catch (e) {
    noError = false;
  }

  assert(noError, 'Opening dialog multiple times does not crash');
  assert(dialogTracker.length === 3, `3 dialogs created for 3 calls (got ${dialogTracker.length})`);
}

// Test 23: Module is marked as active
{
  const mod = game.modules.get('archetype-manager');
  assert(mod.active === true, 'Module is marked as active');
}

// Test 24: Module has correct title
{
  const mod = game.modules.get('archetype-manager');
  assert(mod.title === 'PF1e Archetype Manager', 'Module title is correct');
}

// ========================
// Summary
// ========================
console.log(`\n${'='.repeat(55)}`);
console.log(`Feature #68 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(55)}\n`);

if (failed > 0) {
  process.exit(1);
}
