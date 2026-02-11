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
   * Check if a new archetype can be applied given already-applied archetypes
   * Returns conflict info including whether application should be blocked
   * @param {object} newArchetypeData - Parsed archetype data with features array
   * @param {Array<object>} appliedArchetypeDataList - Array of parsed archetype data for already-applied archetypes
   * @returns {object} { canApply: boolean, conflicts: Array, blockedBy: Array<string> }
   */
  static checkCanApply(newArchetypeData, appliedArchetypeDataList) {
    const conflicts = this.checkAgainstApplied(newArchetypeData, appliedArchetypeDataList);
    const blockedBy = [...new Set(conflicts.map(c => {
      // The conflict has archetypeA and archetypeB - one is the new, one is applied
      // archetypeA comes from the first argument (new), archetypeB from applied
      return c.archetypeB || c.archetypeA;
    }))];

    return {
      canApply: conflicts.length === 0,
      conflicts,
      blockedBy
    };
  }

  /**
   * Validate multi-archetype stacking (checks all pairwise combinations)
   * @param {Array<object>} archetypeDataList - Array of parsed archetype data objects
   * @returns {object} { valid: boolean, conflicts: Array, conflictPairs: Array<[string,string]> }
   */
  static validateStacking(archetypeDataList) {
    const result = DiffEngine.validateStack(archetypeDataList);
    const conflictPairs = [];
    for (const conflict of result.conflicts) {
      const pair = [conflict.archetypeA, conflict.archetypeB].sort();
      const pairKey = pair.join('|');
      if (!conflictPairs.some(p => p.join('|') === pairKey)) {
        conflictPairs.push(pair);
      }
    }

    return {
      valid: result.valid,
      conflicts: result.conflicts,
      conflictPairs
    };
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
