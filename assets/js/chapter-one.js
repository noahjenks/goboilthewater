/* Free Chapter 1 popup: collects an email through Mailchimp, then shows the download link. */
(function () {
  var dialog = document.getElementById('chapter-one');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var form = dialog.querySelector('form');
  var input = dialog.querySelector('input[type="email"]');
  var button = dialog.querySelector('button[type="submit"]');
  var error = dialog.querySelector('.c1-error');
  var stepForm = dialog.querySelector('.c1-step-form');
  var stepDone = dialog.querySelector('.c1-step-done');

  var KEY_DONE = 'gbtw_ch1_done';       // signed up: never show the popup again
  var KEY_CLOSED = 'gbtw_ch1_closed';   // closed it: wait 14 days before showing again
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function open(manual) {
    if (dialog.open) return;
    if (!manual && get(KEY_DONE)) return;
    if (get(KEY_DONE)) { stepForm.hidden = true; stepDone.hidden = false; }
    dialog.showModal();
    if (!stepForm.hidden) setTimeout(function () { input.focus(); }, 50);
  }

  dialog.addEventListener('close', function () {
    if (!get(KEY_DONE)) set(KEY_CLOSED, String(Date.now()));
  });
  dialog.querySelector('.c1-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  // Any button or link with data-chapter-one opens the popup
  document.querySelectorAll('[data-chapter-one]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); open(true); });
  });

  // Automatic popup: once per visitor, after 25 seconds or halfway down the page
  var closedAt = parseInt(get(KEY_CLOSED) || '0', 10);
  var waited = Date.now() - closedAt > 14 * 24 * 60 * 60 * 1000;
  if (!get(KEY_DONE) && waited && document.body.dataset.autopopup === 'on') {
    var fired = false;
    function fire() { if (fired) return; fired = true; open(false); window.removeEventListener('scroll', onScroll); }
    function onScroll() {
      var h = document.documentElement;
      if ((h.scrollTop + window.innerHeight) / h.scrollHeight > 0.5) fire();
    }
    setTimeout(fire, 25000);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Submit to Mailchimp without leaving the page
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.hidden = true;
    var email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error.textContent = 'Enter a full email address, like name@example.com.';
      error.hidden = false; input.focus(); return;
    }
    button.disabled = true; button.textContent = 'Sending…';

    var cb = 'gbtwCh1_' + Date.now();
    var url = form.action.replace('/post?', '/post-json?') +
      '&EMAIL=' + encodeURIComponent(email) + '&' + form.dataset.honeypot + '=&c=' + cb;
    var script = document.createElement('script');
    var timer = setTimeout(function () { finish({ result: 'error', msg: 'timeout' }); }, 10000);

    window[cb] = function (data) { finish(data); };
    function finish(data) {
      clearTimeout(timer);
      try { delete window[cb]; } catch (x) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      button.disabled = false; button.textContent = 'Send Me Chapter 1';
      var msg = (data && data.msg) ? String(data.msg) : '';
      if (data && (data.result === 'success' || /already subscribed/i.test(msg))) {
        set(KEY_DONE, '1');
        stepForm.hidden = true; stepDone.hidden = false;
        stepDone.querySelector('a').focus();
      } else if (/too many/i.test(msg)) {
        error.textContent = 'Too many tries from this email. Wait a few minutes and try again.';
        error.hidden = false;
      } else {
        error.innerHTML = 'Something went wrong on our end. Try again, or email <a href="mailto:noah@goboilthewater.com">noah@goboilthewater.com</a> and Noah will send Chapter 1 directly.';
        error.hidden = false;
        if (window.console) console.warn('Mailchimp response:', data);
      }
    }
    script.src = url;
    script.onerror = function () { finish({ result: 'error', msg: 'network' }); };
    document.body.appendChild(script);
  });
})();
