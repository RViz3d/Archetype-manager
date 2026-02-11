/**
 * Test Suite for Features #11, #17, #62
 *
 * Feature #11: Load archetype features from compendium (pf1e-archetypes.pf-arch-features)
 * Feature #17: UUID resolution for classAssociations entries
 * Feature #62: Missing UUID resolution handled gracefully (no crash, skip with warning)
 *
 * Uses mock FoundryVTT environment since no live Foundry instance is available.
 */

import { setupMockEnvironment, resetMockEnvironment, MockCollection } from './foundry-mock.mjs';

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
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(arr, value, message) {
  if (!arr.includes(value)) {
    throw new Error(`${message || 'Assertion failed'}: expected array to include ${JSON.stringify(value)}`);
  }
}

// ============================================================
// Mock Compendium Data Setup
// ============================================================

/**
 * Create realistic mock archetype feature documents resembling pf1e-archetypes data
 * Based on the Two-Handed Fighter archetype as reference
 */
function createMockArchetypeFeatures() {
  return [
    {
      id: 'feat-001',
      name: 'Shattering Strike',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 2</p><p>This ability replaces bravery.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-002',
      name: 'Overhand Chop',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 3</p><p>This ability replaces armor training 1.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-003',
      name: 'Weapon Training',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 5</p><p>This modifies weapon training.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-004',
      name: 'Backswing',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 7</p><p>This ability replaces armor training 2.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-005',
      name: 'Piledriver',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 11</p><p>This ability replaces armor training 3.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-006',
      name: 'Greater Power Attack',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 15</p><p>This ability replaces armor training 4.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-007',
      name: 'Devastating Blow',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 19</p><p>This ability replaces armor mastery.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    // Additional features from other archetypes for volume
    {
      id: 'feat-008',
      name: 'Bonus Feat',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 1</p><p>A bonus feat gained at 1st level.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-009',
      name: 'Studied Target',
      type: 'classFeat',
      system: {
        description: {
          value: '<p><strong>Level</strong>: 1</p><p>As the studied target class feature, but with improved bonuses.</p>'
        },
        links: { classAssociations: [] }
      }
    },
    {
      id: 'feat-010',
      name: 'No Description Feature',
      type: 'classFeat',
      system: {
        description: {
          value: ''
        },
        links: { classAssociations: [] }
      }
    }
  ];
}

/**
 * Create a mock compendium pack that behaves like game.packs.get()
 */
function createMockPack(documents) {
  return {
    getDocuments: async () => [...documents],
    getDocument: async (id) => documents.find(d => d.id === id) || null,
    metadata: {
      id: 'pf1e-archetypes.pf-arch-features',
      label: 'PF1e Archetype Features',
      type: 'Item'
    }
  };
}

/**
 * Create mock classAssociations entries that reference UUIDs
 */
function createMockClassAssociations() {
  return [
    { uuid: 'Compendium.pf1.classfeatures.bravery-001', level: 2 },
    { uuid: 'Compendium.pf1.classfeatures.armor-training-1-001', level: 3 },
    { uuid: 'Compendium.pf1.classfeatures.armor-training-2-001', level: 7 },
    { uuid: 'Compendium.pf1.classfeatures.armor-training-3-001', level: 11 },
    { uuid: 'Compendium.pf1.classfeatures.armor-training-4-001', level: 15 },
    { uuid: 'Compendium.pf1.classfeatures.armor-mastery-001', level: 19 },
    { uuid: 'Compendium.pf1.classfeatures.weapon-training-001', level: 5 },
    { uuid: 'Compendium.pf1.classfeatures.bonus-feat-001', level: 1 }
  ];
}

/**
 * UUID-to-name mapping for mock fromUuid resolution
 */
const UUID_NAME_MAP = {
  'Compendium.pf1.classfeatures.bravery-001': 'Bravery',
  'Compendium.pf1.classfeatures.armor-training-1-001': 'Armor Training 1',
  'Compendium.pf1.classfeatures.armor-training-2-001': 'Armor Training 2',
  'Compendium.pf1.classfeatures.armor-training-3-001': 'Armor Training 3',
  'Compendium.pf1.classfeatures.armor-training-4-001': 'Armor Training 4',
  'Compendium.pf1.classfeatures.armor-mastery-001': 'Armor Mastery',
  'Compendium.pf1.classfeatures.weapon-training-001': 'Weapon Training',
  'Compendium.pf1.classfeatures.bonus-feat-001': 'Bonus Feat'
};

// ============================================================
// Main Test Runner
// ============================================================

async function runTests() {
  console.log('\n=== Feature #11, #17, #62 Test Suite ===\n');

  // Setup mock environment
  setupMockEnvironment();

  // Setup mock compendium packs
  const mockFeatures = createMockArchetypeFeatures();
  const mockFeaturePack = createMockPack(mockFeatures);

  // Also create archetype list pack (for completeness)
  const mockArchetypes = [
    { id: 'arch-001', name: 'Two-Handed Fighter', type: 'Item', system: {} },
    { id: 'arch-002', name: 'Lore Warden', type: 'Item', system: {} },
    { id: 'arch-003', name: 'Mutation Warrior', type: 'Item', system: {} }
  ];
  const mockArchetypePack = createMockPack(mockArchetypes);

  // Register packs on game.packs
  game.packs.set('pf1e-archetypes.pf-arch-features', mockFeaturePack);
  game.packs.set('pf1e-archetypes.pf-archetypes', mockArchetypePack);

  // Register pf1e-archetypes module as active
  game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });

  // Setup fromUuid to resolve known UUIDs
  globalThis.fromUuid = async (uuid) => {
    if (UUID_NAME_MAP[uuid]) {
      return { name: UUID_NAME_MAP[uuid], id: uuid };
    }
    return null;
  };

  // Import CompendiumParser (after mock env is set up)
  const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');

  // ==========================================================
  // FEATURE #11: Load archetype features from compendium
  // ==========================================================
  console.log('\n--- Feature #11: Load archetype features from compendium ---\n');

  await testAsync('11.1: loadArchetypeFeatures accesses correct pack (pf-arch-features)', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    assert(Array.isArray(features), 'Should return an array');
    assert(features.length > 0, 'Should return features');
  });

  await testAsync('11.2: loadArchetypeFeatures returns all entries from the pack', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    assertEqual(features.length, mockFeatures.length,
      'Should return same number of features as in pack');
  });

  await testAsync('11.3: Each feature entry has name property', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    for (const f of features) {
      assert(typeof f.name === 'string' && f.name.length > 0,
        `Feature should have a name, got: ${f.name}`);
    }
  });

  await testAsync('11.4: Each feature entry has description data', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    for (const f of features) {
      assert(f.system !== undefined, `Feature ${f.name} should have system data`);
      assert(f.system.description !== undefined,
        `Feature ${f.name} should have description in system`);
    }
  });

  await testAsync('11.5: Feature descriptions can be parsed for level info', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    // Shattering Strike should have level 2
    const shatteringStrike = features.find(f => f.name === 'Shattering Strike');
    assert(shatteringStrike, 'Should find Shattering Strike feature');
    const desc = shatteringStrike.system.description.value;
    const level = CompendiumParser.parseLevel(desc);
    assertEqual(level, 2, 'Shattering Strike should be level 2');
  });

  await testAsync('11.6: Feature descriptions can be parsed for replaces info', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    const shatteringStrike = features.find(f => f.name === 'Shattering Strike');
    const desc = shatteringStrike.system.description.value;
    const replaces = CompendiumParser.parseReplaces(desc);
    assertEqual(replaces, 'bravery', 'Shattering Strike should replace bravery');
  });

  await testAsync('11.7: loadArchetypeFeatures returns empty array when module not available', async () => {
    // Temporarily disable the module
    game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: false });
    const features = await CompendiumParser.loadArchetypeFeatures();
    assertEqual(features.length, 0, 'Should return empty array when module not available');
    // Restore
    game.modules.set('pf1e-archetypes', { id: 'pf1e-archetypes', active: true });
  });

  await testAsync('11.8: loadArchetypeFeatures handles pack access failure gracefully', async () => {
    // Temporarily remove the pack
    const savedPack = game.packs.get('pf1e-archetypes.pf-arch-features');
    game.packs.delete('pf1e-archetypes.pf-arch-features');

    const features = await CompendiumParser.loadArchetypeFeatures();
    assertEqual(features.length, 0, 'Should return empty array on pack failure');

    // Restore
    game.packs.set('pf1e-archetypes.pf-arch-features', savedPack);
  });

  await testAsync('11.9: Feature entries have linking data (system.links)', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    for (const f of features) {
      assert(f.system.links !== undefined,
        `Feature ${f.name} should have links in system data`);
    }
  });

  await testAsync('11.10: Features can be classified by type (replacement, modification, additive)', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();

    // Shattering Strike is a replacement
    const ss = features.find(f => f.name === 'Shattering Strike');
    const ssClass = CompendiumParser.classifyFeature(ss.system.description.value);
    assertEqual(ssClass.type, 'replacement', 'Shattering Strike should be a replacement');
    assertEqual(ssClass.target, 'bravery', 'Should target bravery');

    // Weapon Training (modifies)
    const wt = features.find(f => f.name === 'Weapon Training');
    const wtClass = CompendiumParser.classifyFeature(wt.system.description.value);
    assertEqual(wtClass.type, 'modification', 'Weapon Training should be a modification');

    // Bonus Feat (additive - has level but no replace/modify)
    const bf = features.find(f => f.name === 'Bonus Feat');
    const bfClass = CompendiumParser.classifyFeature(bf.system.description.value);
    assertEqual(bfClass.type, 'additive', 'Bonus Feat should be additive');
  });

  await testAsync('11.11: Feature with "as X but" pattern is detected', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    const st = features.find(f => f.name === 'Studied Target');
    assert(st, 'Should find Studied Target feature');
    const isAsBut = CompendiumParser.isAsButVariant(st.system.description.value);
    assert(isAsBut, 'Studied Target should be detected as "as X but" variant');
  });

  await testAsync('11.12: Feature with empty description is handled (no crash)', async () => {
    const features = await CompendiumParser.loadArchetypeFeatures();
    const noDesc = features.find(f => f.name === 'No Description Feature');
    assert(noDesc, 'Should find feature with no description');
    const level = CompendiumParser.parseLevel(noDesc.system.description.value);
    assert(level === null, 'Should return null for empty description level');
    const classification = CompendiumParser.classifyFeature(noDesc.system.description.value);
    assertEqual(classification.type, 'unknown', 'Should classify as unknown for empty description');
  });

  // ==========================================================
  // FEATURE #17: UUID resolution for classAssociations entries
  // ==========================================================
  console.log('\n--- Feature #17: UUID resolution for classAssociations entries ---\n');

  await testAsync('17.1: resolveUUID resolves a known UUID to a feature name', async () => {
    const name = await CompendiumParser.resolveUUID('Compendium.pf1.classfeatures.bravery-001');
    assertEqual(name, 'Bravery', 'Should resolve to Bravery');
  });

  await testAsync('17.2: resolveUUID returns null for unknown UUID', async () => {
    const name = await CompendiumParser.resolveUUID('Compendium.pf1.classfeatures.nonexistent');
    assertEqual(name, null, 'Should return null for unknown UUID');
  });

  await testAsync('17.3: resolveAssociations resolves all UUIDs in classAssociations array', async () => {
    const associations = createMockClassAssociations();
    const resolved = await CompendiumParser.resolveAssociations(associations);

    assertEqual(resolved.length, associations.length,
      'Should return same number of entries');

    // Check that each resolved entry has the original data plus resolvedName
    for (let i = 0; i < resolved.length; i++) {
      assert(resolved[i].uuid !== undefined, 'Should preserve uuid field');
      assert(resolved[i].level !== undefined, 'Should preserve level field');
      assert(resolved[i].resolvedName !== undefined, 'Should have resolvedName field');
    }
  });

  await testAsync('17.4: Each UUID resolves to correct feature name', async () => {
    const associations = createMockClassAssociations();
    const resolved = await CompendiumParser.resolveAssociations(associations);

    // Check specific resolutions
    const bravery = resolved.find(r => r.uuid.includes('bravery'));
    assertEqual(bravery.resolvedName, 'Bravery', 'Bravery UUID should resolve to "Bravery"');

    const at1 = resolved.find(r => r.uuid.includes('armor-training-1'));
    assertEqual(at1.resolvedName, 'Armor Training 1', 'Should resolve to "Armor Training 1"');

    const am = resolved.find(r => r.uuid.includes('armor-mastery'));
    assertEqual(am.resolvedName, 'Armor Mastery', 'Should resolve to "Armor Mastery"');

    const wt = resolved.find(r => r.uuid.includes('weapon-training'));
    assertEqual(wt.resolvedName, 'Weapon Training', 'Should resolve to "Weapon Training"');
  });

  await testAsync('17.5: resolveAssociations preserves original association data', async () => {
    const associations = createMockClassAssociations();
    const resolved = await CompendiumParser.resolveAssociations(associations);

    for (let i = 0; i < resolved.length; i++) {
      assertEqual(resolved[i].uuid, associations[i].uuid,
        `UUID should be preserved for entry ${i}`);
      assertEqual(resolved[i].level, associations[i].level,
        `Level should be preserved for entry ${i}`);
    }
  });

  await testAsync('17.6: resolveAssociations handles empty array', async () => {
    const resolved = await CompendiumParser.resolveAssociations([]);
    assert(Array.isArray(resolved), 'Should return an array');
    assertEqual(resolved.length, 0, 'Should return empty array');
  });

  await testAsync('17.7: Resolved names can be used for matching with normalizeName', async () => {
    const associations = createMockClassAssociations();
    const resolved = await CompendiumParser.resolveAssociations(associations);

    // Test that we can match "bravery" to the resolved "Bravery"
    const match = CompendiumParser.matchTarget('bravery', resolved);
    assert(match !== null, 'Should match "bravery" to "Bravery"');
    assertEqual(match.resolvedName, 'Bravery', 'Matched entry should be Bravery');
  });

  await testAsync('17.8: Resolved names work for fuzzy matching (partial names)', async () => {
    const associations = createMockClassAssociations();
    const resolved = await CompendiumParser.resolveAssociations(associations);

    // "armor training 1" should match normalized
    const match = CompendiumParser.matchTarget('armor training 1', resolved);
    assert(match !== null, 'Should match "armor training 1"');
    assertEqual(match.resolvedName, 'Armor Training 1', 'Should match Armor Training 1');
  });

  await testAsync('17.9: Batch resolution processes all entries', async () => {
    const associations = createMockClassAssociations();
    const startTime = Date.now();
    const resolved = await CompendiumParser.resolveAssociations(associations);
    const elapsed = Date.now() - startTime;

    assertEqual(resolved.length, associations.length,
      'Should resolve all associations');
    // All entries should be resolved (none null for valid UUIDs)
    for (const entry of resolved) {
      assert(entry.resolvedName !== undefined, 'All entries should have resolvedName');
    }
    // Just verify it completed (timing not meaningful in mock, but demonstrates the call works)
    assert(elapsed < 5000, 'Resolution should complete in reasonable time');
  });

  await testAsync('17.10: resolveAssociations handles entry with id instead of uuid', async () => {
    const associations = [
      { id: 'Compendium.pf1.classfeatures.bravery-001', level: 2 }
    ];
    const resolved = await CompendiumParser.resolveAssociations(associations);
    assertEqual(resolved[0].resolvedName, 'Bravery',
      'Should resolve using id field when uuid is not present');
  });

  // ==========================================================
  // FEATURE #62: Missing UUID resolution handled gracefully
  // ==========================================================
  console.log('\n--- Feature #62: Missing UUID resolution handled gracefully ---\n');

  // Track console.warn calls for verification
  let warnMessages = [];
  const originalWarn = console.warn;

  await testAsync('62.1: Unresolvable UUID does not cause crash', async () => {
    const associations = [
      { uuid: 'Compendium.pf1.classfeatures.totally-fake-uuid', level: 5 }
    ];
    // This should NOT throw
    const resolved = await CompendiumParser.resolveAssociations(associations);
    assert(Array.isArray(resolved), 'Should return an array without crashing');
    assertEqual(resolved.length, 1, 'Should return entry for the unresolvable UUID');
  });

  await testAsync('62.2: Broken UUID results in null resolvedName (skipped)', async () => {
    const associations = [
      { uuid: 'Compendium.pf1.classfeatures.nonexistent-feature', level: 3 }
    ];
    const resolved = await CompendiumParser.resolveAssociations(associations);
    assertEqual(resolved[0].resolvedName, null,
      'Broken UUID should resolve to null name');
  });

  await testAsync('62.3: Warning is logged for broken UUID', async () => {
    warnMessages = [];
    console.warn = (...args) => {
      warnMessages.push(args.join(' '));
      originalWarn.apply(console, args);
    };

    // Use a UUID that causes fromUuid to throw
    const originalFromUuid = globalThis.fromUuid;
    globalThis.fromUuid = async (uuid) => {
      if (uuid.includes('error-uuid')) {
        throw new Error('UUID resolution error');
      }
      return UUID_NAME_MAP[uuid] ? { name: UUID_NAME_MAP[uuid] } : null;
    };

    await CompendiumParser.resolveUUID('Compendium.pf1.error-uuid');

    assert(warnMessages.length > 0, 'Should log a warning for broken UUID');
    const hasWarning = warnMessages.some(m =>
      m.includes('Failed to resolve UUID') || m.includes('error-uuid'));
    assert(hasWarning, 'Warning should mention the failed UUID');

    // Restore
    globalThis.fromUuid = originalFromUuid;
    console.warn = originalWarn;
  });

  await testAsync('62.4: Other UUIDs still resolve when one fails', async () => {
    const associations = [
      { uuid: 'Compendium.pf1.classfeatures.bravery-001', level: 2 },
      { uuid: 'Compendium.pf1.classfeatures.nonexistent', level: 5 },
      { uuid: 'Compendium.pf1.classfeatures.armor-mastery-001', level: 19 }
    ];
    const resolved = await CompendiumParser.resolveAssociations(associations);

    assertEqual(resolved.length, 3, 'Should return all 3 entries');
    assertEqual(resolved[0].resolvedName, 'Bravery', 'First UUID should still resolve');
    assertEqual(resolved[1].resolvedName, null, 'Broken UUID should be null');
    assertEqual(resolved[2].resolvedName, 'Armor Mastery', 'Third UUID should still resolve');
  });

  await testAsync('62.5: UUID that throws error is handled gracefully', async () => {
    const originalFromUuid = globalThis.fromUuid;
    globalThis.fromUuid = async (uuid) => {
      if (uuid.includes('throw-error')) {
        throw new Error('Network error fetching document');
      }
      return UUID_NAME_MAP[uuid] ? { name: UUID_NAME_MAP[uuid] } : null;
    };

    const result = await CompendiumParser.resolveUUID('Compendium.pf1.throw-error');
    assertEqual(result, null, 'Should return null for throwing UUID');

    // Restore
    globalThis.fromUuid = originalFromUuid;
  });

  await testAsync('62.6: Mixed valid and broken UUIDs - all valid ones resolve correctly', async () => {
    const originalFromUuid = globalThis.fromUuid;
    let throwCount = 0;
    globalThis.fromUuid = async (uuid) => {
      // Every other UUID throws
      if (uuid.includes('bad-')) {
        throwCount++;
        throw new Error('Resolution failure');
      }
      return UUID_NAME_MAP[uuid] ? { name: UUID_NAME_MAP[uuid] } : null;
    };

    // Suppress console.warn for this test
    console.warn = () => {};

    const associations = [
      { uuid: 'Compendium.pf1.classfeatures.bravery-001', level: 2 },
      { uuid: 'Compendium.pf1.bad-001', level: 3 },
      { uuid: 'Compendium.pf1.classfeatures.armor-mastery-001', level: 19 },
      { uuid: 'Compendium.pf1.bad-002', level: 7 },
      { uuid: 'Compendium.pf1.classfeatures.weapon-training-001', level: 5 }
    ];

    const resolved = await CompendiumParser.resolveAssociations(associations);

    assertEqual(resolved.length, 5, 'Should return all 5 entries');
    assertEqual(resolved[0].resolvedName, 'Bravery', 'Valid UUID 1 should resolve');
    assertEqual(resolved[1].resolvedName, null, 'Bad UUID 1 should be null');
    assertEqual(resolved[2].resolvedName, 'Armor Mastery', 'Valid UUID 2 should resolve');
    assertEqual(resolved[3].resolvedName, null, 'Bad UUID 2 should be null');
    assertEqual(resolved[4].resolvedName, 'Weapon Training', 'Valid UUID 3 should resolve');
    assertEqual(throwCount, 2, 'Should have encountered 2 throwing UUIDs');

    // Restore
    globalThis.fromUuid = originalFromUuid;
    console.warn = originalWarn;
  });

  await testAsync('62.7: Null/undefined UUID handled without crash', async () => {
    const result1 = await CompendiumParser.resolveUUID(null);
    assertEqual(result1, null, 'null UUID should return null');

    const result2 = await CompendiumParser.resolveUUID(undefined);
    assertEqual(result2, null, 'undefined UUID should return null');
  });

  await testAsync('62.8: Empty string UUID handled without crash', async () => {
    const result = await CompendiumParser.resolveUUID('');
    assertEqual(result, null, 'Empty string UUID should return null');
  });

  await testAsync('62.9: Association with neither uuid nor id field handled', async () => {
    // Suppress console.warn for this test
    console.warn = () => {};

    const associations = [
      { level: 5 } // No uuid or id field
    ];
    const resolved = await CompendiumParser.resolveAssociations(associations);
    assertEqual(resolved.length, 1, 'Should return entry even without uuid/id');
    assertEqual(resolved[0].resolvedName, null, 'Should have null resolvedName');

    console.warn = originalWarn;
  });

  await testAsync('62.10: Full workflow - parse archetype with some broken UUIDs', async () => {
    // Suppress console.warn for this test
    console.warn = () => {};

    // Create associations with some broken UUIDs
    const associations = [
      { uuid: 'Compendium.pf1.classfeatures.bravery-001', level: 2 },
      { uuid: 'Compendium.pf1.classfeatures.broken-ref', level: 10 },
      { uuid: 'Compendium.pf1.classfeatures.armor-training-1-001', level: 3 }
    ];

    const resolved = await CompendiumParser.resolveAssociations(associations);

    // Should have all entries
    assertEqual(resolved.length, 3, 'Should have all 3 entries');

    // Valid UUIDs should be resolved
    const bravery = resolved.find(r => r.uuid.includes('bravery'));
    assertEqual(bravery.resolvedName, 'Bravery', 'Bravery should resolve');

    const at1 = resolved.find(r => r.uuid.includes('armor-training-1'));
    assertEqual(at1.resolvedName, 'Armor Training 1', 'Armor Training 1 should resolve');

    // Broken UUID should have null name but not crash
    const broken = resolved.find(r => r.uuid.includes('broken-ref'));
    assertEqual(broken.resolvedName, null, 'Broken ref should have null name');

    // Matching should still work for valid entries
    const match = CompendiumParser.matchTarget('bravery', resolved);
    assert(match !== null, 'Should still match against valid resolved names');

    console.warn = originalWarn;
  });

  // ==========================================================
  // Summary
  // ==========================================================
  console.log('\n=== Results ===');
  console.log(`Total: ${totalTests}, Passed: ${passed}, Failed: ${failed}`);
  console.log(failed === 0 ? '\n✅ ALL TESTS PASSED' : '\n❌ SOME TESTS FAILED');

  // Restore console.warn in case it was overridden
  console.warn = originalWarn;

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test suite crashed:', e);
  process.exit(1);
});
