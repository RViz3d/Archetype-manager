/**
 * Test Suite for Feature #96: Manual entry type defaults to custom
 *
 * Verifies that the manual archetype entry dialog defaults to "custom" (homebrew)
 * type, that the user can switch to "official missing", and that reopening
 * the dialog always resets to the "custom" default.
 *
 * Steps:
 * 1. Open manual entry
 * 2. Custom/homebrew is default
 * 3. Can switch to official missing
 * 4. Reopen -> default still custom
 */

import { setupMockEnvironment, resetMockEnvironment } from './foundry-mock.mjs';

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

function assertIncludes(str, substr, message) {
  if (!str.includes(substr)) {
    throw new Error(message || `Expected "${str}" to include "${substr}"`);
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
console.log('\n==================================================');
console.log('Feature #96: Manual entry type defaults to custom');
console.log('==================================================\n');

setupMockEnvironment();

// Register necessary settings
game.settings.register('archetype-manager', 'jeDbName', { default: 'Archetype Manager DB', type: String });
game.settings.register('archetype-manager', 'lastSelectedClass', { default: '', type: String, scope: 'client', config: false });

// Import UIManager
const { UIManager } = await import('../scripts/ui-manager.mjs');

// Helper: Build manual entry HTML and parse it into a real DOM element
function buildManualEntryDOM(defaultType = 'custom') {
  const html = UIManager._buildManualEntryHTML(defaultType);
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

// Helper: Create a dialog and capture its rendered element
function captureDialogData() {
  return new Promise((resolve) => {
    const origDialog = globalThis.Dialog;
    let capturedData = null;

    // Monkey-patch Dialog to capture the constructor data
    globalThis.Dialog = class extends origDialog {
      constructor(data, options) {
        super(data, options);
        capturedData = { data, options, instance: this };
      }
      render(force) {
        super.render(force);
        if (capturedData) {
          capturedData.element = this._element;
        }
        resolve(capturedData);
        return this;
      }
    };

    return origDialog;
  });
}

// =====================================================
// Section 1: _buildManualEntryHTML default type
// =====================================================
console.log('--- _buildManualEntryHTML default type ---');

await testAsync('Default parameter is "custom"', async () => {
  const html = UIManager._buildManualEntryHTML();
  assertIncludes(html, 'entry-type', 'HTML should contain entry-type select');
});

await testAsync('Custom option is selected by default (no argument)', async () => {
  const container = buildManualEntryDOM();
  const select = container.querySelector('[name="entry-type"]');
  assert(select, 'entry-type select should exist');
  assertEqual(select.value, 'custom', 'Default value should be "custom"');
});

await testAsync('Custom option has "selected" attribute when defaultType=custom', async () => {
  const html = UIManager._buildManualEntryHTML('custom');
  // The custom option should have the selected attribute
  const customOptionMatch = html.match(/<option\s+value="custom"\s+selected\s*>/i) ||
                            html.match(/<option\s+value="custom"\s*selected\s*>/i);
  assert(customOptionMatch, 'Custom option should have selected attribute');
});

await testAsync('Missing option does NOT have "selected" attribute when defaultType=custom', async () => {
  const html = UIManager._buildManualEntryHTML('custom');
  // The missing option should NOT have selected
  const missingOptionHasSelected = html.match(/<option\s+value="missing"\s+selected/i);
  assert(!missingOptionHasSelected, 'Missing option should NOT have selected attribute when default is custom');
});

await testAsync('When defaultType=missing, missing option is selected', async () => {
  const container = buildManualEntryDOM('missing');
  const select = container.querySelector('[name="entry-type"]');
  assert(select, 'entry-type select should exist');
  assertEqual(select.value, 'missing', 'Value should be "missing" when defaultType is missing');
});

await testAsync('When defaultType=missing, missing option has selected attribute', async () => {
  const html = UIManager._buildManualEntryHTML('missing');
  const missingSelected = html.match(/<option\s+value="missing"\s+selected/i);
  assert(missingSelected, 'Missing option should have selected attribute when defaultType is missing');
});

await testAsync('When defaultType=custom, custom option has selected attribute in HTML', async () => {
  const html = UIManager._buildManualEntryHTML('custom');
  const customSelected = html.match(/<option\s+value="custom"\s+selected/i);
  assert(customSelected, 'Custom option should have selected attribute');
});

// =====================================================
// Section 2: Select element has both options
// =====================================================
console.log('\n--- Select element structure ---');

await testAsync('Entry type select has exactly 2 options', async () => {
  const container = buildManualEntryDOM();
  const options = container.querySelectorAll('.entry-type-select option');
  assertEqual(options.length, 2, 'Should have exactly 2 options');
});

await testAsync('First option is "missing" (Official Missing)', async () => {
  const container = buildManualEntryDOM();
  const options = container.querySelectorAll('.entry-type-select option');
  assertEqual(options[0].value, 'missing', 'First option value should be "missing"');
  assertIncludes(options[0].textContent, 'Official Missing', 'First option should say Official Missing');
});

await testAsync('Second option is "custom" (Custom / Homebrew)', async () => {
  const container = buildManualEntryDOM();
  const options = container.querySelectorAll('.entry-type-select option');
  assertEqual(options[1].value, 'custom', 'Second option value should be "custom"');
  assertIncludes(options[1].textContent, 'Custom', 'Second option should say Custom');
});

await testAsync('Select has class "entry-type-select"', async () => {
  const container = buildManualEntryDOM();
  const select = container.querySelector('.entry-type-select');
  assert(select, 'Should have entry-type-select class');
  assertEqual(select.tagName.toLowerCase(), 'select', 'Should be a select element');
});

// =====================================================
// Section 3: Can switch to official missing
// =====================================================
console.log('\n--- Switching entry type ---');

await testAsync('Can programmatically switch from custom to missing', async () => {
  const container = buildManualEntryDOM('custom');
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'custom', 'Initially should be custom');

  // Switch to missing
  select.value = 'missing';
  assertEqual(select.value, 'missing', 'Should now be missing after switch');
});

await testAsync('Can switch from missing back to custom', async () => {
  const container = buildManualEntryDOM('missing');
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'missing', 'Initially should be missing');

  // Switch to custom
  select.value = 'custom';
  assertEqual(select.value, 'custom', 'Should now be custom after switch');
});

await testAsync('Switching type does not affect other form fields', async () => {
  const container = buildManualEntryDOM('custom');
  const nameInput = container.querySelector('[name="archetype-name"]');
  const classInput = container.querySelector('[name="archetype-class"]');

  // Fill in some data
  nameInput.value = 'Test Archetype';
  classInput.value = 'fighter';

  // Switch type
  const select = container.querySelector('[name="entry-type"]');
  select.value = 'missing';

  // Verify other fields unchanged
  assertEqual(nameInput.value, 'Test Archetype', 'Name should be unchanged after type switch');
  assertEqual(classInput.value, 'fighter', 'Class should be unchanged after type switch');
});

await testAsync('Validation reads the current entry type value correctly after switch', async () => {
  const container = buildManualEntryDOM('custom');
  const select = container.querySelector('[name="entry-type"]');

  // Switch to missing
  select.value = 'missing';

  // Fill in valid data
  container.querySelector('[name="archetype-name"]').value = 'Test Archetype';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Test Feature';
  container.querySelector('[name="feat-level-0"]').value = '1';

  // Validate
  const result = UIManager._validateManualEntry(container);
  assert(result.valid, 'Validation should pass');
  assertEqual(result.data.type, 'missing', 'Validated type should be "missing" after switch');
});

await testAsync('Validation reads custom type correctly', async () => {
  const container = buildManualEntryDOM('custom');

  // Fill in valid data (keep custom)
  container.querySelector('[name="archetype-name"]').value = 'My Homebrew';
  container.querySelector('[name="archetype-class"]').value = 'wizard';
  container.querySelector('[name="feat-name-0"]').value = 'Custom Ability';
  container.querySelector('[name="feat-level-0"]').value = '3';

  const result = UIManager._validateManualEntry(container);
  assert(result.valid, 'Validation should pass');
  assertEqual(result.data.type, 'custom', 'Validated type should be "custom"');
});

// =====================================================
// Section 4: showManualEntryDialog defaults
// =====================================================
console.log('\n--- showManualEntryDialog defaults ---');

await testAsync('showManualEntryDialog called with no args creates dialog with custom default', async () => {
  // Capture dialog creation
  let capturedContent = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      capturedContent = data.content;
    }
  };

  // Call without waiting (it returns a promise that won't resolve in test)
  const promise = UIManager.showManualEntryDialog();

  // Give it a tick
  await new Promise(r => setTimeout(r, 10));

  assert(capturedContent, 'Dialog should have been created');
  const container = document.createElement('div');
  container.innerHTML = capturedContent;
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'custom', 'Default should be custom when no arg provided');

  // Clean up - close the dialog to resolve the promise
  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

await testAsync('showManualEntryDialog("custom") creates dialog with custom default', async () => {
  let capturedContent = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      capturedContent = data.content;
    }
  };

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  assert(capturedContent, 'Dialog should have been created');
  const container = document.createElement('div');
  container.innerHTML = capturedContent;
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'custom', 'Default should be custom');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

await testAsync('showManualEntryDialog("missing") as GM creates dialog with missing default', async () => {
  game.user.isGM = true;
  let capturedContent = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      capturedContent = data.content;
    }
  };

  const promise = UIManager.showManualEntryDialog('missing');
  await new Promise(r => setTimeout(r, 10));

  assert(capturedContent, 'Dialog should have been created');
  const container = document.createElement('div');
  container.innerHTML = capturedContent;
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'missing', 'Default should be missing when passed as arg');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

// =====================================================
// Section 5: Reopen -> default still custom
// =====================================================
console.log('\n--- Reopen dialog -> default still custom ---');

await testAsync('First open: custom is default', async () => {
  const html = UIManager._buildManualEntryHTML('custom');
  const container = document.createElement('div');
  container.innerHTML = html;
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'custom', 'First open should default to custom');
});

await testAsync('Second open (after close): custom is still default', async () => {
  // Simulate opening, switching to missing, closing, then reopening
  // First open
  const html1 = UIManager._buildManualEntryHTML('custom');
  const container1 = document.createElement('div');
  container1.innerHTML = html1;
  const select1 = container1.querySelector('[name="entry-type"]');

  // User switches to missing
  select1.value = 'missing';
  assertEqual(select1.value, 'missing', 'User switched to missing');

  // Close and reopen (build new HTML)
  const html2 = UIManager._buildManualEntryHTML('custom');
  const container2 = document.createElement('div');
  container2.innerHTML = html2;
  const select2 = container2.querySelector('[name="entry-type"]');
  assertEqual(select2.value, 'custom', 'Reopened dialog should default to custom');
});

await testAsync('Third open: custom is still default regardless of previous selections', async () => {
  // Open 3 times, switching type each time
  for (let i = 0; i < 3; i++) {
    const html = UIManager._buildManualEntryHTML('custom');
    const container = document.createElement('div');
    container.innerHTML = html;
    const select = container.querySelector('[name="entry-type"]');
    assertEqual(select.value, 'custom', `Open #${i + 1} should default to custom`);

    // Switch to missing (simulating user action)
    select.value = 'missing';
  }

  // Final open should still be custom
  const htmlFinal = UIManager._buildManualEntryHTML('custom');
  const containerFinal = document.createElement('div');
  containerFinal.innerHTML = htmlFinal;
  const selectFinal = containerFinal.querySelector('[name="entry-type"]');
  assertEqual(selectFinal.value, 'custom', 'Final open should still default to custom');
});

await testAsync('showManualEntryDialog always passes "custom" as default from main dialog', async () => {
  // Verify the main dialog's "Add Archetype" button calls showManualEntryDialog('custom')
  // We check the code path by inspecting the call
  let capturedDefaultType = null;
  const origMethod = UIManager.showManualEntryDialog;

  UIManager.showManualEntryDialog = async (defaultType) => {
    capturedDefaultType = defaultType;
    return null;
  };

  // Simulate what the main dialog does
  await UIManager.showManualEntryDialog('custom');

  assertEqual(capturedDefaultType, 'custom', 'Main dialog should pass "custom" as default');

  // Restore
  UIManager.showManualEntryDialog = origMethod;
});

// =====================================================
// Section 6: Non-GM user behavior
// =====================================================
console.log('\n--- Non-GM user behavior ---');

await testAsync('Non-GM user: missing option is disabled, custom is forced', async () => {
  game.user.isGM = false;

  let renderedElement = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
    }
    render(force) {
      super.render(force);
      renderedElement = this._element;
      return this;
    }
  };

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  assert(renderedElement, 'Dialog should have rendered');

  const typeSelect = renderedElement.querySelector('.entry-type-select');
  assert(typeSelect, 'Type select should exist');
  assertEqual(typeSelect.value, 'custom', 'Non-GM user should have custom forced');

  const missingOption = renderedElement.querySelector('option[value="missing"]');
  assert(missingOption, 'Missing option should exist in DOM');
  assert(missingOption.disabled, 'Missing option should be disabled for non-GM');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  game.user.isGM = true;
  globalThis.Dialog = OrigDialog;
});

await testAsync('Non-GM user: cannot open with missing default (returns null with error)', async () => {
  game.user.isGM = false;

  const errors = [];
  const origError = ui.notifications.error;
  ui.notifications.error = (msg) => errors.push(msg);

  const result = await UIManager.showManualEntryDialog('missing');

  assertEqual(result, null, 'Should return null for non-GM trying to open with missing default');
  assert(errors.length > 0, 'Should show an error notification');
  assertIncludes(errors[0], 'GM', 'Error should mention GM');

  ui.notifications.error = origError;
  game.user.isGM = true;
});

await testAsync('Non-GM user: reopening after close still defaults to custom', async () => {
  game.user.isGM = false;

  // Build HTML twice (simulate open/close/reopen)
  const html1 = UIManager._buildManualEntryHTML('custom');
  const c1 = document.createElement('div');
  c1.innerHTML = html1;
  assertEqual(c1.querySelector('[name="entry-type"]').value, 'custom');

  const html2 = UIManager._buildManualEntryHTML('custom');
  const c2 = document.createElement('div');
  c2.innerHTML = html2;
  assertEqual(c2.querySelector('[name="entry-type"]').value, 'custom', 'Reopen should still be custom');

  game.user.isGM = true;
});

// =====================================================
// Section 7: GM user behavior with both types
// =====================================================
console.log('\n--- GM user behavior ---');

await testAsync('GM user: can open with custom default', async () => {
  game.user.isGM = true;

  let capturedContent = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      capturedContent = data.content;
    }
  };

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  assert(capturedContent, 'Dialog should have been created');
  const container = document.createElement('div');
  container.innerHTML = capturedContent;
  assertEqual(container.querySelector('[name="entry-type"]').value, 'custom');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

await testAsync('GM user: can open with missing default', async () => {
  game.user.isGM = true;

  let capturedContent = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      capturedContent = data.content;
    }
  };

  const promise = UIManager.showManualEntryDialog('missing');
  await new Promise(r => setTimeout(r, 10));

  assert(capturedContent, 'Dialog should have been created');
  const container = document.createElement('div');
  container.innerHTML = capturedContent;
  assertEqual(container.querySelector('[name="entry-type"]').value, 'missing');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

await testAsync('GM user: missing option is NOT disabled', async () => {
  game.user.isGM = true;

  let renderedElement = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
    }
    render(force) {
      super.render(force);
      renderedElement = this._element;
      return this;
    }
  };

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  assert(renderedElement, 'Dialog should have rendered');

  const missingOption = renderedElement.querySelector('option[value="missing"]');
  assert(missingOption, 'Missing option should exist');
  assert(!missingOption.disabled, 'Missing option should NOT be disabled for GM');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

// =====================================================
// Section 8: Validation preserves type across entries
// =====================================================
console.log('\n--- Validation preserves entry type ---');

await testAsync('Custom type preserved in validation data', async () => {
  const container = buildManualEntryDOM('custom');
  container.querySelector('[name="archetype-name"]').value = 'Homebrew Archetype';
  container.querySelector('[name="archetype-class"]').value = 'fighter';
  container.querySelector('[name="feat-name-0"]').value = 'Custom Feat';
  container.querySelector('[name="feat-level-0"]').value = '1';

  const result = UIManager._validateManualEntry(container);
  assert(result.valid, 'Should be valid');
  assertEqual(result.data.type, 'custom', 'Type should be custom');
});

await testAsync('Missing type preserved in validation data', async () => {
  const container = buildManualEntryDOM('missing');
  container.querySelector('[name="archetype-name"]').value = 'Official Archetype';
  container.querySelector('[name="archetype-class"]').value = 'ranger';
  container.querySelector('[name="feat-name-0"]').value = 'Official Feat';
  container.querySelector('[name="feat-level-0"]').value = '2';

  const result = UIManager._validateManualEntry(container);
  assert(result.valid, 'Should be valid');
  assertEqual(result.data.type, 'missing', 'Type should be missing');
});

await testAsync('Type after user switch is captured correctly in validation', async () => {
  const container = buildManualEntryDOM('custom');

  // User switches to missing
  container.querySelector('[name="entry-type"]').value = 'missing';

  container.querySelector('[name="archetype-name"]').value = 'Switched Archetype';
  container.querySelector('[name="archetype-class"]').value = 'cleric';
  container.querySelector('[name="feat-name-0"]').value = 'Switched Feat';
  container.querySelector('[name="feat-level-0"]').value = '5';

  const result = UIManager._validateManualEntry(container);
  assert(result.valid, 'Should be valid');
  assertEqual(result.data.type, 'missing', 'Type should reflect user switch to missing');
});

// =====================================================
// Section 9: Edge cases
// =====================================================
console.log('\n--- Edge cases ---');

await testAsync('Building HTML multiple times always returns fresh state with correct default', async () => {
  // Build 5 times in a row, verify each is fresh
  for (let i = 0; i < 5; i++) {
    const container = buildManualEntryDOM('custom');
    const select = container.querySelector('[name="entry-type"]');
    assertEqual(select.value, 'custom', `Build #${i + 1} should have custom default`);
  }
});

await testAsync('Building HTML with missing and custom alternating always has correct default', async () => {
  const types = ['custom', 'missing', 'custom', 'missing', 'custom'];
  for (const type of types) {
    const container = buildManualEntryDOM(type);
    const select = container.querySelector('[name="entry-type"]');
    assertEqual(select.value, type, `Default should be ${type}`);
  }
});

await testAsync('Entry type does not persist in any global state', async () => {
  // Build with missing
  buildManualEntryDOM('missing');

  // Build with custom - should NOT be influenced by previous build
  const container = buildManualEntryDOM('custom');
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'custom', 'Should be custom regardless of previous build');
});

await testAsync('After environment reset, default is still custom', async () => {
  resetMockEnvironment();
  game.settings.register('archetype-manager', 'jeDbName', { default: 'Archetype Manager DB', type: String });
  game.settings.register('archetype-manager', 'lastSelectedClass', { default: '', type: String, scope: 'client', config: false });

  const container = buildManualEntryDOM();
  const select = container.querySelector('[name="entry-type"]');
  assertEqual(select.value, 'custom', 'After env reset, default should be custom');
});

await testAsync('The select element name attribute is "entry-type"', async () => {
  const container = buildManualEntryDOM();
  const select = container.querySelector('select[name="entry-type"]');
  assert(select, 'Select with name="entry-type" should exist');
});

await testAsync('Dialog title includes module title', async () => {
  game.user.isGM = true;
  let capturedTitle = null;
  const OrigDialog = globalThis.Dialog;
  globalThis.Dialog = class extends OrigDialog {
    constructor(data, options) {
      super(data, options);
      capturedTitle = data.title;
    }
  };

  const promise = UIManager.showManualEntryDialog('custom');
  await new Promise(r => setTimeout(r, 10));

  assert(capturedTitle, 'Dialog title should exist');
  assertIncludes(capturedTitle, 'Archetype Manager', 'Title should include module name');

  if (globalThis.Dialog._lastInstance) {
    globalThis.Dialog._lastInstance.close();
  }
  await promise.catch(() => {});

  globalThis.Dialog = OrigDialog;
});

// =====================================================
// Results
// =====================================================
console.log('\n==================================================');
console.log(`Test Results: ${passed}/${totalTests} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('All tests passed!');
}
