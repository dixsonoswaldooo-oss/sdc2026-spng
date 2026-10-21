---
name: Import source precedence
description: Why the existing Cash Guard application takes priority over the migration backup.
---

The migration backup is an older Next.js starter, not the latest product. Preserve the newer Cash Guard implementation when working on the imported app.

**Why:** The import assignment described an unmigrated app, but the checked-in project already contained a richer React/Vite implementation. Replacing it from the backup would lose existing features.

**How to apply:** Compare the current application with the backup before running migration copy scripts. Port only what is still necessary rather than copying the old starter over newer work.
