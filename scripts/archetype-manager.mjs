/**
 * ArchetypeManager - Main controller for archetype operations
 *
 * Coordinates between the UI, parser, diff engine, and applicator
 * to provide the full archetype management workflow.
 */

import { MODULE_ID, MODULE_TITLE } from './module.mjs';
import { UIManager } from './ui-manager.mjs';

export class ArchetypeManager {
  /**
   * Open the archetype manager for the given actor or currently selected token.
   * @param {Actor} [actorParam] - Optional actor to open the manager for.
   *   When provided, skips token selection validation and uses this actor directly.
   *   When omitted, falls back to the currently selected canvas token.
   */
  static async open(actorParam) {
    let actor;

    if (actorParam) {
      // Use the provided actor directly — skip token validation
      actor = actorParam;
    } else {
      // Fall back to token-based selection
      const token = canvas.tokens.controlled[0];
      if (!token) {
        ui.notifications.warn(`${MODULE_TITLE} | Please select a token first.`);
        return;
      }

      actor = token.actor;
      if (!actor) {
        ui.notifications.warn(`${MODULE_TITLE} | Selected token has no actor.`);
        return;
      }
    }

    // Permission check: players can only modify owned characters
    if (!game.user.isGM && !actor.isOwner) {
      ui.notifications.warn(`${MODULE_TITLE} | You do not have permission to modify this character.`);
      return;
    }

    // Validate actor has class items
    const classItems = actor.items.filter(i => i.type === 'class');
    if (classItems.length === 0) {
      ui.notifications.warn(`${MODULE_TITLE} | This actor has no class items. Add a class first.`);
      return;
    }

    // Open the main dialog
    await UIManager.showMainDialog(actor, classItems);
  }
}
