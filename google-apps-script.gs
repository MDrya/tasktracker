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
 * Every sync replaces the first sheet's contents with the current board,
 * so don't keep hand-typed notes on that sheet — add extra sheets in the
 * same spreadsheet instead, those are left untouched.
 */

var SHARED_SECRET = 'PASTE_THE_SAME_SECRET_HERE';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var values = [body.headers].concat(body.rows || []);

    sheet.clearContents();
    sheet
      .getRange(1, 1, values.length, body.headers.length)
      .setValues(values);
    sheet.getRange(1, 1, 1, body.headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    return json({ ok: true, rows: (body.rows || []).length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
