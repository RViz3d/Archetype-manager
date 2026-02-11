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
   * Open the archetype manager for the currently selected token
   */
  static async open() {
    // Validate a token is selected
    const token = canvas.tokens.controlled[0];
    if (!token) {
      ui.notifications.warn(`${MODULE_TITLE} | Please select a token first.`);
      return;
    }

    const actor = token.actor;
    if (!actor) {
      ui.notifications.warn(`${MODULE_TITLE} | Selected token has no actor.`);
      return;
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
