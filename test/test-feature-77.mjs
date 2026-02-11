/**
 * Test Suite for Feature #77: Level field validation in preview dialog
 *
 * Verifies that the preview dialog rejects invalid level values
 * (0, -1, 'abc', >20) and accepts valid values (1-20).
 *
 * Steps:
 * 1. Enter 0 in level -> rejected
 * 2. Enter -1 -> rejected
 * 3. Enter 'abc' -> rejected
 * 4. Enter 21+ -> warned or rejected
 * 5. Enter valid 5 -> accepted
 */

import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';

let passed = 0;
let failed = 0;
let totalTests = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

// =====================================================
// Setup
// =====================================================
console.log('\n=== Feature #77: Level field validation in preview dialog ===\n');

const { hooks, settings } = setupMockEnvironment();

// Track notifications
const notifications = [];
const originalNotifications = globalThis.ui.notifications;
globalThis.ui.notifications = {
  info: (msg) => { notifications.push({ type: 'info', msg }); },
  warn: (msg) => { notifications.push({ type: 'warn', msg }); },
  error: (msg) => { notifications.push({ type: 'error', msg }); }
};

function clearNotifications() {
  notifications.length = 0;
}

await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

const { UIManager } = await import('../scripts/ui-manager.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');

// =====================================================
// Test data: sample parsed archetype and diff
// =====================================================
function createTestDiff() {
  const parsedArchetype = {
    slug: 'two-handed-fighter',
    name: 'Two-Handed Fighter',
    class: 'fighter',
    source: 'compendium',
    features: [
      {
        name: 'Shattering Strike',
        type: 'replacement',
        target: 'bravery',
        level: 2,
        description: '<p>Replaces Bravery with Shattering Strike.</p>',
        matchedAssociation: { uuid: 'uuid-bravery', level: 2 }
      },
      {
        name: 'Backswing',
        type: 'additive',
        target: null,
        level: 7,
        description: '<p>An additive ability at 7th level.</p>'
      }
    ]
  };

  const diff = [
    { status: 'unchanged', level: 1, name: 'Bonus Feat', original: { uuid: 'uuid-bonusfeat', level: 1 } },
    { status: 'removed', level: 2, name: 'Bravery', original: { uuid: 'uuid-bravery', level: 2 } },
    { status: 'added', level: 2, name: 'Shattering Strike', archetypeFeature: parsedArchetype.features[0] },
    { status: 'added', level: 7, name: 'Backswing', archetypeFeature: parsedArchetype.features[1] },
    { status: 'unchanged', level: 5, name: 'Weapon Training 1', original: { uuid: 'uuid-wt1', level: 5 } }
  ];

  return { parsedArchetype, diff };
}

/**
 * Helper: Build preview HTML, trigger render callback to wire up events,
 * then simulate changing a level input value
 */
function setupPreviewWithLevel(diff, parsedArchetype, targetIdx, newValue) {
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);

  // Create a real DOM container
  const container = document.createElement('div');
  container.innerHTML = html;

  // Find the dialog instance to get the render callback
  // We need to call showPreviewDialog to get the render callback wired up
  // Instead, we'll simulate the render callback manually
  const levelInputs = container.querySelectorAll('.preview-level-input');
  const targetInput = container.querySelector(`.preview-level-input[data-index="${targetIdx}"]`);

  // Wire up the event handlers (replicate what the render callback does)
  levelInputs.forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.index);
      if (isNaN(idx) || !diff[idx]) return;

      const validation = UIManager._validatePreviewLevel(input.value);

      if (!validation.valid) {
        input.value = diff[idx].level || '';
        input.classList.add('invalid-level');
        ui.notifications.warn(`PF1e Archetype Manager | ${validation.error}`);
        return;
      }

      input.classList.remove('invalid-level');
      diff[idx].level = validation.level;
    });
  });

  return { container, targetInput, levelInputs };
}

// =====================================================
// _validatePreviewLevel unit tests
// =====================================================
console.log('--- _validatePreviewLevel static method unit tests ---');

await testAsync('Step 1: Level 0 is rejected', async () => {
  const result = UIManager._validatePreviewLevel(0);
  assert(!result.valid, 'Level 0 should be invalid');
  assert(result.error !== null, 'Should have error message');
  assertEqual(result.level, null, 'Level should be null on failure');
});

await testAsync('Step 1b: Level 0 as string is rejected', async () => {
  const result = UIManager._validatePreviewLevel('0');
  assert(!result.valid, 'Level "0" should be invalid');
  assert(result.error.includes('at least 1'), 'Error should mention minimum');
});

await testAsync('Step 2: Level -1 is rejected', async () => {
  const result = UIManager._validatePreviewLevel(-1);
  assert(!result.valid, 'Level -1 should be invalid');
  assert(result.error.includes('at least 1'), 'Error should mention minimum');
});

await testAsync('Step 2b: Level -5 is rejected', async () => {
  const result = UIManager._validatePreviewLevel('-5');
  assert(!result.valid, 'Level "-5" should be invalid');
});

await testAsync('Step 3: Non-numeric "abc" is rejected', async () => {
  const result = UIManager._validatePreviewLevel('abc');
  assert(!result.valid, '"abc" should be invalid');
  assert(result.error.includes('number'), 'Error should mention number');
});

await testAsync('Step 3b: Non-numeric "xyz" is rejected', async () => {
  const result = UIManager._validatePreviewLevel('xyz');
  assert(!result.valid, '"xyz" should be invalid');
});

await testAsync('Step 3c: Empty string is rejected', async () => {
  const result = UIManager._validatePreviewLevel('');
  assert(!result.valid, 'Empty string should be invalid');
  assert(result.error.includes('required'), 'Error should mention required');
});

await testAsync('Step 3d: Whitespace-only is rejected', async () => {
  const result = UIManager._validatePreviewLevel('   ');
  assert(!result.valid, 'Whitespace should be invalid');
});

await testAsync('Step 3e: null is rejected', async () => {
  const result = UIManager._validatePreviewLevel(null);
  assert(!result.valid, 'null should be invalid');
});

await testAsync('Step 3f: undefined is rejected', async () => {
  const result = UIManager._validatePreviewLevel(undefined);
  assert(!result.valid, 'undefined should be invalid');
});

await testAsync('Step 4: Level 21 is rejected', async () => {
  const result = UIManager._validatePreviewLevel(21);
  assert(!result.valid, 'Level 21 should be invalid');
  assert(result.error.includes('at most 20'), 'Error should mention maximum');
});

await testAsync('Step 4b: Level 100 is rejected', async () => {
  const result = UIManager._validatePreviewLevel(100);
  assert(!result.valid, 'Level 100 should be invalid');
});

await testAsync('Step 4c: Level 999 is rejected', async () => {
  const result = UIManager._validatePreviewLevel('999');
  assert(!result.valid, 'Level 999 should be invalid');
});

await testAsync('Step 5: Valid level 5 is accepted', async () => {
  const result = UIManager._validatePreviewLevel(5);
  assert(result.valid, 'Level 5 should be valid');
  assertEqual(result.level, 5, 'Level value should be 5');
  assertEqual(result.error, null, 'No error for valid level');
});

await testAsync('Step 5b: Valid level 1 (minimum boundary) is accepted', async () => {
  const result = UIManager._validatePreviewLevel(1);
  assert(result.valid, 'Level 1 should be valid');
  assertEqual(result.level, 1, 'Level value should be 1');
});

await testAsync('Step 5c: Valid level 20 (maximum boundary) is accepted', async () => {
  const result = UIManager._validatePreviewLevel(20);
  assert(result.valid, 'Level 20 should be valid');
  assertEqual(result.level, 20, 'Level value should be 20');
});

await testAsync('Step 5d: Valid level 10 is accepted', async () => {
  const result = UIManager._validatePreviewLevel('10');
  assert(result.valid, 'Level "10" should be valid');
  assertEqual(result.level, 10, 'Level value should be 10');
});

await testAsync('Step 5e: Decimal level "3.5" truncated to 3 (via parseInt)', async () => {
  const result = UIManager._validatePreviewLevel('3.5');
  assert(result.valid, 'parseInt("3.5")=3 should be valid');
  assertEqual(result.level, 3, 'Level should be 3 (truncated)');
});

// =====================================================
// Integration: Level change in rendered preview dialog
// =====================================================
console.log('\n--- Integration: Level change in rendered preview HTML ---');

await testAsync('Valid level change (5) updates diff array', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2; // "Shattering Strike" (added, level 2)
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '5');
  assert(targetInput !== null, 'Found level input for added entry');

  targetInput.value = '5';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, 5, 'Diff level should be updated to 5');
  assert(notifications.length === 0, 'No warning notifications for valid level');

  // Restore
  diff[addedIdx].level = originalLevel;
});

await testAsync('Level 0 change is rejected and diff unchanged', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '0');
  targetInput.value = '0';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, originalLevel, 'Diff level should NOT be updated');
  assert(notifications.some(n => n.type === 'warn'), 'Should show warning notification');
  assert(notifications.some(n => n.msg.includes('Level')), 'Warning mentions level');
});

await testAsync('Level -1 change is rejected and diff unchanged', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '-1');
  targetInput.value = '-1';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, originalLevel, 'Diff level should NOT be updated for -1');
  assert(notifications.some(n => n.type === 'warn'), 'Should show warning for -1');
});

await testAsync('Non-numeric "abc" change is rejected and diff unchanged', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, 'abc');
  targetInput.value = 'abc';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, originalLevel, 'Diff level should NOT be updated for "abc"');
  assert(notifications.some(n => n.type === 'warn'), 'Should show warning for "abc"');
});

await testAsync('Level 21 change is rejected and diff unchanged', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '21');
  targetInput.value = '21';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, originalLevel, 'Diff level should NOT be updated for 21');
  assert(notifications.some(n => n.type === 'warn'), 'Should show warning for 21');
});

await testAsync('Empty string change is rejected and diff unchanged', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '');
  targetInput.value = '';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, originalLevel, 'Diff level should NOT be updated for empty');
  assert(notifications.some(n => n.type === 'warn'), 'Should show warning for empty');
});

await testAsync('Input reset to original value on invalid entry', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;
  const originalLevel = diff[addedIdx].level;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '-5');
  targetInput.value = '-5';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(targetInput.value, String(originalLevel), 'Input value should be reset to original');
});

await testAsync('Invalid level adds invalid-level CSS class', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '0');
  targetInput.value = '0';
  targetInput.dispatchEvent(new Event('change'));

  assert(targetInput.classList.contains('invalid-level'), 'Should have invalid-level class');
});

await testAsync('Valid level removes invalid-level CSS class', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '0');
  // First make it invalid
  targetInput.value = '0';
  targetInput.dispatchEvent(new Event('change'));
  assert(targetInput.classList.contains('invalid-level'), 'Should have invalid-level class after bad input');

  clearNotifications();
  // Now fix it
  targetInput.value = '5';
  targetInput.dispatchEvent(new Event('change'));
  assert(!targetInput.classList.contains('invalid-level'), 'invalid-level class should be removed after valid input');
});

// =====================================================
// Multiple inputs: different entries validated independently
// =====================================================
console.log('\n--- Multiple level inputs validated independently ---');

await testAsync('Multiple added entries each validate independently', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  // diff[2] = added "Shattering Strike" (level 2)
  // diff[3] = added "Backswing" (level 7)

  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  const container = document.createElement('div');
  container.innerHTML = html;

  const levelInputs = container.querySelectorAll('.preview-level-input');
  // Wire up events
  levelInputs.forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.index);
      if (isNaN(idx) || !diff[idx]) return;
      const validation = UIManager._validatePreviewLevel(input.value);
      if (!validation.valid) {
        input.value = diff[idx].level || '';
        input.classList.add('invalid-level');
        ui.notifications.warn(`PF1e Archetype Manager | ${validation.error}`);
        return;
      }
      input.classList.remove('invalid-level');
      diff[idx].level = validation.level;
    });
  });

  const input2 = container.querySelector('.preview-level-input[data-index="2"]');
  const input3 = container.querySelector('.preview-level-input[data-index="3"]');

  // Valid change on first
  input2.value = '4';
  input2.dispatchEvent(new Event('change'));
  assertEqual(diff[2].level, 4, 'First added entry updated to 4');

  // Invalid change on second
  const originalLevel3 = diff[3].level;
  input3.value = '0';
  input3.dispatchEvent(new Event('change'));
  assertEqual(diff[3].level, originalLevel3, 'Second entry unchanged for invalid value');

  // Valid change on second
  input3.value = '8';
  input3.dispatchEvent(new Event('change'));
  assertEqual(diff[3].level, 8, 'Second added entry updated to 8');
});

// =====================================================
// Preview HTML structure: inputs have proper attributes
// =====================================================
console.log('\n--- Preview HTML structure ---');

await testAsync('Level inputs in preview have type="number"', async () => {
  const { parsedArchetype, diff } = createTestDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  assert(html.includes('type="number"'), 'Should include type="number"');
});

await testAsync('Level inputs have min="1" attribute', async () => {
  const { parsedArchetype, diff } = createTestDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  assert(html.includes('min="1"'), 'Should include min="1"');
});

await testAsync('Level inputs have max="20" attribute', async () => {
  const { parsedArchetype, diff } = createTestDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  assert(html.includes('max="20"'), 'Should include max="20"');
});

await testAsync('Level inputs have preview-level-input CSS class', async () => {
  const { parsedArchetype, diff } = createTestDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  assert(html.includes('preview-level-input'), 'Should include preview-level-input class');
});

await testAsync('Level inputs only appear for added/modified entries', async () => {
  const { parsedArchetype, diff } = createTestDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  const container = document.createElement('div');
  container.innerHTML = html;

  const inputs = container.querySelectorAll('.preview-level-input');
  for (const input of inputs) {
    const idx = parseInt(input.dataset.index);
    const status = diff[idx].status;
    assert(status === 'added' || status === 'modified',
      `Level input at index ${idx} should only be for added/modified, got "${status}"`);
  }
});

await testAsync('Unchanged entries have static level text, not input', async () => {
  const { parsedArchetype, diff } = createTestDiff();
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  const container = document.createElement('div');
  container.innerHTML = html;

  const rows = container.querySelectorAll('.preview-row');
  for (let i = 0; i < rows.length; i++) {
    if (diff[i].status === 'unchanged') {
      const input = rows[i].querySelector('.preview-level-input');
      assert(!input, `Unchanged entry at index ${i} should NOT have an editable input`);
    }
  }
});

// =====================================================
// Boundary values
// =====================================================
console.log('\n--- Boundary values ---');

await testAsync('Level 1 is accepted (lower boundary)', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '1');
  targetInput.value = '1';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, 1, 'Diff level should be updated to 1');
  assert(notifications.length === 0, 'No warnings for valid level 1');
});

await testAsync('Level 20 is accepted (upper boundary)', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '20');
  targetInput.value = '20';
  targetInput.dispatchEvent(new Event('change'));

  assertEqual(diff[addedIdx].level, 20, 'Diff level should be updated to 20');
  assert(notifications.length === 0, 'No warnings for valid level 20');
});

await testAsync('Level -100 is rejected', async () => {
  const result = UIManager._validatePreviewLevel(-100);
  assert(!result.valid, 'Level -100 should be invalid');
});

await testAsync('Level 0.5 truncated to 0 and rejected', async () => {
  const result = UIManager._validatePreviewLevel('0.5');
  // parseInt('0.5') = 0, which is < 1
  assert(!result.valid, 'Level 0.5 (parseInt=0) should be invalid');
});

// =====================================================
// Notification message quality
// =====================================================
console.log('\n--- Notification message quality ---');

await testAsync('Warning message includes module title', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, '0');
  targetInput.value = '0';
  targetInput.dispatchEvent(new Event('change'));

  assert(notifications.length > 0, 'Should have at least one notification');
  assert(notifications[0].msg.includes('PF1e Archetype Manager') ||
         notifications[0].msg.includes('Archetype Manager'),
    'Warning should include module name');
});

await testAsync('Warning message mentions Level', async () => {
  clearNotifications();
  const { parsedArchetype, diff } = createTestDiff();
  const addedIdx = 2;

  const { targetInput } = setupPreviewWithLevel(diff, parsedArchetype, addedIdx, 'abc');
  targetInput.value = 'abc';
  targetInput.dispatchEvent(new Event('change'));

  assert(notifications.some(n => n.msg.toLowerCase().includes('level') || n.msg.toLowerCase().includes('number')),
    'Warning should mention level or number');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
