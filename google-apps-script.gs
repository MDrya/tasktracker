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

// Order columns A–D repeat for every subtask of the same order, so they
// get merged into one block per order.
var ORDER_COLUMN_COUNT = 4;
var DONE_COLUMN = 7;

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

    // Merges and fills survive clearContents(), so a shrinking board would
    // otherwise leave stale merged blocks and colour behind. Break every
    // merge and clear formatting before rewriting.
    sheet
      .getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
      .breakApart();
    sheet.clear();

    var values = [headers].concat(rows);
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    if (rows.length > 0) {
      // Colour the done column. Every data row is written explicitly
      // (blank rows included) so no stale fill can linger.
      var backgrounds = [];
      for (var r = 0; r < rows.length; r++) {
        var value = rows[r][DONE_COLUMN - 1];
        backgrounds.push([
          value === 'Yes'
            ? DONE_BACKGROUND
            : value === 'No'
              ? NOT_DONE_BACKGROUND
              : NO_BACKGROUND,
        ]);
      }
      sheet.getRange(2, DONE_COLUMN, rows.length, 1).setBackgrounds(backgrounds);

      // Merge the order columns down each order's block. Groups arrive
      // from the app, which knows which rows are genuinely the same order
      // — identical text is not treated as the same order.
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        if (group.count < 2) continue;
        sheet
          .getRange(2 + group.start, 1, group.count, ORDER_COLUMN_COUNT)
          .mergeVertically();
      }

      // Centre the merged order cells against their subtask rows.
      sheet
        .getRange(2, 1, rows.length, ORDER_COLUMN_COUNT)
        .setVerticalAlignment('middle');
    }

    return json({ ok: true, rows: rows.length, merged: groups.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
