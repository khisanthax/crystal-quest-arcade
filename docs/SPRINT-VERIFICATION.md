# Sprint verification

| Check | Result |
| --- | --- |
| Reading Detective private fixture | The seven-mission case finished in Chromium and WebKit. Seven applicable checks passed. The Chromium touch swipe check uses CDP and is skipped in WebKit. |
| Public Reading Detective and publishing | Eight browser checks passed with original synthetic material. Tests used form editing, evidence mapping, persistence and access checks. |
| Game Master | Eight touch-emulated checks passed across Chromium and WebKit, including owner access, gifts, pet replacement, score repair, recovery PNG, badges, verified backup, reset and restore, and the owner progress report. |
| Runner controls | Twelve touch or keyboard checks passed across Chromium and WebKit for blast, slide, held controls and cancellation. |
| Navigation and original adventures | Thirty-four touch-emulated checks passed across Chromium and WebKit, including both entrances, all three cards, seven destinations, save/resume and the original discovery gates. |
| Local owner setup | A disposable Explorer changed from forbidden to allowed on the admin page after the local designation command. |

The mode picker and Reading Detective were checked at 1024×768, 1180×820 and 1366×1024. Chromium and WebKit loaded the live Arcade with fresh browser storage and opened the three game cards for both entrances.

A local Windows headless Chromium sample at 1180×820 with device pixel ratio 2 showed a 1,770-pixel initial drawing buffer at the same 1,180-pixel CSS width. With sustained slow frames, the buffer dropped to 885 pixels and the sampled median frame interval went from 66.7 ms early to 16.7 ms after settling. The settled 95th percentile was 33.4 ms. This was a software-browser sample and does not establish iPad frame rate.

A separate Chromium scene-switch sample kept one game loop across all seven worlds. JavaScript heap after garbage collection measured 3.70 MiB at the picker and 6.98 MiB after the seven initial visits. The renderer cached 18 textures by the last visit. This was a short observation, not a long-session leak test.

Physical iPad checks still include Safari tab suspension, Home Screen storage, camera permission, Photos and Files handoff, audio and speech, and performance during repeated world transitions. Use a disposable explorer for recovery and reset checks. Keep production and classroom artifacts private.
