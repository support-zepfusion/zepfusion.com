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
 *    RECAPTCHA_MIN_SCORE     = optional, 0–1 (default 0.5). When the assessment returns a
 *                            risk score, submissions below this are rejected. Omit property
 *                            to use the default. Set e.g. 0.3 to be more permissive.
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
/** Used when Script property RECAPTCHA_MIN_SCORE is not set. 0.5 is a common stricter cutoff. */
var DEFAULT_MIN_SCORE = 0.5;

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

  var minScore = resolveMinScore_(props);
  var check = verifyEnterpriseToken_(token, siteKey, projectId, apiKey, minScore);
  if (!check.ok) {
    if (check.reason === 'low_score') {
      return textOut_('error: score');
    }
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

/** Min risk score 0–1 (higher = more likely legitimate). Script property RECAPTCHA_MIN_SCORE overrides. */
function resolveMinScore_(props) {
  var raw = props.getProperty('RECAPTCHA_MIN_SCORE');
  if (raw == null || String(raw).replace(/\s/g, '') === '') {
    return DEFAULT_MIN_SCORE;
  }
  var n = parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 1) {
    return DEFAULT_MIN_SCORE;
  }
  return n;
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
 * When riskAnalysis.score is present (0–1), it must be >= minScore or the request is rejected.
 * If the API omits a score (some checkbox-only responses), we still accept when valid === true.
 */
function verifyEnterpriseToken_(token, siteKey, projectId, apiKey, minScore) {
  if (!token || !siteKey || !projectId || !apiKey) {
    return { ok: false, score: '', reason: 'config' };
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
    Logger.log('reCAPTCHA Enterprise HTTP ' + code + ' ' + String(text).substring(0, 400));
    return { ok: false, score: '', reason: 'http' };
  }
  var body;
  try {
    body = JSON.parse(text);
  } catch (parseErr) {
    Logger.log('reCAPTCHA Enterprise JSON parse error: ' + String(text).substring(0, 400));
    return { ok: false, score: '', reason: 'parse' };
  }
  var valid = body.tokenProperties && body.tokenProperties.valid === true;
  var scoreNum = body.riskAnalysis && typeof body.riskAnalysis.score === 'number' ? body.riskAnalysis.score : null;

  if (!valid) {
    Logger.log('reCAPTCHA token invalid: ' + JSON.stringify(body.tokenProperties || {}));
    return { ok: false, score: scoreNum !== null ? scoreNum : '', reason: 'invalid' };
  }

  if (scoreNum !== null && scoreNum < minScore) {
    Logger.log('reCAPTCHA score too low: ' + scoreNum + ' (min ' + minScore + ')');
    return { ok: false, score: scoreNum, reason: 'low_score' };
  }

  var scoreCell = scoreNum !== null ? scoreNum : '';
  return { ok: true, score: scoreCell, reason: '' };
}
