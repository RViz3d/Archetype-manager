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

import { MODULE_ID, debugLog } from './module.mjs';
import { JournalEntryDB } from './journal-db.mjs';
import { CompatibilityDB } from './compatibility-db.mjs';

export class CompendiumParser {
  // Regex patterns for parsing archetype feature descriptions
  static LEVEL_REGEX = /Level<\/strong>:\s*(\d+)/i;
  static REPLACES_REGEX = /replaces?\s+(.+?)\./i;
  static MODIFIES_REGEX = /modif(?:y|ies|ying)\s+(.+?)\./i;
  static AS_BUT_REGEX = /as the .+? (?:class feature|ability),?\s+but/i;

  /**
   * Get the configured compendium source module ID
   * @returns {string} The module ID for archetype data packs
   */
  static getCompendiumSource() {
    try {
      return game.settings.get(MODULE_ID, 'defaultCompendiumSource') || 'pf1e-archetypes';
    } catch (e) {
      // Setting may not be registered yet (e.g., during early init)
      return 'pf1e-archetypes';
    }
  }

  /**
   * Check if the compendium source module is available
   */
  static isModuleAvailable() {
    const source = this.getCompendiumSource();
    const module = game.modules.get(source);
    return module?.active ?? false;
  }

  /**
   * Load the archetype list from the compendium
   * @returns {Array} List of archetype documents
   */
  static async loadArchetypeList() {
    if (!this.isModuleAvailable()) {
      const source = this.getCompendiumSource();
      debugLog(`${MODULE_ID} | ${source} module not available, using JE-only mode`);
      return [];
    }

    try {
      const source = this.getCompendiumSource();
      const pack = game.packs.get(`${source}.pf-archetypes`);
      if (!pack) throw new Error(`Could not access ${source}.pf-archetypes pack`);

      const documents = await pack.getDocuments();
      debugLog(`${MODULE_ID} | Loaded ${documents.length} archetypes from ${source} compendium`);
      return documents;
    } catch (e) {
      console.error(`${MODULE_ID} | Failed to load archetype list:`, e);
      const source = this.getCompendiumSource();
      ui.notifications.error(`Archetype Manager: Failed to load archetype compendium. Check that ${source} module is enabled.`);
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
      const source = this.getCompendiumSource();
      const pack = game.packs.get(`${source}.pf-arch-features`);
      if (!pack) throw new Error(`Could not access ${source}.pf-arch-features pack`);

      const documents = await pack.getDocuments();
      debugLog(`${MODULE_ID} | Loaded ${documents.length} archetype features from ${source} compendium`);
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
      .replace(/\s*\(.*?\)\s*/g, ' ')           // Remove parentheticals (replace with space to preserve word boundaries)
      .replace(/\s+/g, ' ')                      // Collapse multiple spaces into one
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
    if (!target || !associations || associations.length === 0) return null;

    const normalizedTarget = this.normalizeName(target);
    if (!normalizedTarget) return null;

    // Pass 1: Exact case-insensitive match (preserves numbers/tiers)
    const lowerTarget = target.trim().toLowerCase();
    for (const assoc of associations) {
      if (!assoc.resolvedName) continue;
      if (assoc.resolvedName.trim().toLowerCase() === lowerTarget) {
        return assoc;
      }
    }

    // Pass 2: Normalized exact match (strips tiers/parentheticals for fuzzy matching)
    for (const assoc of associations) {
      if (!assoc.resolvedName) continue;
      if (this.normalizeName(assoc.resolvedName) === normalizedTarget) {
        return assoc;
      }
    }

    // Pass 3: Partial match (target contained in name or vice versa)
    for (const assoc of associations) {
      if (!assoc.resolvedName) continue;
      const normalizedName = this.normalizeName(assoc.resolvedName);
      if (!normalizedName) continue;
      if (normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName)) {
        return assoc;
      }
    }

    return null;
  }

  /**
   * Parse a full archetype, merging JE fixes over auto-parse results.
   * Priority chain: JE fixes > CompatibilityDB > Regex auto-parse > User prompt
   * @param {object} archetype - The archetype document
   * @param {Array} features - The archetype's features
   * @param {Array} baseAssociations - The base class classAssociations
   * @param {string} [className] - Class name for CompatibilityDB lookup
   * @returns {object} Parsed archetype data with all features classified
   */
  static async parseArchetype(archetype, features, baseAssociations, className) {
    const slug = archetype.name.slugify();
    const source = this.getCompendiumSource();

    // Check JE for fixes first
    const jeFix = await JournalEntryDB.getArchetype(slug);

    const parsed = {
      name: archetype.name,
      slug,
      features: []
    };

    const resolvedAssociations = await this.resolveAssociations(baseAssociations);

    // Load CompatibilityDB touchedRaw for this archetype (if available)
    const dbTouchedRaw = className
      ? CompatibilityDB.getTouchedRaw(className, slug)
      : null;

    if (dbTouchedRaw) {
      debugLog(`${MODULE_ID} | CompatibilityDB: "${archetype.name}" touches [${dbTouchedRaw.join(', ')}]`);
    }

    for (const feature of features) {
      const desc = feature.system?.description?.value || '';
      const featureSlug = feature.name.slugify();

      // Priority 1: JE fix for this specific feature
      if (jeFix?.features?.[featureSlug]) {
        parsed.features.push({
          name: feature.name,
          ...jeFix.features[featureSlug],
          uuid: feature.uuid || `Compendium.${source}.pf-arch-features.Item.${feature.id}`,
          source: 'je-fix'
        });
        continue;
      }

      // Priority 2+3: Regex auto-parse, then CompatibilityDB reclassification
      const level = this.parseLevel(desc);
      let classification = this.classifyFeature(desc);

      // Priority 2: If regex missed (additive/unknown) but DB knows this archetype touches
      // base features, try to match the feature name against touchedRaw entries
      if (dbTouchedRaw && (classification.type === 'additive' || classification.type === 'unknown')) {
        const dbTarget = this._matchFeatureToDbTouched(feature.name, archetype.name, dbTouchedRaw);
        if (dbTarget) {
          debugLog(`${MODULE_ID} | CompatibilityDB reclassified "${feature.name}" as replacement of "${dbTarget}"`);
          classification = { type: 'replacement', target: dbTarget };
        }
      }

      let matchedAssociation = null;
      if (classification.target) {
        matchedAssociation = this.matchTarget(classification.target, resolvedAssociations);
      }

      const featureSource = (dbTouchedRaw && classification.target) ? 'db-assisted' : 'auto-parse';

      parsed.features.push({
        name: feature.name,
        level,
        type: classification.type,
        target: classification.target,
        matchedAssociation,
        uuid: feature.uuid || `Compendium.${source}.pf-arch-features.Item.${feature.id}`,
        description: desc,
        source: featureSource,
        needsUserInput: classification.type === 'unknown' ||
          (classification.type === 'replacement' && !matchedAssociation)
      });
    }

    return parsed;
  }

  /**
   * Try to match an archetype feature name against the DB's touchedRaw list.
   * Strips the archetype short name from the feature name before matching.
   *
   * Example: Feature "Tribal Weapon Training (Tribal Fighter)" with touchedRaw
   * ["Weapon Training 1", ...] → matches "Weapon Training" series.
   *
   * @param {string} featureName - Full feature name (may include archetype in parens)
   * @param {string} archetypeName - Full archetype name like "Fighter (Tribal Fighter)"
   * @param {string[]} touchedRaw - Raw feature names from DB
   * @returns {string|null} The matched base feature name, or null
   * @private
   */
  static _matchFeatureToDbTouched(featureName, archetypeName, touchedRaw) {
    // Strip parenthetical (archetype name) from feature name
    // "Tribal Weapon Training (Tribal Fighter)" → "Tribal Weapon Training"
    const cleanName = featureName.replace(/\s*\(.*?\)\s*$/, '').trim();

    // Normalize for comparison
    const normalizedClean = this.normalizeName(cleanName);

    for (const rawTarget of touchedRaw) {
      const normalizedTarget = this.normalizeName(rawTarget);
      if (!normalizedTarget) continue;

      // Check if the DB target name is contained within the feature name
      // e.g., "tribal weapon training" contains "weapon training"
      if (normalizedClean.includes(normalizedTarget)) {
        return rawTarget;
      }

      // Check if normalized forms match
      if (normalizedClean === normalizedTarget) {
        return rawTarget;
      }
    }

    return null;
  }

  /**
   * Parse an archetype and prompt user for any unparseable features
   *
   * After auto-parsing, iterates over features flagged with needsUserInput=true.
   * For each, triggers a user prompt dialog (via the provided callback) to ask
   * the user to specify what the feature replaces (or mark it as additive).
   * If the user provides a fix, updates the feature data and saves to JE fixes.
   * If the user cancels, the feature remains flagged as needsUserInput.
   *
   * @param {object} archetype - The archetype document
   * @param {Array} features - The archetype's features
   * @param {Array} baseAssociations - The base class classAssociations
   * @param {object} options - Options
   * @param {Function} options.promptCallback - Async function(feature, baseFeatures) => user result or null
   *   Called for each feature that needs user input. Receives the feature data and
   *   a list of base class features (name, level, uuid). Should return an object
   *   with { level, replaces, isAdditive } or null if cancelled.
   * @param {string} options.className - The class name (for JE fix entry)
   * @returns {object} Parsed archetype data with all features resolved where possible
   */
  static async parseArchetypeWithPrompts(archetype, features, baseAssociations, options = {}) {
    const { promptCallback, className } = options;
    const parsed = await this.parseArchetype(archetype, features, baseAssociations, className);

    if (!promptCallback) return parsed;

    // Build base features list for dropdown (from resolved associations)
    const resolvedAssociations = await this.resolveAssociations(baseAssociations);
    const baseFeatures = resolvedAssociations
      .filter(a => a.resolvedName)
      .map(a => ({
        name: a.resolvedName,
        level: a.level,
        uuid: a.uuid || a.id
      }));

    // Iterate over features needing user input
    for (let i = 0; i < parsed.features.length; i++) {
      const feature = parsed.features[i];
      if (!feature.needsUserInput) continue;

      // Build prompt data
      const promptFeature = {
        name: feature.name,
        description: feature.description || '',
        level: feature.level,
        archetypeSlug: parsed.slug,
        archetypeName: parsed.name,
        className: className || ''
      };

      // Call the prompt callback (e.g., UIManager.showFixDialog)
      const result = await promptCallback(promptFeature, baseFeatures);

      if (result) {
        // User provided a fix - update the feature
        parsed.features[i] = {
          ...feature,
          level: result.level ?? feature.level,
          type: result.isAdditive ? 'additive' : 'replacement',
          target: result.replaces || null,
          needsUserInput: false,
          source: 'user-fix',
          userFixApplied: true
        };

        // If the user selected a replacement, try to match it
        if (result.replaces && !result.isAdditive) {
          const matched = this.matchTarget(result.replaces, resolvedAssociations);
          if (matched) {
            parsed.features[i].matchedAssociation = matched;
          }
        }
      }
      // If result is null (cancelled), feature stays as needsUserInput=true
    }

    return parsed;
  }
}
