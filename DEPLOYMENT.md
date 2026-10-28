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
