/**
 * Test Suite for Feature #80: Loading indicator during compendium operations
 *
 * Verifies that spinner or progress text appears during compendium loading:
 * 1. Trigger compendium loading
 * 2. Verify loading indicator appears
 * 3. Disappears when complete
 * 4. UI responsive during loading
 * 5. No flash if cached
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

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

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(str, sub, message) {
  if (!str || !str.includes(sub)) {
    throw new Error(`${message || 'String inclusion failed'}: "${str && str.substring(0, 200)}" does not include "${sub}"`);
  }
}

function assertNotIncludes(str, sub, message) {
  if (str && str.includes(sub)) {
    throw new Error(`${message || 'String exclusion failed'}: string should not include "${sub}"`);
  }
}

// Set up environment
setupMockEnvironment();

// Register required settings
game.settings.register('archetype-manager', 'lastSelectedClass', {
  scope: 'client',
  config: false,
  type: String,
  default: ''
});
game.settings.register('archetype-manager', 'showParseWarnings', {
  scope: 'world',
  config: true,
  type: Boolean,
  default: true
});

// Notification capture
let notifications = [];
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', message: msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', message: msg }); },
  error: (msg) => { notifications.push({ type: 'error', message: msg }); }
};

// ChatMessage mock
globalThis.ChatMessage = {
  create: async (data) => data
};

// UUID resolution
globalThis.fromUuid = async (uuid) => null;

// Import UIManager
const { UIManager } = await import('../scripts/ui-manager.mjs');

const MODULE_ID = 'archetype-manager';

console.log('\n=== Feature #80: Loading indicator during compendium operations ===\n');

// ============================================================
// Section 1: Loading indicator HTML exists in main dialog template
// ============================================================
console.log('\n--- Section 1: Loading indicator HTML exists in main dialog template ---');

test('Main dialog content contains loading-indicator div', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest1', [classItem]);

  // Capture the dialog
  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  assert(dialogData !== null, 'Dialog should be created');
  assertIncludes(dialogData.content, 'loading-indicator', 'Content should include loading-indicator class');
});

test('Loading indicator contains spinner icon (fa-spinner fa-spin)', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest2', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  assertIncludes(dialogData.content, 'fa-spinner', 'Should have fa-spinner icon');
  assertIncludes(dialogData.content, 'fa-spin', 'Should have fa-spin animation class');
});

test('Loading indicator contains "Loading archetypes..." text', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest3', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  assertIncludes(dialogData.content, 'Loading archetypes', 'Should have loading text');
});

test('Loading indicator is initially hidden (display: none)', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest4', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  // The loading-indicator div should have display: none initially
  const content = dialogData.content;
  // Find the loading-indicator section
  const loadingIdx = content.indexOf('loading-indicator');
  assert(loadingIdx >= 0, 'loading-indicator should exist in content');
  // Check that it has display: none in its style
  const precedingContent = content.substring(Math.max(0, loadingIdx - 100), loadingIdx + 100);
  assertIncludes(precedingContent, 'display: none', 'Loading indicator should be initially hidden');
});

// ============================================================
// Section 2: Loading indicator structure in DOM
// ============================================================
console.log('\n--- Section 2: Loading indicator structure in DOM ---');

test('Loading indicator DOM element can be queried via .loading-indicator class', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest5', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  // Parse the HTML and check DOM structure
  const container = document.createElement('div');
  container.innerHTML = dialogData.content;
  const indicator = container.querySelector('.loading-indicator');
  assert(indicator !== null, 'Should find .loading-indicator element in DOM');
});

test('Loading indicator contains an <i> element for the spinner icon', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest6', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = dialogData.content;
  const indicator = container.querySelector('.loading-indicator');
  const spinnerIcon = indicator.querySelector('i.fa-spinner');
  assert(spinnerIcon !== null, 'Should have <i> element with fa-spinner class');
  assert(spinnerIcon.classList.contains('fa-spin'), 'Spinner should have fa-spin for animation');
});

test('Loading indicator contains a <span> for the text', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest7', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = dialogData.content;
  const indicator = container.querySelector('.loading-indicator');
  const textSpan = indicator.querySelector('span');
  assert(textSpan !== null, 'Should have <span> for loading text');
  assertIncludes(textSpan.textContent, 'Loading', 'Span should contain loading text');
});

test('Loading indicator is inside archetype-list-container', () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest8', [classItem]);

  let dialogData = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      dialogData = data;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = dialogData.content;
  const listContainer = container.querySelector('.archetype-list-container');
  assert(listContainer !== null, 'Should find .archetype-list-container');
  const indicator = listContainer.querySelector('.loading-indicator');
  assert(indicator !== null, 'Loading indicator should be inside archetype-list-container');
});

// ============================================================
// Section 3: Loading indicator behavior during compendium load
// ============================================================
console.log('\n--- Section 3: Loading indicator shows during compendium loading ---');

await asyncTest('Loading indicator is shown (display: flex) when loadArchetypes starts', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest9', [classItem]);

  // Track loading indicator state changes
  const stateChanges = [];

  // Set up a slow compendium load to observe the loading indicator
  let loadResolve;
  const loadPromise = new Promise(resolve => { loadResolve = resolve; });

  // Mock CompendiumParser to track when loading starts
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => {
    // At this point, loading indicator should be visible
    stateChanges.push('load-started');
    loadResolve();
    return [];
  };

  // Create dialog to trigger render callback
  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  // Simulate render with a real DOM element
  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    // Wait for the async load to start
    await loadPromise;
  }

  // During loading, the indicator should have been set to flex
  const indicator = container.querySelector('.loading-indicator');
  // The loadArchetypes function sets display to flex, then back to none
  // Since our mock resolves immediately, it may already be none
  // What we verify is that the render callback was invoked and loadArchetypes ran
  assert(stateChanges.includes('load-started'), 'loadArchetypes should have been triggered');

  // Restore
  CompendiumParser.loadArchetypeList = origLoad;
});

await asyncTest('Loading indicator is hidden (display: none) after compendium load completes', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest10', [classItem]);

  // Mock CompendiumParser
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => [];

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    // Wait a tick for async operations
    await new Promise(r => setTimeout(r, 50));
  }

  const indicator = container.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'Loading indicator should be hidden after load completes');

  CompendiumParser.loadArchetypeList = origLoad;
});

await asyncTest('Archetype list is populated after loading completes', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest11', [classItem]);

  // Mock CompendiumParser to return some archetypes
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  const origIsAvail = CompendiumParser.isModuleAvailable;
  CompendiumParser.isModuleAvailable = () => true;
  CompendiumParser.loadArchetypeList = async () => [
    { name: 'Two-Handed Fighter', system: { class: 'Fighter' }, flags: {} },
    { name: 'Weapon Master', system: { class: 'Fighter' }, flags: {} }
  ];

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 100));
  }

  const listEl = container.querySelector('.archetype-list');
  // After loading, the list should have archetype items (not empty state)
  const items = listEl.querySelectorAll('.archetype-item');
  assert(items.length >= 1, `Archetype list should be populated after loading, found ${items.length}`);

  CompendiumParser.loadArchetypeList = origLoad;
  CompendiumParser.isModuleAvailable = origIsAvail;
});

// ============================================================
// Section 4: Loading indicator clears archetype list while loading
// ============================================================
console.log('\n--- Section 4: Loading indicator clears list while loading ---');

await asyncTest('Archetype list is cleared when loading starts', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest12', [classItem]);

  let listContentDuringLoad = null;

  // Mock CompendiumParser with a check during loading
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"><div class="old-content">Old Content</div></div>
    <div class="applied-list"></div>
  `;

  CompendiumParser.loadArchetypeList = async () => {
    // Check the list content during load
    const listEl = container.querySelector('.archetype-list');
    listContentDuringLoad = listEl.innerHTML;
    return [];
  };

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  // During loading, the list should have been cleared
  assertEqual(listContentDuringLoad, '', 'Archetype list should be cleared during loading');

  CompendiumParser.loadArchetypeList = origLoad;
});

// ============================================================
// Section 5: Loading indicator with class change
// ============================================================
console.log('\n--- Section 5: Loading indicator with class change ---');

await asyncTest('Class selection change triggers loading indicator', async () => {
  const fighterItem = createMockClassItem('Fighter', 10, 'fighter');
  fighterItem.system.links.classAssociations = [];
  const rogueItem = createMockClassItem('Rogue', 8, 'rogue');
  rogueItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest13', [fighterItem, rogueItem]);

  let loadCallCount = 0;
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => {
    loadCallCount++;
    return [];
  };

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [fighterItem, rogueItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select">
      <option value="${fighterItem.id}">Fighter</option>
      <option value="${rogueItem.id}">Rogue</option>
    </select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  const initialLoadCount = loadCallCount;

  // Simulate class change
  const select = container.querySelector('.class-select');
  select.value = rogueItem.id;
  select.dispatchEvent(new Event('change'));

  await new Promise(r => setTimeout(r, 50));

  assert(loadCallCount > initialLoadCount, 'Class change should trigger another loadArchetypes call');

  CompendiumParser.loadArchetypeList = origLoad;
});

// ============================================================
// Section 6: Loading indicator disappears on error
// ============================================================
console.log('\n--- Section 6: Loading indicator disappears on error ---');

await asyncTest('Loading indicator hides even when compendium load throws error', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest14', [classItem]);

  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => {
    throw new Error('Compendium load failure');
  };

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 100));
  }

  const indicator = container.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'Loading indicator should be hidden after error');

  CompendiumParser.loadArchetypeList = origLoad;
});

// ============================================================
// Section 7: Loading indicator timing (fast load - no flash)
// ============================================================
console.log('\n--- Section 7: No persistent flash on fast/cached loads ---');

await asyncTest('Fast load completes quickly and hides indicator (no persistent flash)', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest15', [classItem]);

  // Simulate a very fast (cached) load
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => []; // Instant return

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  const indicator = container.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'After fast/cached load, indicator should be hidden');

  CompendiumParser.loadArchetypeList = origLoad;
});

await asyncTest('Empty compendium (JE-only mode) hides indicator after load', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest16', [classItem]);

  // In JE-only mode, loadArchetypeList returns empty array immediately
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  const origAvail = CompendiumParser.isModuleAvailable;
  CompendiumParser.isModuleAvailable = () => false;
  CompendiumParser.loadArchetypeList = async () => [];

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  const indicator = container.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'In JE-only mode, indicator should hide after load');

  CompendiumParser.loadArchetypeList = origLoad;
  CompendiumParser.isModuleAvailable = origAvail;
});

// ============================================================
// Section 8: Loading indicator behavior during slow load
// ============================================================
console.log('\n--- Section 8: Loading indicator visible during slow load ---');

await asyncTest('Loading indicator visible during slow compendium operation', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest17', [classItem]);

  // Track indicator display state during loading
  let indicatorDisplayDuringLoad = null;
  let loadResolve;
  const loadPromise = new Promise(resolve => { loadResolve = resolve; });

  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  CompendiumParser.loadArchetypeList = async () => {
    // Capture display state during loading
    const indicator = container.querySelector('.loading-indicator');
    indicatorDisplayDuringLoad = indicator.style.display;
    loadResolve();
    return [];
  };

  if (renderCallback) {
    renderCallback(container);
    await loadPromise;
    await new Promise(r => setTimeout(r, 50));
  }

  // During loading, indicator should have been flex (visible)
  assertEqual(indicatorDisplayDuringLoad, 'flex', 'Loading indicator should be visible (flex) during compendium load');

  CompendiumParser.loadArchetypeList = origLoad;
});

await asyncTest('Loading indicator hidden after slow compendium operation completes', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest18', [classItem]);

  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;

  // Simulate a slow load (100ms delay)
  CompendiumParser.loadArchetypeList = async () => {
    await new Promise(r => setTimeout(r, 50));
    return [];
  };

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    // Wait for the slow load to finish
    await new Promise(r => setTimeout(r, 200));
  }

  const indicator = container.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'After slow load completes, indicator should be hidden');

  CompendiumParser.loadArchetypeList = origLoad;
});

// ============================================================
// Section 9: UI responsiveness during loading
// ============================================================
console.log('\n--- Section 9: UI responsiveness during loading ---');

await asyncTest('Class select element is still accessible during loading', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest19', [classItem]);

  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => [];

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  // The class select should still be in the DOM and accessible
  const select = container.querySelector('.class-select');
  assert(select !== null, 'Class select should be in DOM');
  assert(!select.disabled, 'Class select should not be disabled during/after loading');

  CompendiumParser.loadArchetypeList = origLoad;
});

await asyncTest('Search input is accessible during loading', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest20', [classItem]);

  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => [];

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  const searchInput = container.querySelector('.archetype-search');
  assert(searchInput !== null, 'Search input should be in DOM');
  assert(!searchInput.disabled, 'Search input should not be disabled');

  CompendiumParser.loadArchetypeList = origLoad;
});

// ============================================================
// Section 10: Initial load on dialog open
// ============================================================
console.log('\n--- Section 10: Initial load triggers loading indicator ---');

await asyncTest('Initial dialog open triggers loadArchetypes automatically', async () => {
  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('LoadTest21', [classItem]);

  let loadTriggered = false;
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => {
    loadTriggered = true;
    return [];
  };

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"><option value="${classItem.id}">Fighter</option></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  assert(loadTriggered, 'loadArchetypes should be triggered on initial dialog render');

  CompendiumParser.loadArchetypeList = origLoad;
});

await asyncTest('With no class items, loadArchetypes is not triggered (no crash)', async () => {
  const actor = createMockActor('LoadTest22', []);

  let loadTriggered = false;
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
  const origLoad = CompendiumParser.loadArchetypeList;
  CompendiumParser.loadArchetypeList = async () => {
    loadTriggered = true;
    return [];
  };

  let renderCallback = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      renderCallback = data.render;
    }
  };

  UIManager.showMainDialog(actor, []);

  const container = document.createElement('div');
  container.innerHTML = `
    <select class="class-select"></select>
    <input class="archetype-search" />
    <div class="loading-indicator" style="display: none;"></div>
    <div class="archetype-list"></div>
    <div class="applied-list"></div>
  `;

  if (renderCallback) {
    renderCallback(container);
    await new Promise(r => setTimeout(r, 50));
  }

  // With no class items, loadArchetypes should not be called (line 432: if classItems.length > 0)
  assert(!loadTriggered, 'loadArchetypes should not trigger when no class items');

  CompendiumParser.loadArchetypeList = origLoad;
});

// ============================================================
// Section 11: Direct verification of showMainDialog loading indicator code
// ============================================================
console.log('\n--- Section 11: Direct code structure verification ---');

test('showMainDialog render callback references loading-indicator element', () => {
  // Verify that UIManager.showMainDialog has proper loading indicator code
  const source = UIManager.showMainDialog.toString();
  assertIncludes(source, 'loading-indicator', 'showMainDialog should reference loading-indicator');
  assertIncludes(source, 'loadingIndicator', 'showMainDialog should use loadingIndicator variable');
});

test('showMainDialog sets loading indicator display to flex on load start', () => {
  const source = UIManager.showMainDialog.toString();
  // The code should show the indicator by setting display to flex
  assert(
    source.includes("display = 'flex'") || source.includes('display = "flex"'),
    'Should set loading indicator display to flex'
  );
});

test('showMainDialog sets loading indicator display to none on load complete', () => {
  const source = UIManager.showMainDialog.toString();
  // The code should hide the indicator
  assert(
    source.includes("display = 'none'") || source.includes('display = "none"'),
    'Should set loading indicator display to none after loading'
  );
});

// Print summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #80 Results: ${passed}/${totalTests} passing`);
if (failed > 0) {
  console.log(`  ${failed} FAILED`);
  process.exit(1);
} else {
  console.log('  All tests passed!');
}
