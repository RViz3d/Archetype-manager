/**
 * ConflictChecker - Validates archetype compatibility
 *
 * Handles:
 * - Conflict detection between archetypes (direct + series-level)
 * - Class validation
 * - Stacking validation per PF1e rules
 * - Cumulative replacement tracking
 * - Pre-computed conflict index for real-time UI feedback
 */

import { MODULE_ID } from './module.mjs';
import { DiffEngine } from './diff-engine.mjs';
import { CompendiumParser } from './compendium-parser.mjs';
import { ScalableFeatures } from './scalable-features.mjs';

export class ConflictChecker {
  /**
   * Check conflicts between a new archetype and already-applied archetypes.
   * Includes both direct target conflicts AND series-level conflicts.
   * @param {object} newArchetype - Parsed archetype data
   * @param {Array<object>} appliedArchetypes - Already applied parsed archetypes
   * @param {string} [className] - Class name for series-level conflict checking
   * @returns {Array} Conflict objects
   */
  static checkAgainstApplied(newArchetype, appliedArchetypes, className) {
    const conflicts = [];
    for (const applied of appliedArchetypes) {
      // Direct target conflicts (existing DiffEngine logic)
      conflicts.push(...DiffEngine.detectConflicts(newArchetype, applied));

      // Series-level conflicts (e.g., both touch Weapon Training at different tiers)
      if (className) {
        conflicts.push(...this._checkSeriesConflicts(newArchetype, applied, className));
      }
    }

    // Deduplicate conflicts
    return this._deduplicateConflicts(conflicts);
  }

  /**
   * Check series-level conflicts between two archetypes.
   * Two archetypes that both touch any tier of the same scalable feature series
   * are incompatible per PF1e rules, even if they target different tiers.
   * @private
   */
  static _checkSeriesConflicts(archetypeA, archetypeB, className) {
    const conflicts = [];
    const checkedPairs = new Set();

    for (const featureA of (archetypeA.features || [])) {
      if (!featureA.target) continue;
      for (const featureB of (archetypeB.features || [])) {
        if (!featureB.target) continue;

        // Skip if already covered by direct conflict detection
        const normalA = CompendiumParser.normalizeName(featureA.target);
        const normalB = CompendiumParser.normalizeName(featureB.target);
        if (normalA === normalB) continue;

        const pairKey = [normalA, normalB].sort().join('|');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const seriesCheck = ScalableFeatures.checkSeriesConflict(
          featureA.target, featureB.target, className
        );

        if (seriesCheck.conflict) {
          conflicts.push({
            featureName: seriesCheck.seriesDisplayName,
            archetypeA: archetypeA.name,
            featureA: featureA.name,
            archetypeB: archetypeB.name,
            featureB: featureB.name,
            isSeriesConflict: true,
            series: seriesCheck.series
          });
        }
      }
    }
    return conflicts;
  }

  /**
   * Deduplicate conflict entries (same feature pair between same archetype pair)
   * @private
   */
  static _deduplicateConflicts(conflicts) {
    const seen = new Set();
    return conflicts.filter(c => {
      const key = [c.archetypeA, c.archetypeB, c.featureName].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Check if a new archetype can be applied given already-applied archetypes
   * @param {object} newArchetypeData - Parsed archetype data with features array
   * @param {Array<object>} appliedArchetypeDataList - Already-applied parsed archetypes
   * @param {string} [className] - Class name for series-level checking
   * @returns {object} { canApply: boolean, conflicts: Array, blockedBy: Array<string> }
   */
  static checkCanApply(newArchetypeData, appliedArchetypeDataList, className) {
    const conflicts = this.checkAgainstApplied(newArchetypeData, appliedArchetypeDataList, className);
    const blockedBy = [...new Set(conflicts.map(c => c.archetypeB || c.archetypeA))];

    return {
      canApply: conflicts.length === 0,
      conflicts,
      blockedBy
    };
  }

  /**
   * Validate multi-archetype stacking (checks all pairwise combinations)
   * @param {Array<object>} archetypeDataList - Array of parsed archetype data objects
   * @param {string} [className] - Class name for series-level checking
   * @returns {object} { valid: boolean, conflicts: Array, conflictPairs: Array<[string,string]> }
   */
  static validateStacking(archetypeDataList, className) {
    // Use DiffEngine for basic target conflicts
    const result = DiffEngine.validateStack(archetypeDataList);

    // Add series-level conflicts
    if (className) {
      for (let i = 0; i < archetypeDataList.length; i++) {
        for (let j = i + 1; j < archetypeDataList.length; j++) {
          result.conflicts.push(
            ...this._checkSeriesConflicts(archetypeDataList[i], archetypeDataList[j], className)
          );
        }
      }
    }

    // Deduplicate
    const allConflicts = this._deduplicateConflicts(result.conflicts);
    const conflictPairs = [];
    for (const conflict of allConflicts) {
      const pair = [conflict.archetypeA, conflict.archetypeB].sort();
      const pairKey = pair.join('|');
      if (!conflictPairs.some(p => p.join('|') === pairKey)) {
        conflictPairs.push(pair);
      }
    }

    return {
      valid: allConflicts.length === 0,
      conflicts: allConflicts,
      conflictPairs
    };
  }

  /**
   * Get cumulative replacement tracking for a stack of archetypes.
   * Groups targets by series base name when applicable.
   * @param {Array<object>} archetypeDataList - Array of parsed archetype data objects
   * @param {string} [className] - Class name for series grouping
   * @returns {object} { replacements: Map, totalReplaced: number }
   */
  static getCumulativeReplacements(archetypeDataList, className) {
    const replacements = new Map();
    let totalReplaced = 0;

    for (const archetype of archetypeDataList) {
      for (const feature of (archetype.features || [])) {
        if (feature.target) {
          // Use series base name as key when available (groups all tiers together)
          const seriesBase = className
            ? ScalableFeatures.getSeriesBaseName(feature.target, className)
            : null;
          const key = seriesBase || CompendiumParser.normalizeName(feature.target);

          if (!replacements.has(key)) {
            replacements.set(key, []);
          }
          replacements.get(key).push({
            archetypeName: archetype.name,
            featureName: feature.name,
            type: feature.type,
            target: feature.target,
            isSeriesTarget: !!seriesBase
          });
          totalReplaced++;
        }
      }
    }

    return { replacements, totalReplaced };
  }

  /**
   * Validate adding an archetype to an existing stack
   * @param {object} newArchetypeData - The archetype to add
   * @param {Array<object>} existingStack - Currently stacked archetypes
   * @param {string} [className] - Class name for series checking
   * @returns {object} { valid, conflicts, conflictPairs, cumulative }
   */
  static validateAddToStack(newArchetypeData, existingStack, className) {
    const proposedStack = [...existingStack, newArchetypeData];
    const validation = this.validateStacking(proposedStack, className);
    const cumulative = this.getCumulativeReplacements(proposedStack, className);

    return {
      valid: validation.valid,
      conflicts: validation.conflicts,
      conflictPairs: validation.conflictPairs,
      cumulative
    };
  }

  /**
   * Validate removing an archetype from a stack
   * @param {string} slugToRemove - Slug of archetype to remove
   * @param {Array<object>} currentStack - Current full stack
   * @param {string} [className] - Class name for series checking
   * @returns {object} { valid, conflicts, remainingStack, cumulative }
   */
  static validateRemoveFromStack(slugToRemove, currentStack, className) {
    const remainingStack = currentStack.filter(a => a.slug !== slugToRemove);
    const validation = this.validateStacking(remainingStack, className);
    const cumulative = this.getCumulativeReplacements(remainingStack, className);

    return {
      valid: validation.valid,
      conflicts: validation.conflicts,
      remainingStack,
      cumulative
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

  /**
   * Build a pre-computed conflict index for all archetypes of a class.
   * Maps each archetype slug to the set of base feature series it touches.
   * Used for real-time incompatibility display in the selection UI.
   *
   * @param {Array} archetypeFeatures - All features from pf-arch-features pack (cached)
   * @param {Array} archetypeDataList - The filtered archetype list for the current class
   * @param {string} className - The class name
   * @returns {Map<string, Set<string>>} archetype slug -> Set of touched feature series/names
   */
  static buildConflictIndex(archetypeFeatures, archetypeDataList, className) {
    const index = new Map();
    const replaceRegex = /replaces?\s+(.+?)\./i;
    const modifyRegex = /modif(?:y|ies|ying)\s+(.+?)\./i;

    for (const archData of archetypeDataList) {
      const touched = new Set();

      // Extract short name from "Class (ArchetypeName)"
      const shortNameMatch = archData.name.match(/\((.+?)\)\s*$/);
      const shortName = shortNameMatch ? shortNameMatch[1].trim() : archData.name;

      // Find features belonging to this archetype
      const namePattern = `(${shortName})`;
      const matchingFeatures = archetypeFeatures.filter(f =>
        f.name && f.name.includes(namePattern)
      );

      for (const feature of matchingFeatures) {
        const desc = feature.system?.description?.value || '';

        // Extract targets from description
        const replaceMatch = desc.match(replaceRegex);
        const modifyMatch = desc.match(modifyRegex);
        const target = replaceMatch?.[1]?.trim() || modifyMatch?.[1]?.trim();

        if (target) {
          // Check if target is part of a scalable feature series
          const seriesBase = ScalableFeatures.getSeriesBaseName(target, className);
          touched.add(seriesBase || CompendiumParser.normalizeName(target));
        }
      }

      if (touched.size > 0) {
        index.set(archData.slug, touched);
      }
    }

    return index;
  }

  /**
   * Given a conflict index and a set of selected archetype slugs,
   * determine which other archetypes are incompatible.
   *
   * @param {Map<string, Set<string>>} conflictIndex - From buildConflictIndex()
   * @param {Set<string>} selectedSlugs - Currently selected archetype slugs
   * @param {Array<string>} appliedSlugs - Already applied archetype slugs
   * @returns {Map<string, string>} slug -> conflict reason (for graying out)
   */
  static getIncompatibleArchetypes(conflictIndex, selectedSlugs, appliedSlugs = []) {
    const incompatible = new Map();

    // Collect all touched features from selected + applied archetypes
    const activeTouched = new Map(); // feature -> archetype name that touches it
    const activeSet = new Set([...selectedSlugs, ...appliedSlugs]);

    for (const slug of activeSet) {
      const touched = conflictIndex.get(slug);
      if (!touched) continue;
      const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      for (const feature of touched) {
        if (!activeTouched.has(feature)) {
          activeTouched.set(feature, displayName);
        }
      }
    }

    // Check each non-active archetype for conflicts
    for (const [slug, touched] of conflictIndex) {
      if (activeSet.has(slug)) continue;

      for (const feature of touched) {
        if (activeTouched.has(feature)) {
          const conflictWith = activeTouched.get(feature);
          const displayFeature = feature.replace(/\b\w/g, l => l.toUpperCase());
          incompatible.set(slug, `Conflicts with ${conflictWith} over ${displayFeature}`);
          break; // One conflict reason is enough
        }
      }
    }

    return incompatible;
  }
}
