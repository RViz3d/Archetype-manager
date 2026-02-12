# Changelog

All notable changes to the PF1e Archetype Manager module.

## [0.4.0-beta.1] - 2026-02-12

### Added
- GitHub Issue templates for structured bug reporting
- Scenario-based beta testing guide (`docs/BETA-TESTING.md`)
- This changelog

### Changed
- Version bump to begin structured beta testing phase

## [0.3.4] - 2026-02-12

### Fixed
- Dialog sizing and layout improvements
- Added hide-incompatible toggle for cleaner archetype browsing

## [0.3.3] - 2026-02-12

### Fixed
- Apply-time false conflict detection (was blocking valid archetype combinations)
- Resize handle visibility issues

## [0.3.2] - 2026-02-12

### Fixed
- False incompatibility warnings on valid archetype stacks
- Resize handle styling
- Composite entries in compatibility database

## [0.3.1] - 2026-02-12

### Fixed
- Slug mismatch between compendium data and internal lookups
- Preview duplication showing same change twice

## [0.3.0] - 2026-02-12

### Added
- CompatibilityDB from Archetype Crawler data for reliable feature classification
- Scalable feature support (level-adjustable archetype features)
- Real-time incompatibility display while browsing

## [0.2.0] - 2026-02-12

### Fixed
- Feature loading fallback when classAssociations array is empty
- Cross-class archetype application edge cases
- Feature parsing and UUID resolution

### Changed
- Moved archetype button from Token HUD to actor sheet title bar

## [0.1.0] - 2026-02-12

### Added
- Initial module with full archetype apply/remove lifecycle
- Compendium parser for pf1e-archetypes module data
- JournalEntry database for fixes, missing content, and custom archetypes
- Diff engine with side-by-side preview
- Conflict checker for archetype stacking validation
- Backup and rollback system for safe archetype operations
- Module settings (parse warnings, chat notifications, debug logging, etc.)
- Actor sheet header button integration
- Localization framework (English)
