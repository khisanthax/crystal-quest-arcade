# Sprint verification

| Check | Result |
| --- | --- |
| Reading Detective private fixture | The seven-mission case finished in Chromium and WebKit. Seven applicable checks passed. The Chromium touch swipe check uses CDP and is skipped in WebKit. |
| Public Reading Detective and publishing | Eight browser checks passed with original synthetic material. Tests used form editing, evidence mapping, persistence and access checks. |
| Game Master | Eight touch-emulated checks passed across Chromium and WebKit, including owner access, gifts, pet replacement, score repair, recovery PNG, badges, verified backup, reset and restore, and the owner progress report. |
| Runner controls | Twelve touch or keyboard checks passed across Chromium and WebKit for blast, slide, held controls and cancellation. |
| Expansion runner stages | Ten touch checks passed across five expansion worlds and both engines. Each earned a stage reward through real controls and quizzes, then resumed stage two after reload. |
| Complete runner courses | Both fantasy identities completed all three runner stages in Chromium and WebKit. |
| Navigation and original adventures | Thirty-four touch-emulated checks passed across Chromium and WebKit, including both entrances, all three cards, seven destinations, save/resume and the original discovery gates. |
| Local owner setup | A disposable Explorer changed from forbidden to allowed on the admin page after the local designation command. |

The mode picker and Reading Detective were checked at 1024×768, 1180×820 and 1366×1024. Chromium and WebKit loaded the live Arcade with fresh browser storage and opened the three game cards for both entrances.

A local Windows headless Chromium sample at 1180×820 with device pixel ratio 2 showed a 1,770-pixel initial drawing buffer at the same 1,180-pixel CSS width. With sustained slow frames, the buffer dropped to 885 pixels and the sampled median frame interval went from 66.7 ms early to 16.7 ms after settling. The settled 95th percentile was 33.4 ms. This was a software-browser sample and does not establish iPad frame rate.

A separate Chromium scene-switch sample kept one game loop across all seven worlds. JavaScript heap after garbage collection measured 3.70 MiB at the picker and 6.98 MiB after the seven initial visits. The renderer cached 18 textures by the last visit. This was a short observation, not a long-session leak test.

Physical iPad checks still include Safari tab suspension, Home Screen storage, camera permission, Photos and Files handoff, audio and speech, and performance during repeated world transitions. Use a disposable explorer for recovery and reset checks. Keep production and classroom artifacts private.

## November 4, 2026 sprint closeout

[Sites v30](https://github.com/khisanthax/crystal-quest-arcade/releases/tag/sites-v30) was published. On the [live Arcade](https://volcano-quest-island-adventure.khisanthax.chatgpt.site), fresh touch-emulated Chromium and WebKit sessions opened all three modes from Emberia and Luminara and advanced each runner. The home and health endpoints returned HTTP 200. Anonymous access to `/admin` returned HTTP 403. Production smoke tests used guest sessions and made no player-account changes.

| Check | Result |
| --- | --- |
| Install and build | A fresh public checkout passed `npm ci`, syntax checks, lint, the build, and all 112 unit and integration tests. The startup-fix revision also passed the build and all 112 tests. |
| Reading Detective | The seven-mission case completed in both engines. The targeted homework publication rerun passed twice, covering form editing, publication, child access, denial of draft and answer-key access, and resume after reload. The separate owner-key-disabled checks passed twice. |
| iPad-sized Detective screens | Six touch-emulated checks passed across both engines at 1024×768, 1180×820, and 1366×1024. Captures cover mode selection, keywords, clue mode, yellow and green evidence, and the paper-answer stage. Captures and private case fixtures were kept out of the public repository. |
| Dashboard | Four targeted badge and progress-report checks passed across both engines. A later full WebKit dashboard attempt passed three of four. The report test timed out while waiting for the refreshed report after a repair, so its final assertion now waits for the save confirmation. The full dashboard matrix has yet to be confirmed on that revision. |
| Runner and Original Adventure | Crystal collection passed six repeated checks across both engines after the test began counting newly collected crystal IDs. The runner rotation and resume regression passed in both engines after the assertion waited for the resize handler. Luminara practice passed in both engines, and its optional two-question demo passed the targeted WebKit rerun. The full Emberia Original Adventure rerun passed in both engines. |
| Cloud recovery and saves | A dedicated WebKit migration and recovery check passed. Two isolated API races also passed. One device could redeem a shared recovery passport, and competing saves produced one accepted write, one conflict, and one ledger transaction. A later mixed local run still timed out in both cloud Explorer browser checks and in one publication check. The separate publication rerun passed in both engines. |
| Cloud startup | A delayed cloud save could replace the screen after a player had already chosen an adventure. The Arcade now waits for the initial save check before offering the player choices. The controlled slow-response regression passed in both engines. The fix is in `1c1614d` and was awaiting release at sprint closeout. |

The earlier full local Chromium run recorded 100 passed, one skipped, and one failed crystal assertion. The crystal assertion was corrected and rerun separately. The earlier full local WebKit run finished with 88 passed, eight failed, and six skipped. These results and the targeted reruns do not establish a clean full-suite pass on the final revision.

The final pushed sprint revision was `df96e88`. The latest recorded [GitHub Actions run](https://github.com/khisanthax/crystal-quest-arcade/actions/runs/41872710696) had passed its build and unit-test job, with all four browser jobs still running. [PR #14](https://github.com/khisanthax/crystal-quest-arcade/pull/14) was open with auto-merge gated on the required checks. A subsequent GitHub status check could not connect, so the final CI and merge outcomes remain unverified here.

Physical iPad Safari testing and custom 3D pet and accessory authoring remain open.

## November 4, 2026 post-sprint audit

Public `main` was `7abbe3404a713ea301039691553d294d2944bf1a`. It had the maintenance `/api/admin` endpoint but lacked the Game Master UI, routes and migrations. The working implementation is on [PR #14](https://github.com/khisanthax/crystal-quest-arcade/pull/14), initially audited at `df96e88`. The dashboard uses the separate `/api/game-master` API, which requires the designated account and a strong owner key. The isolated backend tests covered authorization, crystal and item changes, reward distribution, repairs, snapshots and audit history.

Sites confirmed v30 is active at private source commit `fb5eb4475879cbe1685e6d605a34c18b6bcb28e8`. The corresponding sanitized public source is tag `sites-v30` (`310db1d`). The current live [Arcade](https://volcano-quest-island-adventure.khisanthax.chatgpt.site/) and health endpoint returned HTTP 200. The [admin panel](https://volcano-quest-island-adventure.khisanthax.chatgpt.site/admin) and its API denied anonymous access with HTTP 403. The authenticated mutation workflows were tested locally with disposable accounts. No production data was changed and no migrations were deployed during the audit.

The candidate passed a clean `npm ci` using the local cache, syntax checks, lint, the build and all 112 unit and integration tests. Separate disposable-account reruns passed 15 Game Master backend tests and 12 cloud API tests. Cloud coverage included concurrent stale-write rejection, account isolation, currency reconciliation and purchases, PIN and session behavior, and recovery token expiry and rotation.

The exact reward-ledger regression against an isolated checkout of public `main` accepted a rewind with HTTP 200 where HTTP 409 was expected. The candidate includes the fix in `73e7a37`. Issues #1, #3, #7, #8, #9 and #15 were reopened for missing main-branch coverage or implementation. The sole observed [workflow run on the old main revision](https://github.com/khisanthax/crystal-quest-arcade/actions/runs/41854665552) passed setup, 92 Node tests, and the build before reaching its browser job time limit.

The audit added two checked-in concurrent-device regressions. The cloud API suite then passed 14 of 14. An expanded Playwright test passed in Chromium and WebKit, including a store purchase, feeding, an equipped accessory, and recovery of those changes in a fresh browser from a downloaded PNG without camera use. A public-name regression passed in both engines and covers Arcade home, both profile menus, help, owner-only Parent Settings, and downloaded backup profile labels. The Game Master browser suite passed eight of eight with four checks per engine.

On [PR run 41872710696](https://github.com/khisanthax/crystal-quest-arcade/actions/runs/41872710696), both Chromium shards passed with 102 browser tests and one skip. Chromium's separate Game Master and owner-key checks added five passes. WebKit shard 2 passed 51 browser tests. WebKit shard 1 remained in the dependency installer, so the audit added bounded installation attempts and one retry while retaining the existing protected browser gate.
