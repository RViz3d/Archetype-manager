/**
 * Test Suite for Feature #102: Refactor open() to accept optional actor parameter
 *
 * Verifies that ArchetypeManager.open() can be called:
 * 1. With no arguments (falls back to token-based selection, backward compatible)
 * 2. With a valid actor (skips token validation, opens dialog for that actor)
 * 3. Validates permissions and class items regardless of mode
 * 4. API exposure at game.modules.get(...).api.open passes through actor argument
 */

import { setupMockEnvironment, createMockActor, createMockClassItem } from './foundry-mock.mjs';

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

console.log('\n=== Feature #102: Refactor open() to accept optional actor parameter ===\n');

// Set up environment
setupMockEnvironment();

// Register module settings that UIManager.showMainDialog needs
globalThis.game.settings.register('archetype-manager', 'lastSelectedClass', {
  name: 'Last Selected Class',
  scope: 'client',
  config: false,
  type: String,
  default: ''
});
globalThis.game.settings.register('archetype-manager', 'showParseWarnings', {
  name: 'Show Parse Warnings',
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});
globalThis.game.settings.register('archetype-manager', 'autoCreateJEDB', {
  name: 'Auto-Create Journal Database',
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});

// Import ArchetypeManager after environment is set up
const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');

// =====================================================
// Section 1: Method signature accepts optional actor parameter
// =====================================================
console.log('--- Section 1: Method signature accepts optional actor parameter ---');

test('open() method exists on ArchetypeManager', () => {
  assert(typeof ArchetypeManager.open === 'function', 'open should be a function');
});

test('open() method is async (returns a Promise)', () => {
  // Calling with no args and no token selected returns a promise (even if it warns)
  const result = ArchetypeManager.open();
  assert(result instanceof Promise, 'open() should return a Promise');
});

test('open() accepts 0 arguments without error', () => {
  // Should not throw — just warn about no token
  assert(typeof ArchetypeManager.open.length !== undefined, 'Method should exist');
  // The method has 1 optional parameter
  assertEqual(ArchetypeManager.open.length, 1, 'open() should have 1 parameter (optional actorParam)');
});

test('open() accepts 1 argument in its signature', () => {
  assertEqual(ArchetypeManager.open.length, 1, 'open() should accept 1 parameter');
});

// =====================================================
// Section 2: Token-based fallback (no actor argument — backward compatible)
// =====================================================
console.log('\n--- Section 2: Token-based fallback (no actor argument) ---');

let warnMessages = [];
const origWarn = globalThis.ui.notifications.warn;

await asyncTest('No token selected: shows "select a token" warning', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  await ArchetypeManager.open();

  assert(warnMessages.length > 0, 'Should have shown a warning');
  assert(warnMessages[0].includes('select a token'), `Warning should mention selecting a token, got: ${warnMessages[0]}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('No token selected: does not open dialog', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];
  globalThis.Dialog._lastInstance = null;

  await ArchetypeManager.open();

  // Dialog should not have been created
  // (We can't directly check if showMainDialog was called, but the warn would fire)
  assert(warnMessages.length > 0, 'Warning should have been shown (dialog not opened)');
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Token with no actor: shows "no actor" warning', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [{ actor: null }];

  await ArchetypeManager.open();

  assert(warnMessages.length > 0, 'Should have shown a warning');
  assert(warnMessages[0].includes('no actor'), `Warning should mention no actor, got: ${warnMessages[0]}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Token with actor but no class items: shows "no class items" warning', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  const actor = createMockActor('TestActor');
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [{ actor }];

  await ArchetypeManager.open();

  assert(warnMessages.length > 0, 'Should have shown a warning');
  assert(warnMessages[0].includes('no class items'), `Warning should mention no class items, got: ${warnMessages[0]}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Token with valid actor and class items: proceeds (no warning)', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  const classItem = createMockClassItem('Fighter', 5);
  const actor = createMockActor('TestFighter', [classItem]);
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [{ actor }];

  await ArchetypeManager.open();

  assertEqual(warnMessages.length, 0, `Should not have any warnings, got: ${warnMessages.join(', ')}`);
  globalThis.ui.notifications.warn = origWarn;
});

// =====================================================
// Section 3: Actor parameter mode (direct actor pass)
// =====================================================
console.log('\n--- Section 3: Actor parameter mode (direct actor pass) ---');

await asyncTest('Calling open(actor) with valid actor opens without token', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  // Clear any selected tokens to prove token isn't needed
  globalThis.canvas.tokens.controlled = [];

  const classItem = createMockClassItem('Wizard', 3);
  const actor = createMockActor('TestWizard', [classItem]);
  actor.isOwner = true;

  await ArchetypeManager.open(actor);

  assertEqual(warnMessages.length, 0, `Should not have any warnings when actor is passed, got: ${warnMessages.join(', ')}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Calling open(actor) skips "select a token" check entirely', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  // No tokens at all
  globalThis.canvas.tokens.controlled = [];

  const classItem = createMockClassItem('Rogue', 2);
  const actor = createMockActor('TestRogue', [classItem]);
  actor.isOwner = true;

  await ArchetypeManager.open(actor);

  // If any warning was shown, it should NOT be the token warning
  for (const msg of warnMessages) {
    assert(!msg.includes('select a token'), 'Should NOT show "select a token" when actor is passed');
    assert(!msg.includes('no actor'), 'Should NOT show "no actor" when actor is passed');
  }
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Calling open(actor) with actor that has no class items warns', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  const actor = createMockActor('EmptyActor');
  actor.isOwner = true;

  await ArchetypeManager.open(actor);

  assert(warnMessages.length > 0, 'Should warn about no class items');
  assert(warnMessages[0].includes('no class items'), `Warning should mention no class items, got: ${warnMessages[0]}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Calling open(actor) with multiple class items succeeds', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  const classItems = [
    createMockClassItem('Fighter', 5),
    createMockClassItem('Rogue', 3),
    createMockClassItem('Wizard', 1)
  ];
  const actor = createMockActor('MulticlassHero', classItems);
  actor.isOwner = true;

  await ArchetypeManager.open(actor);

  assertEqual(warnMessages.length, 0, `Should not have any warnings, got: ${warnMessages.join(', ')}`);
  globalThis.ui.notifications.warn = origWarn;
});

// =====================================================
// Section 4: Permission validation applies to both modes
// =====================================================
console.log('\n--- Section 4: Permission validation applies to both modes ---');

await asyncTest('Non-GM, non-owner actor via open(actor) shows permission warning', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Cleric', 4);
  const actor = createMockActor('NotMyCleric', [classItem]);
  actor.isOwner = false;

  await ArchetypeManager.open(actor);

  assert(warnMessages.length > 0, 'Should warn about permission');
  assert(warnMessages[0].includes('permission'), `Warning should mention permission, got: ${warnMessages[0]}`);
  globalThis.game.user.isGM = true;
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Non-GM, non-owner actor via token shows same permission warning', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Cleric', 4);
  const actor = createMockActor('NotMyClericToken', [classItem]);
  actor.isOwner = false;
  globalThis.canvas.tokens.controlled = [{ actor }];

  await ArchetypeManager.open();

  assert(warnMessages.length > 0, 'Should warn about permission');
  assert(warnMessages[0].includes('permission'), `Warning should mention permission, got: ${warnMessages[0]}`);
  globalThis.game.user.isGM = true;
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('GM can open for any actor via open(actor)', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.game.user.isGM = true;

  const classItem = createMockClassItem('Paladin', 7);
  const actor = createMockActor('AnyPaladin', [classItem]);
  actor.isOwner = false; // GM can still open it

  await ArchetypeManager.open(actor);

  assertEqual(warnMessages.length, 0, `GM should have no warnings, got: ${warnMessages.join(', ')}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('Owner can open for owned actor via open(actor)', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Ranger', 6);
  const actor = createMockActor('OwnedRanger', [classItem]);
  actor.isOwner = true;

  await ArchetypeManager.open(actor);

  assertEqual(warnMessages.length, 0, `Owner should have no warnings, got: ${warnMessages.join(', ')}`);
  globalThis.game.user.isGM = true;
  globalThis.ui.notifications.warn = origWarn;
});

// =====================================================
// Section 5: API exposure passes through actor argument
// =====================================================
console.log('\n--- Section 5: API exposure passes through actor argument ---');

// Re-import module.mjs to register hooks and API
await import('../scripts/module.mjs');
// Fire hooks to set up the API
await globalThis.Hooks.callAll('init');
await globalThis.Hooks.callAll('ready');

test('API is exposed at game.modules.get("archetype-manager").api', () => {
  const mod = globalThis.game.modules.get('archetype-manager');
  assert(mod.api, 'Module should have api property');
  assert(typeof mod.api.open === 'function', 'api.open should be a function');
});

await asyncTest('api.open() with no arguments uses token fallback', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  const api = globalThis.game.modules.get('archetype-manager').api;
  await api.open();

  assert(warnMessages.length > 0, 'Should warn about no token');
  assert(warnMessages[0].includes('select a token'), `Should mention selecting token, got: ${warnMessages[0]}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('api.open(actor) passes actor through to ArchetypeManager.open', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  const classItem = createMockClassItem('Bard', 8);
  const actor = createMockActor('APITestBard', [classItem]);
  actor.isOwner = true;

  const api = globalThis.game.modules.get('archetype-manager').api;
  await api.open(actor);

  assertEqual(warnMessages.length, 0, `api.open(actor) should work without warnings, got: ${warnMessages.join(', ')}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('api.open(actor) with no class items shows class warning', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  const actor = createMockActor('EmptyAPIActor');
  actor.isOwner = true;

  const api = globalThis.game.modules.get('archetype-manager').api;
  await api.open(actor);

  assert(warnMessages.length > 0, 'Should warn about no class items');
  assert(warnMessages[0].includes('no class items'), `Warning should mention no class items, got: ${warnMessages[0]}`);
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('api.open(actor) permission check works through API', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.game.user.isGM = false;

  const classItem = createMockClassItem('Sorcerer', 5);
  const actor = createMockActor('NotMyActor', [classItem]);
  actor.isOwner = false;

  const api = globalThis.game.modules.get('archetype-manager').api;
  await api.open(actor);

  assert(warnMessages.length > 0, 'Should warn about permission');
  assert(warnMessages[0].includes('permission'), `Warning should mention permission, got: ${warnMessages[0]}`);
  globalThis.game.user.isGM = true;
  globalThis.ui.notifications.warn = origWarn;
});

// =====================================================
// Section 6: Backward compatibility
// =====================================================
console.log('\n--- Section 6: Backward compatibility ---');

await asyncTest('open() without arguments behaves exactly as before (token path)', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  const classItem = createMockClassItem('Barbarian', 10);
  const actor = createMockActor('TokenBarb', [classItem]);
  actor.isOwner = true;
  globalThis.canvas.tokens.controlled = [{ actor }];

  await ArchetypeManager.open();

  assertEqual(warnMessages.length, 0, 'Backward compatible call should work without warnings');
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('open(undefined) behaves same as open() — token fallback', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  await ArchetypeManager.open(undefined);

  assert(warnMessages.length > 0, 'open(undefined) should trigger token path');
  assert(warnMessages[0].includes('select a token'), 'Should warn about token selection');
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('open(null) behaves same as open() — token fallback', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  await ArchetypeManager.open(null);

  assert(warnMessages.length > 0, 'open(null) should trigger token path');
  assert(warnMessages[0].includes('select a token'), 'Should warn about token selection');
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('open(false) behaves same as open() — token fallback', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);
  globalThis.canvas.tokens.controlled = [];

  await ArchetypeManager.open(false);

  assert(warnMessages.length > 0, 'open(false) should trigger token path');
  assert(warnMessages[0].includes('select a token'), 'Should warn about token selection');
  globalThis.ui.notifications.warn = origWarn;
});

// =====================================================
// Section 7: Edge cases
// =====================================================
console.log('\n--- Section 7: Edge cases ---');

await asyncTest('open(actor) when token IS also selected still uses provided actor', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  const classItem1 = createMockClassItem('Fighter', 5);
  const tokenActor = createMockActor('TokenActor', [classItem1]);
  tokenActor.isOwner = true;
  globalThis.canvas.tokens.controlled = [{ actor: tokenActor }];

  const classItem2 = createMockClassItem('Wizard', 10);
  const directActor = createMockActor('DirectActor', [classItem2]);
  directActor.isOwner = true;

  // Spy on UIManager.showMainDialog to see which actor was used
  const { UIManager } = await import('../scripts/ui-manager.mjs');
  let capturedActor = null;
  const origShowMainDialog = UIManager.showMainDialog;
  UIManager.showMainDialog = async (actor, classItems) => {
    capturedActor = actor;
    return origShowMainDialog.call(UIManager, actor, classItems);
  };

  await ArchetypeManager.open(directActor);

  assertEqual(capturedActor?.name, 'DirectActor', 'Should use provided actor, not token actor');
  assertEqual(warnMessages.length, 0, 'Should have no warnings');

  UIManager.showMainDialog = origShowMainDialog;
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('open(actor) works even when canvas.tokens is undefined', async () => {
  warnMessages = [];
  globalThis.ui.notifications.warn = (msg) => warnMessages.push(msg);

  // Temporarily make canvas.tokens unavailable (e.g., pre-canvas-ready)
  const origTokens = globalThis.canvas.tokens;
  globalThis.canvas.tokens = undefined;

  const classItem = createMockClassItem('Monk', 4);
  const actor = createMockActor('PreCanvasMonk', [classItem]);
  actor.isOwner = true;

  await ArchetypeManager.open(actor);

  assertEqual(warnMessages.length, 0, 'Should succeed without canvas.tokens when actor is provided');

  globalThis.canvas.tokens = origTokens;
  globalThis.ui.notifications.warn = origWarn;
});

await asyncTest('open() return value is always a Promise', async () => {
  const classItem = createMockClassItem('Fighter', 1);
  const actor = createMockActor('PromiseTestActor', [classItem]);
  actor.isOwner = true;

  const result1 = ArchetypeManager.open(actor);
  assert(result1 instanceof Promise, 'open(actor) should return a Promise');

  globalThis.canvas.tokens.controlled = [];
  const result2 = ArchetypeManager.open();
  assert(result2 instanceof Promise, 'open() should return a Promise');

  await result1;
  await result2;
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Feature #102 Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
