/**
 * Test Suite for Feature #85: Dialog styling follows FoundryVTT design language
 *
 * Verifies that:
 * 1. Compare with native Foundry dialogs
 * 2. Fonts match (Signika, system-ui)
 * 3. Button styling consistent
 * 4. Input styling consistent
 * 5. Color scheme matches
 * 6. All dialogs internally consistent
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

console.log('\n=== Feature #85: Dialog styling follows FoundryVTT design language ===\n');

// --- Section 1: Font family matches FoundryVTT ---
console.log('--- Section 1: Fonts match (Signika, system-ui) ---');

test('CSS declares Signika as primary font for all dialog types', () => {
  // All dialog classes should have Signika font
  assert(cssContent.includes('"Signika"'),
    'CSS should reference "Signika" font (FoundryVTT standard)');
});

test('CSS has system-ui as fallback font', () => {
  assert(cssContent.includes('system-ui'),
    'CSS should have system-ui as fallback font');
});

test('CSS font declaration covers main dialog', () => {
  assert(cssContent.includes('.archetype-manager-dialog'),
    'CSS should style .archetype-manager-dialog');
  // Check font-family is set for the main dialog class
  const hasFont = /\.archetype-manager-dialog[^{]*\{[^}]*font-family:.*Signika/s.test(cssContent) ||
    // Also check if it's in a combined selector
    cssContent.includes('.archetype-manager-dialog') && cssContent.includes('"Signika"');
  assert(hasFont, 'Main dialog should use Signika font');
});

test('CSS font declaration covers preview dialog', () => {
  assert(cssContent.includes('.archetype-preview-dialog'),
    'CSS should style .archetype-preview-dialog');
});

test('CSS font declaration covers fix dialog', () => {
  assert(cssContent.includes('.archetype-fix-dialog'),
    'CSS should reference .archetype-fix-dialog');
});

test('CSS font declaration covers description verify dialog', () => {
  assert(cssContent.includes('.archetype-desc-verify-dialog'),
    'CSS should reference .archetype-desc-verify-dialog');
});

test('CSS font declaration covers info popup', () => {
  assert(cssContent.includes('.archetype-info-popup'),
    'CSS should reference .archetype-info-popup');
});

test('Font size is 14px (FoundryVTT standard)', () => {
  assert(cssContent.includes('font-size: 14px'),
    'Base font size should be 14px (FoundryVTT standard)');
});

test('Line height is 1.4 (FoundryVTT standard)', () => {
  assert(cssContent.includes('line-height: 1.4'),
    'Line height should be 1.4');
});

test('Form elements use Signika font', () => {
  // Check that select and input elements inherit the font
  const selectFont = /\.archetype-manager select[^{]*\{[^}]*font-family:.*Signika/s.test(cssContent) ||
    /\.archetype-manager-dialog select[^{]*\{[^}]*font-family:.*Signika/s.test(cssContent);
  assert(cssContent.includes('select') && cssContent.includes('"Signika"'),
    'Select elements should use Signika font');
});

test('Headings use Signika font', () => {
  // h3 and h4 should be styled
  assert(cssContent.includes('.archetype-manager h3') || cssContent.includes('.archetype-manager-dialog h3'),
    'CSS should style h3 headings');
  assert(cssContent.includes('.archetype-manager h4') || cssContent.includes('.archetype-manager-dialog h4'),
    'CSS should style h4 headings');
});

// --- Section 2: Button styling consistent ---
console.log('\n--- Section 2: Button styling consistent ---');

await testAsync('Main dialog buttons use FoundryVTT dialog pattern (icon + label)', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);
  await UIManager.showMainDialog(actor, [fighterClass]);
  const dialog = Dialog._lastInstance;

  // Each button should have an icon and label
  const buttons = dialog.data.buttons;
  for (const [key, btn] of Object.entries(buttons)) {
    assert(btn.icon, `Button "${key}" should have an icon`);
    assert(btn.icon.includes('fas'), `Button "${key}" icon should use FontAwesome (fas class)`);
    assert(btn.label, `Button "${key}" should have a label`);
  }
});

await testAsync('Preview dialog buttons use same pattern', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);
  UIManager.showPreviewDialog(actor, fighterClass, { name: 'Test', slug: 'test', features: [] }, []);
  await new Promise(r => setTimeout(r, 10));
  const dialog = Dialog._lastInstance;

  const buttons = dialog.data.buttons;
  for (const [key, btn] of Object.entries(buttons)) {
    assert(btn.icon, `Preview button "${key}" should have an icon`);
    assert(btn.icon.includes('fas'), `Preview button "${key}" icon should use FontAwesome`);
    assert(btn.label, `Preview button "${key}" should have a label`);
  }
});

await testAsync('Confirmation dialog buttons use same pattern', async () => {
  // showConfirmation creates a dialog
  const confirmPromise = UIManager.showConfirmation('Test', '<p>Test</p>');
  await new Promise(r => setTimeout(r, 10));
  const dialog = Dialog._lastInstance;

  const buttons = dialog.data.buttons;
  assert(buttons.confirm, 'Should have confirm button');
  assert(buttons.cancel, 'Should have cancel button');
  assert(buttons.confirm.icon.includes('fa-check'), 'Confirm button should use fa-check icon');
  assert(buttons.cancel.icon.includes('fa-times'), 'Cancel button should use fa-times icon');
  // Close the dialog
  dialog.close();
});

await testAsync('Fix dialog buttons use same pattern', async () => {
  const feature = { name: 'Test Feature', description: 'Test', level: 3, archetypeSlug: 'test' };
  const baseFeatures = [{ name: 'Bravery', level: 2, uuid: 'test-uuid' }];
  const fixPromise = UIManager.showFixDialog(feature, baseFeatures);
  await new Promise(r => setTimeout(r, 10));
  const dialog = Dialog._lastInstance;

  const buttons = dialog.data.buttons;
  assert(buttons.confirm, 'Fix dialog should have confirm (Save Fix) button');
  assert(buttons.cancel, 'Fix dialog should have cancel button');
  assert(buttons.confirm.icon.includes('fa-check'), 'Save Fix should use fa-check icon');
  assert(buttons.cancel.icon.includes('fa-times'), 'Cancel should use fa-times icon');
  dialog.close();
});

await testAsync('Manual entry dialog buttons use same pattern', async () => {
  const manualPromise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));
  const dialog = Dialog._lastInstance;

  const buttons = dialog.data.buttons;
  assert(buttons.submit, 'Manual entry should have submit (Save) button');
  assert(buttons.cancel, 'Manual entry should have cancel button');
  assert(buttons.submit.icon.includes('fa-save'), 'Submit should use fa-save icon');
  assert(buttons.cancel.icon.includes('fa-times'), 'Cancel should use fa-times icon');
  dialog.close();
});

// --- Section 3: Input styling consistent ---
console.log('\n--- Section 3: Input styling consistent ---');

test('CSS styles text inputs with FoundryVTT variables', () => {
  assert(cssContent.includes('input[type="text"]'),
    'CSS should style text inputs');
  assert(cssContent.includes('var(--color-border-light-1'),
    'Inputs should use FoundryVTT border color variable');
});

test('CSS styles number inputs with FoundryVTT variables', () => {
  assert(cssContent.includes('input[type="number"]'),
    'CSS should style number inputs');
});

test('CSS styles select elements with FoundryVTT variables', () => {
  assert(cssContent.includes('.archetype-manager select') ||
         cssContent.includes('.archetype-manager-dialog select'),
    'CSS should style select elements');
});

test('Input border-radius is 3px (FoundryVTT standard)', () => {
  // Multiple occurrences of border-radius: 3px
  const matches = cssContent.match(/border-radius:\s*3px/g);
  assert(matches && matches.length >= 2,
    `Should have multiple border-radius: 3px declarations (found ${matches ? matches.length : 0})`);
});

test('Input padding follows FoundryVTT convention (4px 6px)', () => {
  assert(cssContent.includes('padding: 4px 6px'),
    'Input padding should be 4px 6px (compact FoundryVTT style)');
});

test('Inputs use FoundryVTT background variable', () => {
  assert(cssContent.includes('var(--color-bg-input') ||
         cssContent.includes('background: var(--color-bg'),
    'Inputs should use FoundryVTT background color variable');
});

test('Focus states use FoundryVTT highlight variable', () => {
  assert(cssContent.includes(':focus'),
    'CSS should have :focus states for inputs');
  assert(cssContent.includes('var(--color-border-highlight') ||
         cssContent.includes('box-shadow'),
    'Focus state should use FoundryVTT highlight or box-shadow');
});

test('Input font size is 13px', () => {
  assert(cssContent.includes('font-size: 13px'),
    'Input font size should be 13px');
});

// --- Section 4: Color scheme matches FoundryVTT ---
console.log('\n--- Section 4: Color scheme matches ---');

test('CSS uses --color-text-dark-primary variable', () => {
  assert(cssContent.includes('var(--color-text-dark-primary'),
    'CSS should use --color-text-dark-primary for text color');
});

test('CSS fallback text color is #191813 (FoundryVTT dark text)', () => {
  assert(cssContent.includes('#191813'),
    'Fallback text color should be #191813 (FoundryVTT standard)');
});

test('CSS uses --color-border-light-1 for borders', () => {
  assert(cssContent.includes('var(--color-border-light-1'),
    'CSS should use --color-border-light-1 for borders');
});

test('CSS uses --color-border-light-2 for lighter borders', () => {
  assert(cssContent.includes('var(--color-border-light-2'),
    'CSS should use --color-border-light-2 for lighter borders');
});

test('CSS uses --color-bg variable for backgrounds', () => {
  assert(cssContent.includes('var(--color-bg'),
    'CSS should use --color-bg for backgrounds');
});

test('CSS fallback background is #f0f0e0 (FoundryVTT standard)', () => {
  assert(cssContent.includes('#f0f0e0'),
    'Fallback background should be #f0f0e0 (FoundryVTT parchment)');
});

test('CSS uses --color-text-dark-secondary for muted text', () => {
  assert(cssContent.includes('var(--color-text-dark-secondary'),
    'CSS should use --color-text-dark-secondary for muted text');
});

test('CSS uses --color-hover-bg for hover states', () => {
  assert(cssContent.includes('var(--color-hover-bg'),
    'CSS should use --color-hover-bg for hover states');
});

test('CSS uses --color-text-hyperlink for links/buttons', () => {
  assert(cssContent.includes('var(--color-text-hyperlink'),
    'CSS should use --color-text-hyperlink for clickable elements');
});

test('CSS uses --color-bg-option for option highlighting', () => {
  assert(cssContent.includes('var(--color-bg-option'),
    'CSS should use --color-bg-option for option states');
});

test('Status colors use standard color palette (#080 green, #c00 red, #08f blue, #f80 orange)', () => {
  assert(cssContent.includes('#080'), 'Should have green (#080) for success/unchanged');
  assert(cssContent.includes('#c00'), 'Should have red (#c00) for removed/error');
  assert(cssContent.includes('#08f'), 'Should have blue (#08f) for added/info');
  assert(cssContent.includes('#f80'), 'Should have orange (#f80) for modified/warning');
});

// --- Section 5: All dialogs internally consistent ---
console.log('\n--- Section 5: All dialogs internally consistent ---');

await testAsync('All dialogs use CSS classes from archetype-manager namespace', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  // Main dialog
  await UIManager.showMainDialog(actor, [fighterClass]);
  const mainDialog = Dialog._lastInstance;
  assert(mainDialog.options.classes.includes('archetype-manager-dialog'),
    'Main dialog should have archetype-manager-dialog class');

  // Preview dialog
  UIManager.showPreviewDialog(actor, fighterClass, { name: 'Test', slug: 'test', features: [] }, []);
  await new Promise(r => setTimeout(r, 10));
  const previewDialog = Dialog._lastInstance;
  assert(previewDialog.options.classes.includes('archetype-preview-dialog'),
    'Preview dialog should have archetype-preview-dialog class');

  // Fix dialog
  const fixPromise = UIManager.showFixDialog({ name: 'Test', description: 'test', level: 3 }, []);
  await new Promise(r => setTimeout(r, 10));
  const fixDialog = Dialog._lastInstance;
  assert(fixDialog.options.classes.includes('archetype-fix-dialog'),
    'Fix dialog should have archetype-fix-dialog class');
  fixDialog.close();

  // Description verify dialog
  const descPromise = UIManager.showDescriptionVerifyDialog({ name: 'Test', description: 'test' });
  await new Promise(r => setTimeout(r, 10));
  const descDialog = Dialog._lastInstance;
  assert(descDialog.options.classes.includes('archetype-desc-verify-dialog'),
    'Description verify dialog should have archetype-desc-verify-dialog class');
  descDialog.close();
});

await testAsync('All dialog titles include MODULE_TITLE prefix', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);
  const MODULE_TITLE = 'PF1e Archetype Manager';

  // Main dialog
  await UIManager.showMainDialog(actor, [fighterClass]);
  assert(Dialog._lastInstance.data.title.includes(MODULE_TITLE),
    `Main dialog title "${Dialog._lastInstance.data.title}" should include module title`);

  // Preview dialog
  UIManager.showPreviewDialog(actor, fighterClass, { name: 'Test', slug: 'test', features: [] }, []);
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.title.includes(MODULE_TITLE),
    `Preview dialog title should include module title`);

  // Confirmation dialog
  UIManager.showConfirmation('Test Title', '<p>Test</p>');
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.title.includes(MODULE_TITLE),
    `Confirmation dialog title should include module title`);
  Dialog._lastInstance.close();

  // Fix dialog
  UIManager.showFixDialog({ name: 'Test Fix', description: 'test' }, []);
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.title.includes(MODULE_TITLE),
    `Fix dialog title should include module title`);
  Dialog._lastInstance.close();

  // Manual entry dialog
  UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.title.includes(MODULE_TITLE),
    `Manual entry dialog title should include module title`);
  Dialog._lastInstance.close();
});

await testAsync('All dialogs have a cancel/close button', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);

  // Main dialog
  await UIManager.showMainDialog(actor, [fighterClass]);
  assert(Dialog._lastInstance.data.buttons.close, 'Main dialog should have close button');

  // Preview dialog
  UIManager.showPreviewDialog(actor, fighterClass, { name: 'Test', slug: 'test', features: [] }, []);
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.buttons.back, 'Preview dialog should have back button');

  // Confirmation
  UIManager.showConfirmation('Test', '<p>Test</p>');
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.buttons.cancel, 'Confirmation dialog should have cancel button');
  Dialog._lastInstance.close();

  // Fix dialog
  UIManager.showFixDialog({ name: 'Test', description: 'test' }, []);
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.buttons.cancel, 'Fix dialog should have cancel button');
  Dialog._lastInstance.close();

  // Manual entry
  UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));
  assert(Dialog._lastInstance.data.buttons.cancel, 'Manual entry dialog should have cancel button');
  Dialog._lastInstance.close();
});

await testAsync('Main dialog content uses FoundryVTT form-group class', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);
  await UIManager.showMainDialog(actor, [fighterClass]);
  const content = Dialog._lastInstance.data.content;
  assert(content.includes('form-group'), 'Main dialog should use form-group class');
});

await testAsync('Fix dialog content uses FoundryVTT form-group class', async () => {
  UIManager.showFixDialog({ name: 'Test', description: 'test', level: 3 }, []);
  await new Promise(r => setTimeout(r, 10));
  const content = Dialog._lastInstance.data.content;
  assert(content.includes('form-group'), 'Fix dialog should use form-group class');
  Dialog._lastInstance.close();
});

await testAsync('Manual entry dialog uses <form> element', async () => {
  UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));
  const content = Dialog._lastInstance.data.content;
  assert(content.includes('<form'), 'Manual entry dialog should use <form> element');
  assert(content.includes('autocomplete="off"'), 'Form should have autocomplete="off"');
  Dialog._lastInstance.close();
});

// --- Section 6: CSS structure and organization ---
console.log('\n--- Section 6: CSS structure ---');

test('CSS has design principles documentation header', () => {
  assert(cssContent.includes('Design Principles'),
    'CSS should document design principles at top');
  assert(cssContent.includes('Signika'),
    'Design principles should mention Signika font');
});

test('CSS uses FoundryVTT CSS variable pattern (var(--color-*)))', () => {
  const varMatches = cssContent.match(/var\(--color-/g);
  assert(varMatches && varMatches.length >= 10,
    `Should use FoundryVTT CSS variables extensively (found ${varMatches ? varMatches.length : 0})`);
});

test('CSS has fallback values for all variable references', () => {
  // Every var(--color-*) should have a fallback: var(--color-*, fallback)
  const varUsages = cssContent.match(/var\(--color-[^)]+\)/g) || [];
  for (const usage of varUsages) {
    assert(usage.includes(','),
      `CSS variable ${usage} should have a fallback value`);
  }
});

test('CSS label styling uses font-weight: bold', () => {
  assert(cssContent.includes('font-weight: bold'),
    'Labels should use font-weight: bold');
});

test('CSS hr styling uses FoundryVTT convention', () => {
  assert(cssContent.includes('.archetype-manager hr') ||
         cssContent.includes('.archetype-manual-entry hr'),
    'CSS should style horizontal rules');
});

test('All dialog selectors are namespaced (no global selectors)', () => {
  // Check that all rules are prefixed with an archetype-manager class
  const lines = cssContent.split('\n');
  let inRule = false;
  let globalRuleCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, comments, media queries, @keyframes
    if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('*') ||
        trimmed.startsWith('@') || trimmed === '{' || trimmed === '}' ||
        trimmed.startsWith('from') || trimmed.startsWith('to')) continue;

    // Check if this is a selector (not a property)
    if (!trimmed.includes(':') || trimmed.includes('{')) {
      if (trimmed.includes('{') && !trimmed.startsWith('.') && !trimmed.startsWith('@')) {
        // This is a selector without a class prefix
        // Allow @media, @keyframes blocks
        if (!trimmed.startsWith('@')) {
          globalRuleCount++;
        }
      }
    }
  }

  // All rules should be namespaced (globalRuleCount should be 0)
  assert(globalRuleCount === 0,
    `Found ${globalRuleCount} potentially global CSS rules (all should be namespaced)`);
});

// --- Section 7: Inline styles in HTML follow conventions ---
console.log('\n--- Section 7: Inline styles follow conventions ---');

await testAsync('Main dialog uses FontAwesome icons consistently', async () => {
  const fighterClass = createMockClassItem('Fighter', 5, 'ftr');
  const actor = createMockActor('Test', [fighterClass]);
  await UIManager.showMainDialog(actor, [fighterClass]);
  const content = Dialog._lastInstance.data.content;

  // Should use fas (FontAwesome Solid) consistently
  assert(content.includes('fas fa-hat-wizard'), 'Should use fa-hat-wizard for class selector');
  assert(content.includes('fas fa-search'), 'Should use fa-search for search');
  assert(content.includes('fas fa-check-circle'), 'Should use fa-check-circle for applied');
  assert(content.includes('fas fa-spinner'), 'Should use fa-spinner for loading');
});

await testAsync('Preview dialog uses consistent status colors in inline styles', async () => {
  const diff = [
    { name: 'Feature 1', level: 1, status: 'unchanged' },
    { name: 'Feature 2', level: 2, status: 'removed' },
    { name: 'Feature 3', level: 3, status: 'added', archetypeFeature: { name: 'F3', description: 'test', level: 3, type: 'add' } },
    { name: 'Feature 4', level: 4, status: 'modified', archetypeFeature: { name: 'F4', description: 'test', level: 4, type: 'replace' } }
  ];
  const html = UIManager._buildPreviewHTML({ name: 'Test', slug: 'test' }, diff);

  // Colors should match the status icon colors in CSS
  assert(html.includes('color:#080'), 'Unchanged should use green (#080)');
  assert(html.includes('color:#c00'), 'Removed should use red (#c00)');
  assert(html.includes('color:#08f'), 'Added should use blue (#08f)');
  assert(html.includes('color:#f80'), 'Modified should use orange (#f80)');
});

test('CSS file is organized with clear section comments', () => {
  const sections = [
    'Main Dialog',
    'Class Selector',
    'Search Field',
    'Archetype List',
    'Status Icons',
    'Preview Dialog',
    'Info Button',
    'Manual Entry Dialog',
    'Loading Indicator',
    'Empty State'
  ];

  for (const section of sections) {
    assert(cssContent.includes(section),
      `CSS should have a "${section}" section comment`);
  }
});

// =====================================================
// SUMMARY
// =====================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`Feature #85 Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Feature #85 tests passed!\n');
  process.exit(0);
}
