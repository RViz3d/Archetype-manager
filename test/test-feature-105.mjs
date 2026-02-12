/**
 * Test Suite for Feature #105: Token HUD button for Archetype Manager
 *
 * Verifies that a button is injected into the FoundryVTT token HUD
 * (right-click menu on tokens) that opens the Archetype Manager.
 * The button only appears for tokens whose actors have class items.
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

console.log('\n=== Feature #105: Token HUD button for Archetype Manager ===\n');

// Set up environment
setupMockEnvironment();

// Import the module to register hooks
await import('../scripts/module.mjs');
// Fire init to register settings
await globalThis.Hooks.callAll('init');
await globalThis.Hooks.callAll('ready');

/**
 * Helper: Create a mock Token HUD HTML structure matching FoundryVTT's format.
 * Token HUD has columns: .col.left, .col.middle (token image), .col.right
 */
function createMockTokenHUD() {
  const container = document.createElement('div');
  container.id = 'token-hud';

  const colLeft = document.createElement('div');
  colLeft.className = 'col left';

  const colMiddle = document.createElement('div');
  colMiddle.className = 'col middle';

  const colRight = document.createElement('div');
  colRight.className = 'col right';

  container.appendChild(colLeft);
  container.appendChild(colMiddle);
  container.appendChild(colRight);

  return container;
}

/**
 * Helper: Create a mock Token HUD app object.
 */
function createMockHudApp(actor) {
  return {
    object: {
      actor,
      id: 'token-' + (actor?.id || 'none'),
      name: actor?.name || 'Unknown Token'
    }
  };
}

/**
 * Helper: Fire the renderTokenHUD hook with given parameters.
 */
async function fireRenderTokenHUD(hud, html, tokenData = {}) {
  await globalThis.Hooks.callAll('renderTokenHUD', hud, html, tokenData);
}

// =====================================================
// Section 1: Hook registration
// =====================================================
console.log('--- Section 1: Hook registration ---');

test('renderTokenHUD hook is registered', () => {
  const hooks = globalThis.Hooks._hooks.get('renderTokenHUD');
  assert(hooks && hooks.length > 0, 'renderTokenHUD hook should be registered');
});

test('renderTokenHUD hook has exactly one listener from our module', () => {
  const hooks = globalThis.Hooks._hooks.get('renderTokenHUD');
  assert(hooks && hooks.length >= 1, 'Should have at least 1 renderTokenHUD listener');
});

// =====================================================
// Section 2: Button injection for tokens with class items
// =====================================================
console.log('\n--- Section 2: Button injection for tokens with class items ---');

await asyncTest('Button is injected when actor has class items', async () => {
  const classItem = createMockClassItem('Fighter', 5);
  const actor = createMockActor('TestFighter', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn !== null, 'Button should be injected into the token HUD');
});

await asyncTest('Button is injected into the right column (.col.right)', async () => {
  const classItem = createMockClassItem('Wizard', 3);
  const actor = createMockActor('TestWizard', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const rightCol = html.querySelector('.col.right');
  const btn = rightCol.querySelector('.archetype-manager-token-btn');
  assert(btn !== null, 'Button should be inside .col.right');
});

await asyncTest('Button has the correct CSS class', async () => {
  const classItem = createMockClassItem('Rogue', 4);
  const actor = createMockActor('TestRogue', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn.classList.contains('archetype-manager-token-btn'), 'Should have archetype-manager-token-btn class');
  assert(btn.classList.contains('control-icon'), 'Should have control-icon class (FoundryVTT HUD style)');
});

await asyncTest('Button has a title attribute "Archetype Manager"', async () => {
  const classItem = createMockClassItem('Cleric', 6);
  const actor = createMockActor('TestCleric', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn.title, 'Archetype Manager', 'Button title should be "Archetype Manager"');
});

await asyncTest('Button has a data-action attribute', async () => {
  const classItem = createMockClassItem('Paladin', 7);
  const actor = createMockActor('TestPaladin', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn.dataset.action, 'archetype-manager', 'Button should have data-action="archetype-manager"');
});

await asyncTest('Button contains a hat-wizard icon', async () => {
  const classItem = createMockClassItem('Ranger', 2);
  const actor = createMockActor('TestRanger', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  const icon = btn.querySelector('i.fas.fa-hat-wizard');
  assert(icon !== null, 'Button should contain an <i> with fas fa-hat-wizard classes');
});

// =====================================================
// Section 3: Button NOT injected for tokens without class items
// =====================================================
console.log('\n--- Section 3: Button NOT injected for tokens without class items ---');

await asyncTest('No button when actor has zero class items', async () => {
  const actor = createMockActor('NoClassActor');
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn, null, 'Button should NOT be injected when actor has no class items');
});

await asyncTest('No button when token has no actor', async () => {
  const hud = createMockHudApp(null);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn, null, 'Button should NOT be injected when token has no actor');
});

await asyncTest('No button when hud.object is null', async () => {
  const hud = { object: null };
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn, null, 'Button should NOT be injected when hud.object is null');
});

// =====================================================
// Section 4: Click handler opens Archetype Manager
// =====================================================
console.log('\n--- Section 4: Click handler opens Archetype Manager ---');

await asyncTest('Clicking the button calls ArchetypeManager.open(actor)', async () => {
  const classItem = createMockClassItem('Monk', 8);
  const actor = createMockActor('ClickTestMonk', [classItem]);
  actor.isOwner = true;
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');

  // Spy on ArchetypeManager.open to capture the actor argument
  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  let capturedActor = null;
  const origOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (a) => { capturedActor = a; };

  // Simulate click
  const clickEvent = new Event('click', { bubbles: true });
  btn.dispatchEvent(clickEvent);

  // Wait a tick for the handler
  await new Promise(r => setTimeout(r, 10));

  assertEqual(capturedActor?.name, 'ClickTestMonk', 'ArchetypeManager.open should receive the correct actor');

  ArchetypeManager.open = origOpen;
});

await asyncTest('Click handler passes the token actor, not the token itself', async () => {
  const classItem = createMockClassItem('Barbarian', 10);
  const actor = createMockActor('ActorNotToken', [classItem]);
  actor.isOwner = true;
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');

  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  let capturedArg = null;
  const origOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (a) => { capturedArg = a; };

  const clickEvent = new Event('click', { bubbles: true });
  btn.dispatchEvent(clickEvent);
  await new Promise(r => setTimeout(r, 10));

  // Verify the argument is the actor, not the token
  assert(capturedArg !== null, 'Should have captured an argument');
  assert(capturedArg.name === 'ActorNotToken', 'Should pass the actor');
  assert(capturedArg.items !== undefined, 'Passed argument should have items (actor, not token)');

  ArchetypeManager.open = origOpen;
});

// =====================================================
// Section 5: Duplicate injection prevention
// =====================================================
console.log('\n--- Section 5: Duplicate injection prevention ---');

await asyncTest('Button is not duplicated on re-render', async () => {
  const classItem = createMockClassItem('Sorcerer', 5);
  const actor = createMockActor('DuplicateTest', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  // Render twice
  await fireRenderTokenHUD(hud, html);
  await fireRenderTokenHUD(hud, html);

  const buttons = html.querySelectorAll('.archetype-manager-token-btn');
  assertEqual(buttons.length, 1, 'Should have exactly 1 button after re-render, not duplicates');
});

await asyncTest('Button is not duplicated on triple re-render', async () => {
  const classItem = createMockClassItem('Druid', 3);
  const actor = createMockActor('TripleRender', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  // Render three times
  await fireRenderTokenHUD(hud, html);
  await fireRenderTokenHUD(hud, html);
  await fireRenderTokenHUD(hud, html);

  const buttons = html.querySelectorAll('.archetype-manager-token-btn');
  assertEqual(buttons.length, 1, 'Should still have exactly 1 button after 3 renders');
});

// =====================================================
// Section 6: Multi-class actor
// =====================================================
console.log('\n--- Section 6: Multi-class actor ---');

await asyncTest('Button appears for multi-class actor', async () => {
  const classItems = [
    createMockClassItem('Fighter', 5),
    createMockClassItem('Rogue', 3),
    createMockClassItem('Wizard', 1)
  ];
  const actor = createMockActor('MultiClassHero', classItems);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn !== null, 'Button should appear for multi-class actor');
});

// =====================================================
// Section 7: Styling matches FoundryVTT token HUD
// =====================================================
console.log('\n--- Section 7: Styling matches FoundryVTT token HUD ---');

await asyncTest('Button uses control-icon class (FoundryVTT HUD convention)', async () => {
  const classItem = createMockClassItem('Bard', 4);
  const actor = createMockActor('StyleTestBard', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn.classList.contains('control-icon'), 'Should use control-icon class for HUD styling');
});

await asyncTest('Button is a div element (matching FoundryVTT HUD controls)', async () => {
  const classItem = createMockClassItem('Alchemist', 6);
  const actor = createMockActor('DivTestAlchemist', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn.tagName, 'DIV', 'Token HUD buttons should be DIV elements with control-icon class');
});

await asyncTest('Icon element is an <i> tag inside the button', async () => {
  const classItem = createMockClassItem('Investigator', 9);
  const actor = createMockActor('IconTestInvestigator', [classItem]);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  const icon = btn.querySelector('i');
  assert(icon !== null, 'Should have an <i> element inside');
  assert(icon.classList.contains('fas'), 'Icon should have fas class');
  assert(icon.classList.contains('fa-hat-wizard'), 'Icon should have fa-hat-wizard class');
});

// =====================================================
// Section 8: Edge cases
// =====================================================
console.log('\n--- Section 8: Edge cases ---');

await asyncTest('No error when html has no .col.right', async () => {
  const classItem = createMockClassItem('Fighter', 5);
  const actor = createMockActor('NoColRightActor', [classItem]);
  const hud = createMockHudApp(actor);
  // Create a minimal container with no .col.right
  const html = document.createElement('div');

  // Should not throw
  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn, null, 'No button injected when .col.right is missing');
});

await asyncTest('No error when actor.items is empty array', async () => {
  const actor = createMockActor('EmptyItemsActor', []);
  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  // Should not throw
  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn, null, 'No button when actor has empty class items');
});

await asyncTest('No error when actor has only non-class items', async () => {
  // Create actor with a non-class item
  const actor = createMockActor('NonClassActor');
  // Override the items to include a non-class item
  const weaponItem = { id: 'weapon1', name: 'Longsword', type: 'weapon' };
  actor.items = {
    filter: (fn) => [weaponItem].filter(fn),
    find: (fn) => [weaponItem].find(fn),
    get: (id) => [weaponItem].find(i => i.id === id),
    map: (fn) => [weaponItem].map(fn),
    [Symbol.iterator]: () => [weaponItem][Symbol.iterator]()
  };

  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assertEqual(btn, null, 'No button when actor has only non-class items');
});

await asyncTest('Button still works when actor has mixed item types including class', async () => {
  const classItem = createMockClassItem('Fighter', 5);
  const weaponItem = { id: 'weapon1', name: 'Longsword', type: 'weapon' };
  const allItems = [classItem, weaponItem];
  const actor = createMockActor('MixedItemsActor', [classItem]);
  // Add weapon item alongside the class
  actor.items = {
    filter: (fn) => allItems.filter(fn),
    find: (fn) => allItems.find(fn),
    get: (id) => allItems.find(i => i.id === id),
    map: (fn) => allItems.map(fn),
    [Symbol.iterator]: () => allItems[Symbol.iterator]()
  };

  const hud = createMockHudApp(actor);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');
  assert(btn !== null, 'Button should appear when actor has class items alongside other types');
});

// =====================================================
// Section 9: Source code verification
// =====================================================
console.log('\n--- Section 9: Source code verification ---');

await asyncTest('module.mjs contains renderTokenHUD hook registration', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');
  assert(source.includes("renderTokenHUD"), 'module.mjs should contain renderTokenHUD');
  assert(source.includes("Hooks.on('renderTokenHUD'") || source.includes('Hooks.on("renderTokenHUD"'),
    'module.mjs should register a Hooks.on(\'renderTokenHUD\', ...) listener');
});

await asyncTest('Hook callback checks for class items before injection', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');
  // Should check for class items and return early if none
  assert(source.includes("type === 'class'") || source.includes('type === "class"'),
    'Hook should filter for class-type items');
  assert(source.includes('classItems.length === 0') || source.includes('classItems.length < 1'),
    'Hook should check if classItems is empty');
});

await asyncTest('Hook injects button into .col.right', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');
  assert(source.includes('.col.right'), 'Hook should look for .col.right selector');
});

await asyncTest('Hook calls ArchetypeManager.open(actor)', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');
  assert(source.includes('ArchetypeManager.open(actor)'), 'Click handler should call ArchetypeManager.open(actor)');
});

await asyncTest('Hook prevents duplicate injection', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');
  assert(source.includes('archetype-manager-token-btn'),
    'Hook should check for existing archetype-manager-token-btn class to prevent duplicates');
});

// =====================================================
// Section 10: Different actors on same HUD reuse
// =====================================================
console.log('\n--- Section 10: Different actors on different HUDs ---');

await asyncTest('Different actors each get their own button on separate HUDs', async () => {
  const class1 = createMockClassItem('Fighter', 5);
  const actor1 = createMockActor('Actor1', [class1]);
  const hud1 = createMockHudApp(actor1);
  const html1 = createMockTokenHUD();

  const class2 = createMockClassItem('Wizard', 3);
  const actor2 = createMockActor('Actor2', [class2]);
  const hud2 = createMockHudApp(actor2);
  const html2 = createMockTokenHUD();

  await fireRenderTokenHUD(hud1, html1);
  await fireRenderTokenHUD(hud2, html2);

  const btn1 = html1.querySelector('.archetype-manager-token-btn');
  const btn2 = html2.querySelector('.archetype-manager-token-btn');

  assert(btn1 !== null, 'First actor HUD should have button');
  assert(btn2 !== null, 'Second actor HUD should have button');
});

await asyncTest('Click handler on button opens the correct actor', async () => {
  const class1 = createMockClassItem('Fighter', 5);
  const actor1 = createMockActor('CorrectActorTest', [class1]);
  actor1.isOwner = true;
  const hud = createMockHudApp(actor1);
  const html = createMockTokenHUD();

  await fireRenderTokenHUD(hud, html);

  const btn = html.querySelector('.archetype-manager-token-btn');

  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  let capturedActor = null;
  const origOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (a) => { capturedActor = a; };

  btn.dispatchEvent(new Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));

  assertEqual(capturedActor?.name, 'CorrectActorTest', 'Should open the correct actor');

  ArchetypeManager.open = origOpen;
});

// =====================================================
// Summary
// =====================================================
console.log(`\n=== Feature #105 Results: ${passed}/${totalTests} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
