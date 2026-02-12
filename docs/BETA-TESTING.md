# Beta Testing Guide — PF1e Archetype Manager

**Version**: 0.4.0-beta.1
**Tester**: Project owner
**Module**: archetype-manager

## How to Report Bugs

1. File a **GitHub Issue** using the [bug report template](https://github.com/RViz3d/Archetype-manager/issues/new/choose)
2. Pick the correct **severity** and **category**
3. Include **steps to reproduce** — the more specific, the faster the fix
4. Paste any **console errors** (F12 → Console tab → red messages)
5. Attach **screenshots** if the bug is visual

## Testing Workflow

Work through each scenario below in order. They build on each other — Scenario 1 creates a character used in Scenario 4, etc. When something breaks or looks wrong, file an issue before continuing.

After each beta release (beta.1, beta.2, ...) re-test any scenarios that had fixes applied.

---

## Scenario 1: Build a Two-Handed Fighter

**Goal**: Verify the core apply flow end-to-end on the most common test case.

**Setup**: Create a new character. Add the Fighter class with 5+ levels (or use an existing Fighter).

| Step | Action | What to check |
|------|--------|---------------|
| 1.1 | Open the character sheet | "Archetypes" button visible in the title bar header |
| 1.2 | Click the Archetypes button | Dialog opens, Fighter auto-selected in class dropdown |
| 1.3 | Browse the archetype list | Archetypes load, list is scrollable, names are readable |
| 1.4 | Search for "Two-Handed Fighter" | Search/filter works, result appears |
| 1.5 | Click to select it | Archetype details/description shown |
| 1.6 | Click Preview / view the diff | Diff shows which features are replaced, added, or modified. Levels look correct. |
| 1.7 | Click Apply | Confirmation dialog appears with summary |
| 1.8 | Confirm application | Toast notification shown. Chat message posted (if setting enabled). |
| 1.9 | Check the class item flags | `flags.archetype-manager.archetypes` lists "Two-Handed Fighter". `originalAssociations` backup exists. |
| 1.10 | Re-open the Archetype Manager | "Two-Handed Fighter" shown as applied. It should not be selectable for re-application. |

**Keep this character** — used in Scenario 4.

---

## Scenario 2: Multi-Archetype Stacking (Rogue)

**Goal**: Verify that multiple non-conflicting archetypes can stack on the same class.

**Setup**: Create a Rogue with 8+ levels.

| Step | Action | What to check |
|------|--------|---------------|
| 2.1 | Open Archetype Manager on the Rogue | Rogue class selected, archetype list loads |
| 2.2 | Apply a first archetype (e.g., "Knife Master") | Apply flow works same as Scenario 1 |
| 2.3 | Re-open manager | First archetype shown as applied |
| 2.4 | Apply a second compatible archetype | No conflict warning. Apply succeeds. |
| 2.5 | Check flags | Both archetypes listed in `flags.archetype-manager.archetypes` |
| 2.6 | Re-open manager | Both archetypes shown as applied. Remaining compatible archetypes still selectable. |

**Keep this character** — used in Scenario 3 and 4.

---

## Scenario 3: Trigger Conflict Detection

**Goal**: Verify the module blocks incompatible archetype stacking.

**Setup**: Use the Rogue from Scenario 2 (already has 2 archetypes applied).

| Step | Action | What to check |
|------|--------|---------------|
| 3.1 | Open Archetype Manager | Both applied archetypes shown |
| 3.2 | Browse for an archetype that replaces the same feature as one already applied | Find one that conflicts (replaces a feature already replaced by Knife Master or the second archetype) |
| 3.3 | Select the conflicting archetype | Conflict warning displayed, naming the specific conflicting features |
| 3.4 | Try to apply it | Application is blocked or requires explicit override |
| 3.5 | Check the character | No changes made — original two archetypes still intact, classAssociations unchanged |

---

## Scenario 4: Remove an Archetype & Verify Rollback

**Goal**: Verify clean removal restores original state.

**Setup**: Use the Fighter from Scenario 1 OR the Rogue from Scenario 2.

| Step | Action | What to check |
|------|--------|---------------|
| 4.1 | Open Archetype Manager | Applied archetype(s) shown with remove option |
| 4.2 | Click Remove on one archetype | Rollback preview/diff shown |
| 4.3 | Confirm removal | Toast notification. Chat message (if enabled). |
| 4.4 | Check class item flags | Archetype removed from `flags.archetype-manager.archetypes`. If it was the only archetype, `originalAssociations` should be cleaned up. |
| 4.5 | Check classAssociations | Restored to pre-archetype state for the removed archetype's features |
| 4.6 | Re-open manager | Removed archetype is available to apply again |
| 4.7 | (Rogue only) If one archetype remains, verify it's still applied | The other archetype's modifications should be untouched |

---

## Scenario 5: JournalEntry Database Operations

**Goal**: Verify the JournalEntry-based fix/custom database works.

| Step | Action | What to check |
|------|--------|---------------|
| 5.1 | Open the Journal sidebar | "Archetype Manager DB" journal exists |
| 5.2 | Open the journal | Three pages: Fixes, Missing, Custom |
| 5.3 | Check the Fixes page | Contains JSON data (or is empty if no fixes needed yet) |
| 5.4 | Add a custom archetype entry via the module's UI (if custom creation is implemented) | Entry saves successfully |
| 5.5 | Refresh the page (F5) | Custom entry persists after reload |
| 5.6 | Open Archetype Manager | Custom archetype appears in the browse list (if applicable) |

---

## Scenario 6: Edge Cases & Error Handling

**Goal**: Verify the module handles unusual situations gracefully.

| Step | Action | What to check |
|------|--------|---------------|
| 6.1 | Run `game.modules.get('archetype-manager').api.open()` with no token selected | Graceful error message (toast or dialog), no console crash |
| 6.2 | Open manager for a character with no class items | Appropriate message ("No classes found" or similar), not a blank/broken dialog |
| 6.3 | Open and close the dialog 5 times rapidly | No memory leak, no stacked dialogs, no errors |
| 6.4 | Apply an archetype, then manually delete the class item from the character | Module should handle missing class gracefully on next open |
| 6.5 | Try applying the same archetype twice | Should be blocked — archetype already applied |
| 6.6 | Open manager on a character with multiple different classes (e.g., Fighter/Rogue multiclass) | Class dropdown shows both classes, switching between them loads correct archetype lists |

---

## Scenario 7: Settings Verification

**Goal**: Verify all module settings work as documented.

Open **Game Settings → Module Settings → PF1e Archetype Manager**.

| Setting | Test | Expected |
|---------|------|----------|
| Show Parse Warnings | Apply an archetype that has parse issues | Warning toast appears when ON, no warning when OFF |
| Chat Notifications | Apply an archetype | Chat message posted when ON, no message when OFF (toast still appears) |
| Auto-Create Journal Database | Delete the "Archetype Manager DB" journal, reload world | JE re-created when ON, not created when OFF |
| Debug Logging | Open console (F12), perform any action | Verbose `console.log` output when ON, only warnings/errors when OFF |
| Default Compendium Source | Change to an invalid module ID, open manager | Graceful fallback — no crash, possibly falls back to JE-only mode |

---

## After Testing

Once all scenarios are complete:
1. File any remaining issues
2. Note which scenarios passed cleanly vs. had problems
3. We'll batch-fix reported issues, bump to beta.2, and re-test the affected scenarios
