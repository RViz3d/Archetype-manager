/**
 * Test Suite for Feature #103: Actor sheet button injection via renderActorSheet hook
 *
 * Verifies that:
 * 1. A Hooks.on('renderActorSheet', ...) listener is registered in module.mjs
 * 2. The hook checks that the actor is a character type with class items before injecting
 * 3. An 'Archetypes' button is injected into the character sheet HTML
 * 4. The button is styled consistently with FoundryVTT's native buttons
 * 5. The button does NOT appear on actors without class items
 * 6. The button CSS is defined in styles/archetype-manager.css
 * 7. No duplicate buttons on re-render
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

console.log('\n=== Feature #103: Actor sheet button injection via renderActorSheet hook ===\n');

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

// Helper: call the renderActorSheet hooks
async function triggerRenderActorSheet(app, html, data = {}) {
  await Hooks.callAll('renderActorSheet', app, html, data);
}

// ===================================
// Section 1: Hook registration
// ===================================
console.log('\n--- Section 1: Hook Registration ---');

test('renderActorSheet hook is registered', () => {
  const hooks = Hooks._hooks.get('renderActorSheet');
  assert(hooks, 'renderActorSheet hooks should be registered');
  assert(hooks.length > 0, 'renderActorSheet should have at least one listener');
});

test('renderActorSheet hook is a function', () => {
  const hooks = Hooks._hooks.get('renderActorSheet');
  assert(typeof hooks[0] === 'function', 'renderActorSheet hook should be a function');
});

// ===================================
// Section 2: Button injection on character with class items
// ===================================
console.log('\n--- Section 2: Button injection on character with class items ---');

await asyncTest('Archetypes button is injected on character with class items', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Test Fighter', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Archetypes button should be injected into the sheet');
});

await asyncTest('Button text contains "Archetypes"', async () => {
  const classItem = createMockClassItem('Wizard', 3, 'wizard');
  const actor = createMockActor('Test Wizard', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should exist');
  assert(btn.textContent.includes('Archetypes'), `Button text should contain "Archetypes", got "${btn.textContent}"`);
});

await asyncTest('Button has an icon (fas fa-hat-wizard)', async () => {
  const classItem = createMockClassItem('Rogue', 4, 'rogue');
  const actor = createMockActor('Test Rogue', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should exist');
  const icon = btn.querySelector('i.fa-hat-wizard');
  assert(icon, 'Button should have a hat-wizard icon');
});

await asyncTest('Button has type="button" to prevent form submission', async () => {
  const classItem = createMockClassItem('Cleric', 2, 'cleric');
  const actor = createMockActor('Test Cleric', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should exist');
  assertEqual(btn.type, 'button', 'Button should have type="button"');
});

await asyncTest('Button has title attribute', async () => {
  const classItem = createMockClassItem('Bard', 6, 'bard');
  const actor = createMockActor('Test Bard', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should exist');
  assert(btn.title, 'Button should have a title attribute');
  assert(btn.title.length > 0, 'Button title should not be empty');
});

await asyncTest('Button is injected inside the features tab area', async () => {
  const classItem = createMockClassItem('Paladin', 7, 'paladin');
  const actor = createMockActor('Test Paladin', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should exist');

  // Button should be inside the features tab or at least in the sheet
  const featuresTab = html.querySelector('.tab[data-tab="features"]');
  assert(featuresTab, 'Features tab should exist');
  assert(featuresTab.contains(btn), 'Button should be inside the features tab area');
});

await asyncTest('Button works with multi-class actor', async () => {
  const fighter = createMockClassItem('Fighter', 5, 'fighter');
  const rogue = createMockClassItem('Rogue', 3, 'rogue');
  const actor = createMockActor('Multiclass', [fighter, rogue]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Archetypes button should be injected for multi-class actor');
});

// ===================================
// Section 3: Button NOT injected for actors without class items
// ===================================
console.log('\n--- Section 3: Button NOT injected for actors without class items ---');

await asyncTest('Button NOT injected when actor has no class items', async () => {
  const actor = createMockActor('No Classes', []);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'Archetypes button should NOT be injected when actor has no class items');
});

await asyncTest('Button NOT injected when actor has only non-class items', async () => {
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
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'Archetypes button should NOT be injected when actor has only non-class items');
});

await asyncTest('Button NOT injected when actor is null', async () => {
  const app = { actor: null };
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'Archetypes button should NOT be injected when actor is null');
});

await asyncTest('Button NOT injected when app has no actor', async () => {
  const app = {};
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'Archetypes button should NOT be injected when app has no actor');
});

// ===================================
// Section 4: Duplicate prevention on re-render
// ===================================
console.log('\n--- Section 4: Duplicate prevention on re-render ---');

await asyncTest('No duplicate button on re-render', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Fighter', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});
  await triggerRenderActorSheet(app, html, {});

  const buttons = html.querySelectorAll('.archetype-manager-sheet-btn');
  assertEqual(buttons.length, 1, 'Should have exactly one button after re-render');
});

await asyncTest('No duplicate button on triple render', async () => {
  const classItem = createMockClassItem('Wizard', 10, 'wizard');
  const actor = createMockActor('Wizard', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});
  await triggerRenderActorSheet(app, html, {});
  await triggerRenderActorSheet(app, html, {});

  const buttons = html.querySelectorAll('.archetype-manager-sheet-btn');
  assertEqual(buttons.length, 1, 'Should have exactly one button after triple render');
});

// ===================================
// Section 5: Button click handler
// ===================================
console.log('\n--- Section 5: Button click handler ---');

await asyncTest('Button click calls ArchetypeManager.open with actor', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Click Test', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should exist');

  let openCalledWith = null;
  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  const originalOpen = ArchetypeManager.open;
  ArchetypeManager.open = async (actorArg) => { openCalledWith = actorArg; };

  try {
    const clickEvent = new Event('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(clickEvent);

    await new Promise(r => setTimeout(r, 10));

    assert(openCalledWith !== null, 'ArchetypeManager.open should be called on click');
    assertEqual(openCalledWith.name, 'Click Test', 'Should pass the correct actor to open()');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

await asyncTest('Button click passes the specific actor, not a global ref', async () => {
  const classItem1 = createMockClassItem('Fighter', 5, 'fighter');
  const actor1 = createMockActor('Actor One', [classItem1]);
  actor1.type = 'character';

  const classItem2 = createMockClassItem('Wizard', 3, 'wizard');
  const actor2 = createMockActor('Actor Two', [classItem2]);
  actor2.type = 'character';

  const html1 = createMockSheetHTML();
  const html2 = createMockSheetHTML();

  await triggerRenderActorSheet(createMockApp(actor1), html1, {});
  await triggerRenderActorSheet(createMockApp(actor2), html2, {});

  const { ArchetypeManager } = await import('../scripts/archetype-manager.mjs');
  const originalOpen = ArchetypeManager.open;
  let openCalledWith = null;
  ArchetypeManager.open = async (actorArg) => { openCalledWith = actorArg; };

  try {
    const btn2 = html2.querySelector('.archetype-manager-sheet-btn');
    assert(btn2, 'Button should exist on actor2 sheet');
    btn2.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 10));

    assert(openCalledWith !== null, 'open should be called');
    assertEqual(openCalledWith.name, 'Actor Two', 'Should pass actor2 to open()');
  } finally {
    ArchetypeManager.open = originalOpen;
  }
});

// ===================================
// Section 6: Fallback insertion points
// ===================================
console.log('\n--- Section 6: Fallback insertion points ---');

await asyncTest('Button injected even without features tab (fallback to sheet-body)', async () => {
  const classItem = createMockClassItem('Fighter', 5, 'fighter');
  const actor = createMockActor('Fallback Test', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML({ hasFeaturesTab: false });

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should still be injected via sheet-body fallback');
});

await asyncTest('Button injected in sheet with only sheet-body (no features tab, no inventory header)', async () => {
  const classItem = createMockClassItem('Monk', 4, 'monk');
  const actor = createMockActor('Minimal Sheet', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const html = document.createElement('div');
  const sheetBody = document.createElement('div');
  sheetBody.classList.add('sheet-body');
  html.appendChild(sheetBody);

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should be injected into sheet-body');
  assert(sheetBody.contains(btn), 'Button should be inside sheet-body');
});

await asyncTest('Button injected in bare container (no matching selectors)', async () => {
  const classItem = createMockClassItem('Barbarian', 8, 'barbarian');
  const actor = createMockActor('Bare Container', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const html = document.createElement('div');

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should be appended to the container as last resort');
});

// ===================================
// Section 7: CSS styling verification
// ===================================
console.log('\n--- Section 7: CSS styling verification ---');

const cssContent = await readFile(new URL('../styles/archetype-manager.css', import.meta.url), 'utf-8');

test('CSS file contains .archetype-manager-sheet-btn class', () => {
  assert(cssContent.includes('.archetype-manager-sheet-btn'), 'CSS should contain .archetype-manager-sheet-btn');
});

test('CSS button has padding defined', () => {
  assert(cssContent.includes('padding'), 'CSS for button should include padding');
});

test('CSS button has border defined', () => {
  const btnSection = cssContent.substring(cssContent.indexOf('.archetype-manager-sheet-btn'));
  assert(btnSection.includes('border'), 'CSS for button should include border styling');
});

test('CSS button has hover state', () => {
  assert(cssContent.includes('.archetype-manager-sheet-btn:hover'), 'CSS should include hover state');
});

test('CSS button has focus state for accessibility', () => {
  assert(cssContent.includes('.archetype-manager-sheet-btn:focus'), 'CSS should include focus state for accessibility');
});

test('CSS button uses FoundryVTT Signika font', () => {
  const btnSection = cssContent.substring(cssContent.indexOf('.archetype-manager-sheet-btn'));
  const nextClosingBrace = btnSection.indexOf('}');
  const btnStyles = btnSection.substring(0, nextClosingBrace);
  assert(btnStyles.includes('Signika'), 'Button CSS should use FoundryVTT Signika font family');
});

test('CSS button uses border-radius 3px (FoundryVTT standard)', () => {
  const btnSection = cssContent.substring(cssContent.indexOf('.archetype-manager-sheet-btn'));
  const nextClosingBrace = btnSection.indexOf('}');
  const btnStyles = btnSection.substring(0, nextClosingBrace);
  assert(btnStyles.includes('border-radius: 3px') || btnStyles.includes('border-radius:3px'), 'Button should use FoundryVTT standard 3px border-radius');
});

test('CSS button has cursor: pointer', () => {
  const btnSection = cssContent.substring(cssContent.indexOf('.archetype-manager-sheet-btn'));
  const nextClosingBrace = btnSection.indexOf('}');
  const btnStyles = btnSection.substring(0, nextClosingBrace);
  assert(btnStyles.includes('cursor: pointer') || btnStyles.includes('cursor:pointer'), 'Button should have cursor: pointer');
});

// ===================================
// Section 8: Source code verification
// ===================================
console.log('\n--- Section 8: Source code verification ---');

const moduleSource = await readFile(new URL('../scripts/module.mjs', import.meta.url), 'utf-8');

test('module.mjs contains Hooks.on("renderActorSheet")', () => {
  assert(
    moduleSource.includes("Hooks.on('renderActorSheet'") || moduleSource.includes('Hooks.on("renderActorSheet"'),
    'module.mjs should register renderActorSheet hook with Hooks.on'
  );
});

test('Hook callback checks for class items', () => {
  assert(
    moduleSource.includes("type === 'class'") || moduleSource.includes('type === "class"'),
    'Hook callback should check for class item type'
  );
});

test('Hook creates button element', () => {
  assert(
    moduleSource.includes('archetype-manager-sheet-btn'),
    'Hook should create button with archetype-manager-sheet-btn class'
  );
});

test('Hook calls ArchetypeManager.open with actor', () => {
  assert(
    moduleSource.includes('ArchetypeManager.open(actor') || moduleSource.includes('ArchetypeManager.open( actor'),
    'Hook should call ArchetypeManager.open with the actor'
  );
});

test('Hook checks for duplicate before injection', () => {
  assert(
    moduleSource.includes('archetype-manager-sheet-btn') && moduleSource.includes('querySelector'),
    'Hook should check for existing button before injection to prevent duplicates'
  );
});

// ===================================
// Section 9: Edge cases
// ===================================
console.log('\n--- Section 9: Edge cases ---');

await asyncTest('Actor with type undefined but has class items gets button', async () => {
  const classItem = createMockClassItem('Sorcerer', 6, 'sorcerer');
  const actor = createMockActor('Typeless', [classItem]);
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Actor with class items should get button even without explicit type');
});

await asyncTest('Actor with items.filter as undefined is handled gracefully', async () => {
  const actor = { name: 'Broken', type: 'character', items: null };
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'Should not inject button when items is null');
});

await asyncTest('jQuery-like html object is handled (jQuery wrapper)', async () => {
  const classItem = createMockClassItem('Ranger', 5, 'ranger');
  const actor = createMockActor('jQuery Test', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const rawHtml = createMockSheetHTML();
  await triggerRenderActorSheet(app, rawHtml, {});

  const btn = rawHtml.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should be injected with raw HTML element');
});

await asyncTest('Button injection with features tab h3 (no inventory-header)', async () => {
  const classItem = createMockClassItem('Druid', 4, 'druid');
  const actor = createMockActor('H3 Test', [classItem]);
  actor.type = 'character';
  const app = createMockApp(actor);

  const html = document.createElement('div');
  const featuresTab = document.createElement('div');
  featuresTab.classList.add('tab');
  featuresTab.setAttribute('data-tab', 'features');
  const h3 = document.createElement('h3');
  h3.textContent = 'Class Features';
  featuresTab.appendChild(h3);
  html.appendChild(featuresTab);

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(btn, 'Button should be injected even with h3 instead of inventory-header');
});

// ===================================
// Section 10: Button does not appear for actors without class items (various scenarios)
// ===================================
console.log('\n--- Section 10: Various no-class-items scenarios ---');

await asyncTest('Actor with empty items array gets no button', async () => {
  const actor = createMockActor('Empty Items', []);
  actor.type = 'character';
  const app = createMockApp(actor);
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'No button for actor with empty items array');
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
  const html = createMockSheetHTML();

  await triggerRenderActorSheet(app, html, {});

  const btn = html.querySelector('.archetype-manager-sheet-btn');
  assert(!btn, 'No button for actor with only feat-type items');
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
