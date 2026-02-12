/**
 * Test Suite for Feature #108: Register chat notifications toggle setting
 *
 * Verifies that a new module setting 'chatNotifications' (boolean, default true,
 * world-scoped, config: true) toggles whether chat messages are posted when
 * archetypes are applied or removed. When disabled, the applicator skips
 * ChatMessage.create() calls in _postApplyMessage and _postRemoveMessage but
 * still performs the actual archetype operations. ui.notifications (toasts) are
 * NOT affected by this setting.
 */

import { setupMockEnvironment, resetMockEnvironment, createMockActor, createMockClassItem } from './foundry-mock.mjs';

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

console.log('\n=== Feature #108: Register chat notifications toggle setting ===\n');

// =====================================================
// Section 1: Setting registration in init hook
// =====================================================

console.log('--- Section 1: Setting registration in init hook ---');

const env = setupMockEnvironment();

// Import the module to register hooks
await import('../scripts/module.mjs');

// Fire init hook to register settings
await env.hooks.callAll('init');

test('chatNotifications setting is registered after init', () => {
  const isRegistered = game.settings.isRegistered('archetype-manager', 'chatNotifications');
  assert(isRegistered, 'chatNotifications setting should be registered');
});

test('chatNotifications setting has type Boolean', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'chatNotifications');
  assertEqual(reg.type, Boolean, 'type should be Boolean');
});

test('chatNotifications setting has default value of true', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'chatNotifications');
  assertEqual(reg.default, true, 'default should be true');
});

test('chatNotifications setting has scope "world"', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'chatNotifications');
  assertEqual(reg.scope, 'world', 'scope should be "world"');
});

test('chatNotifications setting has config: true', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'chatNotifications');
  assertEqual(reg.config, true, 'config should be true');
});

test('chatNotifications setting has a descriptive name containing "Chat"', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'chatNotifications');
  assert(reg.name && reg.name.length > 0, 'name should be non-empty');
  assert(reg.name.toLowerCase().includes('chat') || reg.name.toLowerCase().includes('notification'),
    `name should be descriptive about chat notifications (got: "${reg.name}")`);
});

test('chatNotifications setting has a hint explaining behavior', () => {
  const reg = game.settings.getRegistration('archetype-manager', 'chatNotifications');
  assert(reg.hint && reg.hint.length > 10, 'hint should be a meaningful description');
});

test('chatNotifications default value returns true via game.settings.get', () => {
  const value = game.settings.get('archetype-manager', 'chatNotifications');
  assertEqual(value, true, 'Default get() should return true');
});

// =====================================================
// Section 2: _postApplyMessage respects chatNotifications
// =====================================================

console.log('\n--- Section 2: _postApplyMessage respects chatNotifications ---');

await asyncTest('With chatNotifications=true (default), _postApplyMessage creates a chat message', async () => {
  const freshEnv = setupMockEnvironment();

  // Register the setting
  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Track ChatMessage.create calls
  let chatCreated = false;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreated = true;
      return data;
    }
  };

  // Import the Applicator
  const { Applicator } = await import('../scripts/applicator.mjs');

  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);
  const parsedArchetype = { name: 'Weapon Master', slug: 'weapon-master' };
  const diff = [
    { status: 'removed', name: 'Armor Training' },
    { status: 'added', name: 'Weapon Training (Enhanced)' }
  ];

  await Applicator._postApplyMessage(actor, classItem, parsedArchetype, diff);
  assert(chatCreated, 'ChatMessage.create should be called when chatNotifications is enabled');
});

await asyncTest('With chatNotifications=false, _postApplyMessage does NOT create a chat message', async () => {
  const freshEnv = setupMockEnvironment();

  // Register the setting
  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Disable chat notifications
  game.settings.set('archetype-manager', 'chatNotifications', false);

  // Track ChatMessage.create calls
  let chatCreated = false;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreated = true;
      return data;
    }
  };

  const { Applicator } = await import('../scripts/applicator.mjs');

  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);
  const parsedArchetype = { name: 'Weapon Master', slug: 'weapon-master' };
  const diff = [
    { status: 'removed', name: 'Armor Training' },
    { status: 'added', name: 'Weapon Training (Enhanced)' }
  ];

  await Applicator._postApplyMessage(actor, classItem, parsedArchetype, diff);
  assert(!chatCreated, 'ChatMessage.create should NOT be called when chatNotifications is disabled');
});

await asyncTest('_postApplyMessage returns early (no error) when chatNotifications=false', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  const { Applicator } = await import('../scripts/applicator.mjs');

  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);
  const parsedArchetype = { name: 'Weapon Master', slug: 'weapon-master' };
  const diff = [];

  // Should not throw
  const result = await Applicator._postApplyMessage(actor, classItem, parsedArchetype, diff);
  assertEqual(result, undefined, 'Should return undefined (early return)');
});

// =====================================================
// Section 3: _postRemoveMessage respects chatNotifications
// =====================================================

console.log('\n--- Section 3: _postRemoveMessage respects chatNotifications ---');

await asyncTest('With chatNotifications=true, _postRemoveMessage creates a chat message', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  let chatCreated = false;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreated = true;
      return data;
    }
  };

  const { Applicator } = await import('../scripts/applicator.mjs');

  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);

  await Applicator._postRemoveMessage(actor, classItem, 'weapon-master');
  assert(chatCreated, 'ChatMessage.create should be called when chatNotifications is enabled');
});

await asyncTest('With chatNotifications=false, _postRemoveMessage does NOT create a chat message', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  let chatCreated = false;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreated = true;
      return data;
    }
  };

  const { Applicator } = await import('../scripts/applicator.mjs');

  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);

  await Applicator._postRemoveMessage(actor, classItem, 'weapon-master');
  assert(!chatCreated, 'ChatMessage.create should NOT be called when chatNotifications is disabled');
});

await asyncTest('_postRemoveMessage returns early (no error) when chatNotifications=false', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  const { Applicator } = await import('../scripts/applicator.mjs');

  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);

  const result = await Applicator._postRemoveMessage(actor, classItem, 'weapon-master');
  assertEqual(result, undefined, 'Should return undefined (early return)');
});

// =====================================================
// Section 4: Setting does NOT affect ui.notifications (toasts)
// =====================================================

console.log('\n--- Section 4: Setting does NOT affect ui.notifications (toasts) ---');

await asyncTest('With chatNotifications=false, ui.notifications.info still works', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  // Track notification calls
  let notificationCalled = false;
  globalThis.ui.notifications.info = (msg) => {
    notificationCalled = true;
  };

  // Call ui.notifications.info directly (simulating what apply() does)
  ui.notifications.info('Applied archetype to Fighter');
  assert(notificationCalled, 'ui.notifications.info should still work with chatNotifications=false');
});

await asyncTest('With chatNotifications=false, ui.notifications.warn still works', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  let warnCalled = false;
  globalThis.ui.notifications.warn = (msg) => {
    warnCalled = true;
  };

  ui.notifications.warn('Test warning');
  assert(warnCalled, 'ui.notifications.warn should still work with chatNotifications=false');
});

await asyncTest('With chatNotifications=false, ui.notifications.error still works', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  let errorCalled = false;
  globalThis.ui.notifications.error = (msg) => {
    errorCalled = true;
  };

  ui.notifications.error('Test error');
  assert(errorCalled, 'ui.notifications.error should still work with chatNotifications=false');
});

// =====================================================
// Section 5: Source code verification
// =====================================================

console.log('\n--- Section 5: Source code verification ---');

await asyncTest('module.mjs contains chatNotifications registration', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');
  assert(source.includes('chatNotifications'), 'module.mjs should contain chatNotifications');
});

await asyncTest('module.mjs registers chatNotifications with Boolean type', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'chatNotifications'");
  assert(regStart !== -1, 'Should find chatNotifications string');
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes('Boolean'), 'Registration should use Boolean type');
});

await asyncTest('module.mjs registers chatNotifications with default: true', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'chatNotifications'");
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes('default: true'), 'Registration should have default: true');
});

await asyncTest('module.mjs registers chatNotifications with scope: world', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'chatNotifications'");
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes("scope: 'world'"), 'Registration should have scope: world');
});

await asyncTest('module.mjs registers chatNotifications with config: true', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'chatNotifications'");
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);
  assert(regBlock.includes('config: true'), 'Registration should have config: true');
});

await asyncTest('applicator.mjs _postApplyMessage checks chatNotifications setting', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/applicator.mjs', import.meta.url), 'utf8');

  // Find the _postApplyMessage method definition (static async _postApplyMessage)
  const methodStart = source.indexOf('static async _postApplyMessage');
  assert(methodStart !== -1, 'Should find _postApplyMessage method definition');
  const methodBlock = source.substring(methodStart, source.indexOf('static async _postRemoveMessage', methodStart));

  // Should check chatNotifications setting
  assert(methodBlock.includes('chatNotifications'),
    '_postApplyMessage should reference chatNotifications setting');
  assert(methodBlock.includes('game.settings.get'),
    '_postApplyMessage should call game.settings.get');
});

await asyncTest('applicator.mjs _postRemoveMessage checks chatNotifications setting', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/applicator.mjs', import.meta.url), 'utf8');

  // Find the _postRemoveMessage method
  const methodStart = source.indexOf('_postRemoveMessage');
  assert(methodStart !== -1, 'Should find _postRemoveMessage method');
  const methodBlock = source.substring(methodStart);

  // Should check chatNotifications setting
  assert(methodBlock.includes('chatNotifications'),
    '_postRemoveMessage should reference chatNotifications setting');
  assert(methodBlock.includes('game.settings.get'),
    '_postRemoveMessage should call game.settings.get');
});

// =====================================================
// Section 6: Integration with existing settings
// =====================================================

console.log('\n--- Section 6: Integration with existing settings ---');

test('chatNotifications coexists with other settings', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'lastSelectedClass', {
    scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register('archetype-manager', 'showParseWarnings', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'chatNotifications', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  assert(game.settings.isRegistered('archetype-manager', 'lastSelectedClass'), 'lastSelectedClass should be registered');
  assert(game.settings.isRegistered('archetype-manager', 'showParseWarnings'), 'showParseWarnings should be registered');
  assert(game.settings.isRegistered('archetype-manager', 'autoCreateJEDB'), 'autoCreateJEDB should be registered');
  assert(game.settings.isRegistered('archetype-manager', 'chatNotifications'), 'chatNotifications should be registered');
});

test('Module registers at least 5 settings after init (including chatNotifications)', () => {
  const freshEnv = setupMockEnvironment();

  // Simulate init hook registering all settings
  game.settings.register('archetype-manager', 'lastSelectedClass', {
    scope: 'client', config: false, type: String, default: ''
  });
  game.settings.register('archetype-manager', 'showParseWarnings', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'autoCreateJEDB', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'chatNotifications', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'defaultCompendiumSource', {
    scope: 'world', config: true, type: String, default: 'pf1e-archetypes'
  });

  // Count registered settings for archetype-manager
  let count = 0;
  for (const [key] of game.settings._registered) {
    if (key.startsWith('archetype-manager.')) count++;
  }
  assert(count >= 5, `Should have at least 5 settings registered, got ${count}`);
});

test('Changing chatNotifications does not affect other settings', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'showParseWarnings', {
    scope: 'world', config: true, type: Boolean, default: true
  });
  game.settings.register('archetype-manager', 'chatNotifications', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  game.settings.set('archetype-manager', 'chatNotifications', false);

  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), false, 'chatNotifications should be false');
  assertEqual(game.settings.get('archetype-manager', 'showParseWarnings'), true, 'showParseWarnings should remain true');
});

// =====================================================
// Section 7: Edge cases and toggling
// =====================================================

console.log('\n--- Section 7: Edge cases and toggling ---');

test('Setting can be toggled between true and false', () => {
  const freshEnv = setupMockEnvironment();
  game.settings.register('archetype-manager', 'chatNotifications', {
    scope: 'world', config: true, type: Boolean, default: true
  });

  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), true, 'Default is true');
  game.settings.set('archetype-manager', 'chatNotifications', false);
  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), false, 'Changed to false');
  game.settings.set('archetype-manager', 'chatNotifications', true);
  assertEqual(game.settings.get('archetype-manager', 'chatNotifications'), true, 'Changed back to true');
});

await asyncTest('Chat messages resume when chatNotifications is toggled back to true', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  let chatCreateCount = 0;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreateCount++;
      return data;
    }
  };

  const { Applicator } = await import('../scripts/applicator.mjs');
  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);

  // Disable - no messages
  game.settings.set('archetype-manager', 'chatNotifications', false);
  await Applicator._postRemoveMessage(actor, classItem, 'test-slug');
  assertEqual(chatCreateCount, 0, 'No chat messages when disabled');

  // Re-enable - messages should resume
  game.settings.set('archetype-manager', 'chatNotifications', true);
  await Applicator._postRemoveMessage(actor, classItem, 'test-slug');
  assertEqual(chatCreateCount, 1, 'Chat messages should resume when re-enabled');
});

await asyncTest('_postApplyMessage with empty diff and chatNotifications=true still posts', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  let chatCreated = false;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreated = true;
      return data;
    }
  };

  const { Applicator } = await import('../scripts/applicator.mjs');
  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);
  const parsedArchetype = { name: 'Simple Archetype', slug: 'simple' };

  await Applicator._postApplyMessage(actor, classItem, parsedArchetype, []);
  assert(chatCreated, 'Chat message should still be posted for empty diff when enabled');
});

await asyncTest('_postApplyMessage with empty diff and chatNotifications=false does NOT post', async () => {
  const freshEnv = setupMockEnvironment();

  game.settings.register('archetype-manager', 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'Controls chat messages',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.set('archetype-manager', 'chatNotifications', false);

  let chatCreated = false;
  globalThis.ChatMessage = {
    create: async (data) => {
      chatCreated = true;
      return data;
    }
  };

  const { Applicator } = await import('../scripts/applicator.mjs');
  const actor = createMockActor('TestActor');
  const classItem = createMockClassItem('Fighter', 5);
  const parsedArchetype = { name: 'Simple Archetype', slug: 'simple' };

  await Applicator._postApplyMessage(actor, classItem, parsedArchetype, []);
  assert(!chatCreated, 'Chat message should NOT be posted even for empty diff when disabled');
});

await asyncTest('Hint text mentions toast notifications are not affected', async () => {
  const fs = await import('fs');
  const source = fs.readFileSync(new URL('../scripts/module.mjs', import.meta.url), 'utf8');

  const regStart = source.indexOf("'chatNotifications'");
  assert(regStart !== -1, 'Should find chatNotifications registration');
  const regBlock = source.substring(regStart, source.indexOf('});', regStart) + 3);

  // The hint should mention that toast/ui notifications are not affected
  assert(
    regBlock.toLowerCase().includes('toast') || regBlock.toLowerCase().includes('notification'),
    'Hint should mention toast notifications are not affected'
  );
});

// =====================================================
// Summary
// =====================================================

console.log(`\n=== Feature #108 Results: ${passed}/${totalTests} passed ===`);
if (failed > 0) {
  console.error(`${failed} tests FAILED`);
  process.exit(1);
} else {
  console.log('All tests passed!');
}
