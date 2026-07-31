/**
 * TaskTracker → Google Sheets sync.
 *
 * Paste this into your spreadsheet's Apps Script editor
 * (Extensions → Apps Script), replace SHARED_SECRET below with the same
 * value you put in SHEETS_SHARED_SECRET, then Deploy → New deployment →
 * Web app, with:
 *
 *   Execute as:      Me
 *   Who has access:  Anyone
 *
 * "Anyone" is required because the TaskTracker server calls this URL
 * without a Google login — the shared secret below is what actually
 * guards it, so keep both the URL and the secret private.
 *
 * Copy the deployment URL into GOOGLE_SHEETS_WEBAPP_URL.
 *
 * UPDATING THIS SCRIPT LATER: editing the code is not enough — a web app
 * serves whichever version it was deployed with. Use
 * Deploy → Manage deployments → pencil → Version: "New version" → Deploy.
 * That keeps the same URL, so nothing needs changing on the app side.
 *
 * Every sync replaces the first sheet's contents with the current board,
 * so don't keep hand-typed notes on that sheet — add extra sheets in the
 * same spreadsheet instead, those are left untouched.
 */

// Replace with the same value as SHEETS_SHARED_SECRET in .env.local.
// Keep the real secret out of this file — the repo is public; it belongs
// only in the Apps Script editor and your environment variables.
var SHARED_SECRET = 'PASTE_THE_SAME_SECRET_HERE';

// The column layout arrives with each request, so adding or reordering
// columns in the app never requires redeploying this script. These are
// only fallbacks for an older app version that doesn't send a layout.
var DEFAULT_ORDER_COLUMN_COUNT = 5;
var DEFAULT_DONE_COLUMN = 8;

var DONE_BACKGROUND = '#d9ead3'; // light green
var NOT_DONE_BACKGROUND = '#f4cccc'; // light red
var NO_BACKGROUND = '#ffffff';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var headers = body.headers;
    var rows = body.rows || [];
    var groups = body.groups || [];
    var orderColumnCount = body.orderColumns || DEFAULT_ORDER_COLUMN_COUNT;
    var doneColumn = body.doneColumn || DEFAULT_DONE_COLUMN;
    var formats = body.formats || [];

    // Merges and fills survive clearContents(), so a shrinking board would
    // otherwise leave stale merged blocks and colour behind. Break every
    // merge and clear formatting before rewriting.
    sheet
      .getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
      .breakApart();
    sheet.clear();

    // Number formats are applied BEFORE the values. Sheets keeps a
    // column's previous format when the data underneath it changes, so a
    // column that once held dates renders a plain number as a date — a
    // total of 250 shows as 1900-09-06. Applying formats first also stops
    // setValues parsing a title like "1/2" into a date; setting the format
    // afterwards would be too late and would expose the raw serial number.
    if (rows.length > 0) {
      for (var c = 0; c < formats.length && c < headers.length; c++) {
        sheet.getRange(2, c + 1, rows.length, 1).setNumberFormat(formats[c]);
      }
    }

    var values = [headers].concat(rows);
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    if (rows.length > 0) {
      // Colour the done column. Every data row is written explicitly
      // (blank rows included) so no stale fill can linger.
      var backgrounds = [];
      for (var r = 0; r < rows.length; r++) {
        var value = rows[r][doneColumn - 1];
        backgrounds.push([
          value === 'Yes'
            ? DONE_BACKGROUND
            : value === 'No'
              ? NOT_DONE_BACKGROUND
              : NO_BACKGROUND,
        ]);
      }
      sheet.getRange(2, doneColumn, rows.length, 1).setBackgrounds(backgrounds);

      // Merge the order columns down each order's block. Groups arrive
      // from the app, which knows which rows are genuinely the same order
      // — identical text is not treated as the same order.
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        if (group.count < 2) continue;
        sheet
          .getRange(2 + group.start, 1, group.count, orderColumnCount)
          .mergeVertically();
      }

      // Centre the merged order cells against their subtask rows.
      sheet
        .getRange(2, 1, rows.length, orderColumnCount)
        .setVerticalAlignment('middle');
    }

    var summaryRows = writeSummary(body.summary);

    return json({
      ok: true,
      rows: rows.length,
      merged: groups.length,
      summaryRows: summaryRows,
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Write the workload summary to its own tab, created on first run.
 *
 * It deliberately does not live on the data tab, which is wiped and
 * rewritten every sync. Everything about it — tab name, headers, formats
 * — arrives in the payload, so changing the summary later is an app-side
 * change and needs no redeploy of this script.
 */
function writeSummary(summary) {
  if (!summary || !summary.sheetName) return 0;

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(summary.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(summary.sheetName);

  var headers = summary.headers || [];
  var rows = summary.rows || [];
  var formats = summary.formats || [];
  if (headers.length === 0) return 0;

  sheet.clear();

  if (rows.length > 0) {
    for (var c = 0; c < formats.length && c < headers.length; c++) {
      sheet.getRange(2, c + 1, rows.length, 1).setNumberFormat(formats[c]);
    }
  }

  var values = [headers].concat(rows);
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  return rows.length;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
