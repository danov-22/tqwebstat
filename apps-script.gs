// ─────────────────────────────────────────────────────────────────────────────
// TQ Statistic — Google Apps Script Backend
// HOW TO USE:
//   1. Open your Google Sheet → Extensions → Apps Script
//   2. Paste this entire file, replacing any existing code
//   3. Click Deploy → New Deployment → Web App
//      • Execute as: Me
//      • Who has access: Anyone
//   4. Copy the Web App URL — paste it into Settings in the app
//
// SHEETS NEEDED:
//   • "Stats"  — your existing stats data (columns: Date, QL, NI, HU, SNR, LB, DNC, FE, OOO, WN, FP, MP)
//   • "Users"  — login credentials (columns: Username, Password, Name)
//                Create this sheet manually and add rows like:
//                  trevor | mypassword | Trevor Lee
// ─────────────────────────────────────────────────────────────────────────────

var SHEET_NAME       = 'Stats';
var USERS_SHEET_NAME = 'Users';

// ── CORS helper ───────────────────────────────────────────────────────────────
function jsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── GET — fetch monthly stats ────────────────────────────────────────────────
function doGet(e) {
  try {
    var month = e.parameter.month; // e.g. "2026-07"
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ error: 'Sheet "Stats" not found. Please create it first.' });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse([]);
    }

    var data   = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    var result = [];
    var tz     = SpreadsheetApp.getActive().getSpreadsheetTimeZone();

    for (var i = 0; i < data.length; i++) {
      var row     = data[i];
      var dateVal = row[0];
      var dateStr = '';

      if (dateVal instanceof Date) {
        dateStr = Utilities.formatDate(dateVal, tz, 'yyyy-MM-dd');
      } else {
        dateStr = String(dateVal);
      }

      if (dateStr && (!month || dateStr.substring(0, 7) === month)) {
        result.push({
          date: dateStr,
          ql:  Number(row[1])  || 0,
          ni:  Number(row[2])  || 0,
          hu:  Number(row[3])  || 0,
          snr: Number(row[4])  || 0,
          lb:  Number(row[5])  || 0,
          dnc: Number(row[6])  || 0,
          fe:  Number(row[7])  || 0,
          ooo: Number(row[8])  || 0,
          wn:  Number(row[9])  || 0,
          fp:  Number(row[10]) || 0,
          mp:  Number(row[11]) || 0
        });
      }
    }

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ── POST — handles login AND stat recording ──────────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // ── Login request ──────────────────────────────────────────────────────
    // Called by login.html with: { action: "login", username: "...", password: "..." }
    if (body.action === 'login') {
      return handleLogin(body.username, body.password);
    }

    // ── Stat recording (existing behaviour) ───────────────────────────────
    return handleStatPost(body);

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ── Login handler ─────────────────────────────────────────────────────────────
function handleLogin(username, password) {

  if (!username || !password) {
    return jsonResponse({ success: false, error: 'Username and password are required.' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    return jsonResponse({
      success: false,
      error:
        'No "Users" sheet found. ' +
        'Create a sheet named Users with columns: Username | Password | Name'
    });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ success: false, error: 'No users found in the Users sheet.' });
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  for (var i = 0; i < rows.length; i++) {
    var sheetUsername = String(rows[i][0]).trim().toLowerCase();
    var sheetPassword = String(rows[i][1]).trim();
    var sheetName     = String(rows[i][2]).trim();

    if (
      sheetUsername === username.trim().toLowerCase() &&
      sheetPassword === password.trim()
    ) {
      // Generate a simple session token: base64 of username + timestamp
      var token = Utilities.base64Encode(
        username + ':' + new Date().getTime()
      );

      return jsonResponse({
        success: true,
        name:  sheetName || username,
        token: token
      });
    }
  }

  return jsonResponse({ success: false, error: 'Incorrect username or password.' });
}

// ── Stat recording (unchanged from original) ──────────────────────────────────
function handleStatPost(body) {
  var date     = body.date;
  var category = body.category;
  var delta    = Number(body.delta);
  var fp       = body.fp === true;
  var mp       = body.mp === true;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ error: 'Sheet "Stats" not found.' });
  }

  var colMap = {
    ql: 2, ni: 3, hu: 4, snr: 5, lb: 6, dnc: 7,
    fe: 8, ooo: 9, wn: 10, fp: 11, mp: 12
  };

  var colIndex = colMap[category.toLowerCase()];
  if (!colIndex) {
    return jsonResponse({ error: 'Unknown category: ' + category });
  }

  var lastRow  = sheet.getLastRow();
  var foundRow = -1;
  var tz       = SpreadsheetApp.getActive().getSpreadsheetTimeZone();

  if (lastRow > 1) {
    var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      var cellDate    = dates[i][0];
      var cellDateStr = '';
      if (cellDate instanceof Date) {
        cellDateStr = Utilities.formatDate(cellDate, tz, 'yyyy-MM-dd');
      } else {
        cellDateStr = String(cellDate);
      }
      if (String(cellDateStr).trim() === String(date).trim()) {
        foundRow = i + 2;
        break;
      }
    }
  }

  if (foundRow === -1) {
    var newRow         = [date, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    newRow[colIndex - 1] = Math.max(0, delta);
    if (fp) newRow[colMap.fp - 1] = Math.max(0, delta);
    if (mp) newRow[colMap.mp - 1] = Math.max(0, delta);
    sheet.appendRow(newRow);
    SpreadsheetApp.flush();
  } else {
    var cell        = sheet.getRange(foundRow, colIndex);
    var currentVal  = Number(cell.getValue()) || 0;
    cell.setValue(Math.max(0, currentVal + delta));

    if (fp) {
      var fpCell = sheet.getRange(foundRow, colMap.fp);
      fpCell.setValue(Math.max(0, Number(fpCell.getValue()) + delta));
    }
    if (mp) {
      var mpCell = sheet.getRange(foundRow, colMap.mp);
      mpCell.setValue(Math.max(0, Number(mpCell.getValue()) + delta));
    }
    SpreadsheetApp.flush();
  }

  return jsonResponse({ success: true });
}
