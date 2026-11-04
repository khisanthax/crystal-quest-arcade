# Game Master Dashboard

Sign in to the designated administrator Explorer account in Crystal Quest Arcade, then open `/admin` on the same site. Enter the separate owner key to unlock the dashboard. The normal player PIN does not unlock administrative controls. The owner key stays in page memory. Unlocking also sets a session-bound, 20-minute cookie so the Homework Workshop can check the same owner session. Use **Lock dashboard** to clear the elevated session or sign out when finished.

For hosting, configure `CQ_GAME_MASTER_KEY` as a secret with at least 32 characters, ideally generated from 32 random bytes. Keep it outside version control and use a different value from the maintenance key. The existing administrator designation identifies the owner by immutable account ID. Apply the Game Master database migration before deploying. Use only a disposable local database for test accounts.

## Common tasks

1. **Find an explorer** by username. Select **Emberia** or **Luminara** inside the account before making profile-specific changes.
2. **Crystals** previews the starting and resulting balances. Enter a reason and apply the confirmed change. **Activity History** can reverse a prior adjustment as a new transaction.
3. **Pets & Items** grants or revokes existing catalog items, adjusts treat quantities and pet XP, and restores a revoked pet when its history is available. Pet replacement transfers XP, compatible accessories, a custom name, and equipped status.
4. **Special Rewards** gives gifts to chosen active accounts or draws one eligible account. Review recipients and contents before applying. Save named reward packages to reuse, edit, duplicate, or make inactive.
5. **Worlds & Levels** clears one saved course, corrects a stage’s completion, or resets a selected score. Reset a saved stage score or the best score recorded for one test and world. The lifetime high score is a separate record. **Progress & Reports** shows question coverage, first-attempt accuracy, mastered and missed concepts, Reading Detective completion, and separate world progress. Choose an identity and study pack to review its report, or reopen a specific reading mission. **Study & Homework** can assign or archive an existing pack and opens the Homework Workshop for case review and publication.
6. **Backups & Recovery** exports private progress for one explorer or all explorers. A stored server revision can restore selected gameplay and study records. This targeted restore keeps current wallets, pet collections, Reading Detective records, and reward ledgers. Export files contain private player data and belong outside the repository.
7. **Players** supports account rename, PIN reset, session revocation, disable/re-enable, and recovery credential replacement. Download the replacement recovery passport as a PNG and keep it private. The player can upload it from Photos or Files on the Arcade’s recovery screen. Recovering the account replaces the passport. A private recovery link is also available.

The dashboard changes the cloud save. If an explorer is playing during a repair, stop their session first or have them load the updated cloud save before continuing. Revision checks prevent overwriting changes saved after a preview.

The initial dashboard works with the existing catalog. Custom collectible badges use the illustrated icons provided in the editor. New 3D models and custom pet accessories remain future catalog work.

## Reset or restore an explorer

1. Open **Backups & Recovery** and choose the explorer.
2. Under **Verified account backups**, type the exact username, add a reason, and confirm **Create verified backup**. Save the downloadable JSON somewhere private.
3. Open **Reset or restore the whole explorer**. A reset affects Emberia and Luminara for that account. It clears wallets, pets, items, world progress, scores, learning, reading cases, and awarded badges while keeping the login, current tests, and settings.
4. To restore both identities, make a verified backup of the current save first. Then choose an earlier verified backup, type the username, enter a reason, and confirm the preview.
5. Load the latest cloud save on any iPad before resuming play. A stale save revision is rejected after a reset or restore. The previous verified backups and audit entries remain available.

Verified snapshots are stored on the server. The JSON download is a separate private copy. Restore from the verified snapshots listed for that account.

## Browser verification

```sh
npx playwright test --config=playwright.game-master.config.js
```

The test uses disposable accounts, a dedicated SQLite database, and synthetic keys. It runs in touch-emulated Chromium and WebKit. It does not use live accounts.

## Set up a local owner

Start the local server with a private `CQ_GAME_MASTER_KEY` in its environment, then create an Explorer through the Arcade. In a second terminal in this checkout, run `npm run admin:designate -- EXPLORER_USERNAME`. The command uses the local maintenance key and calls localhost only. Sign in to that Explorer, open `/admin` and enter the owner key. For a hosted Arcade, keep both owner and maintenance keys in the hosting secret store.
