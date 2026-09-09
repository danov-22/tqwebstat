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
//             I=OOO, J=LB, K=FE, L=WN, M=FP, N=MP, O=Rejected
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
var NOTIFICATIONS_SHEET = 'Notifications';
var HISTORY_SHEET       = 'Stat_History';

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
    usersSheet.appendRow([
      'Username',
      'PasswordHash',
      'RecoveryPassword',
      'CreatedAt'
    ]);
    usersSheet.setFrozenRows(1);
  }

  // Stats sheet
  var statsSheet = ss.getSheetByName(STATS_SHEET);

  if (!statsSheet) {
    statsSheet = ss.insertSheet(STATS_SHEET);
    statsSheet.appendRow([
      'Date',
      'Username',
      'QL',
      'VM',
      'SNR',
      'NI',
      'HU',
      'DNC',
      'OOO',
      'LB',
      'FE',
      'WN',
      'FP',
      'MP'
    ]);
    statsSheet.setFrozenRows(1);
  }

  // QL notes sheet
  var notesSheet = ss.getSheetByName(NOTES_SHEET);

  if (!notesSheet) {
    notesSheet = ss.insertSheet(NOTES_SHEET);
    notesSheet.appendRow([
      'Date',
      'Username',
      'LeadNumber',
      'Note'
    ]);
    notesSheet.setFrozenRows(1);
  }

  // Notifications sheet
  var notificationsSheet =
    ss.getSheetByName(NOTIFICATIONS_SHEET);

  if (!notificationsSheet) {
    notificationsSheet =
      ss.insertSheet(NOTIFICATIONS_SHEET);

    notificationsSheet.appendRow([
      'ID',
      'Title',
      'Message',
      'Date'
    ]);

    notificationsSheet.setFrozenRows(1);
  }

  // Individual input history for permanent undo
  var historySheet = ss.getSheetByName(HISTORY_SHEET);

  if (!historySheet) {
    historySheet = ss.insertSheet(HISTORY_SHEET);

    historySheet.appendRow([
      'ID',
      'Date',
      'Username',
      'Category',
      'FP',
      'MP',
      'CreatedAt'
    ]);

    historySheet.setFrozenRows(1);
  }

  return {
    usersSheet: usersSheet,
    statsSheet: statsSheet,
    notesSheet: notesSheet,
    notificationsSheet: notificationsSheet,
    historySheet: historySheet
  };
}

// ── Date normaliser ───────────────────────────────────────────────
function toDateStr(val, tz) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
  }
  return String(val || '').trim();
}

// A short per-user/month cache avoids reading every Stats and QL_Notes row
// each time the dashboard opens. Every stat mutation clears its own cache.
function statsCacheKey(username, month) {
  var source = String(username || '').toLowerCase().trim() + '|' + String(month || '');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, source);
  var digest = bytes.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
  return 'tq_stats_' + digest;
}

function clearStatsCache(username, date) {
  CacheService.getScriptCache().remove(
    statsCacheKey(username, String(date || '').substring(0, 7))
  );
}

function statsRowCacheKey(date, username) {
  return 'tq_stats_row_' + statsCacheKey(username, date);
}

// Finds a daily Stats row without repeatedly reading the entire sheet. Cache
// entries are verified before use, so a stale cache cannot update another row.
function findStatsRow(statsSheet, date, username, tz) {
  var key = statsRowCacheKey(date, username);
  var cache = CacheService.getScriptCache();
  var cachedRow = Number(cache.get(key));
  var userKey = String(username).toLowerCase().trim();

  if (cachedRow >= 2 && cachedRow <= statsSheet.getLastRow()) {
    var cachedValues = statsSheet.getRange(cachedRow, 1, 1, 2).getValues()[0];
    if (toDateStr(cachedValues[0], tz) === date &&
        String(cachedValues[1]).toLowerCase().trim() === userKey) {
      return cachedRow;
    }
  }

  var lastRow = statsSheet.getLastRow();
  if (lastRow <= 1) return -1;
  var rows = statsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (toDateStr(rows[i][0], tz) === date &&
        String(rows[i][1]).toLowerCase().trim() === userKey) {
      var foundRow = i + 2;
      cache.put(key, String(foundRow), 21600);
      return foundRow;
    }
  }
  return -1;
}

// ════════════════════════════════════════════════════════════════════
// GET — fetch stats + QL notes + notifications
// ════════════════════════════════════════════════════════════════════
function apiGet(e) {
try {

  var action   = e.parameter.action || 'stats';
  var month    = e.parameter.month || '';
  var username = (e.parameter.username || '').trim();


  // ── Notifications ───────────────────────────────────────────────
  if (action === 'notifications') {

    var nSheet = SpreadsheetApp.getActive()
      .getSheetByName(NOTIFICATIONS_SHEET);

    if (!nSheet || nSheet.getLastRow() <= 1) {
      return jsonResponse({notifications: []});
    }

    var nData = nSheet
      .getRange(2,1,nSheet.getLastRow()-1,4)
      .getValues();

    return jsonResponse({
      notifications: nData.map(function(r){
        return {
          id: r[0],
          title: r[1],
          message: r[2],
          date: r[3]
        };
      })
    });
  }


  // ── Stats ───────────────────────────────────────────────────────
  if (action !== 'stats') {
    return jsonResponse({error:'Unknown action.'});
  }

  if (!username) {
    return jsonResponse({error:'Username is required.'});
  }

  var cachedStats = CacheService.getScriptCache().get(statsCacheKey(username, month));
  if (cachedStats) {
    return ContentService.createTextOutput(cachedStats)
      .setMimeType(ContentService.MimeType.JSON);
  }


  var sheets = ensureSheets();
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var userKey = username.toLowerCase();


  // ── Stats data ──────────────────────────────────────────────────
  var days = [];
  var statsSheet = sheets.statsSheet;
  var sLastRow = statsSheet.getLastRow();


  if (sLastRow > 1) {

    var sData = statsSheet
      .getRange(2,1,sLastRow-1,14)
      .getValues();


    sData.forEach(function(row){

      if (String(row[1]).toLowerCase().trim() !== userKey) return;

      var dateStr = toDateStr(row[0], tz);

      if (!dateStr) return;
      if (month && dateStr.substring(0,7) !== month) return;


      days.push({
        date: dateStr,
        ql: Number(row[2]) || 0,
        vm: Number(row[3]) || 0,
        snr: Number(row[4]) || 0,
        ni: Number(row[5]) || 0,
        hu: Number(row[6]) || 0,
        dnc: Number(row[7]) || 0,
        ooo: Number(row[8]) || 0,
        lb: Number(row[9]) || 0,
        fe: Number(row[10]) || 0,
        wn: Number(row[11]) || 0,
        fp: Number(row[12]) || 0,
        mp: Number(row[13]) || 0
      });

    });

  }


  // ── QL Notes ────────────────────────────────────────────────────
  var qlNotes = [];
  var notesSheet = sheets.notesSheet;
  var nLastRow = notesSheet.getLastRow();


  if (nLastRow > 1) {

    var notes = notesSheet
      .getRange(2,1,nLastRow-1,4)
      .getValues();


    notes.forEach(function(row){

      if (String(row[1]).toLowerCase().trim() !== userKey) return;


      var dateStr = toDateStr(row[0], tz);

      if (!dateStr) return;
      if (month && dateStr.substring(0,7) !== month) return;


      qlNotes.push({
        date: dateStr,
        leadNumber: Number(row[2]) || 0,
        note: String(row[3] || '').trim()
      });

    });

  }


  var statsResponse = {
    days: days,
    ql_notes: qlNotes
  };
  CacheService.getScriptCache().put(
    statsCacheKey(username, month),
    JSON.stringify(statsResponse),
    60
  );
  return jsonResponse(statsResponse);


} catch(err) {

  return jsonResponse({
    error: err.toString()
  });

}
}

// Web-app UI entry point. The old HTTP API remains available internally via
// apiGet/doPost, but the browser no longer calls it over ContentService.
function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('TQ Statistics')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://tqwebstat.vercel.app/tq-favicon.svg')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function serverRequest(payload) {
  var output = doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(output.getContent());
}

function serverMonthlyData(month, username) {
  var output = apiGet({ parameter: { action: 'stats', month: month, username: username } });
  return JSON.parse(output.getContent());
}

function serverNotifications() {
  var output = apiGet({ parameter: { action: 'notifications' } });
  return JSON.parse(output.getContent());
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

      usersSheet.appendRow([username, hashPassword(password), password, new Date().toISOString()]);
      SpreadsheetApp.flush();
      return jsonResponse({ success: true, username: username });
    }

    // ── Undo latest QL atomically ────────────────────────────────
    // Keeping the count and its note in one locked operation avoids the
    // two-request race that made undo slow and occasionally inconsistent.
    if (action === 'undoLastQL') {
      var undoDate = String(body.date || '').trim();
      var undoUsername = String(body.username || '').trim();
      if (!undoDate || !undoUsername) {
        return jsonResponse({ error: 'Date and username are required.' });
      }

      var undoLock = LockService.getScriptLock();
      undoLock.waitLock(10000);
      try {
        var undoSheets = ensureSheets();
        var undoStats = undoSheets.statsSheet;
        var undoNotes = undoSheets.notesSheet;
        var undoTz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
        var undoUserKey = undoUsername.toLowerCase();
        var undoStatsRow = -1;
        var undoLastStatsRow = undoStats.getLastRow();

        if (undoLastStatsRow > 1) {
          var undoRows = undoStats.getRange(2, 1, undoLastStatsRow - 1, 2).getValues();
          for (var u = 0; u < undoRows.length; u++) {
            if (toDateStr(undoRows[u][0], undoTz) === undoDate &&
                String(undoRows[u][1]).toLowerCase().trim() === undoUserKey) {
              undoStatsRow = u + 2;
              break;
            }
          }
        }

        if (undoStatsRow === -1) {
          return jsonResponse({ error: 'No Qualified Lead to undo.' });
        }

        var undoRange = undoStats.getRange(undoStatsRow, 1, 1, 14);
        var undoValues = undoRange.getValues()[0];
        if ((Number(undoValues[2]) || 0) <= 0) {
          return jsonResponse({ error: 'No Qualified Lead to undo.' });
        }
        undoValues[2] = Math.max(0, (Number(undoValues[2]) || 0) - 1);
        undoValues[12] = Math.max(0, (Number(undoValues[12]) || 0) - 1);
        undoValues[13] = Math.max(0, (Number(undoValues[13]) || 0) - 1);
        undoRange.setValues([undoValues]);

        var undoLastNoteRow = undoNotes.getLastRow();
        if (undoLastNoteRow > 1) {
          var undoNoteRows = undoNotes.getRange(2, 1, undoLastNoteRow - 1, 2).getValues();
          for (var n = undoNoteRows.length - 1; n >= 0; n--) {
            if (toDateStr(undoNoteRows[n][0], undoTz) === undoDate &&
                String(undoNoteRows[n][1]).toLowerCase().trim() === undoUserKey) {
              undoNotes.deleteRow(n + 2);
              break;
            }
          }
        }
        SpreadsheetApp.flush();
        clearStatsCache(undoUsername, undoDate);
        return jsonResponse({ success: true });
      } finally {
        undoLock.releaseLock();
      }
    }

// ── Delete specific QL + its note ─────────────────────────────

if (action === 'deleteQL') {

  var date = String(body.date || '').trim();
  var username = String(body.username || '').trim();
  var leadNumber = Number(body.leadNumber);

  if (!date || !username || !leadNumber) {
    return jsonResponse({
      error: 'Date, username and lead number are required.'
    });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {

    var sheets = ensureSheets();
    var statsSheet = sheets.statsSheet;
    var notesSheet = sheets.notesSheet;

    var tz = SpreadsheetApp
      .getActive()
      .getSpreadsheetTimeZone();

    var userKey = username.toLowerCase().trim();

    // ============================================================
    // 1. DELETE THE SPECIFIC QL NOTE
    // ============================================================

    var noteLastRow = notesSheet.getLastRow();

    if (noteLastRow > 1) {

      var noteData = notesSheet
        .getRange(2, 1, noteLastRow - 1, 4)
        .getValues();

      for (var i = noteData.length - 1; i >= 0; i--) {

        var rowDate = toDateStr(noteData[i][0], tz);
        var rowUser = String(noteData[i][1])
          .toLowerCase()
          .trim();

        var rowLead = Number(noteData[i][2]);

        if (
          rowDate === date &&
          rowUser === userKey &&
          rowLead === leadNumber
        ) {

          notesSheet.deleteRow(i + 2);
          break;

        }

      }

    }


    // ============================================================
    // 2. DECREASE QL COUNT BY 1
    // ============================================================

    var statsLastRow = statsSheet.getLastRow();
    var statsRow = -1;

    if (statsLastRow > 1) {

      var statsData = statsSheet
        .getRange(2, 1, statsLastRow - 1, 2)
        .getValues();

      for (var j = 0; j < statsData.length; j++) {

        var statsDate = toDateStr(statsData[j][0], tz);
        var statsUser = String(statsData[j][1])
          .toLowerCase()
          .trim();

        if (
          statsDate === date &&
          statsUser === userKey
        ) {

          statsRow = j + 2;
          break;

        }

      }

    }


    if (statsRow !== -1) {

      var qlCell = statsSheet.getRange(statsRow, 3);
      var currentQL = Number(qlCell.getValue()) || 0;

      qlCell.setValue(Math.max(0, currentQL - 1));

    }


    // ============================================================
    // 3. RENUMBER REMAINING LEADS
    // ============================================================

    noteLastRow = notesSheet.getLastRow();

    if (noteLastRow > 1) {

      var remainingNotes = notesSheet
        .getRange(2, 1, noteLastRow - 1, 4)
        .getValues();

      var nextLeadNumber = 1;

      for (var k = 0; k < remainingNotes.length; k++) {

        var remainingDate = toDateStr(
          remainingNotes[k][0],
          tz
        );

        var remainingUser = String(remainingNotes[k][1])
          .toLowerCase()
          .trim();

        if (
          remainingDate === date &&
          remainingUser === userKey
        ) {

          notesSheet
            .getRange(k + 2, 3)
            .setValue(nextLeadNumber);

          nextLeadNumber++;

        }

      }

    }


    SpreadsheetApp.flush();
    clearStatsCache(username, date);

    return jsonResponse({
      success: true,
      message: 'Qualified Lead rejected.',
      deletedLeadNumber: leadNumber
    });

  } finally {

    lock.releaseLock();

  }

}

    // ── Delete latest QL Note ───────────────────

    if (action === 'deleteLastNote') {
      var sheet = SpreadsheetApp
        .getActive()
        .getSheetByName('QL_Notes');

      if (!sheet) {
        return jsonResponse({
          error: 'QL_Notes sheet not found.'
        });
      }

      var data = sheet
        .getDataRange()
        .getValues();

      for (var i = data.length - 1; i >= 1; i--) {
        var rowDate = String(data[i][0]);
        var rowUser = String(data[i][1]);

        if (
          rowDate === body.date &&
          rowUser === body.username
        ) {
          sheet.deleteRow(i + 1);
          break;
        }

      }

      return jsonResponse({
        success:true
      });
    }

    // ── Create notification ─────────────────────────────

    function addNotification(title, message) {

      var ss = SpreadsheetApp.getActiveSpreadsheet();

      var sheet = ss.getSheetByName(NOTIFICATIONS_SHEET);


      if (!sheet) {
        sheet = ss.insertSheet(NOTIFICATIONS_SHEET);

        sheet.appendRow([
          'ID',
          'Title',
          'Message',
          'Date'
        ]);
      }


      var id = Utilities.getUuid();

      sheet.appendRow([
        id,
        title,
        message,
        new Date()
      ]);

    }

// ── Login ─────────────────────────────────────────────────────
if (action === 'login') {

  var username = String(body.username || '').trim();
  var password = String(body.password || '').trim();

  if (!username || !password) {
    return jsonResponse({
      error: 'Username and password are required.'
    });
  }

  var sheets = ensureSheets();
  var usersSheet = sheets.usersSheet;
  var lastRow = usersSheet.getLastRow();

  if (lastRow <= 1) {
    return jsonResponse({
      error: 'No users found. Please register first.'
    });
  }

  var rows = usersSheet
    .getRange(2, 1, lastRow - 1, 3)
    .getValues();

  var hash = hashPassword(password);

  for (var i = 0; i < rows.length; i++) {

    var storedUsername = String(rows[i][0])
      .toLowerCase()
      .trim();

    var storedHash = String(rows[i][1]).trim();
    var recoveryPassword = String(rows[i][2]).trim();

    if (
      storedUsername === username.toLowerCase() &&
      (
        storedHash === hash ||
        recoveryPassword === password
      )
    ) {

      return jsonResponse({
        success: true,
        username: rows[i][0]
      });

    }
  }

  return jsonResponse({
    error: 'Invalid username or password.'
  });
}

// ── Undo latest regular stat permanently ──────────────────────
  if (action === 'undoLastStat') {
    var undoDate = String(body.date || '').trim();
    var undoUsername = String(body.username || '').trim();
    var undoCategory = String(body.category || '').toLowerCase().trim();

    if (!undoDate || !undoUsername || !undoCategory) {
      return jsonResponse({
        error: 'Date, username and category are required.'
      });
    }

    if (undoCategory === 'ql') {
      return jsonResponse({
        error: 'Qualified Leads use the special QL undo action.'
      });
    }

    var undoColMap = {
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

    var undoCategoryColumn = undoColMap[undoCategory];

    if (!undoCategoryColumn) {
      return jsonResponse({
        error: 'Unknown category: ' + undoCategory
      });
    }

    var undoLock = LockService.getScriptLock();
    undoLock.waitLock(10000);

    try {
      var undoSheets = ensureSheets();
      var undoStatsSheet = undoSheets.statsSheet;
      var undoHistorySheet = undoSheets.historySheet;
      var undoTz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
      var undoUserKey = undoUsername.toLowerCase().trim();

      // Find the latest matching individual input
      var historyLastRow = undoHistorySheet.getLastRow();
      var historyRowNumber = -1;
      var historyFP = false;
      var historyMP = false;

      if (historyLastRow > 1) {
        var historyRows = undoHistorySheet
          .getRange(2, 1, historyLastRow - 1, 7)
          .getValues();

        for (var h = historyRows.length - 1; h >= 0; h--) {
          var historyDate = toDateStr(historyRows[h][1], undoTz);
          var historyUser = String(historyRows[h][2])
            .toLowerCase()
            .trim();
          var historyCategory = String(historyRows[h][3])
            .toLowerCase()
            .trim();

          if (
            historyDate === undoDate &&
            historyUser === undoUserKey &&
            historyCategory === undoCategory
          ) {
            historyRowNumber = h + 2;
            historyFP = historyRows[h][4] === true;
            historyMP = historyRows[h][5] === true;
            break;
          }
        }
      }

      if (historyRowNumber === -1) {
        return jsonResponse({
          error: 'No recorded ' + undoCategory.toUpperCase() + ' input to undo.'
        });
      }

      // Find this user's daily Stats row
      var undoStatsRow = findStatsRow(
        undoStatsSheet,
        undoDate,
        undoUsername,
        undoTz
      );

      if (undoStatsRow === -1) {
        return jsonResponse({
          error: 'The daily stats row could not be found.'
        });
      }

      var undoRange = undoStatsSheet.getRange(
        undoStatsRow,
        1,
        1,
        14
      );

      var undoValues = undoRange.getValues()[0];
      var currentCategoryCount =
        Number(undoValues[undoCategoryColumn - 1]) || 0;

      if (currentCategoryCount <= 0) {
        return jsonResponse({
          error: 'No ' + undoCategory.toUpperCase() + ' input to undo.'
        });
      }

      // Reverse the category and its original FP/MP selections
      undoValues[undoCategoryColumn - 1] =
        Math.max(0, currentCategoryCount - 1);

      if (historyFP) {
        undoValues[undoColMap.fp - 1] = Math.max(
          0,
          (Number(undoValues[undoColMap.fp - 1]) || 0) - 1
        );
      }

      if (historyMP) {
        undoValues[undoColMap.mp - 1] = Math.max(
          0,
          (Number(undoValues[undoColMap.mp - 1]) || 0) - 1
        );
      }

      undoRange.setValues([undoValues]);

      // Remove the history entry only after Stats was updated
      undoHistorySheet.deleteRow(historyRowNumber);

      SpreadsheetApp.flush();
      clearStatsCache(undoUsername, undoDate);

      return jsonResponse({
        success: true,
        category: undoCategory,
        fp: historyFP,
        mp: historyMP
      });

    } finally {
      undoLock.releaseLock();
    }
  }

// ── Record stat ───────────────────────────────────────────────
if (action === 'stat') {

  var date      = String(body.date     || '').trim();
  var username  = String(body.username || '').trim();
  var category  = String(body.category || '').toLowerCase();
  var delta     = Number(body.delta)   || 0;
  var fp        = body.fp === true;
  var mp        = body.mp === true;
  var qlNote    = String(body.ql_note || '').trim();

  if (!date || !username || !category) {
    return jsonResponse({
      error: 'Missing required fields.'
    });
  }

  // Column map — 1-indexed
  // A=Date
  // B=Username
  // C=QL
  // D=VM
  // E=SNR
  // F=NI
  // G=HU
  // H=DNC
  // I=OOO
  // J=LB
  // K=FE
  // L=WN
  // M=FP
  // N=MP
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
    return jsonResponse({
      error: 'Unknown category: ' + category
    });
  }

  var sheets     = ensureSheets();
  var statsSheet = sheets.statsSheet;
  var notesSheet = sheets.notesSheet;
  var historySheet = sheets.historySheet;

  var tz     = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var userKey = username.toLowerCase();

  // ------------------------------------------------------------
  // Find today's row for this user
  // ------------------------------------------------------------

  var foundRow = findStatsRow(statsSheet, date, username, tz);

  // ------------------------------------------------------------
  // Create row if it doesn't exist
  // ------------------------------------------------------------

  if (foundRow === -1) {

    var newRow = [
      date,
      username,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
      0,
      0
    ];

    newRow[colIndex - 1] = Math.max(0, delta);

    if (fp) {
      newRow[colMap.fp - 1] = Math.max(0, delta);
    }

    if (mp) {
      newRow[colMap.mp - 1] = Math.max(0, delta);
    }

    statsSheet.appendRow(newRow);
    CacheService.getScriptCache().put(
      statsRowCacheKey(date, username),
      String(statsSheet.getLastRow()),
      21600
    );

  } else {

    // ----------------------------------------------------------
    // Read the whole stats row ONCE
    // instead of repeatedly calling getValue()/setValue()
    // ----------------------------------------------------------

    var rowRange = statsSheet.getRange(foundRow, 1, 1, 14);
    var rowValues = rowRange.getValues()[0];

    rowValues[colIndex - 1] =
      Math.max(0, (Number(rowValues[colIndex - 1]) || 0) + delta);

    if (fp) {
      rowValues[colMap.fp - 1] =
        Math.max(0, (Number(rowValues[colMap.fp - 1]) || 0) + delta);
    }

    if (mp) {
      rowValues[colMap.mp - 1] =
        Math.max(0, (Number(rowValues[colMap.mp - 1]) || 0) + delta);
    }

    rowRange.setValues([rowValues]);
  }

  clearStatsCache(username, date);
  
  // Store each non-QL input so it can be undone after a refresh.
  // QL keeps using its existing special undo and notes system.
  if (delta === 1 && category !== 'ql') {
    historySheet.appendRow([
      Utilities.getUuid(),
      date,
      username,
      category,
      fp,
      mp,
      new Date()
    ]);
  }

  // ------------------------------------------------------------
  // QL note
  // ------------------------------------------------------------

  if (category === 'ql' && delta === 1) {

    var leadNumber = 1;
    var nLastRow   = notesSheet.getLastRow();

    if (nLastRow > 1) {

      var nData = notesSheet
        .getRange(2, 1, nLastRow - 1, 3)
        .getValues();

      for (var j = 0; j < nData.length; j++) {

        var noteDate = toDateStr(nData[j][0], tz);
        var noteUser = String(nData[j][1]).toLowerCase().trim();

        if (noteDate === date && noteUser === userKey) {
          leadNumber++;
        }
      }
    }

    notesSheet.appendRow([
      date,
      username,
      leadNumber,
      qlNote
    ]);

    return jsonResponse({
      success: true,
      leadNumber: leadNumber,
      note: qlNote
    });
  }

  return jsonResponse({
    success: true
  });
}

    return jsonResponse({ error: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}
