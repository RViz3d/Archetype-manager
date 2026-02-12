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
  debugLog(`${MODULE_TITLE} | Initializing module`);

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

  game.settings.register(MODULE_ID, 'chatNotifications', {
    name: 'Chat Notifications',
    hint: 'When enabled, chat messages are posted when archetypes are applied or removed. Disable to suppress chat messages while still performing archetype operations. Toast notifications are not affected by this setting.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, 'defaultCompendiumSource', {
    name: 'Default Compendium Source',
    hint: 'The module ID for the archetype data packs. This specifies which module\'s compendium packs to use as the primary archetype data source (e.g., the pf-archetypes and pf-arch-features packs). Change this if you use a different archetype compendium module.',
    scope: 'world',
    config: true,
    type: String,
    default: 'pf1e-archetypes'
  });

  game.settings.register(MODULE_ID, 'debugLogging', {
    name: 'Debug Logging',
    hint: 'When enabled, verbose console output is displayed for troubleshooting. When disabled (default), informational console.log messages are suppressed — only warnings and errors remain active.',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false
  });

  debugLog(`${MODULE_TITLE} | Module initialized`);
});

/**
 * Module ready - set up JournalEntry database and register macro
 */
Hooks.once('ready', async () => {
  debugLog(`${MODULE_TITLE} | Module ready, setting up database`);

  // Auto-create JournalEntry database if it doesn't exist (if setting enabled)
  if (game.settings.get(MODULE_ID, 'autoCreateJEDB')) {
    await JournalEntryDB.ensureDatabase();
  } else {
    debugLog(`${MODULE_TITLE} | Auto-create JournalEntry database is disabled, skipping database creation`);
  }

  // Make the module API available globally for macro access
  game.modules.get(MODULE_ID).api = {
    open: (actor) => ArchetypeManager.open(actor),
    MODULE_ID,
    JE_DB_NAME
  };

  debugLog(`${MODULE_TITLE} | Module fully loaded and ready`);
});

/**
 * Debug-aware logging utility.
 * Logs to console.log only when the 'debugLogging' setting is enabled.
 * console.warn and console.error are NOT affected — they always print.
 * @param  {...any} args - Arguments to pass to console.log
 */
function debugLog(...args) {
  try {
    if (game.settings.get(MODULE_ID, 'debugLogging')) {
      console.log(...args);
    }
  } catch (e) {
    // Setting may not be registered yet (e.g., during early init before settings are registered)
    // In that case, log anyway to avoid swallowing important startup messages
    console.log(...args);
  }
}

export { MODULE_ID, MODULE_TITLE, JE_DB_NAME, debugLog };
