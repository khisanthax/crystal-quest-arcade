# Game Master Dashboard

Sign in to the designated administrator Explorer account in Crystal Quest Arcade, then open `/admin` on the same site. Enter the separate owner key to unlock the dashboard. The normal player PIN does not unlock administrative controls. The owner key stays in page memory. Unlocking also sets a session-bound, 20-minute cookie so the Homework Workshop can check the same owner session. Use **Lock dashboard** to clear the elevated session or sign out when finished.

For hosting, configure `CQ_GAME_MASTER_KEY` as a secret with at least 32 characters, ideally generated from 32 random bytes. Keep it outside version control and use a different value from the maintenance key. The existing administrator designation identifies the owner by immutable account ID. Apply the Game Master database migration before deploying. Use only a disposable local database for test accounts.

## Common tasks

1. **Find an explorer** by username. Select **Emberia** or **Luminara** inside the account before making profile-specific changes.
2. **Crystals** previews the starting and resulting balances. Enter a reason and apply the confirmed change. **Activity History** can reverse a prior adjustment as a new transaction.
3. **Pets & Items** grants or revokes existing catalog items, adjusts treat quantities and pet XP, and restores a revoked pet when its history is available.
4. **Special Rewards** gives gifts to chosen active accounts or draws one eligible account. Review recipients and contents before applying. Save named reward packages to reuse, edit, duplicate, or make inactive.
5. **Worlds & Levels** clears one saved course or corrects a stage’s completion. **Progress & Reports** can reopen a specific Reading Detective mission. **Study & Homework** can assign or archive an existing pack and opens the Homework Workshop for case review and publication.
6. **Backups & Recovery** exports private progress for one explorer or all explorers. A stored server revision can restore selected gameplay and study records. Current wallets, pet collections, Reading Detective records, and reward ledgers are retained. Export files contain private player data and belong outside the repository.
7. **Players** supports account rename, PIN reset, session revocation, disable/re-enable, and recovery credential replacement. Save a rotated recovery link privately. Treat it as a password.

The dashboard changes the cloud save. If an explorer is playing during a repair, stop their session first or have them load the updated cloud save before continuing. Revision checks prevent overwriting changes saved after a preview.

The initial dashboard works with the existing catalog. New 3D models, exclusive item authoring, and a full account wipe are outside this version.

## Browser verification

```sh
npx playwright test --config=playwright.game-master.config.js
```

The test uses disposable accounts, a dedicated SQLite database, and synthetic keys. It runs in touch-emulated Chromium and WebKit. It does not use live accounts.
