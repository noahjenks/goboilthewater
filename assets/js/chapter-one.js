/* Free Chapter 1 quiz funnel.
   Three taps (role, stage, focus), then first name + email to Mailchimp.
   Renders inline wherever [data-gbtw-quiz] appears, and inside the #chapter-one popup. */
(function () {
  'use strict';

  var CH1_URL = 'https://drive.google.com/file/d/1Z5TYON2190UvUadv68agDtk4LpjiutzL/view';
  var HANDOUT_URL = '/assets/downloads/go-boil-the-water-partner-handout.pdf';
  var HANDOUT_A4_URL = '/assets/downloads/go-boil-the-water-partner-handout-a4.pdf';
  var MC_URL = 'https://goboilthewater.us18.list-manage.com/subscribe/post-json?u=a63f1a1d79f7d4fa5ef19eed8&id=6e871b2ba1&f_id=0095ace6f0';
  var HONEYPOT = 'b_a63f1a1d79f7d4fa5ef19eed8_6e871b2ba1';

  var KEY_DONE = 'gbtw_ch1_done';
  var KEY_ROLE = 'gbtw_ch1_role';
  var KEY_CLOSED = 'gbtw_ch1_closed';
  var KEY_SRC = 'gbtw_src';

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function track(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- Where did this visitor come from? ---------- */
  function detectSource() {
    var q = new URLSearchParams(location.search);
    var tagged = q.get('src') || q.get('utm_source');
    if (tagged) { set(KEY_SRC, tagged.toLowerCase().slice(0, 40)); return; }
    if (get(KEY_SRC)) return;
    var host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (host && host.indexOf('goboilthewater.com') !== -1) return;
    var map = [
      ['chatgpt', 'chatgpt'], ['openai', 'chatgpt'], ['perplexity', 'perplexity'], ['claude.ai', 'claude'],
      ['gemini', 'gemini'], ['copilot', 'copilot'], ['google.', 'google'], ['bing.', 'bing'],
      ['duckduckgo', 'duckduckgo'], ['instagram', 'instagram'], ['facebook', 'facebook'], ['fb.', 'facebook'],
      ['youtube', 'youtube'], ['pinterest', 'pinterest'], ['amazon', 'amazon'], ['spotify', 'spotify']
    ];
    var src = host || 'direct';
    for (var i = 0; i < map.length; i++) { if (host.indexOf(map[i][0]) !== -1) { src = map[i][1]; break; } }
    set(KEY_SRC, src.slice(0, 40));
  }
  detectSource();
  function source() { return get(KEY_SRC) || 'direct'; }

  /* ---------- The questions ---------- */
  var Q_ROLE = {
    id: 'role', title: "Who's here?",
    options: [
      { v: 'Husband/Partner', label: "I'm the husband or partner", path: 'dad' },
      { v: 'Mom', label: "I'm the mom", path: 'mom' },
      { v: 'Midwife', label: "I'm a midwife", path: 'pro' },
      { v: 'Doula', label: "I'm a doula", path: 'pro' }
    ]
  };
  var Q_STAGE = {
    id: 'stage', title: 'Where are you?',
    options: [
      { v: 'Just thinking', label: 'Just starting to think about it' },
      { v: 'Planning', label: "We're planning one" },
      { v: 'Due soon', label: "Baby's due in the next few months" },
      { v: 'Done before', label: "We've done one before" }
    ]
  };
  var PATHS = {
    mom: [Q_STAGE, {
      id: 'focus', title: "Where's your partner on this?",
      options: [
        { v: 'All in', label: 'All in', result: "Sounds like you've got a good one. Chapter 1 gives him the history behind what you're choosing." },
        { v: 'Supportive but nervous', label: 'Supportive but nervous', result: 'Nervous usually means he cares. Chapter 1 was written for exactly that guy.' },
        { v: 'Not sold yet', label: 'Not sold yet', result: 'That’s where I started too. Chapter 1 takes on the “is this crazy?” question one dad to another.' },
        { v: 'Has not thought about it', label: "Hasn't really thought about it", result: "Most guys haven't until someone hands them something. Chapter 1 is short and easy to pass along." }
      ]
    }],
    dad: [Q_STAGE, {
      id: 'focus', title: "What's on your mind most?",
      options: [
        { v: 'Safety', label: 'Is it safe?', result: "It was my first question too. Chapter 1 covers how birth moved to the hospital and why home birth today isn't anti-medicine." },
        { v: 'My role', label: 'What do I actually do?', result: "That's the whole book. Chapter 1 lays the groundwork, and the rest shows you your place in the room." },
        { v: 'Transfer', label: 'What if we have to transfer?', result: "Good on you for thinking ahead. I'll send Chapter 1 and my post on hospital transfers." },
        { v: 'Family pushback', label: 'My family thinks we’re crazy', result: "You're not the only one getting the side-eye. Chapter 1 gives you the history to answer them calmly." }
      ]
    }],
    pro: [{
      id: 'stage', title: 'How do partners usually show up at your births?',
      options: [
        { v: 'Hands-on', label: 'Hands-on' },
        { v: 'Willing but lost', label: 'Willing but lost' },
        { v: 'On the sidelines', label: 'On the sidelines' },
        { v: 'All over the map', label: 'All over the map' }
      ]
    }, {
      id: 'focus', title: 'What would help you most?', multi: true, hint: 'Pick as many as you like.',
      options: [
        { v: 'Handout', label: 'Something to hand partners at intake', result: "I made one for that. You'll get a printable partner handout along with Chapter 1.", short: 'A printable partner handout for your intake packet' },
        { v: 'Posts', label: 'Posts I can share', result: "New ones go up every Monday, Wednesday and Friday. You'll get them in your inbox.", short: 'New posts in your inbox to share with families' },
        { v: 'Copies', label: 'Copies for my clients', result: 'Read Chapter 1 first and see if it fits your families. The email that comes with it explains how to get copies.', short: 'How to get copies for your clients' },
        { v: 'Interview', label: 'Being interviewed for the series', result: "I'd love that. Reply to the email with Chapter 1 and we'll set it up.", short: 'A note about the interview series (reply to it and we’ll set it up)' }
      ]
    }]
  };

  /* ---------- One quiz instance ---------- */
  function Quiz(root, where) {
    this.root = root;
    this.where = where;
    this.answers = {};
    this.picked = {};
    this.path = null;
    this.step = 0;
    this.started = false;
    root.classList.add('gq');
    if (get(KEY_DONE)) this.renderDone(get(KEY_ROLE) || '', true);
    else this.renderQuestion();
  }

  Quiz.prototype.questions = function () { return [Q_ROLE].concat(this.path ? PATHS[this.path] : []); };

  Quiz.prototype.header = function () {
    var dots = '';
    for (var i = 0; i < 4; i++) dots += '<span class="gq-dot' + (i <= this.step ? ' on' : '') + '"></span>';
    return '<p class="gq-label">Free Chapter</p>' +
      '<p class="gq-heading">Get Chapter 1 <em>free.</em></p>' +
      '<div class="gq-progress" aria-hidden="true">' + dots + '</div>';
  };

  Quiz.prototype.renderQuestion = function () {
    var q = this.questions()[this.step], self = this;
    var html = this.header() + '<fieldset class="gq-q"><legend class="gq-title">' + esc(q.title) + '</legend>';
    if (q.hint) html += '<p class="gq-hint">' + esc(q.hint) + '</p>';
    html += '<div class="gq-options' + (q.multi ? ' gq-multi' : '') + '">';
    q.options.forEach(function (o, i) {
      if (q.multi) {
        var on = self.picked[o.v] ? ' checked' : '';
        html += '<label class="gq-opt gq-check"><input type="checkbox" value="' + i + '"' + on + '><span>' + esc(o.label) + '</span></label>';
      } else {
        html += '<button type="button" class="gq-opt" data-i="' + i + '">' + esc(o.label) + '</button>';
      }
    });
    html += '</div></fieldset><div class="gq-nav">';
    html += this.step > 0 ? '<button type="button" class="gq-back">&larr; Back</button>' : '<span></span>';
    if (q.multi) html += '<button type="button" class="gq-next" disabled>Continue &rarr;</button>';
    html += '</div>';
    this.root.innerHTML = html;

    var back = this.root.querySelector('.gq-back');
    if (back) back.addEventListener('click', function () { self.step--; self.renderQuestion(); });

    if (q.multi) {
      var next = this.root.querySelector('.gq-next');
      var boxes = this.root.querySelectorAll('input[type=checkbox]');
      var sync = function () {
        var any = false;
        boxes.forEach(function (b) { self.picked[q.options[+b.value].v] = b.checked; if (b.checked) any = true; });
        next.disabled = !any;
      };
      boxes.forEach(function (b) { b.addEventListener('change', sync); });
      sync();
      next.addEventListener('click', function () {
        var chosen = q.options.filter(function (o) { return self.picked[o.v]; });
        self.answers.focus = chosen;
        track('quiz_step', { step: 3, question: 'focus', answer: chosen.map(function (o) { return o.v; }).join(', '), quiz_location: self.where });
        self.renderForm();
      });
    } else {
      this.root.querySelectorAll('.gq-opt').forEach(function (btn) {
        btn.addEventListener('click', function () { self.choose(q, q.options[+btn.dataset.i]); });
      });
    }
  };

  Quiz.prototype.choose = function (q, o) {
    if (!this.started) { this.started = true; track('quiz_start', { quiz_location: this.where }); }
    if (q.id === 'role') {
      if (this.path !== o.path) { this.answers = {}; this.picked = {}; }
      this.path = o.path;
      this.answers.role = o;
    } else if (q.id === 'focus') {
      this.answers.focus = [o];
    } else {
      this.answers[q.id] = o;
    }
    track('quiz_step', { step: this.step + 1, question: q.id, answer: o.v, quiz_location: this.where });
    if (q.id === 'focus') { this.renderForm(); return; }
    this.step++;
    this.renderQuestion();
  };

  Quiz.prototype.resultLine = function () {
    var f = this.answers.focus || [];
    if (f.length === 1) return '<p class="gq-result">' + esc(f[0].result) + '</p>';
    var items = f.map(function (o) { return '<li>' + esc(o.short) + '</li>'; }).join('');
    return '<p class="gq-result">Good. Along with Chapter 1, you’ll get:</p><ul class="gq-list">' + items + '</ul>';
  };

  Quiz.prototype.renderForm = function () {
    var self = this;
    this.step = 3;
    var id = 'gq' + Math.random().toString(36).slice(2, 7);
    this.root.innerHTML = this.header() + this.resultLine() +
      '<form class="gq-form" novalidate>' +
        '<label class="visually-hidden" for="' + id + 'n">First name</label>' +
        '<input id="' + id + 'n" name="FNAME" type="text" placeholder="First name" autocomplete="given-name" required>' +
        '<label class="visually-hidden" for="' + id + 'e">Email address</label>' +
        '<input id="' + id + 'e" name="EMAIL" type="email" placeholder="Email" autocomplete="email" required>' +
        '<button type="submit">Send me Chapter 1</button>' +
      '</form>' +
      '<p class="gq-error" role="alert" hidden></p>' +
      '<p class="gq-note">You’ll also get a short note from Noah most weeks. Unsubscribe any time.</p>' +
      '<div class="gq-nav"><button type="button" class="gq-back">&larr; Back</button><span></span></div>';
    this.root.querySelector('.gq-back').addEventListener('click', function () { self.step = 2; self.renderQuestion(); });
    var form = this.root.querySelector('form');
    form.addEventListener('submit', function (e) { e.preventDefault(); self.submit(form); });
  };

  Quiz.prototype.submit = function (form) {
    var self = this;
    var name = form.FNAME.value.trim(), email = form.EMAIL.value.trim();
    var err = this.root.querySelector('.gq-error'), btn = form.querySelector('button');
    err.hidden = true;
    if (!name) { err.textContent = 'Add your first name so I know who I’m writing to.'; err.hidden = false; form.FNAME.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a full email address, like name@example.com.'; err.hidden = false; form.EMAIL.focus(); return; }
    btn.disabled = true; btn.textContent = 'Sending…';

    var a = this.answers;
    var fields = {
      EMAIL: email, FNAME: name,
      ROLE: a.role ? a.role.v : '',
      STAGE: a.stage ? a.stage.v : '',
      FOCUS: (a.focus || []).map(function (o) { return o.v; }).join(', '),
      SOURCE: source()
    };
    var cb = 'gbtwQuiz_' + Date.now();
    var url = MC_URL;
    Object.keys(fields).forEach(function (k) { url += '&' + k + '=' + encodeURIComponent(fields[k]); });
    url += '&' + HONEYPOT + '=&c=' + cb;

    var script = document.createElement('script');
    var timer = setTimeout(function () { finish({ result: 'error', msg: 'timeout' }); }, 10000);
    window[cb] = function (d) { finish(d); };
    function finish(d) {
      clearTimeout(timer);
      try { delete window[cb]; } catch (x) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      var msg = d && d.msg ? String(d.msg) : '';
      if (d && (d.result === 'success' || /already subscribed/i.test(msg))) {
        set(KEY_DONE, '1'); set(KEY_ROLE, fields.ROLE);
        track('generate_lead', { role: fields.ROLE, focus: fields.FOCUS, lead_source: fields.SOURCE, quiz_location: self.where });
        self.renderDone(fields.ROLE, false);
        return;
      }
      btn.disabled = false; btn.textContent = 'Send me Chapter 1';
      if (/too many/i.test(msg)) err.textContent = 'Too many tries from this email. Wait a few minutes and try again.';
      else err.innerHTML = 'Something went wrong on our end. Try again, or email <a href="mailto:noah@goboilthewater.com">noah@goboilthewater.com</a> and Noah will send Chapter 1 directly.';
      err.hidden = false;
      if (window.console) console.warn('Mailchimp response:', d);
    }
    script.src = url;
    script.onerror = function () { finish({ result: 'error', msg: 'network' }); };
    document.body.appendChild(script);
  };

  Quiz.prototype.renderDone = function (role, returning) {
    var focus = (this.answers.focus || []).map(function (o) { return o.v; });
    var html = '<p class="gq-label">' + (returning ? 'Welcome back' : 'You’re in') + '</p>' +
      '<p class="gq-heading">Chapter 1 <em>is yours.</em></p>' +
      '<p class="gq-result">' + (returning ? 'Here’s your copy again.' : 'It’s on its way to your inbox too. Open it here and save it to your phone.') + '</p>' +
      '<a class="gq-cta" href="' + CH1_URL + '" target="_blank" rel="noopener">Open Chapter 1</a>';

    if (role === 'Mom') {
      var msg = 'I want you to read this. It’s the first chapter of a book for husbands about home birth, written by a dad: ' + CH1_URL;
      html += '<div class="gq-share"><p>Want him to read it?</p>' +
        '<a class="gq-share-btn" href="sms:?&body=' + encodeURIComponent(msg) + '" data-share="sms">Text it to him</a>' +
        '<a class="gq-share-btn" href="https://wa.me/?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener" data-share="whatsapp">Send on WhatsApp</a></div>';
    }
    if (role === 'Midwife' || role === 'Doula') {
      html += '<div class="gq-share"><p>For your welcome packets</p>' +
        '<a class="gq-share-btn" href="' + HANDOUT_URL + '" target="_blank" rel="noopener" data-share="handout">Download the partner handout</a>' +
        '<a class="gq-small" href="' + HANDOUT_A4_URL + '" target="_blank" rel="noopener">A4 version</a></div>';
    }
    if (focus.indexOf('Transfer') !== -1) {
      html += '<p class="gq-more">And here’s the post I mentioned: <a href="/blog/home-birth-hospital-transfer/">What happens if we need to transfer?</a></p>';
    }
    html += '<p class="gq-more">Want the rest? <a href="https://www.amazon.com/dp/B0HLVV9SBS" target="_blank" rel="noopener">Get it on Amazon</a> or <a href="https://open.spotify.com/show/7cUC4ig0KA3HpG8YFI9sSd" target="_blank" rel="noopener">listen on Spotify</a>.</p>';
    this.root.innerHTML = html;
    var where = this.where;
    this.root.querySelectorAll('[data-share]').forEach(function (a) {
      a.addEventListener('click', function () { track('share', { method: a.dataset.share, content_type: 'chapter_1', quiz_location: where }); });
    });
  };

  /* ---------- Inline quizzes ---------- */
  var inline = [];
  document.querySelectorAll('[data-gbtw-quiz]').forEach(function (el) {
    inline.push(el);
    new Quiz(el, el.dataset.gbtwQuiz || 'inline');
  });

  /* ---------- Popup ---------- */
  var dialog = document.getElementById('chapter-one');
  var popupQuiz = null;
  function openPopup(manual) {
    if (!dialog || typeof dialog.showModal !== 'function' || dialog.open) return;
    if (!manual && get(KEY_DONE)) return;
    if (!popupQuiz) popupQuiz = new Quiz(dialog.querySelector('.gq-popup-body'), 'popup');
    dialog.showModal();
    track('quiz_popup_open', { trigger: manual ? 'button' : 'auto' });
  }
  if (dialog && typeof dialog.showModal === 'function') {
    dialog.addEventListener('close', function () { if (!get(KEY_DONE)) set(KEY_CLOSED, String(Date.now())); });
    var x = dialog.querySelector('.c1-close');
    if (x) x.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  // Buttons and links marked data-chapter-one: scroll to the quiz on this page, or open the popup.
  document.querySelectorAll('[data-chapter-one]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      if (inline.length) {
        inline[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        var first = inline[0].querySelector('button, input');
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
      } else openPopup(true);
    });
  });

  // Automatic popup: once per visitor, after 25 seconds or halfway down the page.
  var closedAt = parseInt(get(KEY_CLOSED) || '0', 10);
  var waited = Date.now() - closedAt > 14 * 24 * 60 * 60 * 1000;
  if (dialog && !get(KEY_DONE) && waited && document.body.dataset.autopopup === 'on') {
    var fired = false;
    var onScroll = function () {
      var h = document.documentElement;
      if ((h.scrollTop + window.innerHeight) / h.scrollHeight > 0.5) fire();
    };
    var fire = function () { if (fired) return; fired = true; openPopup(false); window.removeEventListener('scroll', onScroll); };
    setTimeout(fire, 25000);
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
