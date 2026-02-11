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
   * Generate a slug from an archetype name
   * @param {string} name - The archetype name
   * @returns {string} URL-friendly slug
   */
  static _slugify(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate the HTML content for the manual entry dialog
   * @param {string} defaultType - 'missing' or 'custom'
   * @returns {string} HTML content
   */
  static _buildManualEntryHTML(defaultType = 'custom') {
    return `
      <form class="archetype-manual-entry" autocomplete="off">
        <div class="form-group">
          <label>Type:</label>
          <select name="entry-type" class="entry-type-select">
            <option value="missing" ${defaultType === 'missing' ? 'selected' : ''}>Official Missing</option>
            <option value="custom" ${defaultType === 'custom' ? 'selected' : ''}>Custom / Homebrew</option>
          </select>
        </div>
        <div class="form-group">
          <label>Archetype Name:</label>
          <input type="text" name="archetype-name" placeholder="e.g., Divine Tracker" required />
        </div>
        <div class="form-group">
          <label>Class:</label>
          <input type="text" name="archetype-class" placeholder="e.g., ranger" required />
        </div>
        <hr/>
        <h3 style="margin: 8px 0 4px;">Features</h3>
        <p style="font-size: 0.85em; color: #666; margin-bottom: 8px;">
          Add each feature this archetype grants. Specify what base class feature it replaces (if any).
        </p>
        <div class="feature-rows">
          <div class="feature-row" data-index="0">
            <input type="text" name="feat-name-0" placeholder="Feature name" style="flex:2" />
            <input type="number" name="feat-level-0" placeholder="Lvl" min="1" max="20" style="flex:0 0 50px; text-align:center" />
            <input type="text" name="feat-replaces-0" placeholder="Replaces (or blank)" style="flex:2" />
            <button type="button" class="remove-feature-btn" data-index="0" title="Remove" style="flex:0 0 30px; cursor:pointer;">✕</button>
          </div>
        </div>
        <button type="button" class="add-feature-btn" style="margin-top: 4px; cursor: pointer;">
          <i class="fas fa-plus"></i> Add Feature
        </button>
      </form>
    `;
  }

  /**
   * Validate the manual entry form data
   * @param {HTMLElement} html - The dialog HTML element
   * @returns {{valid: boolean, errors: string[], data: object|null}}
   */
  static _validateManualEntry(html) {
    const errors = [];

    const entryType = html.querySelector('[name="entry-type"]')?.value;
    const archetypeName = html.querySelector('[name="archetype-name"]')?.value?.trim();
    const archetypeClass = html.querySelector('[name="archetype-class"]')?.value?.trim();

    if (!archetypeName) errors.push('Archetype name is required.');
    if (!archetypeClass) errors.push('Class is required.');

    // Collect feature rows
    const featureRows = html.querySelectorAll('.feature-row');
    const features = {};
    const featureNames = new Set();
    let hasFeatures = false;

    for (const row of featureRows) {
      const idx = row.dataset.index;
      const name = html.querySelector(`[name="feat-name-${idx}"]`)?.value?.trim();
      const levelStr = html.querySelector(`[name="feat-level-${idx}"]`)?.value;
      const replaces = html.querySelector(`[name="feat-replaces-${idx}"]`)?.value?.trim();

      // Skip completely empty rows
      if (!name && !levelStr && !replaces) continue;

      if (!name) {
        errors.push(`Feature row ${parseInt(idx) + 1}: Name is required.`);
        continue;
      }

      const level = parseInt(levelStr);
      if (!levelStr || isNaN(level) || level < 1 || level > 20) {
        errors.push(`Feature "${name}": Level must be a number between 1 and 20.`);
        continue;
      }

      if (featureNames.has(name.toLowerCase())) {
        errors.push(`Duplicate feature name: "${name}".`);
        continue;
      }

      featureNames.add(name.toLowerCase());
      hasFeatures = true;

      const slug = this._slugify(name);
      features[slug] = {
        level,
        replaces: replaces || null,
        description: ''
      };
    }

    if (!hasFeatures) errors.push('At least one feature is required.');

    if (errors.length > 0) {
      return { valid: false, errors, data: null };
    }

    return {
      valid: true,
      errors: [],
      data: {
        type: entryType,
        slug: this._slugify(archetypeName),
        name: archetypeName,
        entry: {
          class: archetypeClass.toLowerCase(),
          features
        }
      }
    };
  }

  /**
   * Show the manual archetype entry dialog
   * @param {string} defaultType - 'missing' or 'custom'
   * @returns {Promise<object|null>} The entered archetype data or null
   */
  static async showManualEntryDialog(defaultType = 'custom') {
    // Permission check: only GM can add to 'missing' section
    if (defaultType === 'missing' && !game.user.isGM) {
      ui.notifications.error('Only the GM can add missing official archetypes.');
      return null;
    }

    const content = this._buildManualEntryHTML(defaultType);
    let featureCount = 1; // starts with 1 row (index 0)

    return new Promise(resolve => {
      const dialog = new Dialog({
        title: `${MODULE_TITLE} - Add Archetype`,
        content,
        buttons: {
          submit: {
            icon: '<i class="fas fa-save"></i>',
            label: 'Save',
            callback: async (html) => {
              const result = this._validateManualEntry(html[0] || html);

              if (!result.valid) {
                ui.notifications.error(`Validation errors:\n${result.errors.join('\n')}`);
                resolve(null);
                return;
              }

              // Save to the correct JE section
              const section = result.data.type;

              // Additional permission check for the actual section being saved to
              if (section === 'missing' && !game.user.isGM) {
                ui.notifications.error('Only the GM can add to the missing section.');
                resolve(null);
                return;
              }

              const success = await JournalEntryDB.setArchetype(
                section,
                result.data.slug,
                result.data.entry
              );

              if (success) {
                ui.notifications.info(
                  `${MODULE_TITLE} | Saved archetype "${result.data.name}" to ${section} section.`
                );
                resolve(result.data);
              } else {
                ui.notifications.error('Failed to save archetype entry.');
                resolve(null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
            callback: () => resolve(null)
          }
        },
        default: 'cancel',
        close: () => resolve(null),
        render: (html) => {
          const element = html[0] || html;

          // Add Feature button handler
          const addBtn = element.querySelector('.add-feature-btn');
          if (addBtn) {
            addBtn.addEventListener('click', () => {
              const idx = featureCount++;
              const rowsContainer = element.querySelector('.feature-rows');
              const newRow = document.createElement('div');
              newRow.className = 'feature-row';
              newRow.dataset.index = idx;
              newRow.innerHTML = `
                <input type="text" name="feat-name-${idx}" placeholder="Feature name" style="flex:2" />
                <input type="number" name="feat-level-${idx}" placeholder="Lvl" min="1" max="20" style="flex:0 0 50px; text-align:center" />
                <input type="text" name="feat-replaces-${idx}" placeholder="Replaces (or blank)" style="flex:2" />
                <button type="button" class="remove-feature-btn" data-index="${idx}" title="Remove" style="flex:0 0 30px; cursor:pointer;">✕</button>
              `;
              rowsContainer.appendChild(newRow);

              // Attach remove handler to new row
              newRow.querySelector('.remove-feature-btn').addEventListener('click', (e) => {
                e.preventDefault();
                newRow.remove();
              });
            });
          }

          // Attach remove handler to initial row
          const removeBtn = element.querySelector('.remove-feature-btn');
          if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
              e.preventDefault();
              const row = e.currentTarget.closest('.feature-row');
              // Don't remove if it's the only row
              const rows = element.querySelectorAll('.feature-row');
              if (rows.length > 1) {
                row.remove();
              } else {
                ui.notifications.warn('At least one feature row must remain.');
              }
            });
          }

          // If non-GM, disable the "Official Missing" option
          if (!game.user.isGM) {
            const typeSelect = element.querySelector('.entry-type-select');
            if (typeSelect) {
              const missingOption = typeSelect.querySelector('option[value="missing"]');
              if (missingOption) missingOption.disabled = true;
              typeSelect.value = 'custom';
            }
          }
        }
      }, { width: 550, classes: ['archetype-manager'] });

      dialog.render(true);
    });
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
