/**
 * PF1e Archetype Manager - Main Module Entry Point
 *
 * Automates the application and removal of class archetypes for Pathfinder 1e
 * by programmatically modifying classAssociations arrays on class items.
 */

import { ArchetypeManager } from './archetype-manager.mjs';
import { JournalEntryDB } from './journal-db.mjs';
import { CompendiumParser } from './compendium-parser.mjs';
import { DiffEngine } from './diff-engine.mjs';
import { Applicator } from './applicator.mjs';
import { UIManager } from './ui-manager.mjs';

const MODULE_ID = 'archetype-manager';
const MODULE_TITLE = 'PF1e Archetype Manager';
const JE_DB_NAME = 'Archetype Manager DB';

/**
 * Module initialization - register settings and prepare module
 */
Hooks.once('init', () => {
  console.log(`${MODULE_TITLE} | Initializing module`);

  // Register module settings
  game.settings.register(MODULE_ID, 'lastSelectedClass', {
    name: 'Last Selected Class',
    hint: 'Remembers the last selected class within a session',
    scope: 'client',
    config: false,
    type: String,
    default: ''
  });

  game.settings.register(MODULE_ID, 'showParseWarnings', {
    name: 'Show Parse Warnings',
    hint: 'Display warnings when archetype features cannot be automatically parsed',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, 'autoCreateJEDB', {
    name: 'Auto-Create Journal Database',
    hint: 'When enabled, the module automatically creates the Archetype Manager DB JournalEntry on startup. Disable if you manage the journal manually or do not want automatic journal creation.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  console.log(`${MODULE_TITLE} | Module initialized`);
});

/**
 * Module ready - set up JournalEntry database and register macro
 */
Hooks.once('ready', async () => {
  console.log(`${MODULE_TITLE} | Module ready, setting up database`);

  // Auto-create JournalEntry database if it doesn't exist (if setting enabled)
  if (game.settings.get(MODULE_ID, 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  } else {
    console.log(`${MODULE_TITLE} | Auto-create JournalEntry database is disabled, skipping database creation`);
  }

  // Make the module API available globally for macro access
  game.modules.get(MODULE_ID).api = {
    open: (actor) => ArchetypeManager.open(actor),
    MODULE_ID,
    JE_DB_NAME
  };

  console.log(`${MODULE_TITLE} | Module fully loaded and ready`);
});

export { MODULE_ID, MODULE_TITLE, JE_DB_NAME };
