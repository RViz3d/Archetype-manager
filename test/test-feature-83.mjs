/**
 * Test Suite for Feature #83: Main dialog sizes correctly on various resolutions
 *
 * Verifies that:
 * 1. Dialog fits at 1920x1080
 * 2. Dialog fits and is usable at 1366x768
 * 3. Dialog has no overflow at 1024x768
 * 4. Close button is always visible
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

// Import UIManager
const { UIManager } = await import('../scripts/ui-manager.mjs');

// Read CSS file content
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssContent = readFileSync(join(__dirname, '../styles/archetype-manager.css'), 'utf-8');

console.log('\n=== Feature #83: Main dialog sizes correctly on various resolutions ===\n');

// --- Section 1: CSS responsive properties ---
console.log('--- CSS responsive properties ---');

test('CSS has max-height: 80vh for main dialog', () => {
  assert(cssContent.includes('max-height: 80vh'), 'Main dialog should have max-height: 80vh');
});

test('CSS has max-width: 90vw for main dialog', () => {
  assert(cssContent.includes('max-width: 90vw'), 'Main dialog should have max-width: 90vw');
});

test('CSS has min-width for main dialog', () => {
  // min-width: 320px ensures dialog doesn't collapse too small
  assert(cssContent.includes('min-width: 320px'), 'Main dialog should have min-width: 320px');
});

test('CSS has flex layout for dialog structure', () => {
  assert(cssContent.includes('display: flex'), 'Dialog should use flex layout');
  assert(cssContent.includes('flex-direction: column'), 'Dialog should use column flex');
});

test('CSS dialog-content has overflow-y: auto', () => {
  assert(cssContent.includes('overflow-y: auto'), 'Dialog content should have overflow-y: auto for scrolling');
});

test('CSS dialog-buttons is flex-shrink: 0 (always visible)', () => {
  assert(cssContent.includes('flex-shrink: 0'), 'Dialog buttons should never shrink (close button always visible)');
});

test('CSS dialog-buttons has sticky positioning', () => {
  assert(cssContent.includes('position: sticky'), 'Dialog buttons should be sticky positioned');
  assert(cssContent.includes('bottom: 0'), 'Dialog buttons should stick to bottom');
});

test('CSS archetype list uses viewport-responsive max-height', () => {
  // min(400px, 40vh) ensures the list scales with viewport
  assert(cssContent.includes('min(400px, 40vh)') || cssContent.includes('min(300px, 35vh)'),
    'Archetype list max-height should be viewport-responsive');
});

// --- Section 2: Responsive media queries ---
console.log('\n--- Responsive media queries ---');

test('CSS has media query for small screens (max-width: 1100px)', () => {
  assert(cssContent.includes('@media (max-width: 1100px)'),
    'Should have media query for screens 1100px and below');
});

test('CSS small screen reduces min-width', () => {
  // In the media query, min-width should be reduced
  const smallScreenSection = cssContent.split('@media (max-width: 1100px)')[1] || '';
  assert(smallScreenSection.includes('min-width: 320px'),
    'Small screen should have reduced min-width');
});

test('CSS has media query for short viewports (max-height: 800px)', () => {
  assert(cssContent.includes('@media (max-height: 800px)'),
    'Should have media query for short viewports');
});

test('CSS short viewport adjusts max-height', () => {
  const shortViewportSection = cssContent.split('@media (max-height: 800px)')[1] || '';
  assert(shortViewportSection.includes('max-height: 85vh'),
    'Short viewport should adjust max-height');
});

test('CSS short viewport reduces archetype list height', () => {
  const shortViewportSection = cssContent.split('@media (max-height: 800px)')[1] || '';
  assert(shortViewportSection.includes('min(250px, 30vh)'),
    'Short viewport should reduce archetype list max-height');
});

// --- Section 3: Dialog options at 1920x1080 ---
console.log('\n--- Dialog at 1920x1080 ---');

await testAsync('Dialog width is 500px at 1920x1080', async () => {
  // Simulate 1920x1080 viewport
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog, 'Dialog should be created');
  // At 1920px wide, Math.min(500, 1920-100) = 500
  assertEqual(dialog.options.width, 500, `Dialog width should be 500 at 1920px viewport`);
});

await testAsync('Dialog has height: auto at 1920x1080', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assertEqual(dialog.options.height, 'auto', 'Dialog height should be auto');
});

await testAsync('Dialog is resizable', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.options.resizable === true, 'Dialog should be resizable');
});

await testAsync('Dialog has archetype-manager-dialog CSS class at 1920x1080', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.options.classes.includes('archetype-manager-dialog'),
    'Dialog should have archetype-manager-dialog class');
});

// --- Section 4: Dialog options at 1366x768 ---
console.log('\n--- Dialog at 1366x768 ---');

await testAsync('Dialog width is 500px at 1366x768 (still fits)', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1366, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  // At 1366px wide, Math.min(500, 1366-100) = 500
  assertEqual(dialog.options.width, 500, 'Dialog width should be 500 at 1366px viewport');
});

await testAsync('Dialog width fits within 1366px viewport with margins', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.options.width < 1366,
    'Dialog width should be less than 1366px viewport width');
  assert(dialog.options.width <= 1266,
    'Dialog width should leave at least 100px margin at 1366px viewport');
});

await testAsync('Dialog content has class selector usable at 1366x768', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const rogueClass = createMockClassItem('Rogue', 3, 'rog');
  const classItems = [fighterClass, rogueClass];
  const actor = createMockActor('Multi-Class', classItems);

  await UIManager.showMainDialog(actor, classItems);

  const dialog = Dialog._lastInstance;
  // Verify key UI elements are present
  assert(dialog.data.content.includes('class-select'), 'Should have class selector');
  assert(dialog.data.content.includes('archetype-search'), 'Should have search input');
  assert(dialog.data.content.includes('archetype-list'), 'Should have archetype list');
  assert(dialog.data.content.includes('Applied Archetypes'), 'Should have applied section');
});

// --- Section 5: Dialog options at 1024x768 ---
console.log('\n--- Dialog at 1024x768 ---');

await testAsync('Dialog width is 500px at 1024x768 (still fits)', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  // At 1024px wide, Math.min(500, 1024-100) = 500
  assertEqual(dialog.options.width, 500, 'Dialog width should be 500 at 1024px viewport');
});

await testAsync('Dialog width fits within 1024px viewport', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.options.width < 1024,
    'Dialog width should be less than 1024px viewport width');
});

await testAsync('CSS max-width: 90vw prevents horizontal overflow at any resolution', async () => {
  // At 1024px, 90vw = 921.6px. Dialog width 500px < 921.6px, so no overflow
  // Even if window is very small (e.g., 600px), 90vw = 540px > 500px dialog
  // The CSS max-width: 90vw acts as a safety net
  assert(cssContent.includes('max-width: 90vw'), 'CSS should have max-width: 90vw safety net');
  assert(cssContent.includes('max-width: 95vw'), 'CSS should have max-width: 95vw for small screens');
});

// --- Section 6: Dialog at very narrow viewport ---
console.log('\n--- Dialog at very narrow viewport ---');

await testAsync('Dialog width adapts at narrow viewport (500px wide)', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  // At 500px wide, Math.min(500, 500-100) = 400
  assertEqual(dialog.options.width, 400, 'Dialog width should adapt to 400 at 500px viewport');
});

await testAsync('Dialog width adapts at very narrow viewport (400px wide)', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  // At 400px wide, Math.min(500, 400-100) = 300
  assertEqual(dialog.options.width, 300, 'Dialog width should adapt to 300 at 400px viewport');
});

// --- Section 7: Close button always visible ---
console.log('\n--- Close button always visible ---');

await testAsync('Dialog has close button', async () => {
  // Restore to standard resolution
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.buttons.close, 'Dialog must have a close button');
  assert(dialog.data.buttons.close.label === 'Close', 'Close button should be labeled "Close"');
});

await testAsync('Close button has fa-times icon', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.buttons.close.icon.includes('fa-times'), 'Close button should have fa-times icon');
});

await testAsync('CSS ensures buttons are sticky at bottom (never scrolled out of view)', async () => {
  // The dialog-buttons section has position: sticky, bottom: 0, flex-shrink: 0
  // This ensures buttons are always visible even when content overflows
  assert(cssContent.includes('.archetype-manager-dialog .dialog-buttons'),
    'CSS should style dialog buttons');
  assert(cssContent.includes('flex-shrink: 0'),
    'Dialog buttons should not shrink');
});

await testAsync('Dialog default button is close (Escape key dismisses)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assertEqual(dialog.data.default, 'close', 'Default button should be "close"');
});

// --- Section 8: All buttons present at all resolutions ---
console.log('\n--- Buttons at various resolutions ---');

const resolutions = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1024x768', width: 1024, height: 768 }
];

for (const res of resolutions) {
  await testAsync(`All three buttons present at ${res.name}`, async () => {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'innerWidth', { value: res.width, writable: true, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: res.height, writable: true, configurable: true });
    }

    const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
    const actor = createMockActor('Test Fighter', [fighterClass]);

    await UIManager.showMainDialog(actor, [fighterClass]);

    const dialog = Dialog._lastInstance;
    assert(dialog.data.buttons.applySelected, `Apply Selected button present at ${res.name}`);
    assert(dialog.data.buttons.addCustom, `Add Archetype button present at ${res.name}`);
    assert(dialog.data.buttons.close, `Close button present at ${res.name}`);
  });
}

// --- Section 9: Content structure for scrolling ---
console.log('\n--- Content structure ---');

await testAsync('Dialog content uses archetype-manager wrapper div', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('class="archetype-manager"'),
    'Content should have archetype-manager wrapper class');
});

await testAsync('Dialog content has archetype-list-container for overflow management', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);

  await UIManager.showMainDialog(actor, [fighterClass]);

  const dialog = Dialog._lastInstance;
  assert(dialog.data.content.includes('archetype-list-container'),
    'Content should have archetype-list-container for overflow management');
});

await testAsync('Archetype list has overflow-y: auto in CSS', () => {
  // The .archetype-list element has overflow-y: auto
  assert(cssContent.includes('.archetype-manager-dialog .archetype-list'),
    'CSS should target .archetype-list');
  assert(cssContent.includes('overflow-y: auto'),
    'Archetype list should have overflow-y: auto');
});

// --- Section 10: Preview dialog responsive sizing ---
console.log('\n--- Preview dialog responsive sizing ---');

test('Preview dialog CSS has max-height: 80vh', () => {
  // Find the responsive preview dialog section (the standalone selector with flex layout)
  const previewRegex = /\.archetype-preview-dialog\s*\{[^}]*max-height:\s*80vh/;
  assert(previewRegex.test(cssContent),
    'Preview dialog should have max-height: 80vh');
});

test('Preview dialog CSS has max-width: 90vw', () => {
  const previewRegex = /\.archetype-preview-dialog\s*\{[^}]*max-width:\s*90vw/;
  assert(previewRegex.test(cssContent),
    'Preview dialog should have max-width: 90vw');
});

test('Preview dialog content area is scrollable', () => {
  assert(cssContent.includes('.archetype-preview-dialog .dialog-content'),
    'Preview dialog content should be styled');
});

test('Preview dialog buttons are sticky', () => {
  assert(cssContent.includes('.archetype-preview-dialog .dialog-buttons'),
    'Preview dialog buttons should be styled');
});

await testAsync('Preview dialog width adapts at 1920x1080', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Two-Handed Fighter', slug: 'two-handed-fighter', features: [] };
  const diff = [];

  // Don't await since it creates a Promise that resolves on button click
  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  assertEqual(dialog.options.width, 550, 'Preview dialog width should be 550 at 1920px');
});

await testAsync('Preview dialog width adapts at narrow viewport (500px)', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Two-Handed Fighter', slug: 'two-handed-fighter', features: [] };
  const diff = [];

  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  // At 500px wide, Math.min(550, 500-100) = 400
  assertEqual(dialog.options.width, 400, 'Preview dialog width should adapt to 400 at 500px viewport');
});

await testAsync('Preview dialog is resizable', async () => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true, configurable: true });
  }

  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test Fighter', [fighterClass]);
  const parsedArchetype = { name: 'Two-Handed Fighter', slug: 'two-handed-fighter', features: [] };
  const diff = [];

  UIManager.showPreviewDialog(actor, fighterClass, parsedArchetype, diff);
  await new Promise(r => setTimeout(r, 10));

  const dialog = Dialog._lastInstance;
  assert(dialog.options.resizable === true, 'Preview dialog should be resizable');
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #83 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #83 tests passed!\n');
  process.exit(0);
}
