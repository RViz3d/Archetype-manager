/**
 * Test Suite for Feature #6: Module loads without console errors
 *
 * Verifies that the archetype-manager module initializes cleanly with:
 * - No JS errors in browser console
 * - No deprecated API warnings
 * - All imports resolve correctly
 * - All module files are syntactically valid
 * - Init and ready hooks fire without errors
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

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

// =====================================================
// FEATURE #6: Module loads without console errors
// =====================================================
console.log('\n=== Feature #6: Module loads without console errors ===\n');

// === Step 1: All module files exist and are syntactically valid ===
console.log('--- Step 1: File existence and syntax validation ---');

const moduleFiles = [
  'scripts/module.mjs',
  'scripts/archetype-manager.mjs',
  'scripts/journal-db.mjs',
  'scripts/compendium-parser.mjs',
  'scripts/diff-engine.mjs',
  'scripts/applicator.mjs',
  'scripts/conflict-checker.mjs',
  'scripts/ui-manager.mjs',
  'styles/archetype-manager.css',
  'lang/en.json',
  'module.json'
];

for (const file of moduleFiles) {
  test(`${file} exists`, () => {
    const fullPath = resolve(projectRoot, file);
    assert(existsSync(fullPath), `${file} should exist`);
    const content = readFileSync(fullPath, 'utf8');
    assert(content.length > 0, `${file} should not be empty`);
  });
}

// === Step 2: JSON files are valid ===
console.log('\n--- Step 2: JSON validity ---');

test('module.json is valid JSON', () => {
  const content = readFileSync(resolve(projectRoot, 'module.json'), 'utf8');
  JSON.parse(content); // throws if invalid
});

test('lang/en.json is valid JSON', () => {
  const content = readFileSync(resolve(projectRoot, 'lang/en.json'), 'utf8');
  JSON.parse(content);
});

// === Step 3: No deprecated API patterns ===
console.log('\n--- Step 3: No deprecated API patterns ---');

const deprecatedPatterns = [
  { pattern: /\bHooks\.on\b(?!ce)/, name: 'Hooks.on (prefer Hooks.once for init/ready)', files: ['scripts/module.mjs'] },
  { pattern: /game\.data\b/, name: 'game.data (deprecated, use game.settings/game.modules)' },
  { pattern: /\.data\.data\b/, name: '.data.data access pattern (deprecated in v10+, use .system)' },
  { pattern: /CONFIG\.Actor\.entityClass/, name: 'CONFIG.Actor.entityClass (deprecated, use CONFIG.Actor.documentClass)' },
  { pattern: /\.entity\b(?!\.|\w)/, name: '.entity property (deprecated in v10+, use .documentName)' },
  { pattern: /getFlag\s*\(\s*['"]core['"]/, name: 'getFlag("core", ...) used instead of module scope' },
  { pattern: /mergeObject\b/, name: 'mergeObject (deprecated, use foundry.utils.mergeObject)' },
  { pattern: /duplicate\b\s*\(/, name: 'duplicate() (deprecated, use foundry.utils.deepClone)' },
  { pattern: /isObjectEmpty\b/, name: 'isObjectEmpty (deprecated, use foundry.utils.isEmpty)' },
  { pattern: /flattenObject\b/, name: 'flattenObject (deprecated, use foundry.utils.flattenObject)' },
  { pattern: /expandObject\b/, name: 'expandObject (deprecated, use foundry.utils.expandObject)' },
];

const jsFiles = moduleFiles.filter(f => f.endsWith('.mjs'));

for (const jsFile of jsFiles) {
  const content = readFileSync(resolve(projectRoot, jsFile), 'utf8');

  for (const { pattern, name, files } of deprecatedPatterns) {
    // Some checks are only for specific files
    if (files && !files.includes(jsFile)) continue;

    test(`${jsFile}: No deprecated ${name}`, () => {
      // Special case: Hooks.on check is about non-init/ready hooks in module.mjs
      if (name.includes('Hooks.on') && jsFile === 'scripts/module.mjs') {
        // module.mjs should only use Hooks.once, not Hooks.on
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          // Skip comments
          if (lines[i].trim().startsWith('//') || lines[i].trim().startsWith('*')) continue;
          if (/Hooks\.on\(/.test(lines[i]) && !/Hooks\.once\(/.test(lines[i])) {
            throw new Error(`Line ${i + 1}: Found Hooks.on() - module init/ready should use Hooks.once()`);
          }
        }
        return;
      }

      // General check
      if (!files) {
        const match = content.match(pattern);
        if (match) {
          // Find line number
          const beforeMatch = content.substring(0, match.index);
          const lineNum = beforeMatch.split('\n').length;
          throw new Error(`Line ${lineNum}: Found deprecated pattern: ${name}`);
        }
      }
    });
  }
}

// === Step 4: Module initialization with error capture ===
// IMPORTANT: We set up the mock environment ONCE before importing module.mjs,
// then fire hooks and capture errors. All subsequent tests use this same environment.
console.log('\n--- Step 4: Module initialization with error capture ---');

// Set up the mock environment BEFORE importing module.mjs
const { hooks: testHooks, settings: testSettings } = setupMockEnvironment();

// Capture console.error and console.warn during module import + init + ready
const capturedErrors = [];
const capturedWarnings = [];
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  capturedErrors.push(args.join(' '));
};
console.warn = (...args) => {
  capturedWarnings.push(args.join(' '));
};

// Import the module (this registers Hooks.once listeners)
await import('../scripts/module.mjs');

// Fire init and ready hooks
await testHooks.callAll('init');
await testHooks.callAll('ready');

// Restore console
console.error = originalError;
console.warn = originalWarn;

test('Module initializes with zero console.error calls', () => {
  const moduleErrors = capturedErrors.filter(e =>
    e.includes('archetype-manager') || e.includes('Archetype Manager')
  );
  if (moduleErrors.length > 0) {
    throw new Error(`Module produced errors: ${moduleErrors.join('; ')}`);
  }
});

test('Module initializes with zero console.warn calls from module code', () => {
  const moduleWarnings = capturedWarnings.filter(w =>
    (w.includes('archetype-manager') || w.includes('Archetype Manager'))
    && !w.includes('Corrupted') // corruption recovery is expected behavior
  );
  if (moduleWarnings.length > 0) {
    throw new Error(`Module produced warnings: ${moduleWarnings.join('; ')}`);
  }
});

// === Step 5: All module imports resolve without errors ===
console.log('\n--- Step 5: All module imports resolve without errors ---');

await testAsync('scripts/module.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/module.mjs');
  assert(mod.MODULE_ID, 'MODULE_ID should be exported');
  assert(mod.MODULE_TITLE, 'MODULE_TITLE should be exported');
  assert(mod.JE_DB_NAME, 'JE_DB_NAME should be exported');
});

await testAsync('scripts/archetype-manager.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/archetype-manager.mjs');
  assert(mod.ArchetypeManager, 'ArchetypeManager should be exported');
  assert(typeof mod.ArchetypeManager.open === 'function', 'open should be a static function');
});

await testAsync('scripts/journal-db.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/journal-db.mjs');
  assert(mod.JournalEntryDB, 'JournalEntryDB should be exported');
  assert(typeof mod.JournalEntryDB.ensureDatabase === 'function', 'ensureDatabase should be a function');
  assert(typeof mod.JournalEntryDB.readSection === 'function', 'readSection should be a function');
  assert(typeof mod.JournalEntryDB.writeSection === 'function', 'writeSection should be a function');
});

await testAsync('scripts/compendium-parser.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/compendium-parser.mjs');
  assert(mod.CompendiumParser, 'CompendiumParser should be exported');
  assert(typeof mod.CompendiumParser.parseLevel === 'function', 'parseLevel should be a function');
  assert(typeof mod.CompendiumParser.parseReplaces === 'function', 'parseReplaces should be a function');
});

await testAsync('scripts/diff-engine.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/diff-engine.mjs');
  assert(mod.DiffEngine, 'DiffEngine should be exported');
  assert(typeof mod.DiffEngine.generateDiff === 'function', 'generateDiff should be a function');
  assert(typeof mod.DiffEngine.detectConflicts === 'function', 'detectConflicts should be a function');
});

await testAsync('scripts/applicator.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/applicator.mjs');
  assert(mod.Applicator, 'Applicator should be exported');
  assert(typeof mod.Applicator.apply === 'function', 'apply should be a function');
  assert(typeof mod.Applicator.remove === 'function', 'remove should be a function');
});

await testAsync('scripts/conflict-checker.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/conflict-checker.mjs');
  assert(mod.ConflictChecker, 'ConflictChecker should be exported');
  assert(typeof mod.ConflictChecker.checkAgainstApplied === 'function', 'checkAgainstApplied should be a function');
  assert(typeof mod.ConflictChecker.validateClass === 'function', 'validateClass should be a function');
});

await testAsync('scripts/ui-manager.mjs imports resolve cleanly', async () => {
  const mod = await import('../scripts/ui-manager.mjs');
  assert(mod.UIManager, 'UIManager should be exported');
  assert(typeof mod.UIManager.showMainDialog === 'function', 'showMainDialog should be a function');
  assert(typeof mod.UIManager.showConfirmation === 'function', 'showConfirmation should be a function');
});

// === Step 6: Verify module lifecycle is clean ===
console.log('\n--- Step 6: Module lifecycle is clean ---');

test('Settings have correct types and defaults', () => {
  // After init hook fired, settings should be registered on testSettings
  const lastClass = testSettings.get('archetype-manager', 'lastSelectedClass');
  assertEqual(typeof lastClass, 'string', 'lastSelectedClass default should be string');
  assertEqual(lastClass, '', 'lastSelectedClass default should be empty string');

  const showWarnings = testSettings.get('archetype-manager', 'showParseWarnings');
  assertEqual(typeof showWarnings, 'boolean', 'showParseWarnings default should be boolean');
  assertEqual(showWarnings, true, 'showParseWarnings default should be true');
});

test('Module API is accessible after ready', () => {
  // After the ready hook fired, the module API should be set
  const module = game.modules.get('archetype-manager');
  assert(module, 'Module should exist');
  assert(module.api, 'Module API should be set');
  assert(typeof module.api.open === 'function', 'api.open should be callable');
  assertEqual(module.api.MODULE_ID, 'archetype-manager');
  assertEqual(module.api.JE_DB_NAME, 'Archetype Manager DB');
});

await testAsync('No circular import issues', async () => {
  // All modules should already be loaded without error
  const modules = [
    '../scripts/module.mjs',
    '../scripts/archetype-manager.mjs',
    '../scripts/journal-db.mjs',
    '../scripts/compendium-parser.mjs',
    '../scripts/diff-engine.mjs',
    '../scripts/applicator.mjs',
    '../scripts/conflict-checker.mjs',
    '../scripts/ui-manager.mjs'
  ];

  for (const mod of modules) {
    const loaded = await import(mod);
    assert(loaded, `${mod} should load without error`);
  }
});

test('JournalEntry DB was created during ready hook', () => {
  const je = game.journal.getName('Archetype Manager DB');
  assert(je, 'Archetype Manager DB JournalEntry should exist after ready hook');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Feature #6 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #6 tests passed!\n');
  process.exit(0);
}
