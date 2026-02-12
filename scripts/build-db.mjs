#!/usr/bin/env node
/**
 * build-db.mjs - Dev-only build script
 *
 * Fetches Archetype Crawler data and converts it to a normalized
 * archetype-db.json for use by the CompatibilityDB module.
 *
 * Usage: node scripts/build-db.mjs
 *
 * Input:
 *   - https://cbrayton.github.io/Archetype-Crawler/archetypedataCache.json
 *   - https://cbrayton.github.io/Archetype-Crawler/archetypepairCache.json
 *
 * Output:
 *   - data/archetype-db.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'archetype-db.json');

const DATA_URL = 'https://cbrayton.github.io/Archetype-Crawler/archetypedataCache.json';
const PAIR_URL = 'https://cbrayton.github.io/Archetype-Crawler/archetypepairCache.json';

// Known scalable feature series — used to normalize tiered features to base names.
// Mirrors the logic in ScalableFeatures.getSeriesBaseName() but runs at build time.
const SCALABLE_SERIES = {
  fighter: ['weapon training', 'armor training', 'bravery'],
  rogue: ['sneak attack', 'trapfinding', 'trap sense'],
  barbarian: ['rage power', 'damage reduction', 'trap sense'],
  paladin: ['mercy', 'smite evil'],
  ranger: ['favored enemy', 'favored terrain'],
  monk: ['bonus feat', 'ki pool'],
  bard: ['bardic performance', 'versatile performance', 'lore master']
};

// Known typos in the Crawler data
const TYPO_FIXES = {
  '6th-levle-level talent': '6th-level talent',
  '6th-levle-level hex': '6th-level hex',
  '12th-levle-level hex': '12th-level hex'
};

/**
 * Slugify a name (matches FoundryVTT's .slugify() behavior)
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fix known typos in feature names
 */
function fixTypos(name) {
  const lower = name.toLowerCase().trim();
  return TYPO_FIXES[lower] || name.trim();
}

/**
 * Get the normalized series base name for a feature, if it belongs to a scalable series.
 * E.g., "Weapon Training 3" → "weapon training", "Armor Training 1" → "armor training"
 */
function getSeriesBaseName(featureName, className) {
  const lower = featureName.toLowerCase().trim();
  const classKey = className.toLowerCase().trim();
  const seriesList = SCALABLE_SERIES[classKey];
  if (!seriesList) return null;

  for (const series of seriesList) {
    // Match "Series Name" or "Series Name N" (N = number or roman numeral)
    const pattern = new RegExp(`^${series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+|\\s+[iv]+)?$`, 'i');
    if (pattern.test(lower)) {
      return series;
    }
  }
  return null;
}

/**
 * Parse the Crawler's custom JSON structure.
 * Format: { "keys-0": [{ "key-0": "ClassName", "hash-1": { "keys-1": [{ "key-1": "ArchName", "set-2": [...] }] } }] }
 */
function parseCrawlerData(json) {
  const result = new Map(); // className -> Map(archetypeName -> featureArray)
  for (const classEntry of (json['keys-0'] || [])) {
    const className = classEntry['key-0'];
    const archetypes = new Map();
    for (const archEntry of (classEntry['hash-1']?.['keys-1'] || [])) {
      const archName = archEntry['key-1'];
      const features = archEntry['set-2'] || [];
      archetypes.set(archName, features);
    }
    result.set(className, archetypes);
  }
  return result;
}

/**
 * Build the normalized touched list (series base names, deduplicated)
 */
function buildTouchedList(rawFeatures, className) {
  const seen = new Set();
  for (const raw of rawFeatures) {
    // Split comma-separated composite entries
    // e.g., "2nd-level Bonus Feat, Armor Mastery, Weapon Mastery" → 3 entries
    const subEntries = raw.split(/,\s*/);
    for (const sub of subEntries) {
      const fixed = fixTypos(sub);
      const baseName = getSeriesBaseName(fixed, className);
      if (baseName) {
        seen.add(baseName);
      } else {
        // Non-scalable feature — normalize to lowercase trimmed
        seen.add(fixed.toLowerCase().trim());
      }
    }
  }
  return [...seen].sort();
}

async function main() {
  // Support both local files (passed as args) and remote fetch
  const args = process.argv.slice(2);
  let dataJson, pairJson;

  if (args.length === 2) {
    console.log(`Reading local files: ${args[0]}, ${args[1]}`);
    dataJson = JSON.parse(readFileSync(args[0], 'utf-8'));
    pairJson = JSON.parse(readFileSync(args[1], 'utf-8'));
  } else {
    console.log('Fetching Archetype Crawler data...');
    const [dataResp, pairResp] = await Promise.all([
      fetch(DATA_URL),
      fetch(PAIR_URL)
    ]);
    if (!dataResp.ok) throw new Error(`Failed to fetch archetypedataCache: ${dataResp.status}`);
    if (!pairResp.ok) throw new Error(`Failed to fetch archetypepairCache: ${pairResp.status}`);
    dataJson = await dataResp.json();
    pairJson = await pairResp.json();
  }

  console.log('Parsing data...');
  const dataMap = parseCrawlerData(dataJson);
  const pairMap = parseCrawlerData(pairJson);

  console.log(`Found ${dataMap.size} classes in archetypedataCache`);
  console.log(`Found ${pairMap.size} classes in archetypepairCache`);

  // Build normalized DB
  const db = {
    version: '1.0.0',
    source: 'Archetype Crawler (cbrayton)',
    generated: new Date().toISOString().split('T')[0],
    stats: { classes: 0, archetypes: 0 },
    classes: {}
  };

  let totalArchetypes = 0;

  for (const [className, archetypes] of dataMap) {
    const classKey = className.toLowerCase().trim();
    db.classes[classKey] = {};

    for (const [archName, rawFeatures] of archetypes) {
      const slug = slugify(archName);
      const fixedRaw = rawFeatures.flatMap(f =>
        f.split(/,\s*/).map(sub => fixTypos(sub))
      );
      const touched = buildTouchedList(rawFeatures, className);

      // Get compatible archetypes from pair data
      const classCompatMap = pairMap.get(className);
      const compatRaw = classCompatMap?.get(archName) || [];
      const compatible = compatRaw.map(name => slugify(name)).sort();

      db.classes[classKey][slug] = {
        name: archName,
        touched,
        touchedRaw: fixedRaw,
        compatible
      };
      totalArchetypes++;
    }
  }

  db.stats.classes = Object.keys(db.classes).length;
  db.stats.archetypes = totalArchetypes;

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(db, null, 2));
  console.log(`\nWrote ${OUTPUT_FILE}`);
  console.log(`  Classes: ${db.stats.classes}`);
  console.log(`  Archetypes: ${db.stats.archetypes}`);

  // Spot-check
  const fighter = db.classes['fighter'];
  if (fighter) {
    const thf = fighter['two-handed-fighter'];
    const wm = fighter['weapon-master'];
    console.log('\n--- Spot Check ---');
    if (thf) {
      console.log(`Two-Handed Fighter touched: [${thf.touched.join(', ')}]`);
      console.log(`Two-Handed Fighter compatible: [${thf.compatible.join(', ')}]`);
    }
    if (wm) {
      console.log(`Weapon Master touched: [${wm.touched.join(', ')}]`);
      console.log(`Weapon Master compatible: [${wm.compatible.join(', ')}]`);
    }
  }
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
