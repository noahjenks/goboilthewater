/* Website forms (Apply to Be a Guest, Request a Listing, Bulk Orders).
   Sends answers to Noah's Google Sheet through his Apps Script web app.
   Any <form data-gbtw-form="guest|directory|bulk"> on a page is handled here. */
(function () {
  'use strict';

  // Paste the Apps Script "Web app URL" here after deploying it.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwjWYSQ46vDfhJdZ0aqfVWgN0XMyz-bMAOUtS73jA1rU1yZaZpz336E1GmY-ft1oClddw/exec';

  // Same Mailchimp audience the Chapter 1 quiz uses. Guests who tick the newsletter box are added automatically.
  var MC_URL = 'https://goboilthewater.us18.list-manage.com/subscribe/post-json?u=a63f1a1d79f7d4fa5ef19eed8&id=6e871b2ba1&f_id=0095ace6f0';
  var MC_HONEYPOT = 'b_a63f1a1d79f7d4fa5ef19eed8_6e871b2ba1';

  var MAX_PHOTOS = 3;
  var MAX_PHOTO_MB = 8;

  function track(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve({ name: file.name, type: file.type || 'image/jpeg', data: String(r.result).split(',')[1] }); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Pick the role value the Mailchimp welcome journey already branches on.
  function mcRole(roles) {
    roles = roles || '';
    if (/Midwife/.test(roles)) return 'Midwife';
    if (/Doula/.test(roles)) return 'Doula';
    if (/Mom/.test(roles)) return 'Mom';
    if (/Husband/.test(roles)) return 'Husband/Partner';
    return '';
  }

  function subscribe(d) {
    var src = 'direct';
    try { src = localStorage.getItem('gbtw_src') || 'direct'; } catch (e) {}
    var fields = { EMAIL: d.email, FNAME: d.first_name || '', LNAME: d.last_name || '', ROLE: mcRole(d.role), SOURCE: src, OFFER: d.form === 'bulk' ? 'bulk-order' : d.form === 'directory' ? 'directory-form' : 'guest-form' };
    var cb = 'gbtwForm_' + Date.now();
    var url = MC_URL;
    Object.keys(fields).forEach(function (k) { url += '&' + k + '=' + encodeURIComponent(fields[k]); });
    url += '&' + MC_HONEYPOT + '=&c=' + cb;
    var script = document.createElement('script');
    window[cb] = function (r) {
      track(r && r.result === 'success' ? 'newsletter_signup' : 'newsletter_signup_issue', { form_name: d.form });
      try { delete window[cb]; } catch (x) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    };
    script.src = url;
    document.body.appendChild(script);
  }

  function collect(form) {
    var data = { form: form.dataset.gbtwForm, page: location.pathname };
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'file' || el.type === 'submit') return;
      if (el.type === 'checkbox') {
        if (el.hasAttribute('data-group')) {
          if (el.checked) data[el.name] = (data[el.name] ? data[el.name] + ', ' : '') + el.value;
        } else data[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else data[el.name] = el.value.trim();
    });
    return data;
  }

  function showError(form, msg) {
    var err = form.querySelector('.sf-error');
    err.innerHTML = msg; err.hidden = false;
    err.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.querySelectorAll('form[data-gbtw-form]').forEach(function (form) {
    var fileInput = form.querySelector('input[type=file]');
    var fileNote = form.querySelector('.sf-files');
    if (fileInput && fileNote) {
      fileInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileInput.files, 0, MAX_PHOTOS);
        fileNote.textContent = files.length ? files.map(function (f) { return f.name; }).join(', ') : '';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = form.querySelector('.sf-error'); err.hidden = true;

      // Required checkbox groups (at least one box ticked)
      var groups = form.querySelectorAll('[data-required-group]');
      for (var g = 0; g < groups.length; g++) {
        if (!groups[g].querySelector('input:checked')) {
          showError(form, groups[g].dataset.requiredGroup);
          return;
        }
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var files = fileInput ? Array.prototype.slice.call(fileInput.files) : [];
      if (files.length > MAX_PHOTOS) { showError(form, 'Up to ' + MAX_PHOTOS + ' photos, please.'); return; }
      for (var i = 0; i < files.length; i++) {
        if (files[i].size > MAX_PHOTO_MB * 1024 * 1024) { showError(form, '“' + files[i].name + '” is over ' + MAX_PHOTO_MB + ' MB. Try a smaller copy, or leave it off and we’ll sort photos out by email.'); return; }
      }

      var btn = form.querySelector('button[type=submit]');
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = files.length ? 'Uploading…' : 'Sending…';

      var data = collect(form);
      Promise.all(files.map(readFile)).then(function (photos) {
        data.photos = photos;
        if (!ENDPOINT) throw new Error('Form endpoint not set yet');
        return fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(data) });
      }).then(function (res) { return res.json(); }).then(function (out) {
        if (!out || !out.ok) throw new Error(out && out.error || 'Unknown error');
        track('form_submit', { form_name: data.form });
        if (data.newsletter && data.email) subscribe(data);
        var done = form.parentNode.querySelector('.sf-done');
        form.hidden = true; done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (x) {
        if (window.console) console.warn('Form error:', x);
        btn.disabled = false; btn.textContent = label;
        showError(form, 'Something went wrong on our end and your answers didn’t send. Try again, or email them to <a href="mailto:noah@goboilthewater.com">noah@goboilthewater.com</a>.');
      });
    });
  });
})();
