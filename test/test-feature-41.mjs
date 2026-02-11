/**
 * Test Suite for Feature #41: Chat message posted after application
 *
 * Verifies that Applicator.apply() posts a chat message summarizing changes:
 * 1. Apply an archetype
 * 2. Verify chat message appears
 * 3. Verify includes actor, class, archetype names
 * 4. Verify lists features replaced/added/modified
 * 5. Verify readable and well-structured
 */

import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';

var passed = 0;
var failed = 0;
var totalTests = 0;

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
var chatMessages = [];
globalThis.ChatMessage = {
  create: async (data) => {
    chatMessages.push(data);
    return data;
  }
};

// UUID resolution map
var uuidMap = {
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
  'Compendium.pf1.class-abilities.WeaponMastery': { name: 'Weapon Mastery' },
  'Compendium.pf1.class-abilities.SneakAttack1': { name: 'Sneak Attack' },
  'Compendium.pf1.class-abilities.Trapfinding': { name: 'Trapfinding' },
  'Compendium.pf1.class-abilities.TrapSense1': { name: 'Trap Sense' },
  'Compendium.pf1.class-abilities.UncannyDodge': { name: 'Uncanny Dodge' }
};

globalThis.fromUuid = async (uuid) => {
  return uuidMap[uuid] || null;
};

var { Applicator } = await import('../scripts/applicator.mjs');
var { DiffEngine } = await import('../scripts/diff-engine.mjs');
var { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

console.log('\n=== Feature #41: Chat message posted after application ===\n');

// =====================================================
// Enhanced mock actor
// =====================================================
function createEnhancedMockActor(name, classItems) {
  var flags = {};
  var items = [...classItems];
  var id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);

  return {
    id,
    name,
    isOwner: true,
    items: {
      filter: (fn) => items.filter(fn),
      find: (fn) => items.find(fn),
      get: (id) => items.find(i => i.id === id),
      map: (fn) => items.map(fn),
      [Symbol.iterator]: () => items[Symbol.iterator]()
    },
    flags,
    getFlag(scope, key) { return flags[scope]?.[key] ?? null; },
    async setFlag(scope, key, value) {
      if (!flags[scope]) flags[scope] = {};
      flags[scope][key] = value;
    },
    async unsetFlag(scope, key) {
      if (flags[scope]) delete flags[scope][key];
    },
    async createEmbeddedDocuments(type, data) {
      var created = data.map(d => {
        var newId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
        var item = {
          ...d, id: newId,
          getFlag(scope, key) { return d.flags?.[scope]?.[key] ?? null; }
        };
        items.push(item);
        return item;
      });
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (var delId of ids) {
        var idx = items.findIndex(i => i.id === delId);
        if (idx >= 0) items.splice(idx, 1);
      }
      return ids;
    },
    _items: items
  };
}

// =====================================================
// Fighter base classAssociations
// =====================================================
var fighterClassAssociations = [
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

var resolvedFighterAssociations;
await asyncTest('Resolve Fighter classAssociations', async () => {
  resolvedFighterAssociations = await CompendiumParser.resolveAssociations(fighterClassAssociations);
  assertEqual(resolvedFighterAssociations.length, 12, 'Should have 12 base features');
});

// Two-Handed Fighter archetype: 6 replacements + 1 modification
var twoHandedFighterParsed = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'Fighter',
  features: [
    {
      name: 'Shattering Strike',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      description: '<p>Replaces Bravery.</p>',
      matchedAssociation: resolvedFighterAssociations?.[1] || { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
      source: 'auto-parse'
    },
    {
      name: 'Overhand Chop',
      level: 3,
      type: 'replacement',
      target: 'armor training 1',
      description: '<p>Replaces AT1.</p>',
      matchedAssociation: resolvedFighterAssociations?.[2] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
      source: 'auto-parse'
    },
    {
      name: 'Weapon Training',
      level: 5,
      type: 'modification',
      target: 'weapon training 1',
      description: '<p>Modifies Weapon Training.</p>',
      matchedAssociation: resolvedFighterAssociations?.[3] || { uuid: 'Compendium.pf1.class-abilities.WeaponTraining1', level: 5 },
      source: 'auto-parse'
    },
    {
      name: 'Backswing',
      level: 7,
      type: 'replacement',
      target: 'armor training 2',
      matchedAssociation: resolvedFighterAssociations?.[4] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining2', level: 7 },
      source: 'auto-parse'
    },
    {
      name: 'Piledriver',
      level: 11,
      type: 'replacement',
      target: 'armor training 3',
      matchedAssociation: resolvedFighterAssociations?.[6] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining3', level: 11 },
      source: 'auto-parse'
    },
    {
      name: 'Greater Power Attack',
      level: 15,
      type: 'replacement',
      target: 'armor training 4',
      matchedAssociation: resolvedFighterAssociations?.[8] || { uuid: 'Compendium.pf1.class-abilities.ArmorTraining4', level: 15 },
      source: 'auto-parse'
    },
    {
      name: 'Devastating Blow',
      level: 19,
      type: 'replacement',
      target: 'armor mastery',
      matchedAssociation: resolvedFighterAssociations?.[10] || { uuid: 'Compendium.pf1.class-abilities.ArmorMastery', level: 19 },
      source: 'auto-parse'
    }
  ]
};

// =====================================================
// Step 1: Apply an archetype
// =====================================================
console.log('--- Step 1: Apply an archetype ---');

var classItem = createMockClassItem('Fighter', 10, 'fighter');
classItem.system.links.classAssociations = JSON.parse(JSON.stringify(resolvedFighterAssociations));
var actor = createEnhancedMockActor('Thorin Ironforge', [classItem]);

chatMessages = []; // Clear any previous

var diff = DiffEngine.generateDiff(resolvedFighterAssociations, twoHandedFighterParsed);

await asyncTest('Apply Two-Handed Fighter succeeds', async () => {
  var result = await Applicator.apply(actor, classItem, twoHandedFighterParsed, diff);
  assertEqual(result, true, 'Apply should return true');
});

// =====================================================
// Step 2: Verify chat message appears
// =====================================================
console.log('\n--- Step 2: Verify chat message appears ---');

test('ChatMessage.create was called', () => {
  assert(chatMessages.length >= 1, 'Should have at least 1 chat message');
});

test('Chat message has content property', () => {
  var msg = chatMessages[chatMessages.length - 1];
  assertNotNull(msg.content, 'Message should have content');
  assert(msg.content.length > 0, 'Content should not be empty');
});

test('Chat message is HTML formatted', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, '<', 'Content should contain HTML tags');
});

// =====================================================
// Step 3: Verify includes actor, class, archetype names
// =====================================================
console.log('\n--- Step 3: Verify includes actor, class, archetype names ---');

test('Chat message includes archetype name', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Two-Handed Fighter', 'Should include archetype name');
});

test('Chat message includes actor name', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Thorin Ironforge', 'Should include actor name');
});

test('Chat message includes class name', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Fighter', 'Should include class name');
});

test('Archetype name is in bold/strong tag', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, '<strong>Two-Handed Fighter</strong>', 'Archetype name should be bold');
});

test('Actor name is in bold/strong tag', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, "<strong>Thorin Ironforge</strong>", 'Actor name should be bold');
});

test('Chat message has module title header', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'PF1e Archetype Manager', 'Should include module title');
});

// =====================================================
// Step 4: Verify lists features replaced/added/modified
// =====================================================
console.log('\n--- Step 4: Verify lists features replaced/added/modified ---');

test('Chat message lists replaced features', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Replaced', 'Should include "Replaced" label');
});

test('Replaced features include Bravery', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Bravery', 'Should list Bravery as replaced');
});

test('Replaced features include Armor Training 1', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Armor Training 1', 'Should list Armor Training 1');
});

test('Replaced features include Armor Training 2', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Armor Training 2', 'Should list Armor Training 2');
});

test('Replaced features include Armor Training 3', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Armor Training 3', 'Should list Armor Training 3');
});

test('Replaced features include Armor Training 4', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Armor Training 4', 'Should list Armor Training 4');
});

test('Replaced features include Armor Mastery', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Armor Mastery', 'Should list Armor Mastery');
});

test('Replaced features include Weapon Training 1', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  // WT1 is marked as 'removed' by the diff (modification marks original as removed)
  assertIncludes(content, 'Weapon Training 1', 'Should list Weapon Training 1 as replaced');
});

test('Chat message lists added features', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Added', 'Should include "Added" label');
});

test('Added features include Shattering Strike', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Shattering Strike', 'Should list Shattering Strike');
});

test('Added features include Overhand Chop', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Overhand Chop', 'Should list Overhand Chop');
});

test('Added features include Backswing', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Backswing', 'Should list Backswing');
});

test('Added features include Piledriver', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Piledriver', 'Should list Piledriver');
});

test('Added features include Greater Power Attack', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Greater Power Attack', 'Should list Greater Power Attack');
});

test('Added features include Devastating Blow', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Devastating Blow', 'Should list Devastating Blow');
});

test('Chat message lists modified features', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Modified', 'Should include "Modified" label');
});

test('Modified features include Weapon Training', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Weapon Training', 'Should list Weapon Training as modified');
});

// =====================================================
// Step 5: Verify readable and well-structured
// =====================================================
console.log('\n--- Step 5: Verify readable and well-structured ---');

test('Chat message has heading tag', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, '<h3>', 'Should have heading');
});

test('Chat message uses emphasis for labels', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, '<em>', 'Should use emphasis tags for labels');
});

test('Chat message has paragraph structure', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, '<p>', 'Should use paragraph tags');
});

test('Chat message mentions "applied"', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'applied', 'Should indicate archetype was applied');
});

test('Chat message has reasonable length (not too short)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assert(content.length > 100, 'Message should be substantial enough to be informative');
});

test('Chat message has reasonable length (not excessively long)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assert(content.length < 5000, 'Message should not be excessively long');
});

// =====================================================
// Scenario: Replacement-only archetype (no modifications)
// =====================================================
console.log('\n--- Scenario: Replacement-only archetype chat message ---');

chatMessages = [];

var classItem2 = createMockClassItem('Fighter', 5, 'fighter2');
classItem2.system.links.classAssociations = JSON.parse(JSON.stringify([
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1, resolvedName: 'Bonus Feat' },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2, resolvedName: 'Bravery' }
]));
var actor2 = createEnhancedMockActor('Simple Warrior', [classItem2]);

var simpleArchetype = {
  name: 'Braveless Warrior',
  slug: 'braveless-warrior',
  class: 'Fighter',
  features: [
    {
      name: 'Courage',
      level: 2,
      type: 'replacement',
      target: 'bravery',
      description: '<p>Replaces Bravery with Courage.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2, resolvedName: 'Bravery' },
      source: 'auto-parse'
    }
  ]
};

var diff2 = DiffEngine.generateDiff(classItem2.system.links.classAssociations, simpleArchetype);

await asyncTest('Apply replacement-only archetype', async () => {
  var result = await Applicator.apply(actor2, classItem2, simpleArchetype, diff2);
  assertEqual(result, true, 'Apply should succeed');
});

test('Chat message created for simple archetype', () => {
  assert(chatMessages.length >= 1, 'Should have chat message');
});

test('Simple archetype message includes archetype name', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Braveless Warrior', 'Should include archetype name');
});

test('Simple archetype message includes actor name', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Simple Warrior', 'Should include actor name');
});

test('Simple archetype message lists replaced feature (Bravery)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Bravery', 'Should list Bravery');
  assertIncludes(content, 'Replaced', 'Should have Replaced label');
});

test('Simple archetype message lists added feature (Courage)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Courage', 'Should list Courage');
  assertIncludes(content, 'Added', 'Should have Added label');
});

test('Simple archetype message does NOT include Modified label', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertNotIncludes(content, 'Modified', 'Should not have Modified section when no modifications');
});

// =====================================================
// Scenario: Modification-only archetype
// =====================================================
console.log('\n--- Scenario: Modification-only archetype chat message ---');

chatMessages = [];

var rogueAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
  { uuid: 'Compendium.pf1.class-abilities.Trapfinding', level: 1, resolvedName: 'Trapfinding' }
];

var classItem3 = createMockClassItem('Rogue', 5, 'rogue');
classItem3.system.links.classAssociations = JSON.parse(JSON.stringify(rogueAssociations));
var actor3 = createEnhancedMockActor('Sneaky Pete', [classItem3]);

var modOnlyArchetype = {
  name: 'Precision Striker',
  slug: 'precision-striker',
  class: 'Rogue',
  features: [
    {
      name: 'Precision Sneak',
      level: 1,
      type: 'modification',
      target: 'sneak attack',
      description: '<p>Modifies sneak attack for precision damage.</p>',
      matchedAssociation: { uuid: 'Compendium.pf1.class-abilities.SneakAttack1', level: 1, resolvedName: 'Sneak Attack' },
      source: 'auto-parse'
    }
  ]
};

var diff3 = DiffEngine.generateDiff(rogueAssociations, modOnlyArchetype);

await asyncTest('Apply modification-only archetype', async () => {
  var result = await Applicator.apply(actor3, classItem3, modOnlyArchetype, diff3);
  assertEqual(result, true, 'Apply should succeed');
});

test('Chat message created for modification archetype', () => {
  assert(chatMessages.length >= 1, 'Should have chat message');
});

test('Modification-only message includes "Modified" label', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Modified', 'Should have Modified label');
});

test('Modification-only message includes modified feature name', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Precision Sneak', 'Should include modified feature name');
});

test('Modification-only message includes actor name (Sneaky Pete)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Sneaky Pete', 'Should include actor name');
});

test('Modification-only message includes archetype name (Precision Striker)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Precision Striker', 'Should include archetype name');
});

// =====================================================
// Scenario: Additive-only archetype
// =====================================================
console.log('\n--- Scenario: Additive-only archetype chat message ---');

chatMessages = [];

var classItem4 = createMockClassItem('Fighter', 5, 'fighter4');
classItem4.system.links.classAssociations = JSON.parse(JSON.stringify([
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1, resolvedName: 'Bonus Feat' }
]));
var actor4 = createEnhancedMockActor('Bonus Fighter', [classItem4]);

var additiveArchetype = {
  name: 'Extra Feats',
  slug: 'extra-feats',
  class: 'Fighter',
  features: [
    {
      name: 'Bonus Power',
      level: 3,
      type: 'additive',
      target: null,
      description: '<p>Grants additional power at level 3.</p>',
      matchedAssociation: null,
      source: 'manual'
    }
  ]
};

var diff4 = DiffEngine.generateDiff(
  classItem4.system.links.classAssociations,
  additiveArchetype
);

await asyncTest('Apply additive-only archetype', async () => {
  var result = await Applicator.apply(actor4, classItem4, additiveArchetype, diff4);
  assertEqual(result, true, 'Apply should succeed');
});

test('Chat message created for additive archetype', () => {
  assert(chatMessages.length >= 1, 'Should have chat message');
});

test('Additive message includes "Added" label', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Added', 'Should have Added label');
  assertIncludes(content, 'Bonus Power', 'Should list added feature');
});

test('Additive message does NOT include "Replaced" label (no replacements)', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertNotIncludes(content, 'Replaced', 'Should not have Replaced section');
});

test('Additive message includes actor and archetype names', () => {
  var content = chatMessages[chatMessages.length - 1].content;
  assertIncludes(content, 'Bonus Fighter', 'Should include actor name');
  assertIncludes(content, 'Extra Feats', 'Should include archetype name');
});

// =====================================================
// Direct _postApplyMessage testing
// =====================================================
console.log('\n--- Direct _postApplyMessage testing ---');

chatMessages = [];

await asyncTest('_postApplyMessage creates chat message with all sections', async () => {
  var testActor = { name: 'TestActor' };
  var testClassItem = { name: 'TestClass' };
  var testParsed = { name: 'TestArchetype' };
  var testDiff = [
    { status: 'removed', name: 'OldFeature1' },
    { status: 'removed', name: 'OldFeature2' },
    { status: 'added', name: 'NewFeature1' },
    { status: 'added', name: 'NewFeature2' },
    { status: 'added', name: 'NewFeature3' },
    { status: 'modified', name: 'ModdedFeature1' },
    { status: 'unchanged', name: 'KeptFeature1' }
  ];

  await Applicator._postApplyMessage(testActor, testClassItem, testParsed, testDiff);

  assertEqual(chatMessages.length, 1, 'Should create 1 chat message');
  var content = chatMessages[0].content;

  // Check all names
  assertIncludes(content, 'TestArchetype', 'Archetype name');
  assertIncludes(content, 'TestActor', 'Actor name');
  assertIncludes(content, 'TestClass', 'Class name');

  // Check feature lists
  assertIncludes(content, 'OldFeature1', 'Replaced feature 1');
  assertIncludes(content, 'OldFeature2', 'Replaced feature 2');
  assertIncludes(content, 'NewFeature1', 'Added feature 1');
  assertIncludes(content, 'NewFeature2', 'Added feature 2');
  assertIncludes(content, 'NewFeature3', 'Added feature 3');
  assertIncludes(content, 'ModdedFeature1', 'Modified feature');

  // Unchanged should not appear in message (it's not a change)
  // (KeptFeature1 may or may not appear; the key test is the labels)
  assertIncludes(content, 'Replaced', 'Replaced label');
  assertIncludes(content, 'Added', 'Added label');
  assertIncludes(content, 'Modified', 'Modified label');
});

chatMessages = [];

await asyncTest('_postApplyMessage omits empty sections', async () => {
  var testActor = { name: 'TestActor2' };
  var testClassItem = { name: 'TestClass2' };
  var testParsed = { name: 'TestArchetype2' };
  var testDiff = [
    { status: 'added', name: 'OnlyAdded' },
    { status: 'unchanged', name: 'Kept' }
  ];

  await Applicator._postApplyMessage(testActor, testClassItem, testParsed, testDiff);

  var content = chatMessages[0].content;
  assertIncludes(content, 'Added', 'Should have Added section');
  assertIncludes(content, 'OnlyAdded', 'Should list added feature');
  assertNotIncludes(content, 'Replaced', 'Should not have Replaced when no replacements');
  assertNotIncludes(content, 'Modified', 'Should not have Modified when no modifications');
});

chatMessages = [];

await asyncTest('_postApplyMessage with empty diff still creates message', async () => {
  var testActor = { name: 'EmptyActor' };
  var testClassItem = { name: 'EmptyClass' };
  var testParsed = { name: 'EmptyArchetype' };
  var testDiff = [
    { status: 'unchanged', name: 'Only Unchanged' }
  ];

  await Applicator._postApplyMessage(testActor, testClassItem, testParsed, testDiff);

  var content = chatMessages[0].content;
  assertIncludes(content, 'EmptyArchetype', 'Should include archetype name');
  assertIncludes(content, 'EmptyActor', 'Should include actor name');
  assertIncludes(content, 'applied', 'Should include applied text');
});

// =====================================================
// Verify message feature list formatting
// =====================================================
console.log('\n--- Verify feature list formatting ---');

chatMessages = [];

await asyncTest('Multiple replaced features are comma-separated', async () => {
  var testActor = { name: 'A' };
  var testClassItem = { name: 'C' };
  var testParsed = { name: 'T' };
  var testDiff = [
    { status: 'removed', name: 'Alpha' },
    { status: 'removed', name: 'Beta' },
    { status: 'removed', name: 'Gamma' }
  ];

  await Applicator._postApplyMessage(testActor, testClassItem, testParsed, testDiff);

  var content = chatMessages[0].content;
  // Should list all three names separated by commas
  assertIncludes(content, 'Alpha', 'Should include Alpha');
  assertIncludes(content, 'Beta', 'Should include Beta');
  assertIncludes(content, 'Gamma', 'Should include Gamma');
  // Verify comma separation
  assertIncludes(content, ', ', 'Should use comma separation');
});

// =====================================================
// Summary
// =====================================================
console.log('\n' + '='.repeat(60));
console.log(`Feature #41 Results: ${passed}/${totalTests} tests passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
