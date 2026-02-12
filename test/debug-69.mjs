import { setupMockEnvironment, createMockClassItem, createMockActor } from './foundry-mock.mjs';
const { hooks } = setupMockEnvironment();
await import('../scripts/module.mjs');
await hooks.callAll('init');
await hooks.callAll('ready');
const { DiffEngine } = await import('../scripts/diff-engine.mjs');
const { Applicator } = await import('../scripts/applicator.mjs');

const fighter = createMockClassItem('Fighter', 5, 'fighter');
fighter.system.links.classAssociations = [
  { uuid: 'Compendium.pf1.class-abilities.Item.bravery', id: 'bravery-id', level: 2, resolvedName: 'Bravery' },
  { uuid: 'Compendium.pf1.class-abilities.Item.armor-training', id: 'armor-training-id', level: 3, resolvedName: 'Armor Training' },
  { uuid: 'Compendium.pf1.class-abilities.Item.weapon-training', id: 'weapon-training-id', level: 5, resolvedName: 'Weapon Training' },
  { uuid: 'Compendium.pf1.class-abilities.Item.bonus-feat-1', id: 'bonus-feat-1-id', level: 1, resolvedName: 'Bonus Feat' },
];

const archetype = {
  name: 'Two-Handed Fighter',
  slug: 'two-handed-fighter',
  class: 'fighter',
  features: [
    {
      name: 'Shattering Strike',
      type: 'replacement',
      target: 'Bravery',
      level: 2,
      description: 'The two-handed fighter gains a +1 bonus to damage.',
      matchedAssociation: {
        uuid: 'Compendium.pf1.class-abilities.Item.bravery',
        id: 'bravery-id',
        level: 2,
        resolvedName: 'Bravery'
      }
    },
    {
      name: 'Overhand Chop',
      type: 'additive',
      target: null,
      level: 3,
      description: 'Doubles Str bonus on single attacks.'
    }
  ]
};

const diff = DiffEngine.generateDiff(fighter.system.links.classAssociations, archetype);
console.log('Diff entries:');
diff.forEach(d => console.log(d.status, d.name, d.level));

const newAssoc = Applicator._buildNewAssociations(diff);
console.log('\nNew associations after _buildNewAssociations:');
newAssoc.forEach(a => console.log(a.resolvedName || a.uuid, a.level));

// Now simulate full apply
const actor = createMockActor('Debug Hero', [fighter]);
const result = await Applicator.apply(actor, fighter, archetype, diff);
console.log('\nApply result:', result);

console.log('\nFinal classAssociations:');
fighter.system.links.classAssociations.forEach(a => console.log(a.resolvedName || a.uuid, a.level));
console.log('Has Bravery?', fighter.system.links.classAssociations.some(a => a.resolvedName === 'Bravery'));
