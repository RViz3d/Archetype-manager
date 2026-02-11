/**
 * Applicator - Applies and removes archetype modifications to class items
 *
 * Handles:
 * - Backing up original classAssociations to flags
 * - Creating item copies for modified/partial features
 * - Swapping UUIDs in classAssociations
 * - Writing tracking flags on class items and actors
 * - Error rollback on failure
 * - Archetype removal and restoration
 */

import { MODULE_ID, MODULE_TITLE } from './module.mjs';
import { DiffEngine } from './diff-engine.mjs';
import { ConflictChecker } from './conflict-checker.mjs';

export class Applicator {
  // Guard flags for preventing double-click/concurrent operations
  static _applyInProgress = false;
  static _removeInProgress = false;

  /**
   * Apply an archetype to a class item
   * @param {Actor} actor - The actor document
   * @param {Item} classItem - The class item document
   * @param {object} parsedArchetype - Parsed archetype data
   * @param {Array} diff - The generated diff
   * @returns {boolean} Success or failure
   */
  static async apply(actor, classItem, parsedArchetype, diff) {
    // Prevent double-click: if already applying, reject immediately
    if (this._applyInProgress) {
      ui.notifications.warn(`${MODULE_TITLE} | Application already in progress. Please wait.`);
      return false;
    }

    this._applyInProgress = true;
    try {
      return await this._doApply(actor, classItem, parsedArchetype, diff);
    } finally {
      this._applyInProgress = false;
    }
  }

  /**
   * Internal apply implementation (called within the apply guard)
   * @private
   */
  static async _doApply(actor, classItem, parsedArchetype, diff) {
    const slug = parsedArchetype.slug;

    // Permission check: players can only modify owned characters
    if (!game.user.isGM && !actor.isOwner) {
      ui.notifications.error(`${MODULE_TITLE} | You do not have permission to modify this character.`);
      return false;
    }

    // Check for duplicate application
    const existingArchetypes = classItem.getFlag(MODULE_ID, 'archetypes') || [];
    if (existingArchetypes.includes(slug)) {
      ui.notifications.warn(`${parsedArchetype.name} is already applied to this class.`);
      return false;
    }

    // Validate class match - archetype must be for the correct class
    if (parsedArchetype.class) {
      if (!ConflictChecker.validateClass(parsedArchetype, classItem)) {
        const archetypeClass = parsedArchetype.class;
        const className = classItem.name;
        ui.notifications.error(
          `${MODULE_TITLE} | ${parsedArchetype.name} is a ${archetypeClass} archetype and cannot be applied to ${className}.`
        );
        return false;
      }
    }

    try {
      // Step 1: Backup original classAssociations (only if first archetype)
      if (existingArchetypes.length === 0) {
        const originalAssociations = foundry.utils.deepClone(
          classItem.system.links?.classAssociations || []
        );
        await classItem.setFlag(MODULE_ID, 'originalAssociations', originalAssociations);
      }

      // Step 2: Build new classAssociations from diff
      const newAssociations = this._buildNewAssociations(diff);

      // Step 3: Create item copies for modified features
      const createdItems = await this._createModifiedFeatureCopies(actor, parsedArchetype, diff);

      // Step 4: Update classAssociations
      await classItem.update({
        'system.links.classAssociations': newAssociations
      });

      // Step 5: Update tracking flags
      await classItem.setFlag(MODULE_ID, 'archetypes', [...existingArchetypes, slug]);
      await classItem.setFlag(MODULE_ID, 'appliedAt', new Date().toISOString());

      // Store parsed archetype data for selective removal rebuild
      const storedArchetypeData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData') || {};
      storedArchetypeData[slug] = foundry.utils.deepClone(parsedArchetype);
      await classItem.setFlag(MODULE_ID, 'appliedArchetypeData', storedArchetypeData);

      // Update actor-level quick lookup
      const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes') || {};
      const classTag = classItem.system.tag || classItem.name.slugify();
      actorArchetypes[classTag] = [...(actorArchetypes[classTag] || []), slug];
      await actor.setFlag(MODULE_ID, 'appliedArchetypes', actorArchetypes);

      // Step 6: Post chat message
      await this._postApplyMessage(actor, classItem, parsedArchetype, diff);

      ui.notifications.info(`${MODULE_TITLE} | Applied ${parsedArchetype.name} to ${classItem.name}`);
      return true;

    } catch (error) {
      console.error(`${MODULE_ID} | Error applying archetype:`, error);
      ui.notifications.error(`${MODULE_TITLE} | Failed to apply archetype. Rolling back changes.`);

      // Rollback
      await this._rollback(actor, classItem, slug);
      return false;
    }
  }

  /**
   * Remove an archetype from a class item
   * @param {Actor} actor - The actor document
   * @param {Item} classItem - The class item document
   * @param {string} slug - The archetype slug to remove
   * @returns {boolean} Success or failure
   */
  static async remove(actor, classItem, slug) {
    // Prevent double-click: if already removing, reject immediately
    if (this._removeInProgress) {
      ui.notifications.warn(`${MODULE_TITLE} | Removal already in progress. Please wait.`);
      return false;
    }

    this._removeInProgress = true;
    try {
      return await this._doRemove(actor, classItem, slug);
    } finally {
      this._removeInProgress = false;
    }
  }

  /**
   * Internal remove implementation (called within the remove guard)
   * @private
   */
  static async _doRemove(actor, classItem, slug) {
    // Permission check: players can only modify owned characters
    if (!game.user.isGM && !actor.isOwner) {
      ui.notifications.error(`${MODULE_TITLE} | You do not have permission to modify this character.`);
      return false;
    }

    try {
      const existingArchetypes = classItem.getFlag(MODULE_ID, 'archetypes') || [];
      if (!existingArchetypes.includes(slug)) {
        ui.notifications.warn('This archetype is not applied to this class.');
        return false;
      }

      // If this is the last archetype, restore from backup
      if (existingArchetypes.length === 1) {
        const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
        if (backup) {
          await classItem.update({
            'system.links.classAssociations': backup
          });
        }
        // Clean up all flags
        await classItem.unsetFlag(MODULE_ID, 'archetypes');
        await classItem.unsetFlag(MODULE_ID, 'originalAssociations');
        await classItem.unsetFlag(MODULE_ID, 'appliedAt');
        await classItem.unsetFlag(MODULE_ID, 'appliedArchetypeData');
      } else {
        // Selective removal - rebuild from remaining archetypes
        const remaining = existingArchetypes.filter(a => a !== slug);
        const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');

        if (backup) {
          // Rebuild classAssociations by re-applying remaining archetypes to the backup
          const rebuiltAssociations = await this._rebuildForRemainingArchetypes(
            backup, remaining, classItem
          );
          await classItem.update({
            'system.links.classAssociations': rebuiltAssociations
          });
        }

        await classItem.setFlag(MODULE_ID, 'archetypes', remaining);

        // Remove stored parsed data for the removed archetype
        const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData') || {};
        delete storedData[slug];
        await classItem.setFlag(MODULE_ID, 'appliedArchetypeData', storedData);
      }

      // Delete any item copies created for this archetype
      await this._deleteCreatedCopies(actor, slug);

      // Update actor flags
      const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes') || {};
      const classTag = classItem.system.tag || classItem.name.slugify();
      if (actorArchetypes[classTag]) {
        actorArchetypes[classTag] = actorArchetypes[classTag].filter(a => a !== slug);
        if (actorArchetypes[classTag].length === 0) {
          delete actorArchetypes[classTag];
        }
        await actor.setFlag(MODULE_ID, 'appliedArchetypes',
          Object.keys(actorArchetypes).length > 0 ? actorArchetypes : null
        );
      }

      // Post chat message
      await this._postRemoveMessage(actor, classItem, slug);

      ui.notifications.info(`${MODULE_TITLE} | Removed archetype from ${classItem.name}`);
      return true;

    } catch (error) {
      console.error(`${MODULE_ID} | Error removing archetype:`, error);
      ui.notifications.error(`${MODULE_TITLE} | Failed to remove archetype.`);
      return false;
    }
  }

  /**
   * Build new classAssociations array from diff
   * @private
   */
  static _buildNewAssociations(diff) {
    const associations = [];

    for (const entry of diff) {
      if (entry.status === 'unchanged') {
        associations.push(entry.original);
      } else if (entry.status === 'added' || entry.status === 'modified') {
        if (entry.archetypeFeature?.matchedAssociation) {
          associations.push({
            ...entry.archetypeFeature.matchedAssociation,
            level: entry.level
          });
        }
      }
      // 'removed' entries are excluded
    }

    return associations;
  }

  /**
   * Create item copies for modified features
   * @private
   */
  static async _createModifiedFeatureCopies(actor, parsedArchetype, diff) {
    const copiesToCreate = [];

    for (const entry of diff) {
      if (entry.status === 'modified' && entry.archetypeFeature) {
        copiesToCreate.push({
          name: `${entry.archetypeFeature.name} (${parsedArchetype.name})`,
          type: 'feat',
          system: {
            description: {
              value: `<p><strong>Modified by ${parsedArchetype.name}:</strong></p>` +
                     `<p>${entry.archetypeFeature.description || 'See archetype description.'}</p>`
            }
          },
          flags: {
            [MODULE_ID]: {
              createdByArchetype: parsedArchetype.slug,
              isModifiedCopy: true
            }
          }
        });
      }
    }

    if (copiesToCreate.length > 0) {
      return actor.createEmbeddedDocuments('Item', copiesToCreate);
    }
    return [];
  }

  /**
   * Delete item copies created by a specific archetype
   * @private
   */
  static async _deleteCreatedCopies(actor, slug) {
    const copies = actor.items.filter(
      i => i.getFlag(MODULE_ID, 'createdByArchetype') === slug
    );
    if (copies.length > 0) {
      await actor.deleteEmbeddedDocuments('Item', copies.map(c => c.id));
    }
  }

  /**
   * Rebuild classAssociations for remaining archetypes after selective removal
   * Starts from backup (original) and sequentially applies each remaining archetype's diff
   * @param {Array} backup - Original classAssociations from before any archetype was applied
   * @param {Array<string>} remainingSlugs - Slugs of archetypes that remain applied
   * @param {Item} classItem - The class item (to read stored archetype data from flags)
   * @returns {Array} Rebuilt classAssociations reflecting only remaining archetypes
   * @private
   */
  static async _rebuildForRemainingArchetypes(backup, remainingSlugs, classItem) {
    const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData') || {};
    let currentAssociations = foundry.utils.deepClone(backup);

    for (const remainingSlug of remainingSlugs) {
      const parsedArchetype = storedData[remainingSlug];
      if (!parsedArchetype || !parsedArchetype.features) continue;

      // Generate diff from current state for this archetype
      const diff = DiffEngine.generateDiff(currentAssociations, parsedArchetype);
      // Build new associations from diff
      currentAssociations = this._buildNewAssociations(diff);
    }

    return currentAssociations;
  }

  /**
   * Restore classAssociations from backup (emergency restore)
   * Used when classAssociations become corrupted and need to be restored to original state.
   * This removes ALL archetypes and restores the original classAssociations from backup.
   * @param {Actor} actor - The actor document
   * @param {Item} classItem - The class item document
   * @returns {object} { success: boolean, message: string, restoredCount: number }
   */
  static async restoreFromBackup(actor, classItem) {
    // Permission check
    if (!game.user.isGM && !actor.isOwner) {
      ui.notifications.error(`${MODULE_TITLE} | You do not have permission to modify this character.`);
      return { success: false, message: 'Permission denied', restoredCount: 0 };
    }

    const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
    if (!backup) {
      ui.notifications.warn(`${MODULE_TITLE} | No backup found. Cannot restore.`);
      return { success: false, message: 'No backup found', restoredCount: 0 };
    }

    try {
      // Restore original classAssociations from backup
      await classItem.update({
        'system.links.classAssociations': foundry.utils.deepClone(backup)
      });

      // Delete all archetype-created item copies
      const existingArchetypes = classItem.getFlag(MODULE_ID, 'archetypes') || [];
      for (const slug of existingArchetypes) {
        await this._deleteCreatedCopies(actor, slug);
      }

      // Clean up all archetype tracking flags
      await classItem.unsetFlag(MODULE_ID, 'archetypes');
      await classItem.unsetFlag(MODULE_ID, 'originalAssociations');
      await classItem.unsetFlag(MODULE_ID, 'appliedAt');
      await classItem.unsetFlag(MODULE_ID, 'appliedArchetypeData');

      // Clean up actor-level flags
      const classTag = classItem.system.tag || classItem.name.slugify();
      const actorArchetypes = actor.getFlag(MODULE_ID, 'appliedArchetypes') || {};
      if (actorArchetypes[classTag]) {
        delete actorArchetypes[classTag];
        await actor.setFlag(MODULE_ID, 'appliedArchetypes',
          Object.keys(actorArchetypes).length > 0 ? actorArchetypes : null
        );
      }

      ui.notifications.info(`${MODULE_TITLE} | Restored ${classItem.name} to original state (${backup.length} features).`);
      return { success: true, message: 'Restored successfully', restoredCount: backup.length };

    } catch (error) {
      console.error(`${MODULE_ID} | Error restoring from backup:`, error);
      ui.notifications.error(`${MODULE_TITLE} | Failed to restore from backup.`);
      return { success: false, message: error.message, restoredCount: 0 };
    }
  }

  /**
   * Rollback a failed application
   * @private
   */
  static async _rollback(actor, classItem, slug) {
    try {
      const backup = classItem.getFlag(MODULE_ID, 'originalAssociations');
      if (backup) {
        await classItem.update({
          'system.links.classAssociations': backup
        });
      }

      // Remove the archetype from tracking
      const archetypes = classItem.getFlag(MODULE_ID, 'archetypes') || [];
      await classItem.setFlag(MODULE_ID, 'archetypes', archetypes.filter(a => a !== slug));

      // Remove stored parsed data for the rolled-back archetype
      const storedData = classItem.getFlag(MODULE_ID, 'appliedArchetypeData') || {};
      delete storedData[slug];
      await classItem.setFlag(MODULE_ID, 'appliedArchetypeData',
        Object.keys(storedData).length > 0 ? storedData : null
      );

      // Delete any copies created during failed apply
      await this._deleteCreatedCopies(actor, slug);

      console.log(`${MODULE_ID} | Successfully rolled back archetype application`);
    } catch (e) {
      console.error(`${MODULE_ID} | Rollback also failed:`, e);
    }
  }

  /**
   * Post a chat message summarizing archetype application
   * @private
   */
  static async _postApplyMessage(actor, classItem, parsedArchetype, diff) {
    const replaced = diff.filter(d => d.status === 'removed').map(d => d.name);
    const added = diff.filter(d => d.status === 'added').map(d => d.name);
    const modified = diff.filter(d => d.status === 'modified').map(d => d.name);

    let content = `<h3>${MODULE_TITLE}</h3>`;
    content += `<p><strong>${parsedArchetype.name}</strong> applied to <strong>${actor.name}</strong>'s ${classItem.name}.</p>`;

    if (replaced.length) content += `<p><em>Replaced:</em> ${replaced.join(', ')}</p>`;
    if (added.length) content += `<p><em>Added:</em> ${added.join(', ')}</p>`;
    if (modified.length) content += `<p><em>Modified:</em> ${modified.join(', ')}</p>`;

    await ChatMessage.create({ content });
  }

  /**
   * Post a chat message confirming archetype removal
   * @private
   */
  static async _postRemoveMessage(actor, classItem, slug) {
    const content = `<h3>${MODULE_TITLE}</h3>` +
      `<p>Archetype <strong>${slug}</strong> removed from <strong>${actor.name}</strong>'s ${classItem.name}. ` +
      `Class features restored to original state.</p>`;

    await ChatMessage.create({ content });
  }
}
