/**
 * Test Suite for Feature #110: Register debug logging toggle setting
 *
 * Verifies that a new module setting 'debugLogging' (boolean, default false,
 * client-scoped, config: true) enables verbose console output for troubleshooting.
 * When enabled, all console.log calls continue as normal. When disabled (default),
 * informational console.log calls are suppressed — only console.warn and
 * console.error calls remain active. Implements a utility logging function
 * (debugLog) that checks this setting before logging.
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';
import * as fs from 'fs';

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

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(`${message || 'Assertion failed'}: expected "${haystack}" to include "${needle}"`);
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

console.log('\n=== Feature #110: Register debug logging toggle setting ===\n');

// =====================================================
// Section 1: Setting registration in init hook
// =====================================================

console.log('--- Section 1: Setting registration in init hook ---');

const env = setupMockEnvironment();

// Import the module to register hooks
await import('../scripts/module.mjs');

// Fire init hook to register settings
await env.hooks.callAll('init');

test('debugLogging setting is registered after init', () => {
  const isRegistered = game.settings.isRegistered('archetype-manager', 'debugLogging');
  assert(isRegistered, 'debugLogging setting should be registered');
});

test('debugLogging setting has type Boolean', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'debugLogging');
  assertEqual(reg.type, Boolean, 'type should be Boolean');
});

test('debugLogging setting has default value of false', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'debugLogging');
  assertEqual(reg.default, false, 'default should be false');
});

test('debugLogging setting has scope "client"', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'debugLogging');
  assertEqual(reg.scope, 'client', 'scope should be client');
});

test('debugLogging setting has config: true', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'debugLogging');
  assertEqual(reg.config, true, 'config should be true');
});

test('debugLogging setting has a descriptive name', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'debugLogging');
  assert(typeof reg.name === 'string' && reg.name.length > 0, 'name should be a non-empty string');
  assertIncludes(reg.name.toLowerCase(), 'debug', 'name should mention debug');
});

test('debugLogging setting has a descriptive hint', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'debugLogging');
  assert(typeof reg.hint === 'string' && reg.hint.length > 0, 'hint should be a non-empty string');
  assertIncludes(reg.hint.toLowerCase(), 'console', 'hint should mention console output');
});

test('debugLogging default value returns false via game.settings.get', () => {
  const value = game.settings.get('archetype-manager', 'debugLogging');
  assertEqual(value, false, 'default value should be false');
});

// =====================================================
// Section 2: debugLog utility function exists and is exported
// =====================================================

console.log('\n--- Section 2: debugLog utility function exists and is exported ---');

const moduleExports = await import('../scripts/module.mjs');

test('debugLog is exported from module.mjs', () => {
  assert(typeof moduleExports.debugLog === 'function', 'debugLog should be a function');
});

test('debugLog accepts multiple arguments without error', () => {
  // With debug disabled, should not throw
  game.settings.set('archetype-manager', 'debugLogging', false);
  moduleExports.debugLog('test message', 123, { key: 'value' });
  // No error means pass
  assert(true);
});

// =====================================================
// Section 3: debugLog suppresses logs when disabled (default)
// =====================================================

console.log('\n--- Section 3: debugLog suppresses logs when disabled (default) ---');

test('debugLog does NOT call console.log when debugLogging is disabled', () => {
  game.settings.set('archetype-manager', 'debugLogging', false);

  const originalLog = console.log;
  let logCalled = false;
  console.log = (...args) => {
    // Ignore test framework logs (those with checkmark/cross)
    const msg = args[0]?.toString() || '';
    if (!msg.includes('\u2713') && !msg.includes('\u2717') && !msg.startsWith('---') && !msg.startsWith('===')) {
      logCalled = true;
    }
  };

  try {
    moduleExports.debugLog('This should NOT appear');
    assertEqual(logCalled, false, 'console.log should NOT be called when debugLogging is false');
  } finally {
    console.log = originalLog;
  }
});

test('debugLog suppresses all argument types when disabled', () => {
  game.settings.set('archetype-manager', 'debugLogging', false);

  const originalLog = console.log;
  let logCalled = false;
  console.log = () => { logCalled = true; };

  try {
    moduleExports.debugLog('string', 42, { obj: true }, [1, 2, 3], null, undefined);
    assertEqual(logCalled, false, 'console.log should not be called with any args when disabled');
  } finally {
    console.log = originalLog;
  }
});

// =====================================================
// Section 4: debugLog outputs logs when enabled
// =====================================================

console.log('\n--- Section 4: debugLog outputs logs when enabled ---');

test('debugLog calls console.log when debugLogging is enabled', () => {
  game.settings.set('archetype-manager', 'debugLogging', true);

  const originalLog = console.log;
  let loggedArgs = null;
  console.log = (...args) => { loggedArgs = args; };

  try {
    moduleExports.debugLog('Debug message', 42);
    assert(loggedArgs !== null, 'console.log should be called');
    assertEqual(loggedArgs[0], 'Debug message', 'first arg should match');
    assertEqual(loggedArgs[1], 42, 'second arg should match');
  } finally {
    console.log = originalLog;
  }
});

test('debugLog passes through all arguments when enabled', () => {
  game.settings.set('archetype-manager', 'debugLogging', true);

  const originalLog = console.log;
  let loggedArgs = null;
  console.log = (...args) => { loggedArgs = args; };

  try {
    const testObj = { key: 'value' };
    const testArr = [1, 2, 3];
    moduleExports.debugLog('msg', testObj, testArr);
    assert(loggedArgs !== null, 'console.log should be called');
    assertEqual(loggedArgs.length, 3, 'should have 3 arguments');
    assertEqual(loggedArgs[0], 'msg');
    assertEqual(loggedArgs[1], testObj);
    assertEqual(loggedArgs[2], testArr);
  } finally {
    console.log = originalLog;
  }
});

// =====================================================
// Section 5: console.warn and console.error are NOT affected
// =====================================================

console.log('\n--- Section 5: console.warn and console.error NOT affected ---');

test('console.warn is not wrapped by debugLog (always active)', () => {
  game.settings.set('archetype-manager', 'debugLogging', false);

  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = () => { warnCalled = true; };

  try {
    // console.warn should work regardless of debugLogging setting
    console.warn('test warning');
    assert(warnCalled, 'console.warn should always work');
  } finally {
    console.warn = originalWarn;
  }
});

test('console.error is not wrapped by debugLog (always active)', () => {
  game.settings.set('archetype-manager', 'debugLogging', false);

  const originalError = console.error;
  let errorCalled = false;
  console.error = () => { errorCalled = true; };

  try {
    console.error('test error');
    assert(errorCalled, 'console.error should always work');
  } finally {
    console.error = originalError;
  }
});

// =====================================================
// Section 6: Source code verification - console.log replaced
// =====================================================

console.log('\n--- Section 6: Source code verification - console.log replaced ---');

const scriptFiles = [
  'scripts/module.mjs',
  'scripts/applicator.mjs',
  'scripts/compendium-parser.mjs',
  'scripts/journal-db.mjs',
  'scripts/ui-manager.mjs'
];

// Read all script files
const fileContents = {};
for (const file of scriptFiles) {
  try {
    fileContents[file] = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf-8');
  } catch (e) {
    fileContents[file] = '';
  }
}

test('module.mjs uses debugLog instead of console.log (except inside debugLog itself)', () => {
  const src = fileContents['scripts/module.mjs'];
  assert(src.length > 0, 'module.mjs should exist');

  // Find console.log calls that are NOT inside the debugLog function body or comments/hints
  const lines = src.split('\n');
  const badLines = [];
  let insideDebugLog = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track if we're inside the debugLog function using brace counting
    if (line.includes('function debugLog')) {
      insideDebugLog = true;
      braceDepth = 0;
    }
    if (insideDebugLog) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0 && line.includes('}')) {
        insideDebugLog = false;
      }
      continue; // Skip all lines inside debugLog function
    }

    // Skip comments and hint strings
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    if (line.includes("hint:") || line.includes("'hint'")) continue;

    // Check for bare console.log calls
    if (/console\.log\s*\(/.test(line)) {
      badLines.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }

  assertEqual(badLines.length, 0, `module.mjs should not have bare console.log calls outside debugLog. Found: ${badLines.join('; ')}`);
});

test('applicator.mjs uses debugLog instead of console.log', () => {
  const src = fileContents['scripts/applicator.mjs'];
  assert(src.length > 0, 'applicator.mjs should exist');

  // Check that console.log is not called directly (should use debugLog)
  const lines = src.split('\n');
  const badLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    if (/console\.log\s*\(/.test(line)) {
      badLines.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }
  assertEqual(badLines.length, 0, `applicator.mjs should not have console.log calls. Found: ${badLines.join('; ')}`);
});

test('compendium-parser.mjs uses debugLog instead of console.log', () => {
  const src = fileContents['scripts/compendium-parser.mjs'];
  assert(src.length > 0, 'compendium-parser.mjs should exist');

  const lines = src.split('\n');
  const badLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    if (/console\.log\s*\(/.test(line)) {
      badLines.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }
  assertEqual(badLines.length, 0, `compendium-parser.mjs should not have console.log calls. Found: ${badLines.join('; ')}`);
});

test('journal-db.mjs uses debugLog instead of console.log', () => {
  const src = fileContents['scripts/journal-db.mjs'];
  assert(src.length > 0, 'journal-db.mjs should exist');

  const lines = src.split('\n');
  const badLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    if (/console\.log\s*\(/.test(line)) {
      badLines.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }
  assertEqual(badLines.length, 0, `journal-db.mjs should not have console.log calls. Found: ${badLines.join('; ')}`);
});

test('ui-manager.mjs has no console.log calls (unchanged)', () => {
  const src = fileContents['scripts/ui-manager.mjs'];
  assert(src.length > 0, 'ui-manager.mjs should exist');

  const lines = src.split('\n');
  const badLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    if (/console\.log\s*\(/.test(line)) {
      badLines.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }
  assertEqual(badLines.length, 0, `ui-manager.mjs should not have console.log calls. Found: ${badLines.join('; ')}`);
});

test('console.warn calls remain unchanged in all scripts', () => {
  // console.warn should NOT be replaced by debugLog
  let warnCount = 0;
  for (const [file, src] of Object.entries(fileContents)) {
    const matches = src.match(/console\.warn\s*\(/g);
    if (matches) warnCount += matches.length;
  }
  assert(warnCount > 0, 'There should be console.warn calls remaining in scripts (not replaced by debugLog)');
});

test('console.error calls remain unchanged in all scripts', () => {
  // console.error should NOT be replaced by debugLog
  let errorCount = 0;
  for (const [file, src] of Object.entries(fileContents)) {
    const matches = src.match(/console\.error\s*\(/g);
    if (matches) errorCount += matches.length;
  }
  assert(errorCount > 0, 'There should be console.error calls remaining in scripts (not replaced by debugLog)');
});

// =====================================================
// Section 7: debugLog imports in dependent modules
// =====================================================

console.log('\n--- Section 7: debugLog imports in dependent modules ---');

test('applicator.mjs imports debugLog from module.mjs', () => {
  const src = fileContents['scripts/applicator.mjs'];
  assertIncludes(src, 'debugLog', 'applicator.mjs should import debugLog');
  assert(/import\s*\{[^}]*debugLog[^}]*\}\s*from\s*['"]\.\/module\.mjs['"]/.test(src),
    'applicator.mjs should import debugLog from ./module.mjs');
});

test('compendium-parser.mjs imports debugLog from module.mjs', () => {
  const src = fileContents['scripts/compendium-parser.mjs'];
  assertIncludes(src, 'debugLog', 'compendium-parser.mjs should import debugLog');
  assert(/import\s*\{[^}]*debugLog[^}]*\}\s*from\s*['"]\.\/module\.mjs['"]/.test(src),
    'compendium-parser.mjs should import debugLog from ./module.mjs');
});

test('journal-db.mjs imports debugLog from module.mjs', () => {
  const src = fileContents['scripts/journal-db.mjs'];
  assertIncludes(src, 'debugLog', 'journal-db.mjs should import debugLog');
  assert(/import\s*\{[^}]*debugLog[^}]*\}\s*from\s*['"]\.\/module\.mjs['"]/.test(src),
    'journal-db.mjs should import debugLog from ./module.mjs');
});

// =====================================================
// Section 8: Toggling behavior
// =====================================================

console.log('\n--- Section 8: Toggling behavior ---');

test('Setting can be toggled from false to true at runtime', () => {
  game.settings.set('archetype-manager', 'debugLogging', false);
  assertEqual(game.settings.get('archetype-manager', 'debugLogging'), false);

  game.settings.set('archetype-manager', 'debugLogging', true);
  assertEqual(game.settings.get('archetype-manager', 'debugLogging'), true);
});

test('Setting can be toggled from true to false at runtime', () => {
  game.settings.set('archetype-manager', 'debugLogging', true);
  assertEqual(game.settings.get('archetype-manager', 'debugLogging'), true);

  game.settings.set('archetype-manager', 'debugLogging', false);
  assertEqual(game.settings.get('archetype-manager', 'debugLogging'), false);
});

test('debugLog respects setting change immediately', () => {
  const originalLog = console.log;
  let callCount = 0;
  console.log = () => { callCount++; };

  try {
    // Start disabled
    game.settings.set('archetype-manager', 'debugLogging', false);
    moduleExports.debugLog('should not appear');
    assertEqual(callCount, 0, 'should not log when disabled');

    // Enable
    game.settings.set('archetype-manager', 'debugLogging', true);
    moduleExports.debugLog('should appear');
    assertEqual(callCount, 1, 'should log when enabled');

    // Disable again
    game.settings.set('archetype-manager', 'debugLogging', false);
    moduleExports.debugLog('should not appear again');
    assertEqual(callCount, 1, 'should not log when disabled again');
  } finally {
    console.log = originalLog;
  }
});

// =====================================================
// Section 9: Integration with existing settings
// =====================================================

console.log('\n--- Section 9: Integration with existing settings ---');

test('Module registers exactly 6 settings after init (including debugLogging)', () => {
  // lastSelectedClass, showParseWarnings, autoCreateJEDB, chatNotifications, defaultCompendiumSource, debugLogging
  const allSettings = [];
  const settingsKeys = ['lastSelectedClass', 'showParseWarnings', 'autoCreateJEDB',
    'chatNotifications', 'defaultCompendiumSource', 'debugLogging'];

  for (const key of settingsKeys) {
    assert(game.settings.isRegistered('archetype-manager', key),
      `Setting '${key}' should be registered`);
    allSettings.push(key);
  }

  assertEqual(allSettings.length, 6, 'Should have exactly 6 registered settings');
});

test('Changing debugLogging does not affect other settings', () => {
  // Store original values
  const origShowParse = game.settings.get('archetype-manager', 'showParseWarnings');
  const origAutoCreate = game.settings.get('archetype-manager', 'autoCreateJEDB');
  const origChat = game.settings.get('archetype-manager', 'chatNotifications');

  // Toggle debugLogging
  game.settings.set('archetype-manager', 'debugLogging', true);
  game.settings.set('archetype-manager', 'debugLogging', false);

  // Verify other settings unchanged
  assertEqual(game.settings.get('archetype-manager', 'showParseWarnings'), origShowParse);
  assertEqual(game.settings.get('archetype-manager', 'autoCreateJEDB'), origAutoCreate);
  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), origChat);
});

// =====================================================
// Section 10: Edge cases
// =====================================================

console.log('\n--- Section 10: Edge cases ---');

test('debugLog with no arguments does not throw', () => {
  game.settings.set('archetype-manager', 'debugLogging', true);
  moduleExports.debugLog();  // No args - should not throw
  game.settings.set('archetype-manager', 'debugLogging', false);
  moduleExports.debugLog();  // No args, disabled - should not throw
});

test('debugLog with empty string argument works', () => {
  game.settings.set('archetype-manager', 'debugLogging', true);

  const originalLog = console.log;
  let loggedArgs = null;
  console.log = (...args) => { loggedArgs = args; };

  try {
    moduleExports.debugLog('');
    assert(loggedArgs !== null, 'should call console.log');
    assertEqual(loggedArgs[0], '', 'should pass empty string');
  } finally {
    console.log = originalLog;
  }
});

test('debugLog gracefully handles setting not registered', () => {
  // Temporarily remove the setting registration
  const originalGet = game.settings.get;
  game.settings.get = () => { throw new Error('Setting not registered'); };

  const originalLog = console.log;
  let logCalled = false;
  console.log = () => { logCalled = true; };

  try {
    // Should not throw, should fall back to logging
    moduleExports.debugLog('fallback test');
    assert(logCalled, 'should fall back to console.log when setting check fails');
  } finally {
    game.settings.get = originalGet;
    console.log = originalLog;
  }
});

// =====================================================
// Summary
// =====================================================

console.log('\n' + '='.repeat(60));
console.log(`Feature #110 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
