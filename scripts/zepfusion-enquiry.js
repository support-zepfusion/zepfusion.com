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
    var existing = document.querySelector('script[data-zf-recaptcha-enterprise]');
    if (existing) {
      if (enterpriseLoadFailed) {
        existing.remove();
      } else {
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

  function loadEnterpriseScript(siteKey) {
    injectEnterpriseScript(
      siteKey,
      function () {
        enterpriseLoadFailed = false;
      },
      function () {
        enterpriseLoadFailed = true;
      }
    );
  }

  var siteKey = (cfg().siteKey || '').trim();
  if (siteKey) {
    loadEnterpriseScript(siteKey);
  }

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
    setStatus('info', 'Sending…');

    function send(token) {
      var params = new URLSearchParams();
      fd.forEach(function (value, key) {
        if (key !== 'website') params.append(key, value);
      });
      params.set('recaptchaToken', token);
      params.set('source', fd.get('source') || 'home');

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString(),
        mode: 'no-cors',
      })
        .then(function () {
          form.reset();
          setStatus('success', 'Thank you — we received your message and will get back to you soon.');
        })
        .catch(function () {
          setStatus('success', 'Thank you — if you do not hear from us within two business days, email support@zepfusion.com.');
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    }

    function captchaUnavailableMessage() {
      if (window.location && window.location.protocol === 'file:') {
        return 'Open this page from your live site (https://zepfusion.com) or a local server — reCAPTCHA does not run from a saved file (file://).';
      }
      if (enterpriseLoadFailed) {
        return 'The security script was blocked or could not load. Allow scripts from google.com on this page (pause ad blockers / privacy extensions), then refresh. In Google Cloud → reCAPTCHA Enterprise, ensure this domain is allowed for your key.';
      }
      return 'Security check is still loading. Wait a few seconds and try again, or refresh the page.';
    }

    function runCaptcha() {
      function execute() {
        if (!window.grecaptcha || !grecaptcha.enterprise) {
          setStatus('error', captchaUnavailableMessage());
          submitBtn.disabled = false;
          return;
        }
        grecaptcha.enterprise.ready(function () {
          grecaptcha.enterprise
            .execute(siteKey, { action: action })
            .then(function (token) {
              send(token);
            })
            .catch(function () {
              setStatus('error', 'Security verification failed. Please try again.');
              submitBtn.disabled = false;
            });
        });
      }

      if (window.grecaptcha && grecaptcha.enterprise) {
        execute();
        return;
      }

      if (enterpriseLoadFailed) {
        enterpriseLoadFailed = false;
        injectEnterpriseScript(
          siteKey,
          function () {
            execute();
          },
          function () {
            enterpriseLoadFailed = true;
            setStatus('error', captchaUnavailableMessage());
            submitBtn.disabled = false;
          }
        );
        return;
      }

      var waitStart = Date.now();
      var t = setInterval(function () {
        if (window.grecaptcha && grecaptcha.enterprise) {
          clearInterval(t);
          execute();
        } else if (Date.now() - waitStart > 8000) {
          clearInterval(t);
          setStatus('error', captchaUnavailableMessage());
          submitBtn.disabled = false;
        }
      }, 100);
    }

    runCaptcha();
  });
})();
