# U4: auto-remember website accounts

After initial site permission and Use current browser account, successful verified website reads automatically create/reuse Claude, Cursor and ChatGPT accounts. There is no additional website account setup or Save step. Switching login A → B → A keeps both identities and editable nicknames. Default names use the provider family and a stable incrementing account number. Existing names and aliases remain.

Only the website's currently bound account is Live. Others are Remembered with their last checked age and last real meters. A remembered reset past its supplied resetsAt is displayed as “Projected · Reset · full limit available”, with zero used. This is a display assumption, not a provider reading or confirmation of actual remaining usage. Unknown reset times are never guessed. Projection copies never enter Store, history, alerts or badge totals.

Cookie signals for active Claude/ChatGPT sessions now request debounced checks too; normal-store isolation, cooldowns and provider backoff remain. Cursor uses existing tab and scheduler signals. Verified identity changes between the reader's before/after checks are rejected. Accepted switches increment connection generation to fence old results. Claude can select the new account's first eligible workspace when the prior account's workspace is unavailable, while still verifying identity around the quota read.

Forgetting a remembered account removes only its readings/history/metadata. It does not disconnect the browser's current account. Privacy mode masks names. This is remembered website tracking, not independently refreshing logged-out accounts. No new permissions or cookie storage. Saved-sign-in policy remains off. Existing storage/account limits remain.

U4 is based on main as requested; U1's separate open simplification PR is not included in this branch. Live provider tests remain pending; automated fixtures cannot prove provider behavior.
