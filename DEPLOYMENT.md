# Deploy the lead, export, notes, and history changes

1. Open the Google Sheet, then Extensions > Apps Script.
2. Replace the backend with [code.gs](./code.gs).
3. Copy [appscript_index.html](./appscript_index.html) into the Apps Script HTML file named `index`. Keep the repository landing page separate.
4. Replace the Apps Script HTML files named `script` and `style` with [script.html](./script.html) and [style.html](./style.html).
5. Save, then Deploy > Manage deployments > Edit > New version > Deploy. Keep the existing deployment URL.
6. Download a backup of the spreadsheet before the initial history cleanup. In the Apps Script editor, select `setupHistoryMaintenance` and Run. Authorize the daily time trigger. This immediately removes history entries dated before today (spreadsheet timezone), trims blank allocated rows, and installs daily cleanup around 3 AM. Running setup again does not duplicate the trigger.

`Stats` and `QL_Notes` are preserved. History contains the Full Pitch / Money Part flags needed for accurate Undo; today's entries remain usable after refreshing. Undo of older calls is no longer supported after cleanup. Malformed history dates are retained for inspection. If the history sheet remains large, compare its last populated row with its allocated rows and inspect malformed dates.

## Features

- Click **Edit text** beside an existing lead to add, replace, or clear its text. Cancel leaves it unchanged. Edits save to `QL_Notes` and invalidate the monthly cache. Conflicting changes ask the user to sync.
- Input includes today's Full Pitch, Money Part, and Qualified Leads preview, updated with saves and undo.
- Overview includes a qualified leads calendar for the selected month. Select a day to see its performance and notes.
- Select a month in Overview, then **Export monthly PDF**. A fresh report opens with daily statistics, monthly totals, and lead notes. Click **Save as PDF / Print**, then choose **Save as PDF** as the destination. Allow popups if prompted. Browser PDF rendering preserves international text and wraps long notes across pages.
- Open **Notes** for an ongoing personal notepad. Every input saves immediately to local storage under the normalized username. Notes persist across refreshes and sign-outs on the same browser. They do not sync between devices; clearing browser data removes them. Storage failures are shown beside the notepad.

## Verification

Run `node verify-features.cjs` for mocked backend checks covering cleanup, allocated rows, text edits, stale edits, and username matching. Syntax checks also pass for both JavaScript sources. Live Google Sheets integration and browser downloads still need a check after deployment: edit a lead, refresh, export a PDF for a past month, and verify notes after signing out and back in.

## App fails with ?The favicon icon image type is not supported?

Replace the Apps Script backend with the updated [code.gs](./code.gs). The custom favicon now uses the direct PNG URL without a query suffix. Its `setFaviconUrl(...)` call is guarded so an icon validation failure cannot prevent the app from opening. The HTML icon link uses the same direct URL.

Save, then Deploy > Manage deployments > Edit (pencil) > New version > Deploy. Reload the existing web app URL. Updating code without deploying a new version does not update the live app. If the old tab icon remains cached, close the tab and reopen the web app.

## PDF browser headers

The report requests zero page margins to suppress browser-generated headers and addresses, with internal padding for the report content. If the print preview still shows `about:blank`, disable **Headers and footers** under **More settings** in the browser print dialog. That browser preference cannot be forcibly changed by page JavaScript. The report title (and suggested PDF filename) is now `Monthly Report, September` for a September export.

## Shared room and private chat

1. Update the backend with [code.gs](./code.gs) and the Apps Script HTML files `index`, `script`, and `style` with [appscript_index.html](./appscript_index.html), [script.html](./script.html), and [style.html](./style.html).
2. Save and deploy a new version. Sign out and sign in again to obtain a server-verified chat session.
3. Run `setupChatMaintenance` once in the Apps Script editor and authorize its hourly trigger. It also performs an initial cleanup. Re-running setup does not duplicate the trigger. `Chat_Messages` is created automatically on first chat access.
4. Verify with two accounts: send to Everyone, start a private conversation via a sender's **Message privately** button or the user selector, and recall a message. A third account must not see either side of the private conversation.

The Everyone room is visible to every registered app user. Private chat is limited by the server to its two participants; spreadsheet owners still have access to the stored rows. No encryption beyond the platform transport/storage is added. User names are shown; the directory lists registered users, not online presence.

Messages are hidden exactly seven days after sending. The hourly trigger deletes expired rows from `Chat_Messages` afterward. Recall immediately deletes the sender's message row; other viewers see the removal on their next refresh. Polling happens every 10 seconds while Chat is selected and the browser document is visible. Earlier messages can be loaded in batches of 100. Switching conversations clears the composer draft.

Chat sessions are issued only after successful login/registration, stored in server cache, and held only in the open page's memory. They last at most six hours and can expire earlier if Google evicts the cache entry; users then sign out and sign in again. Signing out revokes the session. Invalid tokens and attempts to recall someone else's messages are rejected. Text is limited to 4,000 characters and stored literally to avoid spreadsheet formula execution. Each user can send up to 20 messages per minute.

Automated mocked checks cover sender spoofing, private-message isolation, recall ownership, deduplicated sends, invalid recipients, message size, seven-day expiry, physical cleanup, pagination, session expiry, and logout. A live multi-account browser check remains necessary after deployment.

## Readability, call totals, chat badges, and report chart

Update all four Apps Script files (backend, index, script, style) and deploy a new version using the existing URL. Publish the updated demo and portal CSS through the usual static hosting process.

Small text now has a 15px minimum, with larger admin notices. Login, registration, and password confirmation each include a Show/Hide password button. Input shows today's and yesterday's call totals above performance, including when yesterday falls in the previous month or Overview shows another month.

The Chat tab displays the number of unread incoming public and private messages. Counts refresh every 10 seconds while the app is visible, across all app sections. Opening a conversation marks fetched messages as read. Read IDs persist per user on this browser; existing unexpired messages appear unread on first use. Recalled and expired messages drop from the count. The PDF includes a printable daily total calls line chart, with FP and MP excluded from call totals.

After deploying, verify with two accounts that the badge increases while viewing Input and clears after reading the relevant conversation. Check show/hide controls, mobile text wrapping, month-boundary call totals, and the chart in PDF print preview.


## Offline input queue

Update `code.gs`, `index` from [appscript_index.html](./appscript_index.html), and `script` from [script.html](./script.html), then deploy a new version. Deploy the backend together with the client: offline retries require server receipts. The backend creates `Input_Receipts` automatically; retain this sheet to preserve duplicate protection.

The already-open app accepts call inputs, quality flags, qualified lead notes, and queued undo actions during connection outages. It stores pending operations and a local snapshot per username in browser local storage before sending them. Network failures retain inputs and retry every 15 seconds; reconnecting triggers an immediate retry. Inputs keep their original date. Sign back into the same account after a reload to recover pending inputs. Storage failures reject new inputs visibly. Do not clear browser data while inputs are pending. Personal notes retain their existing local storage behavior; chat, registration, report downloads, and editing previously saved lead notes still require the server.

The save status distinguishes pending local inputs from synced inputs. A validation rejection pauses the queue without deleting it; use Retry pending inputs after resolving the issue. If an execution stops after its receipt is reserved but before the result is recorded, syncing pauses for admin reconciliation rather than risking a duplicate. Review that request's payload against Stats, QL_Notes, and history before filling its Response cell with the confirmed result or removing an unapplied reservation. Historical undo actions can be rejected after daily history cleanup; they stay queued for review.

Google Apps Script serves the app shell remotely, so opening/reloading the app without a connection is not supported. Keep the tab open during an outage. Browser local storage is temporary device-local storage, not a backup, and cannot synchronize across devices until connectivity returns.

Run `node verify-offline.cjs` and `node verify-features.cjs`. After deployment, disconnect an already-open tab, add calls with FP/MP and a lead note, reconnect, and verify the exact totals in Sheets. Also test a reload with pending inputs, storage-disabled behavior, and a second username.

## Floating sync status, larger favicon, and reader names

Update all four Apps Script files: [code.gs](./code.gs), `index` from [appscript_index.html](./appscript_index.html), `script` from [script.html](./script.html), and `style` from [style.html](./style.html). Save and deploy a new version on the existing URL. Publish the static favicon assets and updated static HTML pages too. The Apps Script PNG favicon keeps its direct URL for compatibility; cached icons may require closing and reopening the tab.

Sync status and **Retry pending inputs** now float at the bottom left across app sections. Input acceptance shows immediate local-save feedback; confirmed server saves show a success notification. Temporary server timeouts and lock failures retry automatically. Returning to the tab also resumes pending work. Validation failures keep pending inputs and require attention before manual retry. An error in a success display callback no longer leaves a confirmed input queued.

Chat messages show **Read by N** with reader names on hover or keyboard focus. Opening a conversation in a visible tab acknowledges its fetched messages; this indicates the conversation was opened, not that each message was individually inspected. Reader names update on the next chat refresh, normally within 10 seconds. Receipts are stored with each message in a new automatically initialized `ReadBy` column and expire or disappear with the message. Existing messages have no historical reader information. Private receipts are restricted to the conversation participants.

Verification: run `node verify-offline.cjs` and `node verify-features.cjs`. Live checks after deployment: add an input offline, reconnect and confirm the notice returns to **All inputs synced**; switch sections and verify the floating notice remains; use two accounts to read public and private messages and hover over their reader counts.

## Input footer, clocks, and editable inputs

Redeploy all three HTML files and the backend using steps 1?5 above. Existing pending requests keep their IDs; the backend now compares payload values independently of property order, allowing reordered retries without duplicating inputs. A conflict with different values remains blocked for reconciliation; do not delete its receipt or replace the request ID blindly.

Input sync now appears in the footer. Click a category number to set today's total; changes use the existing durable save/undo queue, including lead-note removal and quality-flag history. Status labels use their standard names. Large adjustments can take time to sync. Reducing qualified leads removes the latest lead notes.

The Timezones page, between Notes and Chat, includes saved country/city clocks sorted by current UTC offset, including daylight saving changes. Countries with multiple time zones include the city in their name. Notes includes a second editable rebuttals/extended notepad stored per authenticated user in the Extended_Notes spreadsheet tab. Click Save extended notes to save across browsers. An existing local extended draft is offered when the server has no text. Concurrent changes are rejected so they cannot overwrite newer notes. Personal notes and clock choices remain browser-local.


## Daily overview corrections

Redeploy the backend and all three app HTML files. The monthly overview now has a daily totals editor immediately below its line graph. Choose a date in the displayed month, edit category totals and FP/MP, then Save daily totals. Pending inputs must finish syncing first. Corrections require the signed-in session, compare previous values to prevent overwriting concurrent input, preserve QL notes, and clear only the corrected user's selected-day Undo history. Existing lead notes may outnumber a reduced QL total; they are retained deliberately. Sync updates the charts and today's preview after saving.

Validation: `node verify-features.cjs`, `node verify-offline.cjs`, and `node verify-workspace-edits.cjs`.


## Clock readability, navigation, and notes backend compatibility

Update all four Apps Script files together: backend `code.gs`, HTML `index` from `appscript_index.html`, `script` from `script.html`, and `style` from `style.html`. Save, then **Deploy > Manage deployments > Edit > New version > Deploy** on the existing URL. Reload the web app afterward. Updating HTML alone does not install server-side notes functions.

`Unknown action: getExtendedNotes` indicates that the deployed backend does not have the notes update; signing in again cannot install it. Notes now use the dedicated `serverExtendedNotes` RPC and display a deployment-specific message if it is unavailable. Use **Reload saved notes** to retry after a connection issue. The `Extended_Notes` tab is created automatically on the first authenticated load; existing server notes are preserved.

Country clocks now separate a prominent country heading and large live time from the date and UTC offset. Country labels and Remove buttons no longer contain corrupted question marks. Navigation stays in the order Overview, Input, Notes, Timezones, Chat on one row, with horizontal scrolling on small screens. **Edit daily inputs** starts collapsed; click its heading to expand or collapse the editor.


## November 5: manual input, public clocks, and office sync recovery

### Deploy together

1. Replace the Apps Script backend with [code.gs](./code.gs).
2. Replace HTML `index`, `script`, and `style` with [appscript_index.html](./appscript_index.html), [script.html](./script.html), and [style.html](./style.html).
3. **Create an additional Apps Script HTML file named `timezone`** and paste [timezone.html](./timezone.html) into it. This is the self-contained shared clock module and styles.
4. Save, then Deploy > Manage deployments > Edit > New version > Deploy on the existing URL. Reload the app on both computers. The client and backend diagnostic version is `2026-11-05-world-clocks`.
5. Publish the static repository changes to the existing web host: [index.html](./index.html), [portal.css](./portal.css), [timezone.js](./timezone.js), [timezone.css](./timezone.css), and [timezones/index.html](./timezones/index.html). The public route is `/timezones/`; it needs no login or Apps Script connection.

The clock source is shared: after editing `timezone.js` or `timezone.css`, run `node sync-timezone-assets.cjs` to regenerate the Apps Script `timezone.html` bundle. Do not edit the generated bundle separately.

### Input method and clocks

Input has a per-user **Input method** selector: Buttons or Manual. Manual fields edit today's totals with **Save total**; adjustments still enter the durable save/undo queue and keep the usual lead-note and pitch-flag behavior. For added qualified leads, the typed lead note applies to the first added lead and the rest have blank notes. Reducing qualified leads removes the latest notes. Large changes queue multiple requests and can take time to sync.

More than 80 country/city choices include Bulgaria, Croatia, Czechia, Latvia, Lithuania, Iceland, Austria, Malta, and other European countries. Selected cards group by their current UTC offset, including daylight saving and fractional offsets. Cards show a flag, country-color stripe/tint, country name, and large live clock. Flag images load from FlagCDN; country-code fallbacks and color palettes remain if images are blocked. Existing saved clock choices keep their original IDs.

Enable **Show floating clocks across pages** in the workspace Timezones page to see a compact grouped panel while entering inputs. **Hide** turns it off. Selections and floating preferences remain browser-local, per user in the workspace. Public page selections use separate browser storage.

### Office sync: what was fixed and what to check

Two reproducible code failures are fixed:

- A blocked Chart.js CDN used to throw while updating the chart before the input reached the queue. Charts are now optional: input storage and sync continue when the chart library is unavailable.
- A pre-write lock timeout could be cached in an input receipt, so the same ID kept returning that old error. Confirmed pre-write lock failures now retry with the original request ID. Successful receipts still prevent duplicates; ambiguous interrupted receipts and payload conflicts remain blocked for reconciliation.

The client also supports browsers without `crypto.randomUUID`, shows the last save failure, waits up to 55 seconds for the server, and allows an explicit Retry/Check to attempt syncing even if the browser's offline indicator is stale.

From home, deploy the complete version above. Pending entries on the office browser are **not accessible from the home laptop** until exported or synced. At the office, open footer **Sync help and recovery > Check connection**. It reports RPC connectivity and backend version; it does not claim to test write permissions. If it reaches the server, Retry pending inputs checks actual saving. If the version is old, reload the current deployment. If it times out or fails only on the office computer, compare Google sign-in/account access, browser extensions, third-party cookie/site settings for Apps Script, and company filtering of `script.google.com` / `script.googleusercontent.com`. A company restriction requires the office IT administrator; a home code change cannot remove it.

If blocked, use **Export pending inputs + diagnostics** at the office, then bring the JSON file home. Sign in as the same Webstat username, finish syncing any home entries, and use **Import recovery file**. Original request IDs are retained, so already-committed requests return their saved receipts rather than adding duplicates. Recovery files contain pending input data and diagnostic errors, not passwords or session tokens. Keep the office browser data until its pending entries have been confirmed on the server. This cannot recover entries that never reached browser storage in an older app version.

For a request-ID conflict or interrupted receipt, inspect the reported request in `Input_Receipts`; do not generate a fresh ID or delete receipts blindly. These may represent a mutation whose outcome needs checking.

Validation: `node verify-features.cjs`, `node verify-offline.cjs`, `node verify-workspace-edits.cjs`, and `node verify-timezones.cjs`. Local browser checks cover manual entry with the chart CDN absent, flag cards, timezone grouping, floating clocks across pages, public navigation, and mobile layout. The actual office connection has not been tested.
