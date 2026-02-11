#!/bin/bash
# PF1e Archetype Manager - Development Environment Setup
#
# This script sets up the module for development within FoundryVTT.
# Since this is a FoundryVTT module (not a standalone web app), the
# "server" is FoundryVTT itself. This script helps with:
# 1. Validating the module structure
# 2. Creating a symlink to FoundryVTT's modules directory (if available)
# 3. Providing information about the development setup

set -e

MODULE_ID="archetype-manager"
MODULE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  PF1e Archetype Manager - Setup"
echo "============================================"
echo ""

# Validate module structure
echo "Checking module structure..."

REQUIRED_FILES=(
  "module.json"
  "scripts/module.mjs"
  "scripts/archetype-manager.mjs"
  "scripts/journal-db.mjs"
  "scripts/compendium-parser.mjs"
  "scripts/diff-engine.mjs"
  "scripts/applicator.mjs"
  "scripts/conflict-checker.mjs"
  "scripts/ui-manager.mjs"
  "styles/archetype-manager.css"
  "lang/en.json"
)

ALL_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$MODULE_DIR/$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (MISSING)"
    ALL_PRESENT=false
  fi
done

echo ""

if [ "$ALL_PRESENT" = true ]; then
  echo "✓ All required files present."
else
  echo "✗ Some required files are missing. Check the project structure."
fi

echo ""

# Check for FoundryVTT data directory
FOUNDRY_DATA_DIRS=(
  "$HOME/.local/share/FoundryVTT/Data/modules"
  "$HOME/Library/Application Support/FoundryVTT/Data/modules"
  "$HOME/foundrydata/Data/modules"
  "$HOME/foundryvtt/Data/modules"
  "/home/$USER/foundrydata/Data/modules"
)

FOUNDRY_MODULES_DIR=""
for dir in "${FOUNDRY_DATA_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    FOUNDRY_MODULES_DIR="$dir"
    break
  fi
done

if [ -n "$FOUNDRY_MODULES_DIR" ]; then
  echo "Found FoundryVTT modules directory: $FOUNDRY_MODULES_DIR"

  LINK_PATH="$FOUNDRY_MODULES_DIR/$MODULE_ID"
  if [ -L "$LINK_PATH" ] || [ -d "$LINK_PATH" ]; then
    echo "✓ Module already linked/present at: $LINK_PATH"
  else
    echo ""
    echo "To install for development, create a symlink:"
    echo "  ln -s \"$MODULE_DIR\" \"$LINK_PATH\""
    echo ""
    read -p "Create symlink now? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      ln -s "$MODULE_DIR" "$LINK_PATH"
      echo "✓ Symlink created. Enable the module in FoundryVTT."
    fi
  fi
else
  echo "FoundryVTT data directory not found in common locations."
  echo "To install the module, create a symlink from this directory"
  echo "to your FoundryVTT modules folder:"
  echo ""
  echo "  ln -s \"$MODULE_DIR\" <FOUNDRY_DATA>/Data/modules/$MODULE_ID"
fi

echo ""
echo "============================================"
echo "  Development Instructions"
echo "============================================"
echo ""
echo "1. Ensure FoundryVTT v13.350+ is running"
echo "2. Ensure PF1e system v11.9+ is installed"
echo "3. Install/link this module to FoundryVTT's modules directory"
echo "4. Enable '$MODULE_ID' in your world's Module Management"
echo "5. Optional: Install 'pf1e-archetypes' module for compendium data"
echo ""
echo "Usage:"
echo "  - Create a macro with: game.modules.get('$MODULE_ID').api.open()"
echo "  - Select a token and click the macro"
echo "  - All testing can be done via the browser console (F12)"
echo ""
echo "Module ID: $MODULE_ID"
echo "Module Dir: $MODULE_DIR"
echo ""
