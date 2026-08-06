// ══════════════════════════════════════════════════════════════════
//  TQ Statistics — Google Apps Script Backend (Multi-User Edition)
//  VERSION 2 — QL Notes stored per-entry, never overwritten
//
//  SETUP INSTRUCTIONS:
//  1. Open your Google Sheet
//  2. Go to Extensions → Apps Script
//  3. Delete any existing code and paste this entire file
//  4. Click Save (floppy disk icon)
//  5. Click Deploy → New deployment (or "Manage deployments" → create new version)
//     - Type: Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  6. Click Deploy, authorize when prompted
//  7. Your Web App URL stays the same if you created a new version.
//     If this is a brand new deploy, copy the new URL and update API_URL in script.js
//
//  GOOGLE SHEET CHANGES NEEDED:
//  The script will auto-create any missing sheets, but for reference:
//
//  Sheet "Users"     — unchanged, created automatically
//  Sheet "Stats"     — unchanged from v1 (leave existing data as-is)
//    Columns: A=Date, B=Username, C=QL, D=VM, E=SNR, F=NI, G=HU, H=DNC,
//             I=OOO, J=LB, K=FE, L=WN, M=FP, N=MP, O=QL_Comment (now unused)
//
//  Sheet "QL_Notes"  ← NEW (auto-created on first use)
//    Columns: A=Date, B=Username, C=LeadNumber, D=Note
//    Each qualified lead note is stored as its own row — nothing is overwritten.
//
//  HOW TO ADD "QL_Notes" MANUALLY (if you prefer):
//  1. In your Google Sheet click the "+" at the bottom to add a sheet
//  2. Name it exactly:  QL_Notes
//  3. In row 1 type these headers:  Date | Username | LeadNumber | Note
//  4. Freeze row 1 (View → Freeze → 1 row)
//  That's it — the script will handle the rest automatically.
// ══════════════════════════════════════════════════════════════════

var USERS_SHEET    = 'Users';
var STATS_SHEET    = 'Stats';
var NOTES_SHEET    = 'QL_Notes';

// ── JSON response helper ──────────────────────────────────────────
function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── SHA-256 password hash ─────────────────────────────────────────
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

// ── Ensure all required sheets exist ─────────────────────────────
function ensureSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Users sheet
  var usersSheet = ss.getSheetByName(USERS_SHEET);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(USERS_SHEET);
    usersSheet.appendRow(['Username', 'PasswordHash', 'CreatedAt']);
    usersSheet.setFrozenRows(1);
  }

  // Stats sheet (unchanged from v1 — keeps existing data safe)
  var statsSheet = ss.getSheetByName(STATS_SHEET);
  if (!statsSheet) {
    statsSheet = ss.insertSheet(STATS_SHEET);
    statsSheet.appendRow([
      'Date', 'Username',
      'QL', 'VM', 'SNR', 'NI', 'HU', 'DNC', 'OOO', 'LB', 'FE', 'WN',
      'FP', 'MP', 'QL_Comment'
    ]);
    statsSheet.setFrozenRows(1);
  }

  // QL_Notes sheet — NEW in v2
  var notesSheet = ss.getSheetByName(NOTES_SHEET);
  if (!notesSheet) {
    notesSheet = ss.insertSheet(NOTES_SHEET);
    notesSheet.appendRow(['Date', 'Username', 'LeadNumber', 'Note']);
    notesSheet.setFrozenRows(1);
  }

  return {
    usersSheet: usersSheet,
    statsSheet: statsSheet,
    notesSheet: notesSheet
  };
}

// ── Date normaliser ───────────────────────────────────────────────
function toDateStr(val, tz) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  return String(val || '').trim();
}

// ════════════════════════════════════════════════════════════════════
//  GET  — fetch stats + QL notes for a user + month
// ════════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var action   = (e.parameter.action   || 'stats');
    var month    = (e.parameter.month    || '');
    var username = (e.parameter.username || '').trim();

    if (action !== 'stats') {
      return jsonResponse({ error: 'Unknown action.' });
    }
    if (!username) {
      return jsonResponse({ error: 'Username is required.' });
    }

    var sheets  = ensureSheets();
    var tz      = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    var userKey = username.toLowerCase();

    // ── Read Stats rows ──────────────────────────────────────────
    var statsSheet = sheets.statsSheet;
    var sLastRow   = statsSheet.getLastRow();
    var days       = [];

    if (sLastRow > 1) {
      var sData = statsSheet.getRange(2, 1, sLastRow - 1, 15).getValues();
      for (var i = 0; i < sData.length; i++) {
        var row     = sData[i];
        var rowUser = String(row[1]).toLowerCase().trim();
        if (rowUser !== userKey) continue;

        var dateStr = toDateStr(row[0], tz);
        if (!dateStr) continue;
        if (month && dateStr.substring(0, 7) !== month) continue;

        days.push({
          date: dateStr,
          ql:   Number(row[2])  || 0,
          vm:   Number(row[3])  || 0,
          snr:  Number(row[4])  || 0,
          ni:   Number(row[5])  || 0,
          hu:   Number(row[6])  || 0,
          dnc:  Number(row[7])  || 0,
          ooo:  Number(row[8])  || 0,
          lb:   Number(row[9])  || 0,
          fe:   Number(row[10]) || 0,
          wn:   Number(row[11]) || 0,
          fp:   Number(row[12]) || 0,
          mp:   Number(row[13]) || 0
        });
      }
    }

    // ── Read QL_Notes rows ───────────────────────────────────────
    var notesSheet = sheets.notesSheet;
    var nLastRow   = notesSheet.getLastRow();
    var qlNotes    = [];

    if (nLastRow > 1) {
      var nData = notesSheet.getRange(2, 1, nLastRow - 1, 4).getValues();
      for (var j = 0; j < nData.length; j++) {
        var nRow     = nData[j];
        var nUser    = String(nRow[1]).toLowerCase().trim();
        if (nUser !== userKey) continue;

        var nDate = toDateStr(nRow[0], tz);
        if (!nDate) continue;
        if (month && nDate.substring(0, 7) !== month) continue;

        var noteText = String(nRow[3] || '').trim();
        // Include entry even if note is blank (so lead count stays accurate)
        qlNotes.push({
          date:       nDate,
          leadNumber: Number(nRow[2]) || 0,
          note:       noteText
        });
      }
    }

    return jsonResponse({ days: days, ql_notes: qlNotes });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ════════════════════════════════════════════════════════════════════
//  POST  — register / login / record stat
// ════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;

    // ── Register ─────────────────────────────────────────────────
    if (action === 'register') {
      var username = String(body.username || '').trim();
      var password = String(body.password || '').trim();

      if (!username || !password) {
        return jsonResponse({ error: 'Username and password are required.' });
      }
      if (username.length < 3) {
        return jsonResponse({ error: 'Username must be at least 3 characters.' });
      }
      if (password.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters.' });
      }

      var sheets     = ensureSheets();
      var usersSheet = sheets.usersSheet;
      var lastRow    = usersSheet.getLastRow();

      if (lastRow > 1) {
        var existing = usersSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < existing.length; i++) {
          if (String(existing[i][0]).toLowerCase().trim() === username.toLowerCase()) {
            return jsonResponse({ error: 'Username already taken. Please choose another.' });
          }
        }
      }

      usersSheet.appendRow([username, hashPassword(password), new Date().toISOString()]);
      SpreadsheetApp.flush();
      return jsonResponse({ success: true, username: username });
    }

    // ── Login ─────────────────────────────────────────────────────
    if (action === 'login') {
      var username = String(body.username || '').trim();
      var password = String(body.password || '').trim();

      if (!username || !password) {
        return jsonResponse({ error: 'Username and password are required.' });
      }

      var sheets     = ensureSheets();
      var usersSheet = sheets.usersSheet;
      var lastRow    = usersSheet.getLastRow();

      if (lastRow <= 1) {
        return jsonResponse({ error: 'No users found. Please register first.' });
      }

      var rows = usersSheet.getRange(2, 1, lastRow - 1, 2).getValues();
      var hash = hashPassword(password);

      for (var i = 0; i < rows.length; i++) {
        if (
          String(rows[i][0]).toLowerCase().trim() === username.toLowerCase() &&
          String(rows[i][1]).trim() === hash
        ) {
          return jsonResponse({ success: true, username: rows[i][0] });
        }
      }

      return jsonResponse({ error: 'Invalid username or password.' });
    }

    // ── Record stat ───────────────────────────────────────────────
    if (action === 'stat') {
      var date      = String(body.date     || '').trim();
      var username  = String(body.username || '').trim();
      var category  = String(body.category || '').toLowerCase();
      var delta     = Number(body.delta)   || 0;
      var fp        = body.fp === true;
      var mp        = body.mp === true;
      var qlNote    = String(body.ql_note  || '').trim(); // note text (may be empty)

      if (!date || !username || !category) {
        return jsonResponse({ error: 'Missing required fields.' });
      }

      // Column map — 1-indexed (Stats sheet)
      // A=1:Date  B=2:Username  C=3:QL  D=4:VM  E=5:SNR  F=6:NI
      // G=7:HU   H=8:DNC       I=9:OOO J=10:LB K=11:FE  L=12:WN
      // M=13:FP  N=14:MP       O=15:QL_Comment (deprecated, not written)
      var colMap = {
        ql:  3,
        vm:  4,
        snr: 5,
        ni:  6,
        hu:  7,
        dnc: 8,
        ooo: 9,
        lb:  10,
        fe:  11,
        wn:  12,
        fp:  13,
        mp:  14
      };

      var colIndex = colMap[category];
      if (!colIndex) {
        return jsonResponse({ error: 'Unknown category: ' + category });
      }

      var sheets     = ensureSheets();
      var statsSheet = sheets.statsSheet;
      var tz         = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
      var foundRow   = -1;
      var userKey    = username.toLowerCase();

      // Find existing Stats row for this date + username
      var sLastRow = statsSheet.getLastRow();
      if (sLastRow > 1) {
        var dateRows = statsSheet.getRange(2, 1, sLastRow - 1, 2).getValues();
        for (var i = 0; i < dateRows.length; i++) {
          if (
            toDateStr(dateRows[i][0], tz) === date &&
            String(dateRows[i][1]).toLowerCase().trim() === userKey
          ) {
            foundRow = i + 2;
            break;
          }
        }
      }

      // Update or create the Stats row
      if (foundRow === -1) {
        // New row — 14 numeric columns + 1 blank comment placeholder
        var newRow = [date, username, 0,0,0,0,0,0,0,0,0,0,0,0,''];
        newRow[colIndex - 1] = Math.max(0, delta);
        if (fp) newRow[colMap.fp - 1] = Math.max(0, delta);
        if (mp) newRow[colMap.mp - 1] = Math.max(0, delta);
        statsSheet.appendRow(newRow);
      } else {
        var cell    = statsSheet.getRange(foundRow, colIndex);
        var curVal  = Number(cell.getValue()) || 0;
        cell.setValue(Math.max(0, curVal + delta));

        if (fp) {
          var fpCell = statsSheet.getRange(foundRow, colMap.fp);
          fpCell.setValue(Math.max(0, (Number(fpCell.getValue()) || 0) + delta));
        }
        if (mp) {
          var mpCell = statsSheet.getRange(foundRow, colMap.mp);
          mpCell.setValue(Math.max(0, (Number(mpCell.getValue()) || 0) + delta));
        }
      }
      SpreadsheetApp.flush();

      // ── Append QL note (v2 behaviour: one row per note) ─────────
      // Only on +1, and only for ql category.
      // Even if note is blank we still record the lead entry so
      // the lead number in the notes panel stays in sync with the count.
      if (category === 'ql' && delta === 1) {
        var notesSheet = sheets.notesSheet;

        // Count how many notes this user already has for this date
        // to derive the next lead number.
        var nLastRow   = notesSheet.getLastRow();
        var leadNumber = 1;

        if (nLastRow > 1) {
          var nData = notesSheet.getRange(2, 1, nLastRow - 1, 3).getValues();
          for (var j = 0; j < nData.length; j++) {
            if (
              toDateStr(nData[j][0], tz) === date &&
              String(nData[j][1]).toLowerCase().trim() === userKey
            ) {
              leadNumber++;
            }
          }
        }

        notesSheet.appendRow([date, username, leadNumber, qlNote]);
        SpreadsheetApp.flush();

        return jsonResponse({ success: true, leadNumber: leadNumber, note: qlNote });
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}
