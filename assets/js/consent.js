/* Cookie choice for European visitors (EU, EEA, UK, Switzerland).
   Analytics cookies stay off for them until they say yes. Everyone else never sees this banner. */
(function () {
  'use strict';
  var KEY = 'gbtw_consent';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function inEurope() {
    try { return /^Europe\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (e) { return false; }
  }

  function apply(choice) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', { analytics_storage: choice === 'granted' ? 'granted' : 'denied' });
  }

  function show() {
    if (document.getElementById('gbtw-consent')) return;
    var bar = document.createElement('div');
    bar.id = 'gbtw-consent';
    bar.className = 'consent-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie choice');
    bar.innerHTML =
      '<p>Can we use a Google Analytics cookie to see which pages help people? No ads, and we never sell anything. <a href="/privacy/">Privacy policy</a></p>' +
      '<div class="consent-btns"><button type="button" data-c="denied">No thanks</button><button type="button" data-c="granted" class="consent-yes">That’s fine</button></div>';
    bar.addEventListener('click', function (e) {
      var c = e.target && e.target.getAttribute('data-c');
      if (!c) return;
      set(c); apply(c);
      bar.parentNode.removeChild(bar);
    });
    document.body.appendChild(bar);
  }

  // The privacy page has a "Change cookie choice" button that calls this.
  window.gbtwCookieSettings = show;

  if (!get() && inEurope()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
  }
})();
