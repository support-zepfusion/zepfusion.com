/**
 * Paste into the Google Sheet: Extensions → Apps Script
 *
 * 1. Sheet row 1 headers (exact order):
 *    Timestamp | FirstName | LastName | Email | Industry | TechNeed | Message | Source | RiskScore
 *
 * 2. Project Settings → Script properties:
 *    GCP_PROJECT_ID          = your GCP project id
 *    RECAPTCHA_ENTERPRISE_API_KEY = API key with "reCAPTCHA Enterprise API" enabled
 *    RECAPTCHA_SITE_KEY      = same site key as on the website (public key)
 *    SPREADSHEET_ID          = required if this project is NOT bound to the Sheet (copy from the Sheet URL:
 *                            https://docs.google.com/spreadsheets/d/THIS_PART/edit )
 *    SHEET_NAME              = optional tab name (default: active/first sheet)
 *
 * 3. GCP: enable "reCAPTCHA Enterprise API"; create an API key restricted to that API.
 *
 * 4. Deploy → New deployment → Web app
 *    Execute as: Me
 *    Who has access: Anyone
 *    Copy /exec URL into index.html ZF_ENQUIRY_CONFIG.scriptUrl
 *
 * reCAPTCHA: Checkbox tokens differ from score-based (v3) tokens — do not require a score
 * when the API omits riskAnalysis, and do not send expectedAction in createAssessment
 * for checkbox flows (see verifyEnterpriseToken_).
 */
var RECAPTCHA_ACTION = 'enquiry_submit';
var MIN_SCORE = 0.3;

function doGet() {
  return ContentService.createTextOutput(
    'Zepfusion enquiry endpoint is active. Submissions use POST from zepfusion.com only.'
  ).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Accepts JSON body (recommended) or form fields in e.parameter.
 * Website should POST with Content-Type: text/plain;charset=utf-8 and JSON body so the
 * browser can read the response (CORS-friendly simple request).
 */
function doPost(e) {
  var p = parsePostPayload_(e);
  if (p.website && String(p.website).trim() !== '') {
    return textOut_('ok');
  }

  var token = p.recaptchaToken;
  if (!token) {
    return textOut_('error: missing token');
  }

  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty('GCP_PROJECT_ID');
  var apiKey = props.getProperty('RECAPTCHA_ENTERPRISE_API_KEY');
  var siteKey = props.getProperty('RECAPTCHA_SITE_KEY');

  var check = verifyEnterpriseToken_(token, siteKey, projectId, apiKey);
  if (!check.ok) {
    return textOut_('error: captcha');
  }

  try {
    var sheet = getEnquirySheet_(props);
    sheet.appendRow([
      new Date(),
      p.firstName || '',
      p.lastName || '',
      p.email || '',
      p.industry || '',
      p.techNeed || '',
      p.message || '',
      p.source || '',
      check.score,
    ]);
  } catch (err) {
    return textOut_('error: sheet ' + err);
  }
  return textOut_('ok');
}

function parsePostPayload_(e) {
  var p = {};
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    p = shallowCopy_(e.parameter);
  }
  if (e.postData && e.postData.contents) {
    var raw = String(e.postData.contents).trim();
    if (raw.charAt(0) === '{') {
      try {
        var j = JSON.parse(raw);
        if (j && typeof j === 'object') {
          p = Object.assign(p, j);
        }
      } catch (ignore) {}
    }
  }
  return p;
}

function shallowCopy_(obj) {
  var o = {};
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) o[k] = obj[k];
  }
  return o;
}

function textOut_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Web apps often have no "active" spreadsheet unless the script was created via the Sheet
 * (Extensions → Apps Script). If SPREADSHEET_ID is set, open that file by id.
 */
function getEnquirySheet_(props) {
  var id = props.getProperty('SPREADSHEET_ID');
  var ss = null;
  if (id && String(id).replace(/\s/g, '') !== '') {
    ss = SpreadsheetApp.openById(String(id).trim());
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!ss) {
    throw new Error(
      'Set Script property SPREADSHEET_ID to your Google Sheet id, or recreate this script from inside the Sheet (Extensions → Apps Script).'
    );
  }
  var tab = props.getProperty('SHEET_NAME');
  if (tab && String(tab).replace(/\s/g, '') !== '') {
    var byName = ss.getSheetByName(String(tab).trim());
    if (byName) {
      return byName;
    }
  }
  var active = ss.getActiveSheet();
  if (active) {
    return active;
  }
  var sheets = ss.getSheets();
  if (sheets && sheets.length > 0) {
    return sheets[0];
  }
  throw new Error('Spreadsheet has no sheets.');
}

/**
 * Checkbox / challenge tokens: tokenProperties.valid is the main signal.
 * Do not send expectedAction in createAssessment for checkbox widgets — it can cause
 * mismatches. Score-based (execute) tokens include riskAnalysis.score; only then apply MIN_SCORE.
 */
function verifyEnterpriseToken_(token, siteKey, projectId, apiKey) {
  if (!token || !siteKey || !projectId || !apiKey) {
    return { ok: false, score: '' };
  }
  var url =
    'https://recaptchaenterprise.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/assessments?key=' +
    encodeURIComponent(apiKey);
  var payload = {
    event: {
      token: token,
      siteKey: siteKey,
    },
  };
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code !== 200) {
    return { ok: false, score: '' };
  }
  var body = JSON.parse(text);
  var valid = body.tokenProperties && body.tokenProperties.valid === true;
  var act = (body.tokenProperties && body.tokenProperties.action) || '';
  var scoreNum = body.riskAnalysis && typeof body.riskAnalysis.score === 'number' ? body.riskAnalysis.score : null;

  if (!valid) {
    return { ok: false, score: scoreNum !== null ? scoreNum : '' };
  }
  if (act !== '' && act !== RECAPTCHA_ACTION) {
    return { ok: false, score: scoreNum !== null ? scoreNum : '' };
  }

  /** Checkbox challenge: action is usually empty — rely on valid. Score-based execute: enforce MIN_SCORE. */
  var ok = true;
  if (act === RECAPTCHA_ACTION) {
    ok = scoreNum !== null && scoreNum >= MIN_SCORE;
  }

  var scoreCell = scoreNum !== null ? scoreNum : '';
  return { ok: ok, score: scoreCell };
}
