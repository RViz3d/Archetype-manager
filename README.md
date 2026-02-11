# PF1e Archetype Manager

A FoundryVTT module for Pathfinder 1e (PF1e system v11.9+) that automates the application and removal of class archetypes by programmatically modifying `classAssociations` arrays on class items.

## Features

- **Automated Archetype Application**: Parse archetype data from the pf1e-archetypes community module and apply it to class items
- **Smart Parsing**: Regex-based extraction of level, replaces, modifies, and additive features from archetype descriptions
- **Conflict Detection**: Automatically detect feature conflicts between archetypes that replace/modify the same base features
- **Multi-Archetype Stacking**: Stack multiple non-conflicting archetypes on the same class
- **Preview & Diff**: Side-by-side preview of all changes before applying, with editable level fields
- **JournalEntry Database**: On-the-fly fix system for bad module data, plus support for missing official and homebrew archetypes
- **Backup & Rollback**: Always backs up original classAssociations before modification; automatic rollback on failure
- **Works Without Compendium**: Falls back to JE-only mode when pf1e-archetypes module is not installed

## Requirements

- **FoundryVTT** v13.350+
- **PF1e System** v11.9+
- **Optional**: pf1e-archetypes module by baileymh (for compendium archetype data)

## Installation

1. Clone or download this repository
2. Create a symlink from this directory to your FoundryVTT modules directory:
   ```bash
   ln -s /path/to/this/repo ~/.local/share/FoundryVTT/Data/modules/archetype-manager
   ```
3. Enable the module in your world's Module Management settings
4. Create a macro with: `game.modules.get('archetype-manager').api.open()`

Or run `./init.sh` for guided setup.

## Project Structure

```
archetype-manager/
├── module.json              # FoundryVTT module manifest
├── scripts/
│   ├── module.mjs           # Main entry point (Hooks, settings, API)
│   ├── archetype-manager.mjs # Main controller
│   ├── journal-db.mjs       # JournalEntry database CRUD
│   ├── compendium-parser.mjs # Compendium data parsing & matching
│   ├── diff-engine.mjs      # Diff generation & conflict detection
│   ├── applicator.mjs       # Apply/remove archetype modifications
│   ├── conflict-checker.mjs # Class & conflict validation
│   └── ui-manager.mjs       # Dialog UI management
├── styles/
│   └── archetype-manager.css # Module styling
├── lang/
│   └── en.json              # English localization
├── templates/               # (Handlebars templates, added later)
├── init.sh                  # Development setup script
└── README.md
```

## Usage

1. Select a token on the canvas
2. Click the archetype manager macro (or run `game.modules.get('archetype-manager').api.open()` in console)
3. Select a class from the dropdown
4. Browse or search for archetypes
5. Preview the changes
6. Confirm to apply

## Data Storage

All data uses FoundryVTT's native storage:

- **JournalEntry "Archetype Manager DB"**: Three sections (fixes, missing, custom) stored as JSON in JE pages
- **Class Item Flags**: `flags.archetype-manager.archetypes`, `originalAssociations`, `appliedAt`
- **Actor Flags**: `flags.archetype-manager.appliedArchetypes` (quick-lookup by class tag)

No external database or server-side storage is used.

## Development

- All code is vanilla JavaScript using ES modules
- Follows FoundryVTT v13 API conventions
- All subsystems testable via browser console (F12)
- Test with Fighter + Two-Handed Fighter archetype as primary test case

## License

MIT
