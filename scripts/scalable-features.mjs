/**
 * ScalableFeatures - Registry and splitting logic for PF1e scalable class features
 *
 * Handles:
 * - Registry of known scalable features per class (weapon training, armor training, etc.)
 * - Detection of scalable feature targets in archetype descriptions
 * - Splitting condensed features into individual tiers
 * - Series-level conflict detection for archetype stacking
 *
 * PF1e Rule Reference (Advanced Class Guide, p.74):
 * "A character can take more than one archetype and garner additional alternate class
 * features, but none of the alternate class features can replace or alter the same
 * class feature from the base class as the other alternate feature."
 *
 * Two archetypes that each touch ANY tier of the same feature series (e.g., both
 * touch Weapon Training, even at different tiers) are incompatible.
 */

import { MODULE_ID, debugLog } from './module.mjs';

export class ScalableFeatures {
  /**
   * Registry of known scalable features organized by class.
   * Each entry maps a normalized base name to its tier progression.
   * Reference: Archives of Nethys / d20pfsrd for PF1e class progressions.
   */
  static REGISTRY = {
    fighter: {
      'bravery': {
        baseName: 'Bravery',
        tiers: [
          { tier: 1, level: 2, name: 'Bravery' },
          { tier: 2, level: 6, name: 'Bravery' },
          { tier: 3, level: 10, name: 'Bravery' },
          { tier: 4, level: 14, name: 'Bravery' },
          { tier: 5, level: 18, name: 'Bravery' }
        ]
      },
      'armor training': {
        baseName: 'Armor Training',
        tiers: [
          { tier: 1, level: 3, name: 'Armor Training 1' },
          { tier: 2, level: 7, name: 'Armor Training 2' },
          { tier: 3, level: 11, name: 'Armor Training 3' },
          { tier: 4, level: 15, name: 'Armor Training 4' }
        ]
      },
      'weapon training': {
        baseName: 'Weapon Training',
        tiers: [
          { tier: 1, level: 5, name: 'Weapon Training 1' },
          { tier: 2, level: 9, name: 'Weapon Training 2' },
          { tier: 3, level: 13, name: 'Weapon Training 3' },
          { tier: 4, level: 17, name: 'Weapon Training 4' }
        ]
      }
    },
    rogue: {
      'sneak attack': {
        baseName: 'Sneak Attack',
        tiers: Array.from({ length: 10 }, (_, i) => ({
          tier: i + 1, level: 1 + i * 2, name: `Sneak Attack +${i + 1}d6`
        }))
      },
      'trap sense': {
        baseName: 'Trap Sense',
        tiers: [
          { tier: 1, level: 3, name: 'Trap Sense +1' },
          { tier: 2, level: 6, name: 'Trap Sense +2' },
          { tier: 3, level: 9, name: 'Trap Sense +3' },
          { tier: 4, level: 12, name: 'Trap Sense +4' },
          { tier: 5, level: 15, name: 'Trap Sense +5' },
          { tier: 6, level: 18, name: 'Trap Sense +6' }
        ]
      },
      'rogue talent': {
        baseName: 'Rogue Talent',
        tiers: Array.from({ length: 10 }, (_, i) => ({
          tier: i + 1, level: 2 + i * 2, name: `Rogue Talent`
        }))
      }
    },
    barbarian: {
      'rage power': {
        baseName: 'Rage Power',
        tiers: Array.from({ length: 10 }, (_, i) => ({
          tier: i + 1, level: 2 + i * 2, name: `Rage Power`
        }))
      },
      'trap sense': {
        baseName: 'Trap Sense',
        tiers: [
          { tier: 1, level: 3, name: 'Trap Sense +1' },
          { tier: 2, level: 6, name: 'Trap Sense +2' },
          { tier: 3, level: 9, name: 'Trap Sense +3' },
          { tier: 4, level: 12, name: 'Trap Sense +4' },
          { tier: 5, level: 15, name: 'Trap Sense +5' },
          { tier: 6, level: 18, name: 'Trap Sense +6' }
        ]
      },
      'damage reduction': {
        baseName: 'Damage Reduction',
        tiers: [
          { tier: 1, level: 7, name: 'Damage Reduction 1/-' },
          { tier: 2, level: 10, name: 'Damage Reduction 2/-' },
          { tier: 3, level: 13, name: 'Damage Reduction 3/-' },
          { tier: 4, level: 16, name: 'Damage Reduction 4/-' },
          { tier: 5, level: 19, name: 'Damage Reduction 5/-' }
        ]
      }
    },
    paladin: {
      'mercy': {
        baseName: 'Mercy',
        tiers: [
          { tier: 1, level: 3, name: 'Mercy' },
          { tier: 2, level: 6, name: 'Mercy' },
          { tier: 3, level: 9, name: 'Mercy' },
          { tier: 4, level: 12, name: 'Mercy' },
          { tier: 5, level: 15, name: 'Mercy' },
          { tier: 6, level: 18, name: 'Mercy' }
        ]
      },
      'smite evil': {
        baseName: 'Smite Evil',
        tiers: [
          { tier: 1, level: 1, name: 'Smite Evil' },
          { tier: 2, level: 4, name: 'Smite Evil' },
          { tier: 3, level: 7, name: 'Smite Evil' },
          { tier: 4, level: 10, name: 'Smite Evil' },
          { tier: 5, level: 13, name: 'Smite Evil' },
          { tier: 6, level: 16, name: 'Smite Evil' },
          { tier: 7, level: 19, name: 'Smite Evil' }
        ]
      }
    },
    ranger: {
      'favored enemy': {
        baseName: 'Favored Enemy',
        tiers: [
          { tier: 1, level: 1, name: 'Favored Enemy' },
          { tier: 2, level: 5, name: 'Favored Enemy' },
          { tier: 3, level: 10, name: 'Favored Enemy' },
          { tier: 4, level: 15, name: 'Favored Enemy' },
          { tier: 5, level: 20, name: 'Favored Enemy' }
        ]
      },
      'favored terrain': {
        baseName: 'Favored Terrain',
        tiers: [
          { tier: 1, level: 3, name: 'Favored Terrain' },
          { tier: 2, level: 8, name: 'Favored Terrain' },
          { tier: 3, level: 13, name: 'Favored Terrain' },
          { tier: 4, level: 18, name: 'Favored Terrain' }
        ]
      },
      'combat style feat': {
        baseName: 'Combat Style Feat',
        tiers: [
          { tier: 1, level: 2, name: 'Combat Style Feat' },
          { tier: 2, level: 6, name: 'Combat Style Feat' },
          { tier: 3, level: 10, name: 'Combat Style Feat' },
          { tier: 4, level: 14, name: 'Combat Style Feat' },
          { tier: 5, level: 18, name: 'Combat Style Feat' }
        ]
      }
    },
    monk: {
      'bonus feat': {
        baseName: 'Bonus Feat',
        tiers: [
          { tier: 1, level: 1, name: 'Bonus Feat' },
          { tier: 2, level: 2, name: 'Bonus Feat' },
          { tier: 3, level: 6, name: 'Bonus Feat' },
          { tier: 4, level: 10, name: 'Bonus Feat' },
          { tier: 5, level: 14, name: 'Bonus Feat' },
          { tier: 6, level: 18, name: 'Bonus Feat' }
        ]
      },
      'slow fall': {
        baseName: 'Slow Fall',
        tiers: [
          { tier: 1, level: 4, name: 'Slow Fall 20 ft.' },
          { tier: 2, level: 6, name: 'Slow Fall 30 ft.' },
          { tier: 3, level: 8, name: 'Slow Fall 40 ft.' },
          { tier: 4, level: 10, name: 'Slow Fall 50 ft.' },
          { tier: 5, level: 12, name: 'Slow Fall 60 ft.' },
          { tier: 6, level: 14, name: 'Slow Fall 70 ft.' },
          { tier: 7, level: 16, name: 'Slow Fall 80 ft.' },
          { tier: 8, level: 18, name: 'Slow Fall 90 ft.' },
          { tier: 9, level: 20, name: 'Slow Fall any distance' }
        ]
      }
    },
    bard: {
      'versatile performance': {
        baseName: 'Versatile Performance',
        tiers: [
          { tier: 1, level: 2, name: 'Versatile Performance' },
          { tier: 2, level: 6, name: 'Versatile Performance' },
          { tier: 3, level: 10, name: 'Versatile Performance' },
          { tier: 4, level: 14, name: 'Versatile Performance' },
          { tier: 5, level: 18, name: 'Versatile Performance' }
        ]
      }
    }
  };

  /**
   * Parse a feature target to detect if it references a scalable feature series.
   * Handles formats: "weapon training", "weapon training 3", "weapon training III",
   * "armor training 1", "bravery", etc.
   *
   * @param {string} target - The target text from "replaces X" parsing
   * @param {string} className - The class name
   * @returns {object|null} { baseName, tier (number|null), series } or null if not scalable
   */
  static parseTarget(target, className) {
    if (!target || !className) return null;
    const normalized = target.trim().toLowerCase();
    const classKey = className.toLowerCase();
    const classRegistry = this.REGISTRY[classKey];
    if (!classRegistry) return null;

    // Exact match: "weapon training", "bravery", etc.
    if (classRegistry[normalized]) {
      return { baseName: normalized, tier: null, series: classRegistry[normalized] };
    }

    // Try to extract tier number: "weapon training 3", "armor training 1"
    const tierMatch = normalized.match(/^(.+?)\s+(\d+)$/);
    if (tierMatch) {
      const baseName = tierMatch[1].trim();
      const tierNum = parseInt(tierMatch[2]);
      if (classRegistry[baseName]) {
        const series = classRegistry[baseName];
        if (tierNum >= 1 && tierNum <= series.tiers.length) {
          return { baseName, tier: tierNum, series };
        }
      }
    }

    // Try Roman numerals: "weapon training III"
    const romanMap = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10 };
    const romanMatch = normalized.match(/^(.+?)\s+(i{1,3}|iv|vi{0,3}|ix|x)$/i);
    if (romanMatch) {
      const baseName = romanMatch[1].trim();
      const tierNum = romanMap[romanMatch[2].toLowerCase()];
      if (tierNum && classRegistry[baseName]) {
        const series = classRegistry[baseName];
        if (tierNum >= 1 && tierNum <= series.tiers.length) {
          return { baseName, tier: tierNum, series };
        }
      }
    }

    // Partial/fuzzy match: "armor training" inside "armor training (heavy armor)"
    for (const [key, data] of Object.entries(classRegistry)) {
      if (normalized.startsWith(key) || key.startsWith(normalized)) {
        return { baseName: key, tier: null, series: data };
      }
    }

    return null;
  }

  /**
   * Get the series base name for a resolved association name.
   * e.g., "Weapon Training 2" -> "weapon training"
   * e.g., "Weapon Training" -> "weapon training"
   * e.g., "Armor Training" -> "armor training"
   * Returns null if not a recognized scalable feature.
   */
  static getSeriesBaseName(resolvedName, className) {
    if (!resolvedName || !className) return null;
    const normalized = resolvedName.trim().toLowerCase()
      .replace(/\s+\d+\s*$/, '')                    // Strip trailing numbers
      .replace(/\s+(i{1,3}|iv|vi{0,3}|ix|x)\s*$/i, '') // Strip Roman numerals
      .replace(/\s*\(.*?\)\s*$/, '')                 // Strip trailing parentheticals
      .trim();

    const classKey = className.toLowerCase();
    const classRegistry = this.REGISTRY[classKey];
    if (!classRegistry) return null;

    if (classRegistry[normalized]) return normalized;

    // Also check if the name starts with any known series name
    for (const key of Object.keys(classRegistry)) {
      if (normalized.startsWith(key) || normalized === key) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get the series data for a given base name and class.
   */
  static getSeries(baseName, className) {
    const classKey = className?.toLowerCase() || '';
    return this.REGISTRY[classKey]?.[baseName?.toLowerCase()] || null;
  }

  /**
   * Check if a resolved association name matches a known scalable feature.
   */
  static isScalable(resolvedName, className) {
    return this.getSeriesBaseName(resolvedName, className) !== null;
  }

  /**
   * Split a condensed scalable feature association into individual tier associations.
   * Used when a single classAssociation entry (e.g., "Weapon Training" at level 5)
   * needs to be split because an archetype targets a specific tier.
   *
   * @param {object} association - The condensed classAssociation { uuid, level, resolvedName }
   * @param {string} className - The class name
   * @returns {Array|null} Array of tier associations or null if not scalable
   */
  static splitIntoTiers(association, className) {
    if (!association) return null;
    const baseName = this.getSeriesBaseName(association.resolvedName || '', className);
    if (!baseName) return null;

    const series = this.getSeries(baseName, className);
    if (!series) return null;

    return series.tiers.map(tier => ({
      uuid: association.uuid,
      id: association.id,
      level: tier.level,
      resolvedName: tier.name,
      _originalUuid: association.uuid,
      _tier: tier.tier,
      _baseName: baseName,
      _isSplitTier: true
    }));
  }

  /**
   * Check if two archetype features conflict at the series level.
   * Per PF1e rules, two archetypes that both replace/alter ANY part of the same
   * feature series are incompatible, even if they target different tiers.
   *
   * @param {string} targetA - First feature's target (e.g., "weapon training 1")
   * @param {string} targetB - Second feature's target (e.g., "weapon training 3")
   * @param {string} className - The class name
   * @returns {object} { conflict: boolean, series: string|null }
   */
  static checkSeriesConflict(targetA, targetB, className) {
    if (!targetA || !targetB) return { conflict: false };

    const seriesA = this.getSeriesBaseName(targetA, className);
    const seriesB = this.getSeriesBaseName(targetB, className);

    if (seriesA && seriesB && seriesA === seriesB) {
      return {
        conflict: true,
        series: seriesA,
        seriesDisplayName: this.getSeries(seriesA, className)?.baseName || seriesA
      };
    }
    return { conflict: false };
  }

  /**
   * Build an expanded feature list for the custom archetype dialog dropdown.
   * Includes individual scalable tiers alongside regular features.
   *
   * @param {Array} resolvedAssociations - Resolved classAssociations with resolvedName
   * @param {string} className - The class name
   * @returns {Array} Features with scalable ones expanded to individual tiers
   */
  static getExpandedFeatureList(resolvedAssociations, className) {
    const result = [];
    const processedSeries = new Set();

    for (const assoc of resolvedAssociations) {
      const baseName = this.getSeriesBaseName(assoc.resolvedName || '', className);

      if (baseName && !processedSeries.has(baseName)) {
        processedSeries.add(baseName);
        const series = this.getSeries(baseName, className);
        if (series) {
          // Add "entire series" option
          result.push({
            ...assoc,
            displayName: `${series.baseName} (entire series)`,
            _isSeriesHeader: true,
            _baseName: baseName
          });
          // Add individual tiers
          for (const tier of series.tiers) {
            result.push({
              uuid: assoc.uuid,
              id: assoc.id,
              level: tier.level,
              resolvedName: tier.name,
              displayName: `  ${tier.name} (Lv ${tier.level})`,
              _isTier: true,
              _tier: tier.tier,
              _baseName: baseName
            });
          }
        }
      } else if (!baseName) {
        // Regular non-scalable feature
        result.push({
          ...assoc,
          displayName: `${assoc.resolvedName || assoc.uuid} (Lv ${assoc.level})`
        });
      }
      // Skip if this scalable feature's series was already processed
    }

    return result;
  }
}
