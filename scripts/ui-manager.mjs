/**
 * UIManager - Manages all dialog interfaces for the Archetype Manager
 *
 * Handles:
 * - Main archetype selection dialog
 * - Preview/diff dialog
 * - Confirmation dialogs
 * - On-the-fly fix dialog
 * - Description verification dialog
 * - Manual archetype entry dialog
 */

import { MODULE_ID, MODULE_TITLE } from './module.mjs';
import { CompendiumParser } from './compendium-parser.mjs';
import { DiffEngine } from './diff-engine.mjs';
import { Applicator } from './applicator.mjs';
import { JournalEntryDB } from './journal-db.mjs';

export class UIManager {
  static _processing = false;

  /**
   * Show the main archetype selection dialog
   * @param {Actor} actor - The actor
   * @param {Array} classItems - The actor's class items
   */
  static async showMainDialog(actor, classItems) {
    // Placeholder - full implementation to be built by coding agents
    const lastClass = game.settings.get(MODULE_ID, 'lastSelectedClass');

    ui.notifications.info(`${MODULE_TITLE} | Opening archetype manager for ${actor.name}`);

    // TODO: Implement full dialog UI
    console.log(`${MODULE_ID} | Main dialog would open here for actor:`, actor.name);
    console.log(`${MODULE_ID} | Class items:`, classItems.map(c => c.name));
  }

  /**
   * Show the preview/diff dialog
   * @param {Actor} actor - The actor
   * @param {Item} classItem - The class item
   * @param {object} parsedArchetype - Parsed archetype data
   * @param {Array} diff - The generated diff
   */
  static async showPreviewDialog(actor, classItem, parsedArchetype, diff) {
    // TODO: Implement preview dialog
    console.log(`${MODULE_ID} | Preview dialog for:`, parsedArchetype.name);
  }

  /**
   * Show a confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} content - Dialog content HTML
   * @returns {Promise<boolean>} Whether confirmed
   */
  static async showConfirmation(title, content) {
    return new Promise(resolve => {
      new Dialog({
        title: `${MODULE_TITLE} - ${title}`,
        content,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-check"></i>',
            label: 'Confirm',
            callback: () => resolve(true)
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
            callback: () => resolve(false)
          }
        },
        default: 'cancel',
        close: () => resolve(false)
      }).render(true);
    });
  }

  /**
   * Show the on-the-fly fix dialog for unresolved features
   * @param {object} feature - The unresolved feature
   * @param {Array} baseFeatures - Available base class features
   * @returns {Promise<object|null>} The user's selection or null if cancelled
   */
  static async showFixDialog(feature, baseFeatures) {
    // TODO: Implement fix dialog
    console.log(`${MODULE_ID} | Fix dialog for:`, feature.name);
    return null;
  }

  /**
   * Show the description verification dialog
   * @param {object} feature - The feature to verify
   * @returns {Promise<string|null>} Corrected description or null
   */
  static async showDescriptionVerifyDialog(feature) {
    // TODO: Implement description verification dialog
    console.log(`${MODULE_ID} | Description verify for:`, feature.name);
    return null;
  }

  /**
   * Show the manual archetype entry dialog
   * @param {string} defaultType - 'missing' or 'custom'
   * @returns {Promise<object|null>} The entered archetype data or null
   */
  static async showManualEntryDialog(defaultType = 'custom') {
    // TODO: Implement manual entry dialog
    console.log(`${MODULE_ID} | Manual entry dialog, type:`, defaultType);
    return null;
  }

  /**
   * Prevent double-click actions
   * @param {Function} fn - The function to guard
   */
  static async guardAction(fn) {
    if (this._processing) return;
    this._processing = true;
    try {
      await fn();
    } finally {
      this._processing = false;
    }
  }
}
