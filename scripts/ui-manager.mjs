/**
 * UIManager - Manages all dialog interfaces for the Archetype Manager
 *
 * Handles:
 * - Main archetype selection dialog
 * - Preview/diff dialog
 * - Confirmation dialogs
 * - On-the-fly fix dialog
 * - Description verification dialog
 * - Manual archetype entry dialog
 */

import { MODULE_ID, MODULE_TITLE } from './module.mjs';
import { CompendiumParser } from './compendium-parser.mjs';
import { DiffEngine } from './diff-engine.mjs';
import { ConflictChecker } from './conflict-checker.mjs';
import { Applicator } from './applicator.mjs';
import { JournalEntryDB } from './journal-db.mjs';

export class UIManager {
  static _processing = false;

  /**
   * Show the main archetype selection dialog
   * @param {Actor} actor - The actor
   * @param {Array} classItems - The actor's class items
   */
  static async showMainDialog(actor, classItems) {
    const lastClass = game.settings.get(MODULE_ID, 'lastSelectedClass');

    // Build class dropdown options
    const classOptions = classItems.map(c => {
      const level = c.system?.level ?? c.system?.levels ?? '?';
      const tag = c.system?.tag || c.name.slugify?.() || c.name.toLowerCase().replace(/\s+/g, '-');
      const isSelected = (lastClass && (lastClass === c.id || lastClass === tag)) ? 'selected' : '';
      return `<option value="${c.id}" data-tag="${tag}" ${isSelected}>${c.name} (Lv ${level})</option>`;
    }).join('');

    // If no lastClass selection matched, default to first class
    const hasSelection = classItems.some(c => {
      const tag = c.system?.tag || c.name.slugify?.() || c.name.toLowerCase().replace(/\s+/g, '-');
      return lastClass === c.id || lastClass === tag;
    });

    const content = `
      <div class="archetype-manager">
        <div class="form-group class-selector">
          <label><i class="fas fa-hat-wizard"></i> Select Class:</label>
          <select name="class-select" class="class-select">
            ${classOptions}
          </select>
        </div>

        <div class="search-container">
          <i class="fas fa-search"></i>
          <input type="text" name="archetype-search" class="archetype-search" placeholder="Search archetypes..." />
        </div>

        <div class="archetype-list-container">
          <div class="loading-indicator" style="display: none;">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading archetypes...</span>
          </div>
          <div class="archetype-list">
            <div class="empty-state">Select a class to view available archetypes</div>
          </div>
        </div>

        <div class="applied-archetypes-section" style="margin-top: 8px;">
          <h4 style="margin: 4px 0;"><i class="fas fa-check-circle" style="color: #080;"></i> Applied Archetypes</h4>
          <div class="applied-list" style="font-style: italic; color: #666;">None</div>
        </div>
      </div>
    `;

    // Store selectedArchetypes at dialog scope for button access
    let dialogSelectedArchetypes = new Set();
    let dialogArchetypeData = [];
    let dialogCurrentClassItem = null;
    let dialogAppliedArchetypeDataList = [];

    const dialogInstance = new Dialog({
      title: `${MODULE_TITLE} - ${actor.name}`,
      content,
      buttons: {
        applySelected: {
          icon: '<i class="fas fa-check-double"></i>',
          label: 'Apply Selected',
          callback: async () => {
            if (dialogSelectedArchetypes.size === 0) {
              ui.notifications.warn(`${MODULE_TITLE} | No archetypes selected. Click on archetypes to select them first.`);
              return;
            }

            // Build combined parsed data for selected archetypes
            const selectedParsedList = [...dialogSelectedArchetypes].map(slug => {
              const arch = dialogArchetypeData.find(a => a.slug === slug);
              return arch?.parsedData || { name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), slug, features: [] };
            });

            // Final stacking validation including applied
            const fullStack = [...dialogAppliedArchetypeDataList, ...selectedParsedList];
            const validation = ConflictChecker.validateStacking(fullStack);
            if (!validation.valid) {
              const conflictMsg = validation.conflicts.map(c => c.featureName).join(', ');
              ui.notifications.error(`${MODULE_TITLE} | Cannot apply: conflicts detected over ${conflictMsg}`);
              return;
            }

            // Generate combined diff preview
            const selectedNames = selectedParsedList.map(a => a.name).join(' + ');
            const combinedParsed = {
              name: selectedNames,
              slug: [...dialogSelectedArchetypes].join('+'),
              features: selectedParsedList.flatMap(a => a.features || [])
            };

            // Build combined diff from base associations
            const baseAssociations = dialogCurrentClassItem?.system?.links?.classAssociations || [];
            const combinedDiff = DiffEngine.generateDiff(baseAssociations, combinedParsed);

            // Show preview
            const result = await this.showPreviewConfirmFlow(
              actor, dialogCurrentClassItem, combinedParsed, combinedDiff
            );

            if (result === 'applied') {
              // Apply each archetype sequentially
              for (const parsed of selectedParsedList) {
                const diff = DiffEngine.generateDiff(
                  dialogCurrentClassItem?.system?.links?.classAssociations || [],
                  parsed
                );
                await Applicator.apply(actor, dialogCurrentClassItem, parsed, diff);
              }
            }
          }
        },
        addCustom: {
          icon: '<i class="fas fa-plus"></i>',
          label: 'Add Archetype',
          callback: async () => {
            await this.showManualEntryDialog('custom');
          }
        },
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Close',
          callback: () => {}
        }
      },
      default: 'close',
      render: (html) => {
        const element = html[0] || html;
        const classSelect = element.querySelector('.class-select');
        const searchInput = element.querySelector('.archetype-search');
        const archetypeListEl = element.querySelector('.archetype-list');
        const appliedListEl = element.querySelector('.applied-list');
        const loadingIndicator = element.querySelector('.loading-indicator');

        // State - local variables synced to dialog scope for button callback access
        let archetypeData = [];
        let currentClassItem = null;
        let appliedArchetypeDataList = [];
        let selectedArchetypes = dialogSelectedArchetypes;

        // Sync function: call after modifying local state
        const syncToDialogScope = () => {
          dialogArchetypeData.length = 0;
          dialogArchetypeData.push(...archetypeData);
          dialogCurrentClassItem = currentClassItem;
          dialogAppliedArchetypeDataList.length = 0;
          dialogAppliedArchetypeDataList.push(...appliedArchetypeDataList);
        };

        /**
         * Load archetypes for the selected class
         */
        const loadArchetypes = async () => {
          const selectedId = classSelect.value;
          currentClassItem = classItems.find(c => c.id === selectedId);
          if (!currentClassItem) return;

          // Save selection
          const classTag = currentClassItem.system?.tag || currentClassItem.name.slugify?.() || currentClassItem.name.toLowerCase().replace(/\s+/g, '-');
          game.settings.set(MODULE_ID, 'lastSelectedClass', selectedId);

          // Show loading
          if (loadingIndicator) loadingIndicator.style.display = 'flex';
          archetypeListEl.innerHTML = '';

          try {
            // Load archetypes from compendium
            const compendiumArchetypes = await CompendiumParser.loadArchetypeList();

            // Filter by class if possible (archetypes that match current class)
            const className = currentClassItem.name.toLowerCase();
            const classTag2 = classTag.toLowerCase();

            // Build combined list: compendium + JE missing + JE custom
            archetypeData = [];

            // Compendium archetypes (filtered by class)
            for (const arch of compendiumArchetypes) {
              // Archetype items in the pf1e-archetypes module may have class info in flags or system
              const archClass = (arch.system?.class || arch.flags?.['pf1e-archetypes']?.class || '').toLowerCase();
              // Include if class matches, or if we can't determine class (show all)
              if (!archClass || archClass === className || archClass === classTag2) {
                archetypeData.push({
                  name: arch.name,
                  slug: arch.name.slugify?.() || arch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  source: 'compendium',
                  class: archClass
                });
              }
            }

            // JE missing archetypes
            const missingData = await JournalEntryDB.readSection('missing');
            for (const [slug, entry] of Object.entries(missingData)) {
              if ((entry.class || '').toLowerCase() === className ||
                  (entry.class || '').toLowerCase() === classTag2) {
                archetypeData.push({
                  name: entry.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  slug,
                  source: 'missing',
                  class: entry.class
                });
              }
            }

            // JE custom archetypes
            const customData = await JournalEntryDB.readSection('custom');
            for (const [slug, entry] of Object.entries(customData)) {
              if ((entry.class || '').toLowerCase() === className ||
                  (entry.class || '').toLowerCase() === classTag2) {
                archetypeData.push({
                  name: entry.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  slug,
                  source: 'custom',
                  class: entry.class
                });
              }
            }

            // Sort alphabetically
            archetypeData.sort((a, b) => a.name.localeCompare(b.name));

            // Build parsed data for already-applied archetypes (for conflict checking)
            appliedArchetypeDataList = this._buildAppliedArchetypeData(currentClassItem, archetypeData);

          } catch (e) {
            console.error(`${MODULE_ID} | Error loading archetypes:`, e);
          }

          // Clear selections when class changes
          selectedArchetypes.clear();

          // Sync state to dialog scope for button callbacks
          syncToDialogScope();

          // Hide loading
          if (loadingIndicator) loadingIndicator.style.display = 'none';

          // Show applied archetypes
          updateAppliedList();

          // Render list
          renderArchetypeList();
        };

        /**
         * Update the applied archetypes display
         */
        const updateAppliedList = () => {
          if (!currentClassItem || !appliedListEl) return;
          const applied = currentClassItem.getFlag?.(MODULE_ID, 'archetypes') || [];
          if (applied.length === 0) {
            appliedListEl.innerHTML = '<span style="font-style: italic; color: #666;">None</span>';
          } else {
            appliedListEl.innerHTML = applied.map(slug => {
              const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              return `<span class="applied-archetype-tag" style="display:inline-block; background:rgba(0,128,0,0.1); border:1px solid #080; border-radius:3px; padding:2px 6px; margin:2px; font-size:0.9em;">
                <i class="fas fa-check" style="color:#080; margin-right:2px;"></i>${displayName}
              </span>`;
            }).join('');
          }
        };

        /**
         * Render the archetype list with optional search filter
         */
        const renderArchetypeList = () => {
          const searchTerm = (searchInput?.value || '').toLowerCase().trim();
          let filtered = archetypeData;

          if (searchTerm) {
            filtered = archetypeData.filter(a => a.name.toLowerCase().includes(searchTerm));
          }

          if (filtered.length === 0) {
            archetypeListEl.innerHTML = `<div class="empty-state">
              ${searchTerm ? 'No matching archetypes found' : 'No archetypes available for this class'}
            </div>`;
            return;
          }

          // Check applied archetypes
          const applied = currentClassItem?.getFlag?.(MODULE_ID, 'archetypes') || [];

          archetypeListEl.innerHTML = filtered.map(arch => {
            const isApplied = applied.includes(arch.slug);
            const isSelected = selectedArchetypes.has(arch.slug);
            const appliedClass = isApplied ? ' applied' : '';
            const selectedClass = isSelected ? ' selected' : '';
            const sourceIcon = arch.source === 'compendium' ? 'fa-book' :
                               arch.source === 'missing' ? 'fa-exclamation-triangle' : 'fa-user';
            const sourceLabel = arch.source === 'compendium' ? 'From compendium' :
                                arch.source === 'missing' ? 'Official (added manually)' : 'Custom/Homebrew';

            // Check conflicts against applied archetypes
            let conflictWarning = '';
            let hasConflict = false;
            if (!isApplied && arch.parsedData && appliedArchetypeDataList.length > 0) {
              const conflicts = ConflictChecker.checkAgainstApplied(arch.parsedData, appliedArchetypeDataList);
              if (conflicts.length > 0) {
                hasConflict = true;
                const conflictNames = conflicts.map(c => c.featureName).join(', ');
                conflictWarning = `<span class="status-icon conflict-warning" title="Conflicts with applied archetype(s): ${conflictNames}" style="color: #f80;">
                  <i class="fas fa-exclamation-triangle"></i>
                </span>`;
              }
            }

            return `<div class="archetype-item${appliedClass}${selectedClass}" data-slug="${arch.slug}" data-source="${arch.source}" data-has-conflict="${hasConflict}">
              <span class="archetype-name">${arch.name}</span>
              <span class="archetype-indicators">
                ${conflictWarning}
                ${isApplied ? '<span class="status-icon status-unchanged" title="Applied"><i class="fas fa-check-circle"></i></span>' : ''}
                <span class="status-icon" title="${sourceLabel}"><i class="fas ${sourceIcon}"></i></span>
                <button class="info-btn" data-slug="${arch.slug}" title="Info">
                  <i class="fas fa-info-circle"></i>
                </button>
              </span>
            </div>`;
          }).join('');

          // Add click handlers for archetype items
          archetypeListEl.querySelectorAll('.archetype-item').forEach(item => {
            item.addEventListener('click', (e) => {
              // Don't trigger on info button clicks
              if (e.target.closest('.info-btn')) return;

              const slug = item.dataset.slug;
              const hasConflict = item.dataset.hasConflict === 'true';
              const isApplied = item.classList.contains('applied');

              // Don't allow selecting already-applied archetypes
              if (isApplied) return;

              // Warn and block if conflict with applied archetypes
              if (hasConflict) {
                const arch = archetypeData.find(a => a.slug === slug);
                if (arch && arch.parsedData) {
                  const conflicts = ConflictChecker.checkAgainstApplied(arch.parsedData, appliedArchetypeDataList);
                  const conflictDetails = conflicts.map(c =>
                    `"${c.featureA}" (${c.archetypeA}) conflicts with "${c.featureB}" (${c.archetypeB}) over ${c.featureName}`
                  ).join('\n');
                  ui.notifications.warn(`${MODULE_TITLE} | Cannot select ${arch.name}: conflicts with applied archetype(s).\n${conflictDetails}`);
                } else {
                  ui.notifications.warn(`${MODULE_TITLE} | This archetype conflicts with an already-applied archetype.`);
                }
                return;
              }

              // Toggle multi-selection
              if (selectedArchetypes.has(slug)) {
                selectedArchetypes.delete(slug);
                item.classList.remove('selected');
              } else {
                // Check stacking conflicts with other selected archetypes
                const newArch = archetypeData.find(a => a.slug === slug);
                if (newArch?.parsedData && selectedArchetypes.size > 0) {
                  const selectedDataList = [...selectedArchetypes].map(s => {
                    const a = archetypeData.find(x => x.slug === s);
                    return a?.parsedData;
                  }).filter(Boolean);

                  const allToValidate = [...selectedDataList, ...appliedArchetypeDataList];
                  const conflicts = ConflictChecker.checkAgainstApplied(newArch.parsedData, allToValidate);

                  if (conflicts.length > 0) {
                    const conflictDetails = conflicts.map(c => c.featureName).join(', ');
                    ui.notifications.warn(`${MODULE_TITLE} | Cannot add ${newArch.name}: conflicts over ${conflictDetails}`);
                    return;
                  }
                }

                selectedArchetypes.add(slug);
                item.classList.add('selected');
              }
            });
          });

          // Add click handlers for info buttons
          archetypeListEl.querySelectorAll('.info-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const slug = btn.dataset.slug;
              const arch = archetypeData.find(a => a.slug === slug);
              if (arch) {
                ui.notifications.info(`${arch.name} (${arch.source})`);
              }
            });
          });
        };

        // Event listeners
        if (classSelect) {
          classSelect.addEventListener('change', () => {
            loadArchetypes();
          });
        }

        if (searchInput) {
          searchInput.addEventListener('input', () => {
            renderArchetypeList();
          });
        }

        // Initial load for the selected class
        if (classItems.length > 0) {
          loadArchetypes();
        }
      }
    }, {
      width: Math.min(500, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 100),
      height: 'auto',
      classes: ['archetype-manager-dialog'],
      resizable: true
    });

    dialogInstance.render(true);
  }

  /**
   * Show the preview/diff dialog
   * @param {Actor} actor - The actor
   * @param {Item} classItem - The class item
   * @param {object} parsedArchetype - Parsed archetype data
   * @param {Array} diff - The generated diff
   * @returns {Promise<string>} 'apply' to proceed, 'back' to go back, null if cancelled
   */
  static async showPreviewDialog(actor, classItem, parsedArchetype, diff) {
    const content = this._buildPreviewHTML(parsedArchetype, diff);

    return new Promise(resolve => {
      const dialog = new Dialog({
        title: `${MODULE_TITLE} - Preview: ${parsedArchetype.name}`,
        content,
        buttons: {
          apply: {
            icon: '<i class="fas fa-check"></i>',
            label: 'Apply',
            callback: () => resolve('apply')
          },
          back: {
            icon: '<i class="fas fa-arrow-left"></i>',
            label: 'Back',
            callback: () => resolve('back')
          }
        },
        default: 'back',
        close: () => resolve(null),
        render: (html) => {
          const element = html[0] || html;

          // Wire up editable level fields with validation
          const levelInputs = element.querySelectorAll('.preview-level-input');
          if (levelInputs) {
            levelInputs.forEach(input => {
              input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.index);
                if (isNaN(idx) || !diff[idx]) return;

                const validation = UIManager._validatePreviewLevel(input.value);

                if (!validation.valid) {
                  // Reject invalid value: reset to original and warn
                  input.value = diff[idx].level || '';
                  input.classList.add('invalid-level');
                  ui.notifications.warn(`${MODULE_TITLE} | ${validation.error}`);
                  return;
                }

                // Valid level: update diff and clear any error styling
                input.classList.remove('invalid-level');
                diff[idx].level = validation.level;
              });
            });
          }

          // Wire up info buttons for feature descriptions
          const infoBtns = element.querySelectorAll('.info-btn');
          if (infoBtns) {
            infoBtns.forEach(btn => {
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (isNaN(idx) || !diff[idx]) return;

                const entry = diff[idx];
                const feature = entry.archetypeFeature;
                if (!feature) return;

                const featureName = feature.name || entry.name || 'Unknown Feature';
                const description = feature.description || '<em>No description available</em>';
                const source = feature.source || 'compendium';
                const sourceLabel = source === 'custom' ? 'Custom/Homebrew' :
                                    source === 'missing' ? 'Official (manually added)' : 'Compendium Module';

                new Dialog({
                  title: `${MODULE_TITLE} - ${featureName}`,
                  content: `
                    <div class="feature-info-popup" style="padding: 4px;">
                      <h3 style="margin: 0 0 4px;">
                        <i class="fas fa-info-circle" style="color: #08f;"></i>
                        ${featureName}
                      </h3>
                      <p style="font-size: 0.85em; color: #666; margin: 0 0 8px;">
                        Source: ${sourceLabel} | Level: ${feature.level || '?'} | Type: ${feature.type || 'unknown'}
                      </p>
                      <div style="max-height: 250px; overflow-y: auto; padding: 8px; border: 1px solid #ddd; border-radius: 3px; background: rgba(0,0,0,0.03); font-size: 0.9em;">
                        ${description}
                      </div>
                    </div>
                  `,
                  buttons: {
                    ok: {
                      icon: '<i class="fas fa-check"></i>',
                      label: 'OK',
                      callback: () => {}
                    }
                  },
                  default: 'ok'
                }, { width: 450, classes: ['archetype-manager', 'archetype-info-popup'] }).render(true);
              });
            });
          }
        }
      }, {
        width: Math.min(550, (typeof window !== 'undefined' ? window.innerWidth : 1920) - 100),
        height: 'auto',
        classes: ['archetype-manager', 'archetype-preview-dialog'],
        resizable: true
      });

      dialog.render(true);
    });
  }

  /**
   * Build HTML content for the preview/diff dialog
   * @param {object} parsedArchetype - Parsed archetype data
   * @param {Array} diff - The generated diff
   * @returns {string} HTML content
   */
  static _buildPreviewHTML(parsedArchetype, diff) {
    const statusIcons = {
      unchanged: { icon: 'fa-check', color: '#080', label: 'Unchanged' },
      removed: { icon: 'fa-times', color: '#c00', label: 'Removed' },
      added: { icon: 'fa-plus', color: '#08f', label: 'Added' },
      modified: { icon: 'fa-pen', color: '#f80', label: 'Modified' }
    };

    const rows = (diff || []).map((entry, idx) => {
      const info = statusIcons[entry.status] || statusIcons.unchanged;
      const levelEditable = entry.status === 'added' || entry.status === 'modified';
      const hasDescription = entry.archetypeFeature && (entry.status === 'added' || entry.status === 'modified');

      return `<tr class="preview-row preview-${entry.status}">
        <td style="text-align:center;">
          <span class="status-icon" title="${info.label}" style="color:${info.color};">
            <i class="fas ${info.icon}"></i>
          </span>
        </td>
        <td>
          ${levelEditable
            ? `<input type="number" class="preview-level-input" data-index="${idx}" value="${entry.level || ''}" min="1" max="20" style="width:50px;text-align:center;" />`
            : `<span>${entry.level || '?'}</span>`
          }
        </td>
        <td>
          ${entry.name || 'Unknown'}
          ${hasDescription
            ? `<button class="info-btn" data-index="${idx}" title="Show description" style="border:none;background:none;cursor:pointer;color:#08f;padding:0 4px;"><i class="fas fa-info-circle"></i></button>`
            : ''
          }
        </td>
        <td style="font-size:0.85em;color:${info.color};">${info.label}</td>
      </tr>`;
    }).join('');

    return `
      <div class="archetype-preview-content">
        <h3 style="margin:0 0 8px;">
          <i class="fas fa-exchange-alt" style="color:#08f;"></i>
          ${parsedArchetype.name || 'Archetype Preview'}
        </h3>
        <p style="font-size:0.9em;color:#666;margin-bottom:8px;">
          Review the changes this archetype will make to class features.
          Editable levels can be adjusted before applying.
        </p>
        <table class="preview-diff-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #ccc;">
              <th style="width:40px;">Status</th>
              <th style="width:60px;">Level</th>
              <th>Feature</th>
              <th style="width:80px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" style="text-align:center;color:#666;padding:12px;">No changes detected</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Orchestrate the preview → confirm → apply flow with back navigation
   * @param {Actor} actor - The actor
   * @param {Item} classItem - The class item
   * @param {object} parsedArchetype - Parsed archetype data
   * @param {Array} diff - The generated diff
   * @returns {Promise<string>} 'applied', 'back-to-main', or null if cancelled at any point
   */
  static async showPreviewConfirmFlow(actor, classItem, parsedArchetype, diff) {
    let currentStep = 'preview';

    while (true) {
      if (currentStep === 'preview') {
        const previewResult = await this.showPreviewDialog(actor, classItem, parsedArchetype, diff);

        if (previewResult === 'back') {
          return 'back-to-main';
        } else if (previewResult === 'apply') {
          currentStep = 'confirm';
        } else {
          // null = closed/escaped
          return null;
        }
      } else if (currentStep === 'confirm') {
        const confirmed = await this.showConfirmation(
          'Apply Archetype',
          `<p>Are you sure you want to apply <strong>${parsedArchetype.name}</strong> to <strong>${classItem.name}</strong>?</p>
           <p>This will modify the class's feature associations. A backup will be saved for later removal.</p>`
        );

        if (confirmed) {
          return 'applied';
        } else {
          // Go back to preview
          currentStep = 'preview';
        }
      }
    }
  }

  /**
   * Show a confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} content - Dialog content HTML
   * @returns {Promise<boolean>} Whether confirmed
   */
  static async showConfirmation(title, content) {
    return new Promise(resolve => {
      new Dialog({
        title: `${MODULE_TITLE} - ${title}`,
        content,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-check"></i>',
            label: 'Confirm',
            callback: () => resolve(true)
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
            callback: () => resolve(false)
          }
        },
        default: 'cancel',
        close: () => resolve(false)
      }).render(true);
    });
  }

  /**
   * Show the on-the-fly fix dialog for unresolved features
   * @param {object} feature - The unresolved feature { name, description, level, archetypeSlug }
   * @param {Array} baseFeatures - Available base class features [{ name, level, uuid }]
   * @returns {Promise<object|null>} The user's selection or null if cancelled
   */
  static async showFixDialog(feature, baseFeatures) {
    const content = this._buildFixDialogHTML(feature, baseFeatures);

    return new Promise(resolve => {
      const dialog = new Dialog({
        title: `${MODULE_TITLE} - Fix: ${feature.name}`,
        content,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-check"></i>',
            label: 'Save Fix',
            callback: async (html) => {
              const element = html[0] || html;
              const result = this._parseFixDialogResult(element, feature);

              if (!result) {
                ui.notifications.error('Please select what this feature replaces, or mark it as additive.');
                resolve(null);
                return;
              }

              // Save to JE fixes section
              const fixEntry = {
                level: result.level,
                replaces: result.replaces,
                description: feature.description || ''
              };

              const archetypeSlug = feature.archetypeSlug || this._slugify(feature.archetypeName || feature.name);

              // Read existing fix data for this archetype, or create new
              const existingFix = await JournalEntryDB.getArchetype(archetypeSlug);
              const fixData = existingFix && existingFix._section === 'fixes'
                ? { class: existingFix.class || '', features: { ...existingFix.features } }
                : { class: feature.className || '', features: {} };

              const featureSlug = this._slugify(feature.name);
              fixData.features[featureSlug] = fixEntry;

              const success = await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData);

              if (success) {
                ui.notifications.info(`${MODULE_TITLE} | Saved fix for "${feature.name}" to fixes database.`);
                resolve(result);
              } else {
                ui.notifications.error('Failed to save fix entry.');
                resolve(null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
            callback: () => resolve(null)
          }
        },
        default: 'cancel',
        close: () => resolve(null),
        render: (html) => {
          const element = html[0] || html;

          // Wire up the additive checkbox to disable/enable dropdown
          const additiveCheckbox = element.querySelector('.fix-additive-checkbox');
          const replacesSelect = element.querySelector('.fix-replaces-select');

          if (additiveCheckbox && replacesSelect) {
            additiveCheckbox.addEventListener('change', () => {
              replacesSelect.disabled = additiveCheckbox.checked;
              if (additiveCheckbox.checked) {
                replacesSelect.value = '';
              }
            });
          }
        }
      }, { width: 500, classes: ['archetype-manager', 'archetype-fix-dialog'] });

      dialog.render(true);
    });
  }

  /**
   * Build the HTML content for the fix dialog
   * @param {object} feature - The unresolved feature
   * @param {Array} baseFeatures - Available base class features
   * @returns {string} HTML content
   */
  static _buildFixDialogHTML(feature, baseFeatures) {
    const featureName = feature.name || 'Unknown Feature';
    const featureDesc = feature.description || '<em>No description available</em>';
    const featureLevel = feature.level || '';

    // Build dropdown options from base class features
    const baseOptions = (baseFeatures || [])
      .sort((a, b) => (a.level || 0) - (b.level || 0))
      .map(bf => {
        const label = bf.name + (bf.level ? ` (Lv ${bf.level})` : '');
        return `<option value="${bf.name}">${label}</option>`;
      })
      .join('');

    return `
      <div class="archetype-fix-dialog-content">
        <div class="fix-feature-info" style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
          <h3 style="margin: 0 0 4px;"><i class="fas fa-puzzle-piece" style="color: #f80;"></i> ${featureName}</h3>
          <div class="fix-description" style="max-height: 150px; overflow-y: auto; font-size: 0.9em; color: #555; padding: 4px; border: 1px solid #ddd; border-radius: 3px; background: #fff;">
            ${featureDesc}
          </div>
        </div>

        <p style="font-size: 0.9em; color: #666; margin-bottom: 8px;">
          This feature could not be automatically parsed. Please specify what base class feature it replaces,
          or mark it as an additive feature (grants something new without replacing anything).
        </p>

        <div class="form-group" style="margin-bottom: 8px;">
          <label>Level:</label>
          <input type="number" class="fix-level-input" name="fix-level" value="${featureLevel}" min="1" max="20" style="width: 60px; text-align: center;" />
        </div>

        <div class="form-group" style="margin-bottom: 8px;">
          <label>Replaces:</label>
          <select class="fix-replaces-select" name="fix-replaces" style="width: 100%;">
            <option value="">-- Select base feature --</option>
            ${baseOptions}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 8px;">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" class="fix-additive-checkbox" name="fix-additive" />
            <span>This is an <strong>additive</strong> feature (does not replace anything)</span>
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Parse the result from the fix dialog
   * @param {HTMLElement} element - The dialog element
   * @param {object} feature - The original feature data
   * @returns {object|null} Parsed result or null if invalid
   */
  static _parseFixDialogResult(element, feature) {
    const levelInput = element.querySelector('.fix-level-input');
    const replacesSelect = element.querySelector('.fix-replaces-select');
    const additiveCheckbox = element.querySelector('.fix-additive-checkbox');

    const isAdditive = additiveCheckbox?.checked || false;
    const replaces = isAdditive ? null : (replacesSelect?.value || null);
    const levelStr = levelInput?.value;
    const level = levelStr ? parseInt(levelStr) : (feature.level || null);

    // Must either be additive or have a replaces selection
    if (!isAdditive && !replaces) {
      return null;
    }

    return {
      level: level,
      replaces: replaces,
      isAdditive: isAdditive,
      featureName: feature.name
    };
  }

  /**
   * Show the description verification dialog
   * Shows raw module description, allows corrections with auto-strip formatting
   * @param {object} feature - The feature to verify { name, description, archetypeSlug, className }
   * @returns {Promise<object|null>} { correctedDescription } or null if cancelled
   */
  static async showDescriptionVerifyDialog(feature) {
    const content = this._buildDescriptionVerifyHTML(feature);

    return new Promise(resolve => {
      const dialog = new Dialog({
        title: `${MODULE_TITLE} - Verify: ${feature.name}`,
        content,
        buttons: {
          save: {
            icon: '<i class="fas fa-save"></i>',
            label: 'Save Correction',
            callback: async (html) => {
              const element = html[0] || html;
              const textarea = element.querySelector('.desc-correction-textarea');
              const correctedDescription = textarea?.value?.trim() || '';

              if (!correctedDescription) {
                ui.notifications.error('Please enter a corrected description.');
                resolve(null);
                return;
              }

              // Save the corrected description to JE fixes
              const archetypeSlug = feature.archetypeSlug || this._slugify(feature.archetypeName || feature.name);
              const featureSlug = this._slugify(feature.name);

              // Read existing fix data or create new
              const existingFix = await JournalEntryDB.getArchetype(archetypeSlug);
              const fixData = existingFix && existingFix._section === 'fixes'
                ? { class: existingFix.class || '', features: { ...existingFix.features } }
                : { class: feature.className || '', features: {} };

              // Update or create the feature fix entry with corrected description
              if (!fixData.features[featureSlug]) {
                fixData.features[featureSlug] = {
                  level: feature.level || null,
                  replaces: feature.replaces || null,
                  description: correctedDescription
                };
              } else {
                fixData.features[featureSlug].description = correctedDescription;
              }

              const success = await JournalEntryDB.setArchetype('fixes', archetypeSlug, fixData);

              if (success) {
                ui.notifications.info(`${MODULE_TITLE} | Saved corrected description for "${feature.name}".`);
                resolve({ correctedDescription });
              } else {
                ui.notifications.error('Failed to save description correction.');
                resolve(null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
            callback: () => resolve(null)
          }
        },
        default: 'cancel',
        close: () => resolve(null),
        render: (html) => {
          const element = html[0] || html;

          // Set up paste handler to auto-strip HTML formatting
          const textarea = element.querySelector('.desc-correction-textarea');
          if (textarea) {
            textarea.addEventListener('paste', (e) => {
              e.preventDefault();
              // Get plain text from clipboard, stripping any HTML
              const clipboardData = e.clipboardData || window.clipboardData;
              let text = '';
              if (clipboardData) {
                // Prefer plain text
                text = clipboardData.getData('text/plain') || '';
                // If no plain text, try HTML and strip tags
                if (!text) {
                  const html = clipboardData.getData('text/html') || '';
                  text = this._stripHTML(html);
                }
              }
              // Insert at cursor position
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
              textarea.selectionStart = textarea.selectionEnd = start + text.length;
            });
          }
        }
      }, { width: 550, classes: ['archetype-manager', 'archetype-desc-verify-dialog'] });

      dialog.render(true);
    });
  }

  /**
   * Build HTML for the description verification dialog
   * @param {object} feature - The feature data
   * @returns {string} HTML content
   */
  static _buildDescriptionVerifyHTML(feature) {
    const featureName = feature.name || 'Unknown Feature';
    const rawDescription = feature.description || '<em>No description available</em>';

    return `
      <div class="archetype-desc-verify-content">
        <h3 style="margin: 0 0 8px;"><i class="fas fa-file-alt" style="color: #08f;"></i> ${featureName}</h3>

        <div class="form-group" style="margin-bottom: 12px;">
          <label><strong>Raw Module Description:</strong></label>
          <div class="desc-raw-display" style="max-height: 200px; overflow-y: auto; font-size: 0.9em; padding: 8px; border: 1px solid #ddd; border-radius: 3px; background: rgba(0,0,0,0.03);">
            ${rawDescription}
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 8px;">
          <label><strong>Corrected Description:</strong></label>
          <p style="font-size: 0.8em; color: #666; margin: 2px 0 4px;">
            Paste or type the corrected plain-text description below. HTML will be automatically stripped on paste.
          </p>
          <textarea class="desc-correction-textarea" name="corrected-description" rows="6"
            style="width: 100%; resize: vertical; font-family: monospace; font-size: 0.9em;"
            placeholder="Paste or type the corrected description here..."></textarea>
        </div>
      </div>
    `;
  }

  /**
   * Strip HTML tags from a string, preserving text content
   * @param {string} html - HTML string
   * @returns {string} Plain text
   */
  static _stripHTML(html) {
    if (!html) return '';
    // Use DOMParser if available, otherwise regex fallback
    if (typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
      } catch (e) {
        // Fallback to regex
      }
    }
    // Regex fallback
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  /**
   * Generate a slug from an archetype name
   * @param {string} name - The archetype name
   * @returns {string} URL-friendly slug
   */
  /**
   * Validate a level value for the preview dialog
   * @param {string|number} value - The level value to validate
   * @returns {{ valid: boolean, level: number|null, error: string|null }}
   */
  static _validatePreviewLevel(value) {
    const str = String(value ?? '').trim();
    if (!str || str === '') {
      return { valid: false, level: null, error: 'Level is required.' };
    }
    const level = parseInt(str);
    if (isNaN(level)) {
      return { valid: false, level: null, error: 'Level must be a number.' };
    }
    if (level < 1) {
      return { valid: false, level: null, error: 'Level must be at least 1.' };
    }
    if (level > 20) {
      return { valid: false, level: null, error: 'Level must be at most 20.' };
    }
    return { valid: true, level, error: null };
  }

  static _slugify(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate the HTML content for the manual entry dialog
   * @param {string} defaultType - 'missing' or 'custom'
   * @returns {string} HTML content
   */
  static _buildManualEntryHTML(defaultType = 'custom') {
    return `
      <form class="archetype-manual-entry" autocomplete="off">
        <div class="form-group">
          <label>Type:</label>
          <select name="entry-type" class="entry-type-select">
            <option value="missing" ${defaultType === 'missing' ? 'selected' : ''}>Official Missing</option>
            <option value="custom" ${defaultType === 'custom' ? 'selected' : ''}>Custom / Homebrew</option>
          </select>
        </div>
        <div class="form-group">
          <label>Archetype Name:</label>
          <input type="text" name="archetype-name" placeholder="e.g., Divine Tracker" required />
        </div>
        <div class="form-group">
          <label>Class:</label>
          <input type="text" name="archetype-class" placeholder="e.g., ranger" required />
        </div>
        <hr/>
        <h3 style="margin: 8px 0 4px;">Features</h3>
        <p style="font-size: 0.85em; color: #666; margin-bottom: 8px;">
          Add each feature this archetype grants. Specify what base class feature it replaces (if any).
        </p>
        <div class="feature-rows">
          <div class="feature-row" data-index="0">
            <input type="text" name="feat-name-0" placeholder="Feature name" style="flex:2" />
            <input type="number" name="feat-level-0" placeholder="Lvl" min="1" max="20" style="flex:0 0 50px; text-align:center" />
            <input type="text" name="feat-replaces-0" placeholder="Replaces (or blank)" style="flex:2" />
            <button type="button" class="remove-feature-btn" data-index="0" title="Remove" style="flex:0 0 30px; cursor:pointer;">✕</button>
          </div>
        </div>
        <button type="button" class="add-feature-btn" style="margin-top: 4px; cursor: pointer;">
          <i class="fas fa-plus"></i> Add Feature
        </button>
      </form>
    `;
  }

  /**
   * Validate the manual entry form data
   * @param {HTMLElement} html - The dialog HTML element
   * @returns {{valid: boolean, errors: string[], data: object|null}}
   */
  static _validateManualEntry(html) {
    const errors = [];

    const entryType = html.querySelector('[name="entry-type"]')?.value;
    const archetypeName = html.querySelector('[name="archetype-name"]')?.value?.trim();
    const archetypeClass = html.querySelector('[name="archetype-class"]')?.value?.trim();

    if (!archetypeName) errors.push('Archetype name is required.');
    if (!archetypeClass) errors.push('Class is required.');

    // Collect feature rows
    const featureRows = html.querySelectorAll('.feature-row');
    const features = {};
    const featureNames = new Set();
    let hasFeatures = false;

    for (const row of featureRows) {
      const idx = row.dataset.index;
      const name = html.querySelector(`[name="feat-name-${idx}"]`)?.value?.trim();
      const levelStr = html.querySelector(`[name="feat-level-${idx}"]`)?.value;
      const replaces = html.querySelector(`[name="feat-replaces-${idx}"]`)?.value?.trim();

      // Skip completely empty rows
      if (!name && !levelStr && !replaces) continue;

      if (!name) {
        errors.push(`Feature row ${parseInt(idx) + 1}: Name is required.`);
        continue;
      }

      const level = parseInt(levelStr);
      if (!levelStr || isNaN(level) || level < 1 || level > 20) {
        errors.push(`Feature "${name}": Level must be a number between 1 and 20.`);
        continue;
      }

      if (featureNames.has(name.toLowerCase())) {
        errors.push(`Duplicate feature name: "${name}".`);
        continue;
      }

      featureNames.add(name.toLowerCase());
      hasFeatures = true;

      const slug = this._slugify(name);
      features[slug] = {
        level,
        replaces: replaces || null,
        description: ''
      };
    }

    if (!hasFeatures) errors.push('At least one feature is required.');

    if (errors.length > 0) {
      return { valid: false, errors, data: null };
    }

    return {
      valid: true,
      errors: [],
      data: {
        type: entryType,
        slug: this._slugify(archetypeName),
        name: archetypeName,
        entry: {
          class: archetypeClass.toLowerCase(),
          features
        }
      }
    };
  }

  /**
   * Show the manual archetype entry dialog
   * @param {string} defaultType - 'missing' or 'custom'
   * @returns {Promise<object|null>} The entered archetype data or null
   */
  static async showManualEntryDialog(defaultType = 'custom') {
    // Permission check: only GM can add to 'missing' section
    if (defaultType === 'missing' && !game.user.isGM) {
      ui.notifications.error('Only the GM can add missing official archetypes.');
      return null;
    }

    const content = this._buildManualEntryHTML(defaultType);
    let featureCount = 1; // starts with 1 row (index 0)

    return new Promise(resolve => {
      const dialog = new Dialog({
        title: `${MODULE_TITLE} - Add Archetype`,
        content,
        buttons: {
          submit: {
            icon: '<i class="fas fa-save"></i>',
            label: 'Save',
            callback: async (html) => {
              const result = this._validateManualEntry(html[0] || html);

              if (!result.valid) {
                ui.notifications.error(`Validation errors:\n${result.errors.join('\n')}`);
                resolve(null);
                return;
              }

              // Save to the correct JE section
              const section = result.data.type;

              // Additional permission check for the actual section being saved to
              if (section === 'missing' && !game.user.isGM) {
                ui.notifications.error('Only the GM can add to the missing section.');
                resolve(null);
                return;
              }

              const success = await JournalEntryDB.setArchetype(
                section,
                result.data.slug,
                result.data.entry
              );

              if (success) {
                ui.notifications.info(
                  `${MODULE_TITLE} | Saved archetype "${result.data.name}" to ${section} section.`
                );
                resolve(result.data);
              } else {
                ui.notifications.error('Failed to save archetype entry.');
                resolve(null);
              }
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
            callback: () => resolve(null)
          }
        },
        default: 'cancel',
        close: () => resolve(null),
        render: (html) => {
          const element = html[0] || html;

          // Add Feature button handler
          const addBtn = element.querySelector('.add-feature-btn');
          if (addBtn) {
            addBtn.addEventListener('click', () => {
              const idx = featureCount++;
              const rowsContainer = element.querySelector('.feature-rows');
              const newRow = document.createElement('div');
              newRow.className = 'feature-row';
              newRow.dataset.index = idx;
              newRow.innerHTML = `
                <input type="text" name="feat-name-${idx}" placeholder="Feature name" style="flex:2" />
                <input type="number" name="feat-level-${idx}" placeholder="Lvl" min="1" max="20" style="flex:0 0 50px; text-align:center" />
                <input type="text" name="feat-replaces-${idx}" placeholder="Replaces (or blank)" style="flex:2" />
                <button type="button" class="remove-feature-btn" data-index="${idx}" title="Remove" style="flex:0 0 30px; cursor:pointer;">✕</button>
              `;
              rowsContainer.appendChild(newRow);

              // Attach remove handler to new row
              newRow.querySelector('.remove-feature-btn').addEventListener('click', (e) => {
                e.preventDefault();
                newRow.remove();
              });
            });
          }

          // Attach remove handler to initial row
          const removeBtn = element.querySelector('.remove-feature-btn');
          if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
              e.preventDefault();
              const row = e.currentTarget.closest('.feature-row');
              // Don't remove if it's the only row
              const rows = element.querySelectorAll('.feature-row');
              if (rows.length > 1) {
                row.remove();
              } else {
                ui.notifications.warn('At least one feature row must remain.');
              }
            });
          }

          // If non-GM, disable the "Official Missing" option
          if (!game.user.isGM) {
            const typeSelect = element.querySelector('.entry-type-select');
            if (typeSelect) {
              const missingOption = typeSelect.querySelector('option[value="missing"]');
              if (missingOption) missingOption.disabled = true;
              typeSelect.value = 'custom';
            }
          }
        }
      }, { width: 550, classes: ['archetype-manager'] });

      dialog.render(true);
    });
  }

  /**
   * Build parsed archetype data for already-applied archetypes (for conflict checking)
   * Uses the archetype data list to find matching entries and build feature data.
   * @param {Item} classItem - The class item with applied archetype flags
   * @param {Array} archetypeDataList - The loaded archetype data list
   * @returns {Array<object>} Array of parsed archetype data objects
   */
  static _buildAppliedArchetypeData(classItem, archetypeDataList) {
    const applied = classItem?.getFlag?.(MODULE_ID, 'archetypes') || [];
    if (applied.length === 0) return [];

    const result = [];
    for (const slug of applied) {
      // Try to find the archetype in our data
      const archData = archetypeDataList.find(a => a.slug === slug);
      if (archData?.parsedData) {
        result.push(archData.parsedData);
      } else {
        // Build minimal data from JE database if available
        // Just use the slug as a placeholder with name derived from slug
        const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        result.push({
          name: displayName,
          slug,
          features: []
        });
      }
    }
    return result;
  }

  /**
   * Prevent double-click actions
   * @param {Function} fn - The function to guard
   */
  static async guardAction(fn) {
    if (this._processing) return;
    this._processing = true;
    try {
      await fn();
    } finally {
      this._processing = false;
    }
  }
}
