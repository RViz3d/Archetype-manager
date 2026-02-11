/**
 * Test Suite for Feature #98: Compendium loading completes in reasonable time
 *
 * Verifies that loading ~6000 entries completes without timeout:
 * 1. Clear cached data
 * 2. Trigger loading
 * 3. Time the operation
 * 4. Completes within 30 seconds
 * 5. No browser hang
 * 6. Loading indicator shown
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

// Import modules under test
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { JournalEntryDB } = await import('../scripts/journal-db.mjs');

const MODULE_ID = 'archetype-manager';

/**
 * Helper: Generate a large set of mock archetype documents (~1241 items)
 */
function generateMockArchetypes(count = 1241) {
  const archetypes = [];
  const classNames = ['fighter', 'wizard', 'rogue', 'cleric', 'bard', 'ranger', 'paladin', 'monk', 'barbarian', 'druid'];
  for (let i = 0; i < count; i++) {
    const className = classNames[i % classNames.length];
    archetypes.push({
      id: `arch-${i}`,
      name: `Test Archetype ${i}`,
      system: { class: className },
      flags: { 'pf1e-archetypes': { class: className } }
    });
  }
  return archetypes;
}

/**
 * Helper: Generate a large set of mock archetype features (~4824 items)
 */
function generateMockFeatures(count = 4824) {
  const features = [];
  for (let i = 0; i < count; i++) {
    features.push({
      id: `feat-${i}`,
      name: `Test Feature ${i}`,
      system: {
        description: {
          value: `<p><strong>Level</strong>: ${(i % 20) + 1}</p><p>This feature replaces Bonus Feat.</p>`
        }
      }
    });
  }
  return features;
}

/**
 * Helper: Set up a mock compendium pack with N documents
 */
function setupMockPack(packName, documents) {
  const pack = {
    getDocuments: async () => documents,
    size: documents.length,
    name: packName
  };
  game.packs.set(packName, pack);
  return pack;
}

/**
 * Helper: Set up pf1e-archetypes as active module
 */
function enableArchetypesModule() {
  game.modules.set('pf1e-archetypes', {
    id: 'pf1e-archetypes',
    active: true,
    title: 'PF1e Archetypes'
  });
}

/**
 * Helper: Disable pf1e-archetypes module
 */
function disableArchetypesModule() {
  game.modules.delete('pf1e-archetypes');
}

console.log('\n=== Feature #98: Compendium loading completes in reasonable time ===\n');

// ============================================================
// Section 1: loadArchetypeList handles ~1241 entries efficiently
// ============================================================
console.log('\n--- Section 1: loadArchetypeList handles ~1241 entries efficiently ---');

await asyncTest('loadArchetypeList returns all ~1241 entries', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(1241);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 1241, 'Should return all 1241 archetypes');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('loadArchetypeList completes within 5 seconds for 1241 entries', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(1241);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const start = Date.now();
  const result = await CompendiumParser.loadArchetypeList();
  const elapsed = Date.now() - start;

  assert(elapsed < 5000, `Load took ${elapsed}ms, expected < 5000ms`);
  assertEqual(result.length, 1241, 'Should return all entries');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('loadArchetypeList uses async (returns a Promise)', async () => {
  enableArchetypesModule();
  setupMockPack('pf1e-archetypes.pf-archetypes', []);

  const result = CompendiumParser.loadArchetypeList();
  assert(result instanceof Promise, 'loadArchetypeList should return a Promise');
  await result;

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 2: loadArchetypeFeatures handles ~4824 entries efficiently
// ============================================================
console.log('\n--- Section 2: loadArchetypeFeatures handles ~4824 entries efficiently ---');

await asyncTest('loadArchetypeFeatures returns all ~4824 entries', async () => {
  enableArchetypesModule();
  const features = generateMockFeatures(4824);
  setupMockPack('pf1e-archetypes.pf-arch-features', features);

  const result = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(result.length, 4824, 'Should return all 4824 features');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

await asyncTest('loadArchetypeFeatures completes within 5 seconds for 4824 entries', async () => {
  enableArchetypesModule();
  const features = generateMockFeatures(4824);
  setupMockPack('pf1e-archetypes.pf-arch-features', features);

  const start = Date.now();
  const result = await CompendiumParser.loadArchetypeFeatures();
  const elapsed = Date.now() - start;

  assert(elapsed < 5000, `Load took ${elapsed}ms, expected < 5000ms`);
  assertEqual(result.length, 4824, 'Should return all entries');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

await asyncTest('loadArchetypeFeatures uses async (returns a Promise)', async () => {
  enableArchetypesModule();
  setupMockPack('pf1e-archetypes.pf-arch-features', []);

  const result = CompendiumParser.loadArchetypeFeatures();
  assert(result instanceof Promise, 'loadArchetypeFeatures should return a Promise');
  await result;

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

// ============================================================
// Section 3: Combined ~6000 entries loading performance
// ============================================================
console.log('\n--- Section 3: Combined ~6000 entries loading performance ---');

await asyncTest('Loading ~6065 total entries (1241 archetypes + 4824 features) completes within 10 seconds', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(1241);
  const features = generateMockFeatures(4824);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);
  setupMockPack('pf1e-archetypes.pf-arch-features', features);

  const start = Date.now();
  const [archResult, featResult] = await Promise.all([
    CompendiumParser.loadArchetypeList(),
    CompendiumParser.loadArchetypeFeatures()
  ]);
  const elapsed = Date.now() - start;

  assert(elapsed < 10000, `Combined load took ${elapsed}ms, expected < 10000ms`);
  assertEqual(archResult.length, 1241, 'All archetypes loaded');
  assertEqual(featResult.length, 4824, 'All features loaded');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

await asyncTest('Loading 6000 entries completes well within 30-second timeout', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(3000);
  const features = generateMockFeatures(3000);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);
  setupMockPack('pf1e-archetypes.pf-arch-features', features);

  const start = Date.now();
  const archResult = await CompendiumParser.loadArchetypeList();
  const featResult = await CompendiumParser.loadArchetypeFeatures();
  const elapsed = Date.now() - start;

  assert(elapsed < 30000, `Total load took ${elapsed}ms, should be under 30s`);
  assertEqual(archResult.length, 3000, 'All archetypes loaded');
  assertEqual(featResult.length, 3000, 'All features loaded');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

await asyncTest('Loading does not block other async operations (non-blocking)', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(1241);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  let concurrentTaskCompleted = false;

  // Start loading and a concurrent task simultaneously
  const loadPromise = CompendiumParser.loadArchetypeList();
  const concurrentPromise = (async () => {
    // Simulate another async task running concurrently
    await new Promise(resolve => setTimeout(resolve, 1));
    concurrentTaskCompleted = true;
  })();

  await Promise.all([loadPromise, concurrentPromise]);
  assert(concurrentTaskCompleted, 'Concurrent async task should complete alongside loading');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 4: Loading indicator shown during operation
// ============================================================
console.log('\n--- Section 4: Loading indicator shown during operation ---');

await asyncTest('Loading indicator becomes visible when loadArchetypes starts', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(100);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('PerfTest1', [classItem]);

  let loadingShown = false;
  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      // Intercept the render callback to check loading state
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;

        // Patch loadArchetypeList to check loading indicator state mid-load
        const origLoad = CompendiumParser.loadArchetypeList;
        CompendiumParser.loadArchetypeList = async function() {
          // Before returning results, check loading indicator
          const indicator = dialogElement.querySelector('.loading-indicator');
          if (indicator && indicator.style.display !== 'none') {
            loadingShown = true;
          }
          return origLoad.call(this);
        };

        originalRender(html);

        // Restore original
        CompendiumParser.loadArchetypeList = origLoad;
      };
      super(data, options);
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  // Wait for async loadArchetypes to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  assert(loadingShown, 'Loading indicator should be shown (display != none) during load');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Loading indicator is hidden after loading completes', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(50);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('PerfTest2', [classItem]);

  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;
        originalRender(html);
      };
      super(data, options);
    }
  };

  UIManager.showMainDialog(actor, [classItem]);

  // Wait for loading to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  assert(dialogElement !== null, 'Dialog should have been rendered');
  const indicator = dialogElement.querySelector('.loading-indicator');
  assert(indicator !== null, 'Loading indicator should exist');
  assertEqual(indicator.style.display, 'none', 'Loading indicator should be hidden after loading completes');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Archetype list is cleared during loading', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(50);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('PerfTest3', [classItem]);

  let listClearedDuringLoad = false;
  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;

        // Patch to check list state mid-load
        const origLoad = CompendiumParser.loadArchetypeList;
        CompendiumParser.loadArchetypeList = async function() {
          const list = dialogElement.querySelector('.archetype-list');
          if (list && list.innerHTML === '') {
            listClearedDuringLoad = true;
          }
          return origLoad.call(this);
        };

        originalRender(html);
        CompendiumParser.loadArchetypeList = origLoad;
      };
      super(data, options);
    }
  };

  UIManager.showMainDialog(actor, [classItem]);
  await new Promise(resolve => setTimeout(resolve, 50));

  assert(listClearedDuringLoad, 'Archetype list should be cleared during loading');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Loading indicator hidden after load error (no hang)', async () => {
  enableArchetypesModule();

  // Set up a pack that throws an error
  const errorPack = {
    getDocuments: async () => { throw new Error('Simulated compendium error'); },
    size: 0,
    name: 'pf1e-archetypes.pf-archetypes'
  };
  game.packs.set('pf1e-archetypes.pf-archetypes', errorPack);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('PerfTest4', [classItem]);

  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;
        originalRender(html);
      };
      super(data, options);
    }
  };

  UIManager.showMainDialog(actor, [classItem]);
  await new Promise(resolve => setTimeout(resolve, 100));

  assert(dialogElement !== null, 'Dialog rendered');
  const indicator = dialogElement.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'Loading indicator should hide even on error');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 5: No browser hang during large loads
// ============================================================
console.log('\n--- Section 5: No browser hang during large loads ---');

await asyncTest('loadArchetypeList with 2000 entries completes without blocking', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(2000);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const start = Date.now();
  const result = await CompendiumParser.loadArchetypeList();
  const elapsed = Date.now() - start;

  assertEqual(result.length, 2000, 'All 2000 archetypes loaded');
  assert(elapsed < 5000, `Loading 2000 items took ${elapsed}ms, expected < 5000ms`);

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('loadArchetypeFeatures with 5000 entries completes without blocking', async () => {
  enableArchetypesModule();
  const features = generateMockFeatures(5000);
  setupMockPack('pf1e-archetypes.pf-arch-features', features);

  const start = Date.now();
  const result = await CompendiumParser.loadArchetypeFeatures();
  const elapsed = Date.now() - start;

  assertEqual(result.length, 5000, 'All 5000 features loaded');
  assert(elapsed < 5000, `Loading 5000 items took ${elapsed}ms, expected < 5000ms`);

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

await asyncTest('Concurrent Promise.all loading does not deadlock', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(1241);
  const features = generateMockFeatures(4824);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);
  setupMockPack('pf1e-archetypes.pf-arch-features', features);

  const start = Date.now();

  // Simulate the pattern that would be used in real operation
  const [archResult, featResult] = await Promise.all([
    CompendiumParser.loadArchetypeList(),
    CompendiumParser.loadArchetypeFeatures()
  ]);
  const elapsed = Date.now() - start;

  assert(elapsed < 10000, `Concurrent load took ${elapsed}ms, expected < 10000ms`);
  assertEqual(archResult.length, 1241, 'Archetypes loaded');
  assertEqual(featResult.length, 4824, 'Features loaded');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.packs.delete('pf1e-archetypes.pf-arch-features');
});

await asyncTest('UI event loop not blocked: setTimeout fires during load', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(1000);

  // Simulate a slow pack with a small delay per getDocuments call
  const slowPack = {
    getDocuments: async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return archetypes;
    },
    size: 1000,
    name: 'pf1e-archetypes.pf-archetypes'
  };
  game.packs.set('pf1e-archetypes.pf-archetypes', slowPack);

  let timeoutFired = false;
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      timeoutFired = true;
      resolve();
    }, 5);
  });

  const loadPromise = CompendiumParser.loadArchetypeList();

  // Both should resolve
  await Promise.all([loadPromise, timeoutPromise]);

  assert(timeoutFired, 'setTimeout callback should fire during async load (event loop not blocked)');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 6: Clear cached data and reload
// ============================================================
console.log('\n--- Section 6: Clear cached data and reload ---');

await asyncTest('Loading from fresh state (no prior cache) works correctly', async () => {
  // Make sure no prior state
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
  game.packs.delete('pf1e-archetypes.pf-arch-features');

  enableArchetypesModule();
  const archetypes = generateMockArchetypes(500);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 500, 'Should load all entries from fresh state');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Second load call returns same data (no stale cache)', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(200);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const result1 = await CompendiumParser.loadArchetypeList();
  const result2 = await CompendiumParser.loadArchetypeList();

  assertEqual(result1.length, 200, 'First load');
  assertEqual(result2.length, 200, 'Second load');
  assertEqual(result1[0].name, result2[0].name, 'Same data from both loads');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Changing pack data between loads reflects new data', async () => {
  enableArchetypesModule();

  // First load with 100 entries
  setupMockPack('pf1e-archetypes.pf-archetypes', generateMockArchetypes(100));
  const result1 = await CompendiumParser.loadArchetypeList();
  assertEqual(result1.length, 100, 'First load: 100 entries');

  // Update pack with 200 entries
  setupMockPack('pf1e-archetypes.pf-archetypes', generateMockArchetypes(200));
  const result2 = await CompendiumParser.loadArchetypeList();
  assertEqual(result2.length, 200, 'Second load: 200 entries (new data)');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 7: JE-only mode when module not available
// ============================================================
console.log('\n--- Section 7: JE-only mode when module not available ---');

await asyncTest('Without pf1e-archetypes module, loadArchetypeList returns empty', async () => {
  disableArchetypesModule();

  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 0, 'Should return empty array in JE-only mode');
});

await asyncTest('Without pf1e-archetypes module, loadArchetypeFeatures returns empty', async () => {
  disableArchetypesModule();

  const result = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(result.length, 0, 'Should return empty array in JE-only mode');
});

await asyncTest('JE-only mode loading completes immediately (near-zero time)', async () => {
  disableArchetypesModule();

  const start = Date.now();
  const [archResult, featResult] = await Promise.all([
    CompendiumParser.loadArchetypeList(),
    CompendiumParser.loadArchetypeFeatures()
  ]);
  const elapsed = Date.now() - start;

  assert(elapsed < 100, `JE-only mode took ${elapsed}ms, expected < 100ms`);
  assertEqual(archResult.length, 0, 'Empty archetypes');
  assertEqual(featResult.length, 0, 'Empty features');
});

// ============================================================
// Section 8: UIManager loadArchetypes with large data sets
// ============================================================
console.log('\n--- Section 8: UIManager loadArchetypes with large data sets ---');

await asyncTest('Main dialog loads 500 archetypes within 5 seconds', async () => {
  enableArchetypesModule();

  // Create 500 fighter archetypes
  const archetypes = [];
  for (let i = 0; i < 500; i++) {
    archetypes.push({
      id: `arch-${i}`,
      name: `Fighter Archetype ${i}`,
      system: { class: 'fighter' },
      flags: { 'pf1e-archetypes': { class: 'fighter' } }
    });
  }
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('PerfTest5', [classItem]);

  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;
        originalRender(html);
      };
      super(data, options);
    }
  };

  const start = Date.now();
  UIManager.showMainDialog(actor, [classItem]);
  await new Promise(resolve => setTimeout(resolve, 200));
  const elapsed = Date.now() - start;

  assert(elapsed < 5000, `Dialog with 500 archetypes took ${elapsed}ms`);

  // Check archetypes rendered
  assert(dialogElement !== null, 'Dialog rendered');
  const items = dialogElement.querySelectorAll('.archetype-item');
  assert(items.length > 0, 'Should have archetype items rendered');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Main dialog handles class with 0 matching archetypes (from large set) gracefully', async () => {
  enableArchetypesModule();

  // Create archetypes that are all wizard (not fighter)
  const archetypes = [];
  for (let i = 0; i < 500; i++) {
    archetypes.push({
      id: `arch-${i}`,
      name: `Wizard Archetype ${i}`,
      system: { class: 'wizard' },
      flags: { 'pf1e-archetypes': { class: 'wizard' } }
    });
  }
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('PerfTest6', [classItem]);

  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;
        originalRender(html);
      };
      super(data, options);
    }
  };

  UIManager.showMainDialog(actor, [classItem]);
  await new Promise(resolve => setTimeout(resolve, 100));

  assert(dialogElement !== null, 'Dialog rendered');
  // Should show empty state, not crash
  const emptyState = dialogElement.querySelector('.empty-state');
  assert(emptyState !== null, 'Should show empty state for no matching archetypes');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 9: Parsing performance with large feature sets
// ============================================================
console.log('\n--- Section 9: Parsing performance with large feature sets ---');

test('parseLevel handles 6000 descriptions quickly', () => {
  const descriptions = [];
  for (let i = 0; i < 6000; i++) {
    descriptions.push(`<p><strong>Level</strong>: ${(i % 20) + 1}</p><p>Some description text.</p>`);
  }

  const start = Date.now();
  const results = descriptions.map(d => CompendiumParser.parseLevel(d));
  const elapsed = Date.now() - start;

  assert(elapsed < 1000, `Parsing 6000 levels took ${elapsed}ms, expected < 1000ms`);
  assertEqual(results[0], 1, 'First level parsed');
  assertEqual(results[19], 20, 'Level 20 parsed');
  assertEqual(results.length, 6000, 'All 6000 parsed');
});

test('parseReplaces handles 6000 descriptions quickly', () => {
  const descriptions = [];
  for (let i = 0; i < 6000; i++) {
    descriptions.push(`<p>This feature replaces Bonus Feat ${i % 100}.</p>`);
  }

  const start = Date.now();
  const results = descriptions.map(d => CompendiumParser.parseReplaces(d));
  const elapsed = Date.now() - start;

  assert(elapsed < 1000, `Parsing 6000 replaces took ${elapsed}ms, expected < 1000ms`);
  assert(results[0] !== null, 'First replaces parsed');
  assertEqual(results.length, 6000, 'All 6000 parsed');
});

test('parseModifies handles 6000 descriptions quickly', () => {
  const descriptions = [];
  for (let i = 0; i < 6000; i++) {
    descriptions.push(`<p>This ability modifies weapon training ${i % 50}.</p>`);
  }

  const start = Date.now();
  const results = descriptions.map(d => CompendiumParser.parseModifies(d));
  const elapsed = Date.now() - start;

  assert(elapsed < 1000, `Parsing 6000 modifies took ${elapsed}ms, expected < 1000ms`);
  assert(results[0] !== null, 'First modifies parsed');
  assertEqual(results.length, 6000, 'All 6000 parsed');
});

test('classifyFeature handles 6000 descriptions quickly', () => {
  const descriptions = [];
  for (let i = 0; i < 6000; i++) {
    if (i % 3 === 0) {
      descriptions.push(`<p><strong>Level</strong>: ${(i % 20) + 1}</p><p>This feature replaces Bonus Feat.</p>`);
    } else if (i % 3 === 1) {
      descriptions.push(`<p><strong>Level</strong>: ${(i % 20) + 1}</p><p>This modifies armor training.</p>`);
    } else {
      descriptions.push(`<p><strong>Level</strong>: ${(i % 20) + 1}</p><p>The archetype gains a new ability.</p>`);
    }
  }

  const start = Date.now();
  const results = descriptions.map(d => CompendiumParser.classifyFeature(d));
  const elapsed = Date.now() - start;

  assert(elapsed < 2000, `Classifying 6000 features took ${elapsed}ms, expected < 2000ms`);
  assertEqual(results.length, 6000, 'All 6000 classified');
  // Check distribution
  const replacements = results.filter(r => r.type === 'replacement').length;
  const modifications = results.filter(r => r.type === 'modification').length;
  const additives = results.filter(r => r.type === 'additive').length;
  assert(replacements > 0, 'Some replacements found');
  assert(modifications > 0, 'Some modifications found');
  assert(additives > 0, 'Some additives found');
});

test('normalizeName handles 6000 names quickly', () => {
  const names = [];
  for (let i = 0; i < 6000; i++) {
    names.push(`Bonus Feat (Advanced) ${i} III`);
  }

  const start = Date.now();
  const results = names.map(n => CompendiumParser.normalizeName(n));
  const elapsed = Date.now() - start;

  assert(elapsed < 1000, `Normalizing 6000 names took ${elapsed}ms, expected < 1000ms`);
  assertEqual(results.length, 6000, 'All 6000 normalized');
  // Verify normalization was applied (stripped parentheticals and roman numerals)
  assert(!results[0].includes('('), 'Parentheticals stripped');
  assert(!results[0].includes('III'), 'Roman numerals stripped');
});

// ============================================================
// Section 10: Error handling during large loads
// ============================================================
console.log('\n--- Section 10: Error handling during large loads ---');

await asyncTest('loadArchetypeList handles pack not found gracefully', async () => {
  enableArchetypesModule();
  // Don't set up any pack
  game.packs.delete('pf1e-archetypes.pf-archetypes');

  notifications = [];
  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 0, 'Should return empty on pack not found');

  // Check error notification was shown
  const errorNotif = notifications.find(n => n.type === 'error');
  assert(errorNotif, 'Error notification should be shown');

  disableArchetypesModule();
});

await asyncTest('loadArchetypeFeatures handles pack not found gracefully', async () => {
  enableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-arch-features');

  notifications = [];
  const result = await CompendiumParser.loadArchetypeFeatures();
  assertEqual(result.length, 0, 'Should return empty on pack not found');

  const errorNotif = notifications.find(n => n.type === 'error');
  assert(errorNotif, 'Error notification should be shown');

  disableArchetypesModule();
});

await asyncTest('loadArchetypeList recovers from getDocuments error', async () => {
  enableArchetypesModule();
  const errorPack = {
    getDocuments: async () => { throw new Error('Network timeout'); },
    size: 0
  };
  game.packs.set('pf1e-archetypes.pf-archetypes', errorPack);

  notifications = [];
  const result = await CompendiumParser.loadArchetypeList();
  assertEqual(result.length, 0, 'Should return empty on error');

  const errorNotif = notifications.find(n => n.type === 'error');
  assert(errorNotif, 'Error notification shown');
  assertIncludes(errorNotif.message, 'Failed', 'Error message mentions failure');

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 11: Full end-to-end loading performance verification
// ============================================================
console.log('\n--- Section 11: Full end-to-end loading performance verification ---');

await asyncTest('Full e2e: Open dialog → load archetypes → render list (500 entries)', async () => {
  enableArchetypesModule();

  const archetypes = [];
  for (let i = 0; i < 500; i++) {
    archetypes.push({
      id: `arch-e2e-${i}`,
      name: `E2E Archetype ${i}`,
      system: { class: 'fighter' },
      flags: { 'pf1e-archetypes': { class: 'fighter' } }
    });
  }
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = [];
  const actor = createMockActor('E2ETest1', [classItem]);

  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;
        originalRender(html);
      };
      super(data, options);
    }
  };

  const start = Date.now();
  UIManager.showMainDialog(actor, [classItem]);
  await new Promise(resolve => setTimeout(resolve, 200));
  const elapsed = Date.now() - start;

  assert(dialogElement !== null, 'Dialog rendered');
  assert(elapsed < 10000, `Full e2e took ${elapsed}ms, expected < 10000ms`);

  // Check loading indicator is now hidden (loading complete)
  const indicator = dialogElement.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'Loading indicator hidden after e2e load');

  // Check some archetypes rendered
  const items = dialogElement.querySelectorAll('.archetype-item');
  assert(items.length > 0, `Rendered ${items.length} archetype items`);

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Full e2e: class change triggers full reload cycle correctly', async () => {
  enableArchetypesModule();

  const fighterArchs = [];
  for (let i = 0; i < 50; i++) {
    fighterArchs.push({
      id: `fighter-arch-${i}`,
      name: `Fighter Archetype ${i}`,
      system: { class: 'fighter' },
      flags: { 'pf1e-archetypes': { class: 'fighter' } }
    });
  }
  const wizardArchs = [];
  for (let i = 0; i < 30; i++) {
    wizardArchs.push({
      id: `wizard-arch-${i}`,
      name: `Wizard Archetype ${i}`,
      system: { class: 'wizard' },
      flags: { 'pf1e-archetypes': { class: 'wizard' } }
    });
  }
  setupMockPack('pf1e-archetypes.pf-archetypes', [...fighterArchs, ...wizardArchs]);

  const fighterClass = createMockClassItem('Fighter', 10, 'fighter');
  fighterClass.system.links.classAssociations = [];
  const wizardClass = createMockClassItem('Wizard', 8, 'wizard');
  wizardClass.system.links.classAssociations = [];
  const actor = createMockActor('E2ETest2', [fighterClass, wizardClass]);

  let dialogElement = null;

  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      const originalRender = data.render;
      data.render = (html) => {
        dialogElement = html[0] || html;
        originalRender(html);
      };
      super(data, options);
    }
  };

  UIManager.showMainDialog(actor, [fighterClass, wizardClass]);
  await new Promise(resolve => setTimeout(resolve, 100));

  assert(dialogElement !== null, 'Dialog rendered');

  // Verify fighter archetypes loaded initially
  let items = dialogElement.querySelectorAll('.archetype-item');
  const initialCount = items.length;
  assert(initialCount > 0, `Initial load should have archetypes (got ${initialCount})`);

  // Simulate class change to Wizard
  const classSelect = dialogElement.querySelector('.class-select');
  assert(classSelect !== null, 'Class select exists');
  classSelect.value = wizardClass.id;
  classSelect.dispatchEvent(new Event('change'));

  // Wait for reload
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check loading indicator is hidden after class change load
  const indicator = dialogElement.querySelector('.loading-indicator');
  assertEqual(indicator.style.display, 'none', 'Loading indicator hidden after class change');

  globalThis.Dialog = OrigDialog;
  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

// ============================================================
// Section 12: isModuleAvailable check
// ============================================================
console.log('\n--- Section 12: isModuleAvailable check ---');

test('isModuleAvailable returns true when module is active', () => {
  enableArchetypesModule();
  assert(CompendiumParser.isModuleAvailable() === true, 'Should be available');
  disableArchetypesModule();
});

test('isModuleAvailable returns false when module not installed', () => {
  disableArchetypesModule();
  assert(CompendiumParser.isModuleAvailable() === false, 'Should not be available');
});

test('isModuleAvailable returns false when module is inactive', () => {
  game.modules.set('pf1e-archetypes', {
    id: 'pf1e-archetypes',
    active: false,
    title: 'PF1e Archetypes'
  });
  assert(CompendiumParser.isModuleAvailable() === false, 'Inactive module should not be available');
  disableArchetypesModule();
});

// ============================================================
// Section 13: Stress test with higher entry counts
// ============================================================
console.log('\n--- Section 13: Stress test with higher entry counts ---');

await asyncTest('Loading 10000 archetypes completes within 15 seconds', async () => {
  enableArchetypesModule();
  const archetypes = generateMockArchetypes(10000);
  setupMockPack('pf1e-archetypes.pf-archetypes', archetypes);

  const start = Date.now();
  const result = await CompendiumParser.loadArchetypeList();
  const elapsed = Date.now() - start;

  assertEqual(result.length, 10000, 'All 10000 loaded');
  assert(elapsed < 15000, `Loading 10000 entries took ${elapsed}ms, expected < 15000ms`);

  disableArchetypesModule();
  game.packs.delete('pf1e-archetypes.pf-archetypes');
});

await asyncTest('Parsing 10000 descriptions completes within 5 seconds', async () => {
  const descriptions = [];
  for (let i = 0; i < 10000; i++) {
    descriptions.push(`<p><strong>Level</strong>: ${(i % 20) + 1}</p><p>This feature replaces Bonus Feat ${i % 100}.</p>`);
  }

  const start = Date.now();
  const results = descriptions.map(d => ({
    level: CompendiumParser.parseLevel(d),
    replaces: CompendiumParser.parseReplaces(d),
    modifies: CompendiumParser.parseModifies(d),
    classification: CompendiumParser.classifyFeature(d)
  }));
  const elapsed = Date.now() - start;

  assertEqual(results.length, 10000, 'All 10000 parsed');
  assert(elapsed < 5000, `Full parse of 10000 descriptions took ${elapsed}ms, expected < 5000ms`);
});

// ============================================================
// Print Results
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #98 Results: ${passed}/${totalTests} tests passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
