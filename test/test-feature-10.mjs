/**
 * Test Suite for Feature #10: Load archetype list from compendium
 *
 * Verifies that the CompendiumParser loads the full archetype index
 * from the pf1e-archetypes.pf-archetypes pack correctly.
 */

import { setupMockEnvironment } from './foundry-mock.mjs';

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

async function testAsync(name, fn) {
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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * Generate mock archetype documents for testing
 */
function generateMockArchetypes(count) {
  const archetypes = [];
  const classes = ['Fighter', 'Rogue', 'Wizard', 'Cleric', 'Ranger', 'Paladin', 'Bard', 'Monk', 'Barbarian', 'Druid'];

  for (let i = 0; i < count; i++) {
    archetypes.push({
      _id: `arch-${String(i).padStart(4, '0')}`,
      name: `Test Archetype ${i + 1}`,
      type: 'feat',
      system: {
        class: classes[i % classes.length].toLowerCase(),
        description: {
          value: `<p>Description for test archetype ${i + 1}</p>`
        }
      },
      flags: {
        'pf1e-archetypes': {
          class: classes[i % classes.length].toLowerCase()
        }
      }
    });
  }
  return archetypes;
}

/**
 * Create a mock compendium pack
 */
function createMockPack(documents) {
  return {
    getDocuments: async () => documents,
    getIndex: async () => documents.map(d => ({ _id: d._id, name: d.name, type: d.type })),
    size: documents.length
  };
}

// Set up environment
const { hooks, settings } = setupMockEnvironment();

// Import and init module
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import CompendiumParser
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #10: Load archetype list from compendium ===\n');

// =====================================================
// Step 1: Verify correct pack is accessed
// =====================================================
console.log('--- Step 1: Correct pack name ---');

await testAsync('loadArchetypeList accesses pf1e-archetypes.pf-archetypes pack', async () => {
  // Set up pf1e-archetypes module as active
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  // Track which pack key is accessed
  let accessedPackKey = null;
  const originalGet = game.packs.get.bind(game.packs);
  game.packs.get = (key) => {
    accessedPackKey = key;
    return createMockPack(generateMockArchetypes(5));
  };

  await CompendiumParser.loadArchetypeList();

  assertEqual(accessedPackKey, 'pf1e-archetypes.pf-archetypes',
    `Should access pack 'pf1e-archetypes.pf-archetypes', accessed '${accessedPackKey}'`);

  // Restore
  game.packs.get = originalGet;
});

await testAsync('loadArchetypeFeatures accesses pf1e-archetypes.pf-arch-features pack', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  let accessedPackKey = null;
  const originalGet = game.packs.get.bind(game.packs);
  game.packs.get = (key) => {
    accessedPackKey = key;
    return createMockPack([]);
  };

  await CompendiumParser.loadArchetypeFeatures();

  assertEqual(accessedPackKey, 'pf1e-archetypes.pf-arch-features',
    `Should access pack 'pf1e-archetypes.pf-arch-features', accessed '${accessedPackKey}'`);

  game.packs.get = originalGet;
});

// =====================================================
// Step 2: Verify entries have required fields
// =====================================================
console.log('\n--- Step 2: Entry fields ---');

await testAsync('Loaded entries have name property', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  const mockDocs = generateMockArchetypes(10);
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(mockDocs));

  const result = await CompendiumParser.loadArchetypeList();

  assert(result.length === 10, `Should have 10 entries, got ${result.length}`);
  for (const entry of result) {
    assert(entry.name, `Entry should have a name, got: ${JSON.stringify(entry)}`);
    assert(typeof entry.name === 'string', 'name should be a string');
  }
});

await testAsync('Loaded entries have _id property', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  const mockDocs = generateMockArchetypes(5);
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(mockDocs));

  const result = await CompendiumParser.loadArchetypeList();

  for (const entry of result) {
    assert(entry._id, `Entry should have _id, got: ${JSON.stringify(Object.keys(entry))}`);
  }
});

await testAsync('Loaded entries have type property', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  const mockDocs = generateMockArchetypes(5);
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(mockDocs));

  const result = await CompendiumParser.loadArchetypeList();

  for (const entry of result) {
    assert(entry.type, `Entry should have type, got: ${JSON.stringify(Object.keys(entry))}`);
  }
});

await testAsync('Each archetype entry has a unique name', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  const mockDocs = generateMockArchetypes(20);
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(mockDocs));

  const result = await CompendiumParser.loadArchetypeList();
  const names = result.map(e => e.name);
  const uniqueNames = new Set(names);

  assertEqual(names.length, uniqueNames.size, 'All archetype names should be unique');
});

// =====================================================
// Step 3: Verify list can handle large counts
// =====================================================
console.log('\n--- Step 3: Handle large archetype counts ---');

await testAsync('Can load large archetype list (~1241 entries)', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  const mockDocs = generateMockArchetypes(1241);
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(mockDocs));

  const result = await CompendiumParser.loadArchetypeList();

  assertEqual(result.length, 1241, `Should load all 1241 entries, got ${result.length}`);
});

await testAsync('Can load empty archetype list', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack([]));

  const result = await CompendiumParser.loadArchetypeList();

  assertEqual(result.length, 0, 'Should handle empty pack gracefully');
});

// =====================================================
// Step 4: Verify module availability check
// =====================================================
console.log('\n--- Step 4: Module availability check ---');

test('isModuleAvailable returns true when module is active', () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  assertEqual(CompendiumParser.isModuleAvailable(), true);
});

test('isModuleAvailable returns false when module is inactive', () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: false });
  assertEqual(CompendiumParser.isModuleAvailable(), false);
});

test('isModuleAvailable returns false when module not installed', () => {
  game.modules.delete('pf1e-archetypes');
  assertEqual(CompendiumParser.isModuleAvailable(), false);
});

await testAsync('loadArchetypeList returns empty array when module not available', async () => {
  game.modules.delete('pf1e-archetypes');

  const result = await CompendiumParser.loadArchetypeList();

  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array when module not available');
});

await testAsync('loadArchetypeList returns empty array when module is inactive', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: false });

  const result = await CompendiumParser.loadArchetypeList();

  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array when module is inactive');
});

// =====================================================
// Step 5: Verify error handling
// =====================================================
console.log('\n--- Step 5: Error handling ---');

await testAsync('Handles pack.getDocuments() failure gracefully', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  // Create a pack that throws on getDocuments
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('Simulated pack load failure'); }
  });

  // Capture error calls
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));

  const result = await CompendiumParser.loadArchetypeList();

  console.error = originalError;

  // Should return empty array, not throw
  assert(Array.isArray(result), 'Should return an array on error');
  assertEqual(result.length, 0, 'Should return empty array on error');

  // Should have logged an error
  const moduleErrors = errors.filter(e => e.includes('archetype-manager'));
  assert(moduleErrors.length > 0, 'Should have logged an error message');
});

await testAsync('Handles missing pack gracefully', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  // Clear packs so the pack key returns undefined
  game.packs = new Map();

  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));

  const result = await CompendiumParser.loadArchetypeList();

  console.error = originalError;

  assert(Array.isArray(result), 'Should return an array');
  assertEqual(result.length, 0, 'Should return empty array when pack not found');
});

// =====================================================
// Step 6: No errors during successful loading
// =====================================================
console.log('\n--- Step 6: Clean loading ---');

await testAsync('No console.error during successful load', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs = new Map();
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(generateMockArchetypes(50)));

  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));

  const result = await CompendiumParser.loadArchetypeList();

  console.error = originalError;

  assertEqual(result.length, 50, 'Should load 50 entries');

  const moduleErrors = errors.filter(e => e.includes('archetype-manager'));
  assertEqual(moduleErrors.length, 0, 'Should have zero errors during clean load');
});

await testAsync('No console.warn during successful load', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs = new Map();
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(generateMockArchetypes(50)));

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  await CompendiumParser.loadArchetypeList();

  console.warn = originalWarn;

  const moduleWarnings = warnings.filter(w => w.includes('archetype-manager'));
  assertEqual(moduleWarnings.length, 0, 'Should have zero warnings during clean load');
});

// =====================================================
// Step 7: Return type consistency
// =====================================================
console.log('\n--- Step 7: Return type consistency ---');

await testAsync('Always returns an array (module available)', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs = new Map();
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(generateMockArchetypes(5)));

  const result = await CompendiumParser.loadArchetypeList();
  assert(Array.isArray(result), 'Should return an array');
});

await testAsync('Always returns an array (module not available)', async () => {
  game.modules.delete('pf1e-archetypes');

  const result = await CompendiumParser.loadArchetypeList();
  assert(Array.isArray(result), 'Should return an array');
});

await testAsync('Always returns an array (pack error)', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs = new Map();
  game.packs.set('pf1e-archetypes.pf-archetypes', {
    getDocuments: async () => { throw new Error('test'); }
  });

  // Suppress error output
  const orig = console.error;
  console.error = () => {};
  const result = await CompendiumParser.loadArchetypeList();
  console.error = orig;

  assert(Array.isArray(result), 'Should return an array even on error');
});

// =====================================================
// Step 8: Console log output during successful load
// =====================================================
console.log('\n--- Step 8: Logging ---');

await testAsync('Logs the count of loaded archetypes', async () => {
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  game.packs = new Map();
  game.packs.set('pf1e-archetypes.pf-archetypes', createMockPack(generateMockArchetypes(100)));

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  await CompendiumParser.loadArchetypeList();

  console.log = originalLog;

  const loadLog = logs.find(l => l.includes('100') && l.includes('archetype'));
  assert(loadLog, `Should log the count of loaded archetypes. Logs: ${JSON.stringify(logs)}`);
});

await testAsync('Logs JE-only mode when module not available', async () => {
  game.modules.delete('pf1e-archetypes');

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  await CompendiumParser.loadArchetypeList();

  console.log = originalLog;

  const jeLog = logs.find(l => l.includes('JE-only') || l.includes('not available'));
  assert(jeLog, 'Should log that module is not available and using JE-only mode');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #10 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #10 tests passed!\n');
  process.exit(0);
}
