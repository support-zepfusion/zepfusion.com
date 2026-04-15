/**
 * Zepfusion contact form → Google Apps Script Web App (Sheet + reCAPTCHA Enterprise).
 * Configure window.ZF_ENQUIRY_CONFIG before this file (see index.html).
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

  function injectEnterpriseScript(siteKey, onload, onerror) {
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
    s.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + encodeURIComponent(siteKey);
    s.async = true;
    s.onload = onload;
    s.onerror = onerror;
    document.head.appendChild(s);
  }

  var siteKey = (cfg().siteKey || '').trim();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = cfg();
    var action = (c.action || 'enquiry_submit').trim();
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

    function withTimeout(promise, ms, errMsg) {
      return Promise.race([
        Promise.resolve(promise),
        new Promise(function (_, reject) {
          setTimeout(function () {
            reject(new Error(errMsg || 'timeout'));
          }, ms);
        }),
      ]);
    }

    function send(token) {
      setStatus('info', 'Sending…');
      var params = new URLSearchParams();
      fd.forEach(function (value, key) {
        if (key !== 'website') params.append(key, value);
      });
      params.set('recaptchaToken', token);
      params.set('source', fd.get('source') || 'home');

      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var fetchTimer = setTimeout(function () {
        if (controller) controller.abort();
      }, 45000);

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString(),
        mode: 'no-cors',
        signal: controller ? controller.signal : undefined,
      })
        .then(function () {
          form.reset();
          setStatus('success', 'Thank you — we received your message and will get back to you soon.');
        })
        .catch(function () {
          setStatus('success', 'Thank you — if you do not hear from us within two business days, email support@zepfusion.com.');
        })
        .finally(function () {
          clearTimeout(fetchTimer);
          clearFailsafe();
          submitBtn.disabled = false;
        });
    }

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

    function runCaptcha() {
      function runToken() {
        setStatus('info', 'Verifying…');

        if (!window.grecaptcha || !grecaptcha.enterprise) {
          clearFailsafe();
          setStatus('error', captchaUnavailableMessage());
          submitBtn.disabled = false;
          return;
        }

        function finishError(msg) {
          clearFailsafe();
          setStatus('error', msg);
          submitBtn.disabled = false;
        }

        function afterToken(token) {
          if (!token || String(token).length < 10) {
            finishError('Security verification returned no token. Refresh the page and try again.');
            return;
          }
          send(token);
        }

        try {
          var execPromise = grecaptcha.enterprise.execute(siteKey, { action: action });
          withTimeout(execPromise, 25000, 'execute-timeout')
            .then(afterToken)
            .catch(function () {
              finishError(
                'Security check timed out or failed. Keep this tab active, refresh, allow google.com (disable ad blockers), and confirm zepfusion.com is allowed for your reCAPTCHA key in Google Cloud.'
              );
            });
        } catch (err) {
          finishError(captchaUnavailableMessage());
        }
      }

      if (window.ZF_RECAPTCHA_LOAD_FAILED && !window.grecaptcha) {
        clearFailsafe();
        setStatus('error', captchaUnavailableMessage());
        submitBtn.disabled = false;
        return;
      }

      if (window.grecaptcha && grecaptcha.enterprise) {
        runToken();
        return;
      }

      setStatus('info', 'Loading security check…');

      if (enterpriseLoadFailed) {
        enterpriseLoadFailed = false;
        injectEnterpriseScript(
          siteKey,
          function () {
            runToken();
          },
          function () {
            enterpriseLoadFailed = true;
            clearFailsafe();
            setStatus('error', captchaUnavailableMessage());
            submitBtn.disabled = false;
          }
        );
        return;
      }

      var waitStart = Date.now();
      var t = setInterval(function () {
        if (window.ZF_RECAPTCHA_LOAD_FAILED && !window.grecaptcha) {
          clearInterval(t);
          clearFailsafe();
          setStatus('error', captchaUnavailableMessage());
          submitBtn.disabled = false;
          return;
        }
        if (window.grecaptcha && grecaptcha.enterprise) {
          clearInterval(t);
          runToken();
        } else if (Date.now() - waitStart > 15000) {
          clearInterval(t);
          clearFailsafe();
          setStatus('error', captchaUnavailableMessage());
          submitBtn.disabled = false;
        }
      }, 100);
    }

    runCaptcha();
  });
})();
