/**
 * JournalEntryDB - Manages the JournalEntry-based archetype database
 *
 * Provides CRUD operations for three sections:
 * - fixes: Bugfix overrides for bad module data
 * - missing: Official archetypes not in the pf1e-archetypes module
 * - custom: Homebrew/world-specific archetypes
 *
 * Data is stored as JSON in JournalEntry pages.
 */

import { MODULE_ID, JE_DB_NAME } from './module.mjs';

export class JournalEntryDB {
  static SECTIONS = ['fixes', 'missing', 'custom'];

  /**
   * Ensure the database JournalEntry exists, creating it if needed
   */
  static async ensureDatabase() {
    let je = game.journal.getName(JE_DB_NAME);
    if (!je) {
      console.log(`${MODULE_ID} | Creating JournalEntry database: ${JE_DB_NAME}`);
      je = await JournalEntry.create({
        name: JE_DB_NAME,
        pages: this.SECTIONS.map(section => ({
          name: section,
          type: 'text',
          text: { content: '{}' }
        }))
      });
    }
    return je;
  }

  /**
   * Get the JournalEntry database document
   */
  static getDatabase() {
    return game.journal.getName(JE_DB_NAME);
  }

  /**
   * Read a section of the database, with corruption recovery
   * @param {string} section - 'fixes', 'missing', or 'custom'
   * @returns {object} The parsed JSON data
   */
  static async readSection(section) {
    if (!this.SECTIONS.includes(section)) {
      throw new Error(`Invalid section: ${section}. Must be one of: ${this.SECTIONS.join(', ')}`);
    }

    const je = this.getDatabase();
    if (!je) {
      await this.ensureDatabase();
      return {};
    }

    const page = je.pages.getName(section);
    if (!page) return {};

    try {
      const parsed = JSON.parse(page.text.content || '{}');
      // Ensure we always return a plain object (handles JSON null, arrays, primitives)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`${MODULE_ID} | Unexpected JSON type in ${section} section, resetting to empty object`);
        await page.update({ 'text.content': '{}' });
        return {};
      }
      return parsed;
    } catch (e) {
      console.warn(`${MODULE_ID} | Corrupted JSON in ${section} section, resetting to empty`);
      ui.notifications.warn(`Archetype Manager: Corrupted data in ${section} section was reset.`);
      await page.update({ 'text.content': '{}' });
      return {};
    }
  }

  /**
   * Write data to a section of the database
   * @param {string} section - 'fixes', 'missing', or 'custom'
   * @param {object} data - The data to write
   */
  static async writeSection(section, data) {
    if (!this.SECTIONS.includes(section)) {
      throw new Error(`Invalid section: ${section}`);
    }

    // Permission check: only GM can write to fixes and missing
    if ((section === 'fixes' || section === 'missing') && !game.user.isGM) {
      ui.notifications.error('Only the GM can modify the fixes and missing sections.');
      return false;
    }

    const je = this.getDatabase();
    if (!je) return false;

    const page = je.pages.getName(section);
    if (!page) return false;

    await page.update({ 'text.content': JSON.stringify(data, null, 2) });
    return true;
  }

  /**
   * Get a specific archetype entry from the database
   * @param {string} slug - The archetype slug
   * @returns {object|null} The archetype data and which section it came from
   */
  static async getArchetype(slug) {
    // Priority: fixes > missing > custom
    for (const section of ['fixes', 'missing', 'custom']) {
      const data = await this.readSection(section);
      if (data[slug]) {
        return { ...data[slug], _section: section };
      }
    }
    return null;
  }

  /**
   * Set an archetype entry in a specific section
   * @param {string} section - 'fixes', 'missing', or 'custom'
   * @param {string} slug - The archetype slug
   * @param {object} entry - The archetype data
   */
  static async setArchetype(section, slug, entry) {
    const data = await this.readSection(section);
    data[slug] = entry;
    return this.writeSection(section, data);
  }

  /**
   * Delete an archetype entry from a specific section
   * @param {string} section - 'fixes', 'missing', or 'custom'
   * @param {string} slug - The archetype slug
   */
  static async deleteArchetype(section, slug) {
    const data = await this.readSection(section);
    delete data[slug];
    return this.writeSection(section, data);
  }
}
