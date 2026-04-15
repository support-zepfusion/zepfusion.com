/**
 * Zepfusion contact form → Google Apps Script Web App (Sheet + reCAPTCHA Enterprise).
 * Uses Google Cloud “widget” integration: plain enterprise.js (no ?render=) + grecaptcha.enterprise.render.
 * Configure window.ZF_ENQUIRY_CONFIG in index.html <head>.
 */
(function () {
  var form = document.getElementById('zf-enquiry-form');
  if (!form) return;

  var statusEl = document.getElementById('zf-enquiry-status');
  var submitBtn = document.getElementById('zf-enquiry-submit');

  function cfg() {
    return window.ZF_ENQUIRY_CONFIG || {};
  }

  function setStatus(type, message) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.className = 'zf-enquiry-status' + (type ? ' zf-enquiry-status--' + type : '');
    statusEl.setAttribute('role', 'status');
  }

  var enterpriseLoadFailed = false;
  /** Set after grecaptcha.enterprise.render (number widget id). */
  var widgetId = null;
  var widgetRendered = false;

  function injectEnterpriseScript(onload, onerror) {
    if (window.grecaptcha && window.grecaptcha.enterprise) {
      onload();
      return;
    }
    var existing =
      document.getElementById('zf-recaptcha-enterprise-loader') ||
      document.querySelector('script[data-zf-recaptcha-enterprise]');
    if (existing) {
      if (enterpriseLoadFailed) {
        existing.remove();
      } else {
        if (window.grecaptcha && window.grecaptcha.enterprise) {
          onload();
          return;
        }
        existing.addEventListener('load', onload);
        existing.addEventListener('error', onerror);
        return;
      }
    }
    var s = document.createElement('script');
    s.setAttribute('data-zf-recaptcha-enterprise', '1');
    s.id = 'zf-recaptcha-enterprise-loader';
    s.async = true;
    s.defer = true;
    s.src = 'https://www.google.com/recaptcha/enterprise.js';
    s.onload = onload;
    s.onerror = onerror;
    document.head.appendChild(s);
  }

  var siteKey = (cfg().siteKey || '').trim();

  function captchaUnavailableMessage() {
    if (window.location && window.location.protocol === 'file:') {
      return 'Open this page from your live site (https://zepfusion.com) or a local server — reCAPTCHA does not run from a saved file (file://).';
    }
    if (window.ZF_RECAPTCHA_LOAD_FAILED) {
      return 'reCAPTCHA could not load (blocked or offline). Allow google.com and gstatic.com, turn off ad blockers for this site, then refresh.';
    }
    if (enterpriseLoadFailed) {
      return 'The security script was blocked or could not load. Allow scripts from google.com on this page (pause ad blockers / privacy extensions), then refresh. In Google Cloud → reCAPTCHA Enterprise, ensure this domain is allowed for your key.';
    }
    return 'Security check is still loading. Wait a few seconds and try again, or refresh the page.';
  }

  function renderWidget() {
    var host = document.getElementById('zf-recaptcha');
    if (!host || !siteKey || widgetRendered) return;
    if (!window.grecaptcha || !grecaptcha.enterprise) return;

    grecaptcha.enterprise.ready(function () {
      if (widgetRendered) return;
      try {
        var isLight = document.documentElement.getAttribute('data-theme') === 'light';
        widgetId = grecaptcha.enterprise.render('zf-recaptcha', {
          sitekey: siteKey,
          theme: isLight ? 'light' : 'dark',
        });
        widgetRendered = true;
      } catch (err) {
        setStatus('error', 'Could not show security check. Refresh the page or email support@zepfusion.com.');
      }
    });
  }

  function ensureApiThenRender() {
    if (window.grecaptcha && grecaptcha.enterprise) {
      renderWidget();
      return;
    }
    if (window.ZF_RECAPTCHA_LOAD_FAILED) return;
    var n = 0;
    var t = setInterval(function () {
      if (window.grecaptcha && grecaptcha.enterprise) {
        clearInterval(t);
        renderWidget();
      } else if (window.ZF_RECAPTCHA_LOAD_FAILED) {
        clearInterval(t);
      } else if (++n > 200) {
        clearInterval(t);
        if (!enterpriseLoadFailed) {
          enterpriseLoadFailed = true;
          injectEnterpriseScript(
            function () {
              enterpriseLoadFailed = false;
              renderWidget();
            },
            function () {
              enterpriseLoadFailed = true;
            }
          );
        }
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureApiThenRender);
  } else {
    ensureApiThenRender();
  }

  document.addEventListener('zf-theme-changed', function () {
    if (!widgetRendered || widgetId === null) return;
    try {
      grecaptcha.enterprise.reset(widgetId);
    } catch (e) {}
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = cfg();
    var endpoint = (c.scriptUrl || '').trim();

    if (!endpoint) {
      setStatus('error', 'This form is not connected yet. Please email support@zepfusion.com.');
      return;
    }

    if (!siteKey) {
      setStatus('error', 'reCAPTCHA site key is not configured.');
      return;
    }

    var fd = new FormData(form);
    if (fd.get('website')) {
      setStatus('error', '');
      return;
    }

    submitBtn.disabled = true;
    setStatus('info', 'Verifying…');

    var failsafeTimer = setTimeout(function () {
      submitBtn.disabled = false;
      setStatus(
        'error',
        'This is taking too long. Refresh the page, allow scripts from google.com (turn off ad blockers for zepfusion.com), then try again.'
      );
    }, 55000);

    function clearFailsafe() {
      clearTimeout(failsafeTimer);
    }

    function send(token) {
      setStatus('info', 'Sending…');
      /** JSON in body + text/plain avoids CORS preflight; browser can read response text from GAS. */
      var payload = {
        firstName: fd.get('firstName') || '',
        lastName: fd.get('lastName') || '',
        email: fd.get('email') || '',
        industry: fd.get('industry') || '',
        techNeed: fd.get('techNeed') || '',
        message: fd.get('message') || '',
        source: fd.get('source') || 'home',
        recaptchaToken: token,
      };

      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var fetchTimer = setTimeout(function () {
        if (controller) controller.abort();
      }, 45000);

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'cors',
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          return res.text().then(function (text) {
            return { res: res, text: text };
          });
        })
        .then(function (_ref) {
          var text = (_ref.text || '').trim();
          var ok = text === 'ok';
          if (ok) {
            form.reset();
            if (widgetId !== null && window.grecaptcha && grecaptcha.enterprise) {
              try {
                grecaptcha.enterprise.reset(widgetId);
              } catch (err) {}
            }
            setStatus('success', 'Thank you — we received your message and will get back to you soon.');
            return;
          }
          var errMsg =
            text.indexOf('error: captcha') === 0
              ? 'Security verification failed. Complete the checkbox again and try, or email support@zepfusion.com.'
              : text.indexOf('error:') === 0
                ? 'Could not save your message. Please try again or email support@zepfusion.com.'
                : 'Something went wrong. Please email support@zepfusion.com.';
          setStatus('error', errMsg);
        })
        .catch(function () {
          setStatus(
            'error',
            'Could not reach our form server (network or browser block). Check your connection, try another browser, or email support@zepfusion.com.'
          );
        })
        .finally(function () {
          clearTimeout(fetchTimer);
          clearFailsafe();
          submitBtn.disabled = false;
        });
    }

    function finishError(msg) {
      clearFailsafe();
      setStatus('error', msg);
      submitBtn.disabled = false;
    }

    if (window.ZF_RECAPTCHA_LOAD_FAILED && !window.grecaptcha) {
      finishError(captchaUnavailableMessage());
      return;
    }

    if (!window.grecaptcha || !grecaptcha.enterprise) {
      finishError(captchaUnavailableMessage());
      return;
    }

    if (widgetId === null || widgetId === undefined) {
      finishError('Security check is still loading. Wait a moment and try again.');
      return;
    }

    var token = grecaptcha.enterprise.getResponse(widgetId);
    if (!token || String(token).length < 10) {
      finishError('Please complete the security check above, then click Send again.');
      return;
    }

    send(token);
  });
})();
