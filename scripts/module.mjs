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

  game.settings.register(MODULE_ID, 'entryPointLocation', {
    name: 'Entry Point Location',
    hint: 'Choose where the Archetype Manager button appears. "Actor Sheet Only" places it on character sheets, "Token HUD Only" places it on token right-click menus, and "Both" places it in both locations.',
    scope: 'world',
    config: true,
    type: String,
    default: 'both',
    choices: {
      'actor-sheet': 'Actor Sheet Only',
      'token-hud': 'Token HUD Only',
      'both': 'Both Actor Sheet and Token HUD'
    }
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
 * Inject "Archetypes" button into PF1e character sheets.
 *
 * Hooks into renderActorSheet to add an 'Archetypes' button near the class
 * section / features tab area. The button only appears on character-type actors
 * that have at least one class item. Clicking the button opens the Archetype Manager.
 */
Hooks.on('renderActorSheet', (app, html, data) => {
  // Check entryPointLocation setting — only inject if 'actor-sheet' or 'both'
  const entryPointLocation = game.settings.get(MODULE_ID, 'entryPointLocation');
  if (entryPointLocation !== 'actor-sheet' && entryPointLocation !== 'both') return;

  const actor = app.actor;
  if (!actor) return;

  // Only inject on character-type actors (not NPCs or other types unless they have class items)
  const actorType = actor.type ?? actor.data?.type;
  const classItems = actor.items?.filter?.(i => i.type === 'class') ?? [];

  // Skip if no class items — no archetypes to manage
  if (classItems.length === 0) return;

  // Prevent duplicate button injection on re-render
  // Safely handle jQuery-wrapped html (FoundryVTT may pass jQuery or raw element)
  const container = (typeof jQuery !== 'undefined' && html instanceof jQuery) ? html[0] : (html?.[0] ?? html);
  if (!container || typeof container.querySelector !== 'function') return;
  if (container.querySelector('.archetype-manager-sheet-btn')) return;

  // Create the Archetypes button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'archetype-manager-sheet-btn';
  btn.title = 'Open Archetype Manager';
  btn.innerHTML = '<i class="fas fa-hat-wizard"></i> Archetypes';

  // Attach click handler to open the Archetype Manager for this actor
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ArchetypeManager.open(actor);
  });

  // Find insertion point — look for common PF1e sheet areas near class features
  // Try multiple selectors in priority order for PF1e compatibility
  const insertionSelectors = [
    '.tab[data-tab="features"] .inventory-header',  // Features tab header
    '.tab[data-tab="features"] h3',                   // Features tab heading
    '.features .inventory-header',                     // Features section header
    '.class-features-header',                         // Class features header
    '.tab[data-tab="features"]',                       // Features tab container
    '.sheet-body'                                       // Fallback: sheet body
  ];

  let inserted = false;
  for (const selector of insertionSelectors) {
    const target = container.querySelector(selector);
    if (target) {
      // Insert the button as the first child or prepend to the target area
      target.insertBefore(btn, target.firstChild);
      inserted = true;
      break;
    }
  }

  // Last resort: append to the container itself
  if (!inserted) {
    container.appendChild(btn);
  }

  debugLog(`${MODULE_TITLE} | Archetypes button injected for ${actor.name}`);
});

/**
 * Inject "Archetypes" button into the Token HUD (right-click menu on tokens).
 *
 * Hooks into renderTokenHUD to add a button in the token HUD's button column.
 * The button only appears for tokens whose actors have at least one class item.
 * Clicking the button opens the Archetype Manager for the token's actor.
 * The button icon and styling matches FoundryVTT's native token HUD design.
 */
Hooks.on('renderTokenHUD', (hud, html, tokenData) => {
  // Check entryPointLocation setting — only inject if 'token-hud' or 'both'
  const entryPointLocation = game.settings.get(MODULE_ID, 'entryPointLocation');
  if (entryPointLocation !== 'token-hud' && entryPointLocation !== 'both') return;

  const token = hud.object;
  if (!token) return;

  const actor = token.actor;
  if (!actor) return;

  // Only show button if the actor has class items
  const classItems = actor.items?.filter?.(i => i.type === 'class') ?? [];
  if (classItems.length === 0) return;

  // Get the HTML container (handle jQuery-wrapped html)
  const container = (typeof jQuery !== 'undefined' && html instanceof jQuery) ? html[0] : (html?.[0] ?? html);
  if (!container || typeof container.querySelector !== 'function') return;

  // Prevent duplicate button injection
  if (container.querySelector('.archetype-manager-token-btn')) return;

  // Find the right column (.col.right) for the button — FoundryVTT token HUD convention
  const rightCol = container.querySelector('.col.right');
  if (!rightCol) return;

  // Create the HUD control button matching FoundryVTT's token HUD style
  const controlIcon = document.createElement('div');
  controlIcon.className = 'control-icon archetype-manager-token-btn';
  controlIcon.title = 'Archetype Manager';
  controlIcon.dataset.action = 'archetype-manager';

  // Use a hat-wizard icon consistent with the sheet button
  const icon = document.createElement('i');
  icon.className = 'fas fa-hat-wizard';
  controlIcon.appendChild(icon);

  // Attach click handler to open the Archetype Manager for this token's actor
  controlIcon.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ArchetypeManager.open(actor);
  });

  // Append to the right column
  rightCol.appendChild(controlIcon);

  debugLog(`${MODULE_TITLE} | Token HUD button injected for ${actor.name}`);
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
