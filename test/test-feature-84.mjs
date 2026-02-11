/**
 * Test Suite for Feature #84: Preview dialog handles long feature lists
 *
 * Verifies that:
 * 1. Preview for 7+ feature archetype works
 * 2. All features visible (scrollable)
 * 3. Status icons aligned
 * 4. Level fields accessible
 * 5. No horizontal overflow
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

// Set up environment
const { hooks, settings } = setupMockEnvironment();

// Import module and fire hooks
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');

// Import UIManager and DiffEngine
const { UIManager } = await import('../scripts/ui-manager.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');

// Read CSS file content
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssContent = readFileSync(join(__dirname, '../styles/archetype-manager.css'), 'utf-8');

console.log('\n=== Feature #84: Preview dialog handles long feature lists ===\n');

// Helper: Generate a diff with N features of various types
function generateLongDiff(count) {
  const statuses = ['unchanged', 'removed', 'added', 'modified'];
  const diff = [];
  for (let i = 0; i < count; i++) {
    const status = statuses[i % statuses.length];
    diff.push({
      name: `Feature ${i + 1} - ${status.charAt(0).toUpperCase() + status.slice(1)} Ability`,
      level: Math.ceil((i + 1) * 20 / count),
      status: status,
      uuid: `Compendium.pf1.features.Item.uuid${i}`,
      archetypeFeature: (status === 'added' || status === 'modified') ? {
        name: `Feature ${i + 1}`,
        description: `This is the description for feature ${i + 1}. It has some details about what it does.`,
        level: Math.ceil((i + 1) * 20 / count),
        type: status === 'added' ? 'add' : 'replace',
        source: 'compendium'
      } : null
    });
  }
  return diff;
}

// Helper: Build preview HTML and parse it
function buildAndParsePreview(archName, diff) {
  const parsedArchetype = {
    name: archName,
    slug: archName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    features: diff.filter(d => d.status === 'added' || d.status === 'modified')
  };
  const html = UIManager._buildPreviewHTML(parsedArchetype, diff);
  const container = document.createElement('div');
  container.innerHTML = html;
  return { html, container, parsedArchetype };
}

// --- Section 1: 7+ feature archetype generates all rows ---
console.log('--- Section 1: Preview for 7+ feature archetype ---');

test('Preview HTML for 7-feature archetype contains all 7 rows', () => {
  const diff = generateLongDiff(7);
  const { container } = buildAndParsePreview('Seven Feature Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  assertEqual(rows.length, 7, `Should have 7 rows, got ${rows.length}`);
});

test('Preview HTML for 10-feature archetype contains all 10 rows', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Ten Feature Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  assertEqual(rows.length, 10, `Should have 10 rows, got ${rows.length}`);
});

test('Preview HTML for 15-feature archetype contains all 15 rows', () => {
  const diff = generateLongDiff(15);
  const { container } = buildAndParsePreview('Fifteen Feature Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  assertEqual(rows.length, 15, `Should have 15 rows, got ${rows.length}`);
});

test('Preview HTML for 20-feature archetype contains all 20 rows', () => {
  const diff = generateLongDiff(20);
  const { container } = buildAndParsePreview('Twenty Feature Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  assertEqual(rows.length, 20, `Should have 20 rows, got ${rows.length}`);
});

test('Each row has the correct feature name', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  for (let i = 0; i < 10; i++) {
    const nameCell = rows[i].querySelectorAll('td')[2];
    assert(nameCell.textContent.includes(`Feature ${i + 1}`),
      `Row ${i + 1} should contain "Feature ${i + 1}", got "${nameCell.textContent.trim()}"`);
  }
});

// --- Section 2: All features visible (scrollable) ---
console.log('\n--- Section 2: All features visible (scrollable) ---');

test('Preview content is wrapped in archetype-preview-content div', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const previewContent = container.querySelector('.archetype-preview-content');
  assert(previewContent, 'Should have .archetype-preview-content wrapper');
});

test('CSS makes preview dialog content scrollable', () => {
  assert(cssContent.includes('.archetype-preview-dialog .dialog-content'),
    'CSS should style preview dialog content');
  assert(cssContent.includes('overflow-y: auto'),
    'Preview dialog content should be vertically scrollable');
});

test('CSS sets preview dialog max-height for viewport', () => {
  const hasMaxHeight = /\.archetype-preview-dialog\s*\{[^}]*max-height:\s*80vh/.test(cssContent);
  assert(hasMaxHeight, 'Preview dialog should have max-height: 80vh');
});

test('CSS preview content has overflow-x: hidden (no horizontal scroll)', () => {
  assert(cssContent.includes('.archetype-preview-content'),
    'CSS should style .archetype-preview-content');
  assert(cssContent.includes('overflow-x: hidden'),
    'Preview content should have overflow-x: hidden');
});

test('Preview diff table has width: 100%', () => {
  assert(cssContent.includes('.preview-diff-table'),
    'CSS should style .preview-diff-table');
  // Table has width: 100% in the CSS
  const tableRule = /\.preview-diff-table\s*\{[^}]*width:\s*100%/.test(cssContent);
  assert(tableRule, 'Preview diff table should have width: 100%');
});

test('Preview diff table uses table-layout: fixed', () => {
  const hasFixed = /\.preview-diff-table\s*\{[^}]*table-layout:\s*fixed/.test(cssContent);
  assert(hasFixed, 'Preview diff table should use table-layout: fixed for consistent column widths');
});

test('Preview table thead is sticky for long lists', () => {
  assert(cssContent.includes('.preview-diff-table thead'),
    'CSS should style preview table thead');
  const hasStickyHead = /\.preview-diff-table thead\s*\{[^}]*position:\s*sticky/.test(cssContent);
  assert(hasStickyHead, 'Preview table header should be sticky for long lists');
});

// --- Section 3: Status icons aligned ---
console.log('\n--- Section 3: Status icons aligned ---');

test('Each row has a status icon as first cell', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const rows = container.querySelectorAll('.preview-row');
  for (let i = 0; i < rows.length; i++) {
    const firstCell = rows[i].querySelector('td');
    const statusIcon = firstCell.querySelector('.status-icon');
    assert(statusIcon, `Row ${i + 1} should have a status icon in first cell`);
  }
});

test('Status icons have correct FontAwesome class per status', () => {
  const diff = generateLongDiff(8);
  const { container } = buildAndParsePreview('Test', diff);
  const rows = container.querySelectorAll('.preview-row');

  const expectedIcons = {
    'preview-unchanged': 'fa-check',
    'preview-removed': 'fa-times',
    'preview-added': 'fa-plus',
    'preview-modified': 'fa-pen'
  };

  for (const row of rows) {
    const statusClass = [...row.classList].find(c => c.startsWith('preview-') && c !== 'preview-row');
    const icon = row.querySelector('.status-icon i');
    assert(icon, `Row should have an icon`);
    const expected = expectedIcons[statusClass];
    if (expected) {
      assert(icon.classList.contains(expected),
        `Row with class ${statusClass} should have ${expected} icon, got ${icon.className}`);
    }
  }
});

test('Status icons have inline color styles', () => {
  const diff = generateLongDiff(8);
  const { container } = buildAndParsePreview('Test', diff);
  const statusIcons = container.querySelectorAll('.status-icon');
  for (const icon of statusIcons) {
    const style = icon.getAttribute('style') || '';
    assert(style.includes('color:'), `Status icon should have inline color style, got: ${style}`);
  }
});

test('CSS sets status icon column width to 40px', () => {
  assert(cssContent.includes('width: 40px'),
    'Status column should be 40px wide');
});

test('CSS centers status column content', () => {
  const statusColRule = /\.preview-diff-table td:nth-child\(1\)[^{]*\{[^}]*text-align:\s*center/.test(cssContent);
  assert(statusColRule, 'Status column should be centered');
});

test('All status icons are vertically centered (CSS vertical-align: middle)', () => {
  assert(cssContent.includes('vertical-align: middle'),
    'Table cells should have vertical-align: middle for alignment');
});

// --- Section 4: Level fields accessible ---
console.log('\n--- Section 4: Level fields accessible ---');

test('Added features have editable level inputs', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const addedRows = container.querySelectorAll('.preview-added');
  for (const row of addedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    assert(levelInput, 'Added feature row should have a level input');
    assert(levelInput.getAttribute('type') === 'number', 'Level input should be type="number"');
    assert(levelInput.getAttribute('min') === '1', 'Level input min should be 1');
    assert(levelInput.getAttribute('max') === '20', 'Level input max should be 20');
  }
});

test('Modified features have editable level inputs', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const modifiedRows = container.querySelectorAll('.preview-modified');
  for (const row of modifiedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    assert(levelInput, 'Modified feature row should have a level input');
  }
});

test('Unchanged features do NOT have editable level inputs', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const unchangedRows = container.querySelectorAll('.preview-unchanged');
  for (const row of unchangedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    assert(!levelInput, 'Unchanged feature row should NOT have a level input');
  }
});

test('Removed features do NOT have editable level inputs', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const removedRows = container.querySelectorAll('.preview-removed');
  for (const row of removedRows) {
    const levelInput = row.querySelector('.preview-level-input');
    assert(!levelInput, 'Removed feature row should NOT have a level input');
  }
});

test('Level inputs have data-index attribute for event handling', () => {
  const diff = generateLongDiff(10);
  const { container } = buildAndParsePreview('Test', diff);
  const levelInputs = container.querySelectorAll('.preview-level-input');
  for (const input of levelInputs) {
    const idx = input.getAttribute('data-index');
    assert(idx !== null && idx !== undefined, 'Level input should have data-index attribute');
    const numIdx = parseInt(idx);
    assert(!isNaN(numIdx), `data-index should be numeric, got "${idx}"`);
  }
});

test('Level input column is 60px wide in CSS', () => {
  assert(cssContent.includes('width: 60px'),
    'Level column should be 60px wide');
});

test('CSS styles .preview-level-input with width and border', () => {
  assert(cssContent.includes('.preview-level-input'),
    'CSS should style .preview-level-input');
});

test('CSS styles .invalid-level class for validation feedback', () => {
  assert(cssContent.includes('.preview-level-input.invalid-level'),
    'CSS should style .preview-level-input.invalid-level for validation errors');
});

// --- Section 5: No horizontal overflow ---
console.log('\n--- Section 5: No horizontal overflow ---');

test('Preview content container prevents horizontal overflow', () => {
  assert(cssContent.includes('overflow-x: hidden'),
    'Preview content should prevent horizontal overflow');
});

test('Table uses table-layout: fixed to prevent column expansion', () => {
  const hasFixed = /\.preview-diff-table\s*\{[^}]*table-layout:\s*fixed/.test(cssContent);
  assert(hasFixed, 'Table should use table-layout: fixed');
});

test('Feature name column uses word-wrap: break-word', () => {
  assert(cssContent.includes('word-wrap: break-word'),
    'Feature name column should wrap long words');
});

test('Feature name column uses overflow-wrap: break-word', () => {
  assert(cssContent.includes('overflow-wrap: break-word'),
    'Feature name column should break overflow words');
});

test('Table cells have overflow: hidden for safety', () => {
  const tdOverflow = /\.preview-diff-table td\s*\{[^}]*overflow:\s*hidden/.test(cssContent);
  assert(tdOverflow, 'Table cells should have overflow: hidden');
});

test('Table cells have text-overflow: ellipsis for long content', () => {
  const tdEllipsis = /\.preview-diff-table td\s*\{[^}]*text-overflow:\s*ellipsis/.test(cssContent);
  assert(tdEllipsis, 'Table cells should have text-overflow: ellipsis');
});

test('Preview dialog has max-width: 90vw (CSS constraint)', () => {
  const hasMaxWidth = /\.archetype-preview-dialog\s*\{[^}]*max-width:\s*90vw/.test(cssContent);
  assert(hasMaxWidth, 'Preview dialog should have max-width: 90vw');
});

// --- Section 6: Very long feature names ---
console.log('\n--- Section 6: Long feature names and edge cases ---');

test('Feature with very long name is included in preview', () => {
  const longName = 'Super Long Feature Name That Should Not Cause Any Horizontal Overflow Issues At All Even On Smaller Screens';
  const diff = [
    { name: longName, level: 5, status: 'added', archetypeFeature: { name: longName, description: 'test', level: 5, type: 'add' } },
    { name: 'Normal Feature', level: 3, status: 'unchanged' }
  ];
  const { container } = buildAndParsePreview('Long Name Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  assertEqual(rows.length, 2, 'Should have 2 rows');
  assert(rows[0].textContent.includes('Super Long Feature Name'),
    'Long feature name should be in the row');
});

test('Preview with 30 features generates all rows', () => {
  const diff = generateLongDiff(30);
  const { container } = buildAndParsePreview('Thirty Feature Archetype', diff);
  const rows = container.querySelectorAll('.preview-row');
  assertEqual(rows.length, 30, `Should have 30 rows, got ${rows.length}`);
});

test('Info buttons present on added/modified features in long list', () => {
  const diff = generateLongDiff(12);
  const { container } = buildAndParsePreview('Test', diff);
  const infoBtns = container.querySelectorAll('.info-btn');
  // Every other feature is added or modified (indices 2,3,6,7,10,11 for 12 items)
  assert(infoBtns.length > 0, 'Should have info buttons on added/modified features');
  // Count: unchanged(0), removed(1), added(2), modified(3), unchanged(4), removed(5),
  // added(6), modified(7), unchanged(8), removed(9), added(10), modified(11)
  // That's 6 features with info buttons (indices 2,3,6,7,10,11)
  assertEqual(infoBtns.length, 6, `Should have 6 info buttons for 12 features, got ${infoBtns.length}`);
});

test('Empty diff shows "No changes detected" message', () => {
  const { container } = buildAndParsePreview('Empty Archetype', []);
  const tbody = container.querySelector('tbody');
  assert(tbody.textContent.includes('No changes detected'),
    'Empty diff should show "No changes detected"');
});

// --- Section 7: Preview row status classes ---
console.log('\n--- Section 7: Preview row status classes ---');

test('CSS styles preview-removed rows', () => {
  assert(cssContent.includes('.preview-row.preview-removed'),
    'CSS should have .preview-row.preview-removed styles');
});

test('CSS styles preview-added rows', () => {
  assert(cssContent.includes('.preview-row.preview-added'),
    'CSS should have .preview-row.preview-added styles');
});

test('CSS styles preview-modified rows', () => {
  assert(cssContent.includes('.preview-row.preview-modified'),
    'CSS should have .preview-row.preview-modified styles');
});

test('CSS styles preview-unchanged rows', () => {
  assert(cssContent.includes('.preview-row.preview-unchanged'),
    'CSS should have .preview-row.preview-unchanged styles');
});

// --- Section 8: Preview dialog as Dialog ---
console.log('\n--- Section 8: Preview dialog as Dialog ---');

await testAsync('Preview dialog for 10+ features creates valid Dialog', async () => {
  const diff = generateLongDiff(12);
  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Many Features Archetype', slug: 'many-features', features: [] };

  // showPreviewDialog returns a Promise, don't await (we just check the dialog)
  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  assert(dialog, 'Dialog should be created');
  assert(dialog.data.content.includes('preview-diff-table'), 'Dialog should contain preview table');
  assert(dialog.data.content.includes('archetype-preview-content'), 'Dialog should have preview content wrapper');
});

await testAsync('Preview dialog has Apply and Back buttons', async () => {
  const diff = generateLongDiff(10);
  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Test', slug: 'test', features: [] };

  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  assert(dialog.data.buttons.apply, 'Dialog should have Apply button');
  assert(dialog.data.buttons.back, 'Dialog should have Back button');
});

await testAsync('Preview dialog has resizable: true', async () => {
  const diff = generateLongDiff(10);
  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Test', slug: 'test', features: [] };

  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  assert(dialog.options.resizable === true, 'Preview dialog should be resizable');
});

await testAsync('Preview dialog has archetype-preview-dialog CSS class', async () => {
  const diff = generateLongDiff(10);
  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Test', slug: 'test', features: [] };

  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  assert(dialog.options.classes.includes('archetype-preview-dialog'),
    'Dialog should have archetype-preview-dialog CSS class');
});

await testAsync('Preview dialog renders all 15 rows in DOM', async () => {
  const diff = generateLongDiff(15);
  const fighterClass = createMockClassItem('Fighter', 10, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Test', slug: 'test', features: [] };

  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  // Check the element if render created it
  if (dialog._element) {
    const rows = dialog._element.querySelectorAll('.preview-row');
    assertEqual(rows.length, 15, `Should render 15 rows in DOM, got ${rows.length}`);
  } else {
    // Fallback: check HTML content
    const matches = dialog.data.content.match(/preview-row/g);
    assertEqual(matches.length, 15, `Should have 15 preview-row occurrences, got ${matches.length}`);
  }
});

// --- Section 9: Action column content ---
console.log('\n--- Section 9: Action labels ---');

test('Each row has an action label matching its status', () => {
  const diff = generateLongDiff(8);
  const { container } = buildAndParsePreview('Test', diff);
  const rows = container.querySelectorAll('.preview-row');

  const expectedLabels = ['Unchanged', 'Removed', 'Added', 'Modified'];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    const actionCell = cells[3]; // 4th cell is action
    const expectedLabel = expectedLabels[i % 4];
    assert(actionCell.textContent.trim() === expectedLabel,
      `Row ${i + 1} action should be "${expectedLabel}", got "${actionCell.textContent.trim()}"`);
  }
});

test('Action column has correct CSS width: 80px', () => {
  assert(cssContent.includes('width: 80px'),
    'Action column should be 80px wide');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #84 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #84 tests passed!\n');
  process.exit(0);
}
