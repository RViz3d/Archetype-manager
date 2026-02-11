/**
 * CompendiumParser - Parses archetype data from the pf1e-archetypes module
 *
 * Handles:
 * - Loading archetype list and features from compendium packs
 * - Regex parsing of level, replaces, modifies patterns from descriptions
 * - Feature name normalization for fuzzy matching
 * - UUID resolution for classAssociations entries
 * - Matching parsed text to classAssociations entries
 * - Merging JournalEntry fixes over automatic parse results
 */

import { MODULE_ID } from './module.mjs';
import { JournalEntryDB } from './journal-db.mjs';

export class CompendiumParser {
  // Regex patterns for parsing archetype feature descriptions
  static LEVEL_REGEX = /Level<\/strong>:\s*(\d+)/i;
  static REPLACES_REGEX = /replaces?\s+(.+?)\./i;
  static MODIFIES_REGEX = /modif(?:y|ies|ying)\s+(.+?)\./i;
  static AS_BUT_REGEX = /as the .+? (?:class feature|ability),?\s+but/i;

  /**
   * Check if the pf1e-archetypes module is available
   */
  static isModuleAvailable() {
    const module = game.modules.get('pf1e-archetypes');
    return module?.active ?? false;
  }

  /**
   * Load the archetype list from the compendium
   * @returns {Array} List of archetype documents
   */
  static async loadArchetypeList() {
    if (!this.isModuleAvailable()) {
      console.log(`${MODULE_ID} | pf1e-archetypes module not available, using JE-only mode`);
      return [];
    }

    try {
      const pack = game.packs.get('pf1e-archetypes.pf-archetypes');
      if (!pack) throw new Error('Could not access pf-archetypes pack');

      const documents = await pack.getDocuments();
      console.log(`${MODULE_ID} | Loaded ${documents.length} archetypes from compendium`);
      return documents;
    } catch (e) {
      console.error(`${MODULE_ID} | Failed to load archetype list:`, e);
      ui.notifications.error('Archetype Manager: Failed to load archetype compendium. Check that pf1e-archetypes module is enabled.');
      return [];
    }
  }

  /**
   * Load archetype features from the compendium
   * @returns {Array} List of feature documents
   */
  static async loadArchetypeFeatures() {
    if (!this.isModuleAvailable()) return [];

    try {
      const pack = game.packs.get('pf1e-archetypes.pf-arch-features');
      if (!pack) throw new Error('Could not access pf-arch-features pack');

      const documents = await pack.getDocuments();
      console.log(`${MODULE_ID} | Loaded ${documents.length} archetype features from compendium`);
      return documents;
    } catch (e) {
      console.error(`${MODULE_ID} | Failed to load archetype features:`, e);
      ui.notifications.error('Archetype Manager: Failed to load archetype features compendium.');
      return [];
    }
  }

  /**
   * Parse the level from a feature description
   * @param {string} description - HTML description text
   * @returns {number|null} The level number or null
   */
  static parseLevel(description) {
    const match = description?.match(this.LEVEL_REGEX);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Parse the replaced feature name from a description
   * @param {string} description - HTML description text
   * @returns {string|null} The replaced feature name or null
   */
  static parseReplaces(description) {
    const match = description?.match(this.REPLACES_REGEX);
    return match ? match[1].trim() : null;
  }

  /**
   * Parse the modified feature name from a description
   * @param {string} description - HTML description text
   * @returns {string|null} The modified feature name or null
   */
  static parseModifies(description) {
    const match = description?.match(this.MODIFIES_REGEX);
    return match ? match[1].trim() : null;
  }

  /**
   * Check if the description indicates an "as X but" variant
   * @param {string} description - HTML description text
   * @returns {boolean}
   */
  static isAsButVariant(description) {
    return this.AS_BUT_REGEX.test(description || '');
  }

  /**
   * Determine the type of an archetype feature
   * @param {string} description - HTML description text
   * @returns {object} { type: 'replacement'|'modification'|'additive', target: string|null }
   */
  static classifyFeature(description) {
    const replaces = this.parseReplaces(description);
    if (replaces) return { type: 'replacement', target: replaces };

    const modifies = this.parseModifies(description);
    if (modifies) return { type: 'modification', target: modifies };

    const level = this.parseLevel(description);
    if (level !== null) return { type: 'additive', target: null };

    return { type: 'unknown', target: null };
  }

  /**
   * Normalize a feature name for matching
   * Strips trailing tier numbers, parentheticals, and whitespace
   * @param {string} name - Feature name
   * @returns {string} Normalized name
   */
  static normalizeName(name) {
    if (!name) return '';
    return name
      .replace(/\s*\(.*?\)\s*/g, '')           // Remove parentheticals
      .replace(/\s+\d+\s*$/g, '')               // Remove trailing numbers (1, 2, etc.)
      .replace(/\s+(I{1,4}|IV|V|VI{0,3})\s*$/g, '') // Remove Roman numerals
      .trim()
      .toLowerCase();
  }

  /**
   * Resolve a UUID to a document name
   * @param {string} uuid - FoundryVTT UUID string
   * @returns {string|null} The resolved name or null
   */
  static async resolveUUID(uuid) {
    try {
      const doc = await fromUuid(uuid);
      return doc?.name ?? null;
    } catch (e) {
      console.warn(`${MODULE_ID} | Failed to resolve UUID: ${uuid}`, e);
      return null;
    }
  }

  /**
   * Resolve all UUIDs in a classAssociations array
   * Uses Promise.all for efficient batch resolution
   * @param {Array} associations - classAssociations array
   * @returns {Array} Associations with resolved names
   */
  static async resolveAssociations(associations) {
    if (!associations || associations.length === 0) return [];

    const resolvedNames = await Promise.all(
      associations.map(assoc => this.resolveUUID(assoc.uuid || assoc.id))
    );

    return associations.map((assoc, i) => ({
      ...assoc,
      resolvedName: resolvedNames[i]
    }));
  }

  /**
   * Match a parsed "replaces X" target against classAssociations entries
   * @param {string} target - The parsed replacement target
   * @param {Array} associations - Resolved classAssociations
   * @returns {object|null} The matched association entry
   */
  static matchTarget(target, associations) {
    const normalizedTarget = this.normalizeName(target);

    // Exact normalized match
    for (const assoc of associations) {
      if (this.normalizeName(assoc.resolvedName) === normalizedTarget) {
        return assoc;
      }
    }

    // Partial match (target contained in name or vice versa)
    for (const assoc of associations) {
      const normalizedName = this.normalizeName(assoc.resolvedName);
      if (normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName)) {
        return assoc;
      }
    }

    return null;
  }

  /**
   * Parse a full archetype, merging JE fixes over auto-parse results
   * @param {object} archetype - The archetype document
   * @param {Array} features - The archetype's features
   * @param {Array} baseAssociations - The base class classAssociations
   * @returns {object} Parsed archetype data with all features classified
   */
  static async parseArchetype(archetype, features, baseAssociations) {
    const slug = archetype.name.slugify();

    // Check JE for fixes first
    const jeFix = await JournalEntryDB.getArchetype(slug);

    const parsed = {
      name: archetype.name,
      slug,
      features: []
    };

    const resolvedAssociations = await this.resolveAssociations(baseAssociations);

    for (const feature of features) {
      const desc = feature.system?.description?.value || '';
      const featureSlug = feature.name.slugify();

      // Check JE fix for this specific feature
      if (jeFix?.features?.[featureSlug]) {
        parsed.features.push({
          name: feature.name,
          ...jeFix.features[featureSlug],
          source: 'je-fix'
        });
        continue;
      }

      // Auto-parse
      const level = this.parseLevel(desc);
      const classification = this.classifyFeature(desc);

      let matchedAssociation = null;
      if (classification.target) {
        matchedAssociation = this.matchTarget(classification.target, resolvedAssociations);
      }

      parsed.features.push({
        name: feature.name,
        level,
        type: classification.type,
        target: classification.target,
        matchedAssociation,
        description: desc,
        source: 'auto-parse',
        needsUserInput: classification.type === 'unknown' ||
          (classification.type === 'replacement' && !matchedAssociation)
      });
    }

    return parsed;
  }
}
