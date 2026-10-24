# U1 simplification status

Archive: archive/pre-simplify, pushed before changes. Working branch: codex/u1-simplify; PR target main.

Only Claude / Claude Code, ChatGPT / Codex and Cursor website tracking remain. Retired provider/source routes, remote services and the floating preview are removed. Saved sign-in remains off by policy. No new features or live provider behavior claimed.

Validation and the exact deleted-file/permission comparison are recorded in the U1 PR handoff. Compatibility tests cover old 2.2-era and current stores, cleanup interruption and preservation of retained account data.

Validated: npm run check passes (210 unit tests and Chrome build); npm run test:browser passes 45/45; npm run test:spike passes 4/4. Chrome, Edge and Firefox builds and archive guards pass. No live provider traffic or new capability was tested or claimed.

The initial browser iteration used an outdated build and still contained deleted-feature fixtures; it is not acceptance evidence. Final rebuilt-source tests pass, including first-load IndexedDB deletion and encrypted saved-sign-in fixtures.

Required permissions remain storage, alarms, scripting and idle, plus Chromium sidePanel. Optional permissions reduce to notifications/cookies; optional origins reduce from six to the three retained providers. The separate evidence build keeps its explicit diagnostic permissions.

The compatibility-only parser recognizes retired provider/kind names to delete their old records safely. Those names do not reintroduce providers or routes. Unknown/malformed current data still fails validation. Both account IDs and source IDs are journaled before rewriting state; cleanup retries on history failure.
