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

  console.log(`${MODULE_TITLE} | Module initialized`);
});

/**
 * Module ready - set up JournalEntry database and register macro
 */
Hooks.once('ready', async () => {
  console.log(`${MODULE_TITLE} | Module ready, setting up database`);

  // Auto-create JournalEntry database if it doesn't exist
  await JournalEntryDB.ensureDatabase();

  // Make the module API available globally for macro access
  game.modules.get(MODULE_ID).api = {
    open: ArchetypeManager.open,
    MODULE_ID,
    JE_DB_NAME
  };

  console.log(`${MODULE_TITLE} | Module fully loaded and ready`);
});

export { MODULE_ID, MODULE_TITLE, JE_DB_NAME };
