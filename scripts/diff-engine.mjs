/**
 * DiffEngine - Generates and validates diffs between base and archetype classAssociations
 *
 * Handles:
 * - Generating side-by-side diff with status (add/remove/modify/unchanged)
 * - Conflict detection between archetypes
 * - Multi-archetype stacking validation
 * - Scaling feature analysis (partial vs total replacement)
 * - Final state validation before application
 */

import { MODULE_ID } from './module.mjs';
import { CompendiumParser } from './compendium-parser.mjs';

export class DiffEngine {
  // Status types for diff entries
  static STATUS = {
    UNCHANGED: 'unchanged',
    REMOVED: 'removed',
    ADDED: 'added',
    MODIFIED: 'modified'
  };

  /**
   * Generate a diff between base classAssociations and archetype modifications
   * @param {Array} baseAssociations - Original classAssociations
   * @param {object} parsedArchetype - Parsed archetype data from CompendiumParser
   * @returns {Array} Diff entries with status, level, name, and details
   */
  static generateDiff(baseAssociations, parsedArchetype) {
    const diff = [];
    const replacedIndices = new Set();
    const addedFeatures = [];

    // Process each archetype feature
    for (const feature of parsedArchetype.features) {
      if (feature.type === 'replacement' && feature.matchedAssociation) {
        // Find the base association index
        const baseIndex = baseAssociations.findIndex(
          a => a.uuid === feature.matchedAssociation.uuid || a.id === feature.matchedAssociation.id
        );
        if (baseIndex >= 0) {
          replacedIndices.add(baseIndex);
        }
        addedFeatures.push(feature);
      } else if (feature.type === 'modification') {
        // Modifications don't remove the base, but mark it
        const baseIndex = baseAssociations.findIndex(
          a => a.uuid === feature.matchedAssociation?.uuid
        );
        if (baseIndex >= 0) {
          replacedIndices.add(baseIndex);
        }
        addedFeatures.push(feature);
      } else if (feature.type === 'additive') {
        addedFeatures.push(feature);
      }
    }

    // Build diff from base associations
    for (let i = 0; i < baseAssociations.length; i++) {
      const assoc = baseAssociations[i];
      if (replacedIndices.has(i)) {
        diff.push({
          status: this.STATUS.REMOVED,
          level: assoc.level,
          name: assoc.resolvedName || assoc.uuid,
          original: assoc
        });
      } else {
        diff.push({
          status: this.STATUS.UNCHANGED,
          level: assoc.level,
          name: assoc.resolvedName || assoc.uuid,
          original: assoc
        });
      }
    }

    // Add archetype features
    for (const feature of addedFeatures) {
      diff.push({
        status: feature.type === 'modification' ? this.STATUS.MODIFIED : this.STATUS.ADDED,
        level: feature.level,
        name: feature.name,
        archetypeFeature: feature
      });
    }

    // Sort by level
    diff.sort((a, b) => (a.level || 0) - (b.level || 0));

    return diff;
  }

  /**
   * Detect conflicts between two archetypes
   * @param {object} archetypeA - Parsed archetype A
   * @param {object} archetypeB - Parsed archetype B
   * @returns {Array} List of conflicting features
   */
  static detectConflicts(archetypeA, archetypeB) {
    const conflicts = [];

    const aTargets = new Map();
    for (const f of archetypeA.features) {
      if (f.target) {
        const normalized = CompendiumParser.normalizeName(f.target);
        aTargets.set(normalized, f);
      }
    }

    for (const f of archetypeB.features) {
      if (f.target) {
        const normalized = CompendiumParser.normalizeName(f.target);
        if (aTargets.has(normalized)) {
          conflicts.push({
            featureName: f.target,
            archetypeA: archetypeA.name,
            featureA: aTargets.get(normalized).name,
            archetypeB: archetypeB.name,
            featureB: f.name
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Validate a multi-archetype stack for conflicts
   * @param {Array} archetypes - Array of parsed archetypes
   * @returns {object} { valid: boolean, conflicts: Array }
   */
  static validateStack(archetypes) {
    const allConflicts = [];

    for (let i = 0; i < archetypes.length; i++) {
      for (let j = i + 1; j < archetypes.length; j++) {
        const conflicts = this.detectConflicts(archetypes[i], archetypes[j]);
        allConflicts.push(...conflicts);
      }
    }

    return {
      valid: allConflicts.length === 0,
      conflicts: allConflicts
    };
  }

  /**
   * Validate the final classAssociations state before application
   * @param {Array} finalAssociations - The proposed final classAssociations
   * @returns {object} { valid: boolean, errors: Array }
   */
  static validateFinalState(finalAssociations) {
    const errors = [];

    for (const assoc of finalAssociations) {
      if (!assoc.uuid && !assoc.id) {
        errors.push(`Entry at level ${assoc.level} has no UUID reference`);
      }
      if (assoc.level === undefined || assoc.level === null || assoc.level < 1) {
        errors.push(`Entry "${assoc.name || 'unknown'}" has invalid level: ${assoc.level}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
