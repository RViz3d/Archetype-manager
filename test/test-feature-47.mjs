/**
 * Test Suite for Feature #47: Chat message posted on removal
 *
 * Verifies that Applicator.remove() posts a chat message confirming removal:
 * 1. Remove applied archetype
 * 2. Verify chat message created
 * 3. Includes actor, class, archetype removed
 * 4. Confirms features restored
 */

import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

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

function assertNotNull(actual, message) {
  if (actual === null || actual === undefined) {
    throw new Error(`${message || 'Expected non-null value'}: got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(str, sub, message) {
  if (!str || !str.includes(sub)) {
    throw new Error(`${message || 'String inclusion failed'}: "${str && str.substring(0, 200)}" does not include "${sub}"`);
  }
}

function assertNotIncludes(str, sub, message) {
  if (str && str.includes(sub)) {
    throw new Error(`${message || 'String exclusion failed'}: string should not include "${sub}"`);
  }
}

// Set up environment
setupMockEnvironment();

// Capture ChatMessage.create calls
let chatMessages = [];
globalThis.ChatMessage = {
  create: async (data) => {
    chatMessages.push(data);
    return data;
  }
};

// UUID resolution map
const uuidMap = {
  'Compendium.pf1.class-abilities.BonusFeat1': { name: 'Bonus Feat' },
  'Compendium.pf1.class-abilities.Bravery': { name: 'Bravery' },
  'Compendium.pf1.class-abilities.ArmorTraining1': { name: 'Armor Training 1' },
  'Compendium.pf1.class-abilities.ArmorTraining2': { name: 'Armor Training 2' },
  'Compendium.pf1.class-abilities.ArmorTraining3': { name: 'Armor Training 3' },
  'Compendium.pf1.class-abilities.ArmorTraining4': { name: 'Armor Training 4' },
  'Compendium.pf1.class-abilities.ArmorMastery': { name: 'Armor Mastery' },
  'Compendium.pf1.class-abilities.WeaponTraining1': { name: 'Weapon Training 1' },
  'Compendium.pf1.class-abilities.WeaponTraining2': { name: 'Weapon Training 2' },
  'Compendium.pf1.class-abilities.WeaponTraining3': { name: 'Weapon Training 3' },
  'Compendium.pf1.class-abilities.WeaponTraining4': { name: 'Weapon Training 4' },
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

const { Applicator } = await import('../scripts/applicator.mjs');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #47: Chat message posted on removal ===\n');

// =====================================================
// Fighter base classAssociations
// =====================================================
const fighterClassAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining2', level: 9 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining3', level: 13 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponTraining4', level: 17 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
  { uuid: 'Compendium.pf1.class-abilities.WeaponMastery', level: 20 }
];

let resolvedFighterAssociations;
await asyncTest('Resolve Fighter classAssociations', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
});

// =====================================================
// Two-Handed Fighter archetype (replaces and modifies)
// =====================================================
const twoHandedFighterParsed = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'Fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1],
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations?.[2],
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'modification',
      target: 'weapon training 1',
      description: 'Modified weapon training for two-handed weapons.',
      matchedAssociation: resolvedFighterAssociations?.[3],
      source: 'auto-parse'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'armor training 2',
      matchedAssociation: resolvedFighterAssociations?.[4],
      source: 'auto-parse'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'armor training 3',
      matchedAssociation: resolvedFighterAssociations?.[6],
      source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'armor training 4',
      matchedAssociation: resolvedFighterAssociations?.[8],
      source: 'auto-parse'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'armor mastery',
      matchedAssociation: resolvedFighterAssociations?.[10],
      source: 'auto-parse'
    }
  ]
};

// Simple archetype for additional tests
const simpleParsed = {
  name: 'Bravery Replacer',
  slug: 'bravery-replacer',
  class: 'Fighter',
  features: [
    {
      name: 'Fearless Resolve',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations?.[1],
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Create mock actor with proper item management
// =====================================================
let classItem;
let actor;

function createTestFixture(actorName) {
  classItem = createMockClassItem('Fighter', 10, 'fighter');
  classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));

  const items = [classItem];
  actor = {
    id: 'actor-47',
    name: actorName || 'Test Fighter',
    isOwner: true,
    items: {
      filter: (fn) => items.filter(fn),
      find: (fn) => items.find(fn),
      get: (id) => items.find(i => i.id === id),
      map: (fn) => items.map(fn),
      [Symbol.iterator]: () => items[Symbol.iterator]()
    },
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key] ?? null; },
    async setFlag(scope, key, value) {
      if (!this.flags[scope]) this.flags[scope] = {};
      this.flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (this.flags[scope]) delete this.flags[scope][key];
    },
    async createEmbeddedDocuments(type, data) {
      const created = data.map(d => {
        const newItem = {
          ...d,
          id: Math.random().toString(36).slice(2),
          getFlag(scope, key) { return d.flags?.[scope]?.[key] ?? null; }
        };
        items.push(newItem);
        return newItem;
      });
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (const delId of ids) {
        const idx = items.findIndex(i => i.id === delId);
        if (idx >= 0) items.splice(idx, 1);
      }
      return ids;
    }
  };
}

// =====================================================
// Step 1: Remove applied archetype
// =====================================================
console.log('--- Step 1: Remove applied archetype ---');

await asyncTest('Apply Two-Handed Fighter then remove it', async () => {
  createTestFixture('Sir Galahad');
  chatMessages = [];

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff);

  // Clear messages from the apply step so we only see removal
  chatMessages = [];

  const result = await Applicator.remove(actor, classItem, 'two-handed-fighter');
  assertEqual(result, true, 'Remove should succeed');
});

// =====================================================
// Step 2: Verify chat message
// =====================================================
console.log('\n--- Step 2: Verify chat message created ---');

test('ChatMessage.create was called on removal', () => {
  assertEqual(chatMessages.length, 1, 'Should have exactly 1 chat message from removal');
});

test('Chat message has content property', () => {
  assertNotNull(chatMessages[0], 'Message should exist');
  assertNotNull(chatMessages[0].content, 'Message should have content');
});

test('Chat message content is non-empty string', () => {
  assert(typeof chatMessages[0].content === 'string', 'Content should be a string');
  assert(chatMessages[0].content.length > 0, 'Content should not be empty');
});

test('Chat message contains HTML markup (well-structured)', () => {
  const content = chatMessages[0].content;
  assert(content.includes('<'), 'Should contain HTML tags');
  assert(content.includes('</'), 'Should have closing tags');
});

test('Chat message has module title header (h3)', () => {
  const content = chatMessages[0].content;
  assertIncludes(content, '<h3>', 'Should have h3 opening tag');
  assertIncludes(content, 'PF1e Archetype Manager', 'Should include module title');
});

// =====================================================
// Step 3: Includes actor, class, archetype removed
// =====================================================
console.log('\n--- Step 3: Includes actor, class, archetype ---');

test('Chat message includes actor name', () => {
  const content = chatMessages[0].content;
  assertIncludes(content, 'Sir Galahad', 'Should mention actor name');
});

test('Actor name is in bold', () => {
  const content = chatMessages[0].content;
  assertIncludes(content, '<strong>Sir Galahad</strong>', 'Actor name should be bold');
});

test('Chat message includes class name', () => {
  const content = chatMessages[0].content;
  assertIncludes(content, 'Fighter', 'Should mention class name');
});

test('Chat message includes archetype identifier', () => {
  const content = chatMessages[0].content;
  assertIncludes(content, 'two-handed-fighter', 'Should mention archetype slug');
});

test('Archetype identifier is emphasized/bold', () => {
  const content = chatMessages[0].content;
  assertIncludes(content, '<strong>two-handed-fighter</strong>', 'Archetype should be bold');
});

test('Chat message mentions "removed" action', () => {
  const content = chatMessages[0].content.toLowerCase();
  assertIncludes(content, 'removed', 'Should mention removal action');
});

// =====================================================
// Step 4: Confirms features restored
// =====================================================
console.log('\n--- Step 4: Confirms features restored ---');

test('Chat message confirms restoration', () => {
  const content = chatMessages[0].content.toLowerCase();
  assertIncludes(content, 'restored', 'Should confirm features restored');
});

test('Chat message mentions class features or original state', () => {
  const content = chatMessages[0].content.toLowerCase();
  // Should mention "class features" or "original state" or similar
  const hasClassFeatures = content.includes('class features');
  const hasOriginalState = content.includes('original state');
  const hasRestored = content.includes('restored');
  assert(hasClassFeatures || hasOriginalState || hasRestored,
    'Should reference class features/original state/restored');
});

// =====================================================
// Additional verification scenarios
// =====================================================
console.log('\n--- Additional scenarios ---');

await asyncTest('Chat message with different actor name', async () => {
  createTestFixture('Lady Morgana');
  chatMessages = [];

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, simpleParsed);
  await Applicator.apply(actor, classItem, simpleParsed, diff);
  chatMessages = [];

  await Applicator.remove(actor, classItem, 'bravery-replacer');

  assertEqual(chatMessages.length, 1, 'Should have 1 removal message');
  assertIncludes(chatMessages[0].content, 'Lady Morgana', 'Should mention Lady Morgana');
  assertIncludes(chatMessages[0].content, 'bravery-replacer', 'Should mention archetype');
});

await asyncTest('Chat message with different class name', async () => {
  classItem = createMockClassItem('Rogue', 8, 'rogue');
  classItem.system.links.classAssociations = [];

  const items = [classItem];
  actor = {
    id: 'actor-47-rogue',
    name: 'Sneaky Pete',
    isOwner: true,
    items: {
      filter: (fn) => items.filter(fn),
      find: (fn) => items.find(fn),
      get: (id) => items.find(i => i.id === id),
      map: (fn) => items.map(fn),
      [Symbol.iterator]: () => items[Symbol.iterator]()
    },
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key] ?? null; },
    async setFlag(scope, key, value) {
      if (!this.flags[scope]) this.flags[scope] = {};
      this.flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (this.flags[scope]) delete this.flags[scope][key];
    },
    async createEmbeddedDocuments(type, data) {
      return data.map(d => ({ ...d, id: Math.random().toString(36).slice(2), getFlag(s, k) { return d.flags?.[s]?.[k] ?? null; } }));
    },
    async deleteEmbeddedDocuments(type, ids) { return ids; }
  };

  chatMessages = [];

  // Additive archetype (no class check)
  const additiveParsed = {
    name: 'Rogue Trick',
    slug: 'rogue-trick',
    features: [{
      name: 'Shadow Step',
      level: 3,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'manual'
    }]
  };

  const diff = DiffEngine.generateDiff([], additiveParsed);
  await Applicator.apply(actor, classItem, additiveParsed, diff);
  chatMessages = [];

  await Applicator.remove(actor, classItem, 'rogue-trick');

  assertEqual(chatMessages.length, 1, 'Should have 1 removal message');
  assertIncludes(chatMessages[0].content, 'Sneaky Pete', 'Should mention Sneaky Pete');
  assertIncludes(chatMessages[0].content, 'Rogue', 'Should mention Rogue class');
  assertIncludes(chatMessages[0].content, 'rogue-trick', 'Should mention rogue-trick');
});

await asyncTest('No chat message for failed removal (non-existent slug)', async () => {
  createTestFixture('Test Hero');
  chatMessages = [];

  const result = await Applicator.remove(actor, classItem, 'nonexistent-archetype');
  assertEqual(result, false, 'Should fail');
  assertEqual(chatMessages.length, 0, 'No chat message for failed removal');
});

await asyncTest('Chat message on selective removal (from multi-archetype stack)', async () => {
  createTestFixture('Stack Hero');
  chatMessages = [];

  const archetypeA = {
    name: 'Bravery Replacer',
    slug: 'bravery-replacer',
    class: 'Fighter',
    features: [{
      name: 'Fearless Resolve',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations[1],
      source: 'auto-parse'
    }]
  };

  const archetypeB = {
    name: 'Armor Specialist',
    slug: 'armor-specialist',
    class: 'Fighter',
    features: [{
      name: 'Defensive Stance',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations[2],
      source: 'auto-parse'
    }]
  };

  const diff1 = DiffEngine.generateDiff(resolvedFighterAssociations, archetypeA);
  await Applicator.apply(actor, classItem, archetypeA, diff1);
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetypeB);
  await Applicator.apply(actor, classItem, archetypeB, diff2);

  chatMessages = [];

  // Remove A (selective, B stays)
  await Applicator.remove(actor, classItem, 'bravery-replacer');

  assertEqual(chatMessages.length, 1, 'Should have 1 removal message');
  assertIncludes(chatMessages[0].content, 'Stack Hero', 'Should mention actor');
  assertIncludes(chatMessages[0].content, 'bravery-replacer', 'Should mention removed archetype');
  assertIncludes(chatMessages[0].content, 'Fighter', 'Should mention class');

  // Clean up
  await Applicator.remove(actor, classItem, 'armor-specialist');
});

await asyncTest('Each removal gets its own chat message', async () => {
  createTestFixture('Multi Remove Hero');

  const archetypeA = {
    name: 'Bravery Replacer',
    slug: 'bravery-replacer',
    class: 'Fighter',
    features: [{
      name: 'Fearless Resolve',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      matchedAssociation: resolvedFighterAssociations[1],
      source: 'auto-parse'
    }]
  };

  const archetypeB = {
    name: 'Armor Specialist',
    slug: 'armor-specialist',
    class: 'Fighter',
    features: [{
      name: 'Defensive Stance',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      matchedAssociation: resolvedFighterAssociations[2],
      source: 'auto-parse'
    }]
  };

  const diff1 = DiffEngine.generateDiff(resolvedFighterAssociations, archetypeA);
  await Applicator.apply(actor, classItem, archetypeA, diff1);
  const diff2 = DiffEngine.generateDiff(classItem.system.links.classAssociations, archetypeB);
  await Applicator.apply(actor, classItem, archetypeB, diff2);

  chatMessages = [];

  await Applicator.remove(actor, classItem, 'bravery-replacer');
  await Applicator.remove(actor, classItem, 'armor-specialist');

  assertEqual(chatMessages.length, 2, 'Should have 2 removal messages');
  assertIncludes(chatMessages[0].content, 'bravery-replacer', 'First message for A');
  assertIncludes(chatMessages[1].content, 'armor-specialist', 'Second message for B');
});

await asyncTest('Chat message content does not contain undefined or null', async () => {
  createTestFixture('Clean Hero');
  chatMessages = [];

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);
  await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff);
  chatMessages = [];

  await Applicator.remove(actor, classItem, 'two-handed-fighter');

  const content = chatMessages[0].content;
  assertNotIncludes(content, 'undefined', 'Should not contain "undefined"');
  assertNotIncludes(content, 'null', 'Should not contain "null"');
});

await asyncTest('Chat message posted even for additive-only archetype removal', async () => {
  createTestFixture('Additive Hero');
  chatMessages = [];

  const additiveParsed = {
    name: 'Additive Only',
    slug: 'additive-only',
    features: [{
      name: 'Extra Skill',
      level: 1,
      type: 'additive',
      target: null,
      matchedAssociation: null,
      source: 'manual'
    }]
  };

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, additiveParsed);
  await Applicator.apply(actor, classItem, additiveParsed, diff);
  chatMessages = [];

  await Applicator.remove(actor, classItem, 'additive-only');

  assertEqual(chatMessages.length, 1, 'Should still post chat message');
  assertIncludes(chatMessages[0].content, 'Additive Hero', 'Should mention actor');
  assertIncludes(chatMessages[0].content, 'additive-only', 'Should mention archetype');
});

await asyncTest('Permission denied removal does NOT post chat message', async () => {
  createTestFixture('Permission Hero');
  chatMessages = [];

  const diff = DiffEngine.generateDiff(resolvedFighterAssociations, simpleParsed);
  await Applicator.apply(actor, classItem, simpleParsed, diff);
  chatMessages = [];

  // Switch to non-GM non-owner
  const origGM = game.user.isGM;
  game.user.isGM = false;
  const origOwner = actor.isOwner;
  actor.isOwner = false;

  const result = await Applicator.remove(actor, classItem, 'bravery-replacer');
  assertEqual(result, false, 'Should fail permission check');
  assertEqual(chatMessages.length, 0, 'No chat message for permission denied');

  // Restore
  game.user.isGM = origGM;
  actor.isOwner = origOwner;

  // Clean up
  await Applicator.remove(actor, classItem, 'bravery-replacer');
});

// =====================================================
// Direct _postRemoveMessage testing
// =====================================================
console.log('\n--- Direct _postRemoveMessage tests ---');

await asyncTest('_postRemoveMessage creates message with correct structure', async () => {
  chatMessages = [];
  const mockActor = { name: 'Direct Test Actor' };
  const mockClassItem = { name: 'Wizard' };
  await Applicator._postRemoveMessage(mockActor, mockClassItem, 'test-archetype');

  assertEqual(chatMessages.length, 1, 'Should create 1 message');
  const content = chatMessages[0].content;
  assertIncludes(content, 'Direct Test Actor', 'Has actor name');
  assertIncludes(content, 'Wizard', 'Has class name');
  assertIncludes(content, 'test-archetype', 'Has archetype slug');
});

await asyncTest('_postRemoveMessage includes restoration confirmation', async () => {
  chatMessages = [];
  await Applicator._postRemoveMessage({ name: 'Hero' }, { name: 'Paladin' }, 'holy-warrior');

  const content = chatMessages[0].content.toLowerCase();
  assertIncludes(content, 'restored', 'Contains restoration confirmation');
});

await asyncTest('_postRemoveMessage has proper HTML structure', async () => {
  chatMessages = [];
  await Applicator._postRemoveMessage({ name: 'Knight' }, { name: 'Fighter' }, 'shield-bearer');

  const content = chatMessages[0].content;
  // Should have heading
  assertIncludes(content, '<h3>', 'Has h3 header');
  // Should have paragraph
  assertIncludes(content, '<p>', 'Has paragraph');
  // Should use strong/bold for emphasis
  assertIncludes(content, '<strong>', 'Uses bold emphasis');
});

// =====================================================
// Summary
// =====================================================
console.log('\n' + '='.repeat(60));
console.log('Feature #47 Results: ' + passed + '/' + totalTests + ' tests passed, ' + failed + ' failed');
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
