/**
 * Paste into the Google Sheet: Extensions → Apps Script
 *
 * 1. Sheet row 1 headers (exact order):
 *    Timestamp | FirstName | LastName | Email | Industry | TechNeed | Message | Source | RiskScore
 *
 * 2. Project Settings → Script properties:
 *    GCP_PROJECT_ID          = your GCP project id (e.g. figma-shadcn or zepfusion-prod)
 *    RECAPTCHA_ENTERPRISE_API_KEY = API key with "reCAPTCHA Enterprise API" enabled
 *    RECAPTCHA_SITE_KEY      = same site key as on the website (public key)
 *
 * 3. GCP: enable "reCAPTCHA Enterprise API" for the project; create an API key restricted to that API.
 *
 * 4. Deploy → New deployment → Web app
 *    Execute as: Me
 *    Who has access: Anyone
 *    Copy /exec URL into index.html ZF_ENQUIRY_CONFIG.scriptUrl
 */
var RECAPTCHA_ACTION = 'enquiry_submit';
var MIN_SCORE = 0.3;

/**
 * Opening the /exec URL in a browser sends GET — without doGet, Apps Script shows
 * "Script function not found: doGet". The contact form uses POST only.
 */
function doGet() {
  return ContentService.createTextOutput(
    'Zepfusion enquiry endpoint is active. Submissions use POST from zepfusion.com only.'
  ).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var p = e.parameter || {};
  if (p.website && String(p.website).trim() !== '') {
    return ContentService.createTextOutput('ok');
  }

  var token = p.recaptchaToken;
  if (!token) {
    return ContentService.createTextOutput('error: missing token');
  }

  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty('GCP_PROJECT_ID');
  var apiKey = props.getProperty('RECAPTCHA_ENTERPRISE_API_KEY');
  var siteKey = props.getProperty('RECAPTCHA_SITE_KEY');

  var check = verifyEnterpriseToken_(token, siteKey, projectId, apiKey);
  if (!check.ok) {
    return ContentService.createTextOutput('error: captcha');
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
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
    return ContentService.createTextOutput('error: sheet ' + err);
  }
  return ContentService.createTextOutput('ok');
}

function verifyEnterpriseToken_(token, siteKey, projectId, apiKey) {
  if (!token || !siteKey || !projectId || !apiKey) {
    return { ok: false, score: 0 };
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
      expectedAction: RECAPTCHA_ACTION,
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
    return { ok: false, score: 0 };
  }
  var body = JSON.parse(text);
  var valid = body.tokenProperties && body.tokenProperties.valid === true;
  var act = (body.tokenProperties && body.tokenProperties.action) || '';
  var actionOk = act === '' || act === RECAPTCHA_ACTION;
  var score = (body.riskAnalysis && body.riskAnalysis.score) || 0;
  var ok = valid && actionOk && score >= MIN_SCORE;
  return { ok: ok, score: score };
}
