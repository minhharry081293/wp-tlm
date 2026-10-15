(function () {
  'use strict';

  var KEY = 'wpcf_catfish_closed';

  function hide(el) {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch (e) {
      /* ignore */
    }
    el.classList.add('is-closed');
    el.style.display = 'none';
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function init() {
    var el = document.getElementById('wpcf-catfish');
    if (!el) return;

    try {
      if (sessionStorage.getItem(KEY) === '1') {
        hide(el);
        return;
      }
    } catch (e) {
      /* ignore */
    }

    var btn = document.getElementById('wpcf-close') || el.querySelector('.wpcf-close');
    if (!btn) return;

    function onClose(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      hide(el);
      return false;
    }

    btn.addEventListener('click', onClose, true);
    btn.addEventListener('mousedown', onClose, true);
    btn.addEventListener('touchstart', onClose, { capture: true, passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
