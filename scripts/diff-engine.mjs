/**
 * DiffEngine - Generates and validates diffs between base and archetype classAssociations
 *
 * Handles:
 * - Generating side-by-side diff with status (add/remove/modify/unchanged)
 * - Scalable feature splitting (expanding condensed features into individual tiers)
 * - Conflict detection between archetypes
 * - Multi-archetype stacking validation
 * - Final state validation before application
 */

import { MODULE_ID } from './module.mjs';
import { CompendiumParser } from './compendium-parser.mjs';
import { ScalableFeatures } from './scalable-features.mjs';

export class DiffEngine {
  // Status types for diff entries
  static STATUS = {
    UNCHANGED: 'unchanged',
    REMOVED: 'removed',
    ADDED: 'added',
    MODIFIED: 'modified'
  };

  /**
   * Generate a diff between base classAssociations and archetype modifications.
   * Automatically handles scalable feature splitting when an archetype targets
   * a specific tier of a condensed feature.
   *
   * @param {Array} baseAssociations - Original classAssociations (resolved with resolvedName)
   * @param {object} parsedArchetype - Parsed archetype data from CompendiumParser
   * @param {string} [className] - Class name for scalable feature detection
   * @returns {Array} Diff entries with status, level, name, and details
   */
  static generateDiff(baseAssociations, parsedArchetype, className) {
    // Phase 1: Expand scalable features if needed
    const expandedBase = className
      ? this._expandScalableFeatures(baseAssociations, parsedArchetype, className)
      : baseAssociations;

    const diff = [];
    const replacedIndices = new Set();
    const addedFeatures = [];

    // Phase 2: Process each archetype feature against the (potentially expanded) base
    for (const feature of parsedArchetype.features) {
      if (feature.type === 'replacement' && feature.matchedAssociation) {
        // Find the base association index
        const matchUuid = feature.matchedAssociation.uuid;
        const matchId = feature.matchedAssociation.id;
        const matchLevel = feature.matchedAssociation.level;
        const baseIndex = expandedBase.findIndex(a => {
          // Match by UUID/ID AND level (important for split tiers sharing same UUID)
          const uuidMatch = (matchUuid && a.uuid === matchUuid) || (matchId && a.id === matchId);
          if (!uuidMatch) return false;
          // If matching a split tier, also match by level
          if (a._isSplitTier && matchLevel !== undefined) {
            return a.level === matchLevel;
          }
          return true;
        });
        if (baseIndex >= 0) {
          replacedIndices.add(baseIndex);
        }
        addedFeatures.push(feature);
      } else if (feature.type === 'modification') {
        const baseIndex = expandedBase.findIndex(
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

    // Phase 3: Build diff from (expanded) base associations
    for (let i = 0; i < expandedBase.length; i++) {
      const assoc = expandedBase[i];
      if (replacedIndices.has(i)) {
        diff.push({
          status: this.STATUS.REMOVED,
          level: assoc.level,
          name: assoc.resolvedName || assoc.uuid,
          original: assoc,
          _isSplitTier: assoc._isSplitTier || false
        });
      } else {
        diff.push({
          status: this.STATUS.UNCHANGED,
          level: assoc.level,
          name: assoc.resolvedName || assoc.uuid,
          original: assoc,
          _isSplitTier: assoc._isSplitTier || false
        });
      }
    }

    // Phase 4: Add archetype features
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
   * Expand condensed scalable features into individual tiers when an archetype
   * targets them. Only splits features that are actually targeted by the archetype.
   *
   * For example, if the base has a single "Weapon Training" at level 5 and the
   * archetype replaces "Weapon Training 3", this expands it to:
   *   Weapon Training 1 (lv5), Weapon Training 2 (lv9),
   *   Weapon Training 3 (lv13), Weapon Training 4 (lv17)
   *
   * @param {Array} baseAssociations - Original classAssociations
   * @param {object} parsedArchetype - Parsed archetype data
   * @param {string} className - Class name
   * @returns {Array} Expanded base associations
   * @private
   */
  static _expandScalableFeatures(baseAssociations, parsedArchetype, className) {
    // Determine which scalable series are targeted by the archetype
    const targetedSeries = new Set();
    for (const feature of (parsedArchetype.features || [])) {
      if (feature.target) {
        const baseName = ScalableFeatures.getSeriesBaseName(feature.target, className);
        if (baseName) targetedSeries.add(baseName);
      }
    }

    if (targetedSeries.size === 0) return baseAssociations;

    // Expand targeted scalable features
    const expanded = [];
    for (const assoc of baseAssociations) {
      const baseName = ScalableFeatures.getSeriesBaseName(
        assoc.resolvedName || '', className
      );

      if (baseName && targetedSeries.has(baseName)) {
        // This is a condensed scalable feature that needs splitting
        const tiers = ScalableFeatures.splitIntoTiers(assoc, className);
        if (tiers) {
          expanded.push(...tiers);
          continue;
        }
      }
      expanded.push(assoc);
    }

    return expanded;
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
