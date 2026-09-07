# LJingle merge manifest — 2026-08-24

## Keep / run

1. `_fork-e-stats-books-unified-v1.cjs`
2. `_fork-f-collections-v1.cjs`
3. `_fork-d-topics-v1.cjs`
4. `_bridge-server-v1.1.cjs` — VPS, corrected Bridge auth separation
5. `_fork-b-radio-bridge-frequency-v1.1.cjs` — local app, corrected Bridge auth separation
6. `_fork-a-session-intelligence-v1.cjs`
7. `_fork-c-today-meadow-palette-v1.cjs` — run last

Run `npx tsc --noEmit` after every local app patch. Do not continue on a new TypeScript error.

## Do NOT run

- `_memory-box-visual-topic-polish-v1.cjs` — obsolete/superseded. It overlaps Fork F, Fork D and Fork C and can partially modify files before SAFE STOP.
- `_fork-b-radio-bridge-frequency-v1.cjs` — superseded by v1.1 below for Bridge auth separation.
- `_bridge-server-v1.cjs` — superseded by v1.1 below; v1 still gates normal Bridge traffic with the Cloud Sync key.

## Bridge auth contract after v1.1

- `LJINGLE_SYNC_KEY` / `EXPO_PUBLIC_SYNC_KEY`: Cloud Sync only.
- `LJINGLE_BRIDGE_BOOTSTRAP_KEY` / `EXPO_PUBLIC_BRIDGE_BOOTSTRAP_KEY`: optional registration gate only.
- Normal Bridge send/inbox/delete: authenticated only with `X-LJINGLE-BRIDGE-ID` + `X-LJINGLE-BRIDGE-TOKEN`.
- `/bridge/bootstrap-check`: side-effect-free bootstrap diagnostic.

If no `LJINGLE_BRIDGE_BOOTSTRAP_KEY` is configured on the VPS, Bridge registration is open. The per-device Bridge token remains the credential for normal Bridge traffic.

## Duplicate fork note

Only one `_fork-d-topics-v1.cjs` was available to the audit environment. Two uploads used the exact same filename, so the currently mounted artifact is one version. Rename the other copy to `_fork-d-topics-v2.cjs` before uploading if a comparison is needed.

## Audit result against the latest supplied src(2).zip

Static patch-shape test succeeded in sequence for:

- Fork E (using the supplied App.tsx capture for root navigation shape)
- Fork F
- Fork D
- Fork A
- Fork C
- Fork B v1.1 anchors (with TypeScript/smoke execution bypassed only inside the isolated audit copy)

All uploaded `.cjs` files pass `node --check`. The actual app must still run its real TypeScript checks during merge.

## Post-merge follow-up

Regenerate the Memory Box visual-only pass after F/D/C are merged. Do not reuse the older visual patch because its anchors target the pre-fork Topic/Collection UI.

Also audit Bridge identity persistence before using separate users with Cloud Sync: the current Bridge identity is stored in SQLite, while LJingle backup exports all app tables. Device identity/token should eventually be excluded from shared/cloud backup or moved to local-only storage.
