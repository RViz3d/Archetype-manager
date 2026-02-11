/**
 * ConflictChecker - Validates archetype compatibility
 *
 * Re-exports conflict detection from DiffEngine for convenience.
 * Adds class validation and applied-archetype checking.
 */

import { MODULE_ID } from './module.mjs';
import { DiffEngine } from './diff-engine.mjs';
import { CompendiumParser } from './compendium-parser.mjs';

export class ConflictChecker {
  /**
   * Check conflicts between a new archetype and already-applied archetypes
   * @param {object} newArchetype - Parsed archetype data
   * @param {Array<object>} appliedArchetypes - Already applied parsed archetypes
   * @returns {Array} Conflict objects
   */
  static checkAgainstApplied(newArchetype, appliedArchetypes) {
    const conflicts = [];
    for (const applied of appliedArchetypes) {
      conflicts.push(...DiffEngine.detectConflicts(newArchetype, applied));
    }
    return conflicts;
  }

  /**
   * Validate that an archetype matches the target class
   * @param {object} archetype - Archetype data with class field
   * @param {Item} classItem - The PF1e class item
   * @returns {boolean}
   */
  static validateClass(archetype, classItem) {
    const archetypeClass = (archetype.class || '').toLowerCase().trim();
    const classTag = (classItem.system?.tag || '').toLowerCase().trim();
    const className = (classItem.name || '').toLowerCase().trim();

    return archetypeClass === classTag || archetypeClass === className;
  }
}
