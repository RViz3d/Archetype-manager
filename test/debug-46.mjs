import { setupMockEnvironment, createMockClassItem } from './foundry-mock.mjs';
setupMockEnvironment();

const uuidMap = {
  'Compendium.pf1.class-abilities.BonusFeat1': { name: 'Bonus Feat' },
  'Compendium.pf1.class-abilities.Bravery': { name: 'Bravery' },
  'Compendium.pf1.class-abilities.ArmorTraining1': { name: 'Armor Training 1' },
};
globalThis.fromUuid = async (uuid) => uuidMap[uuid] || null;

const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { CompendiumParser } = await import('../scripts/compendium-parser.mjs');
const { Applicator } = await import('../scripts/applicator.mjs');

const baseAssocs = [
  { uuid: 'Compendium.pf1.class-abilities.BonusFeat1', level: 1 },
  { uuid: 'Compendium.pf1.class-abilities.Bravery', level: 2 },
  { uuid: 'Compendium.pf1.class-abilities.ArmorTraining1', level: 3 },
];
const resolved = await CompendiumParser.resolveAssociations(baseAssocs);
console.log('Resolved:', JSON.stringify(resolved));

const archetypeA = {
  name: 'A',
  slug: 'a',
  features: [{
    name: 'Fearless',
    level: 2,
    type: 'replacement',
    target: 'bravery',
    matchedAssociation: resolved[1],
    source: 'auto-parse'
  }]
};

const diff = DiffEngine.generateDiff(resolved, archetypeA);
console.log('Diff entries:');
for (const entry of diff) {
  console.log(`  status=${entry.status} name=${entry.name} level=${entry.level} hasOriginal=${!!entry.original} hasArchFeature=${!!entry.archetypeFeature}`);
  if (entry.archetypeFeature) {
    console.log(`    matchedAssoc: ${JSON.stringify(entry.archetypeFeature.matchedAssociation)}`);
  }
}

const newAssocs = Applicator._buildNewAssociations(diff);
console.log('New assocs:');
for (const a of newAssocs) {
  console.log(`  uuid=${a.uuid} level=${a.level} name=${a.resolvedName || 'n/a'}`);
}

// Check if Bravery is in the new assocs
const hasBravery = newAssocs.some(a => a.uuid === 'Compendium.pf1.class-abilities.Bravery');
console.log('Has Bravery in new assocs:', hasBravery);
