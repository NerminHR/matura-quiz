# IMPORTANT — Database Rules

## DO NOT DO THESE THINGS

- **Never push `app/matura.sqlite` after making question edits without reading this file first.**
- **Never run `git add app/matura.sqlite` unless you are absolutely certain test results are not stored there.**
- **Never overwrite the production database on Railway without taking a backup first.**

---

## Why This Matters

The app uses two databases:

| File | Contains | In git? | On Railway |
|------|----------|---------|------------|
| `app/matura.sqlite` | Questions, sections (read-only) | ✅ YES | Overwritten on every deploy |
| `app/results.sqlite` | Test results, user logs | ❌ NO (gitignored) | Lives on a Railway Volume — never touched by deployments |

If `results.sqlite` is ever committed and pushed, production data is **permanently lost**.

---

## Architecture (after the fix)

- `matura.sqlite` — static question data only. Safe to edit and push via scripts.
- `results.sqlite` — created automatically at runtime. **Must be stored on a Railway persistent volume** (see below).

### Railway Volume Setup

1. In the Railway dashboard, go to your service → **Volumes**
2. Create a volume mounted at `/data`
3. Set the environment variable: `RESULTS_DB_PATH=/data/results.sqlite`
4. Redeploy — results will now persist across deployments

---

## How to Make Question Changes Safely

1. Run your migration script locally (e.g., `node scripts/add-grammar-options.mjs`)
2. The script modifies `app/matura.sqlite` (questions only)
3. `git add app/matura.sqlite && git commit && git push` — this is safe because `results.sqlite` is separate
4. Railway redeploys with updated questions, results are untouched

---

## What Was Lost

On 2026-06-09, a push of `app/matura.sqlite` after question edits caused Railway to overwrite the production database, erasing all `test_results` rows. **This data cannot be recovered.** The fix (separate `results.sqlite`) prevents this from ever happening again.

---

## .gitignore Rules

`results.sqlite` and its WAL files are gitignored:

```
app/results.sqlite
app/results.sqlite-wal
app/results.sqlite-shm
```

Do not remove these entries.
