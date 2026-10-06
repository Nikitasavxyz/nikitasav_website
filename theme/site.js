// Small interactive bits of the site: slideshow, video sound on hover, full-screen image gallery.
(function () {
  function initSlideshow(ss) {
    if (ss.dataset.ready) return;
    ss.dataset.ready = '1';
    var slides = ss.querySelectorAll('.ss-slide');
    if (slides.length < 2) return;
    var i = 0;
    function go(d) {
      slides[i].classList.remove('on');
      i = (i + d + slides.length) % slides.length;
      slides[i].classList.add('on');
      // preload the neighbouring slide
      var next = slides[(i + 1) % slides.length].querySelector('img');
      if (next) next.loading = 'eager';
    }
    var prev = ss.querySelector('.ss-prev'), next = ss.querySelector('.ss-next');
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    var x0 = null;
    ss.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    ss.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(dx < 0 ? 1 : -1); e.preventDefault(); }
      x0 = null;
    });
  }
  function initVideo(v) {
    if (v.dataset.ready) return;
    v.dataset.ready = '1';
    v.addEventListener('mouseenter', function () { v.muted = false; });
    v.addEventListener('mouseleave', function () { v.muted = true; });
    v.addEventListener('click', function () { v.muted = !v.muted; });
  }
  // Full-screen gallery: click an image on a page to enlarge it and flip through all images of that page
  function initLightbox() {
    if (document.body.classList.contains('is-edit') || window.__lb) return;
    window.__lb = true;
    var list = [], cur = 0, box = null, big = null, frame = null, count = null, x0 = null;
    function largest(img) {
      var best = img.currentSrc || img.src, bw = 0;
      (img.getAttribute('srcset') || '').split(',').forEach(function (part) {
        var m = part.trim().match(/^(\S+)\s+(\d+)w$/);
        if (m && +m[2] > bw) { bw = +m[2]; best = m[1]; }
      });
      return best;
    }
    function collect() {
      var imgs = [].slice.call(document.querySelectorAll('.page:not(.no-zoom) .blk-image img')).filter(function (i) { return !i.closest('a') && i.offsetParent; });
      return imgs.map(function (i) { var r = i.getBoundingClientRect(); return { img: i, top: r.top + window.scrollY, left: r.left }; })
        .sort(function (a, b) { return a.top - b.top || a.left - b.left; }).map(function (o) { return o.img; });
    }
    function show(i) {
      cur = (i + list.length) % list.length;
      var src = list[cur], full = largest(src);
      var v = (src.getAttribute('data-view') || '').split(',').map(Number);
      var nw = +src.getAttribute('width') || src.naturalWidth || 3, nh = +src.getAttribute('height') || src.naturalHeight || 2;
      var cropped = v.length === 4, ar = cropped ? (v[2] * nw) / (v[3] * nh) : nw / nh;
      var wide = window.innerWidth > 800, mw = window.innerWidth - (wide ? 140 : 0), mh = window.innerHeight - (wide ? 90 : 120);
      var fw = Math.min(mw, mh * ar);
      frame.style.width = fw + 'px'; frame.style.height = fw / ar + 'px';
      big.style.cssText = cropped ? 'left:' + (-v[0] / v[2] * 100) + '%;top:' + (-v[1] / v[3] * 100) + '%;width:' + (100 / v[2]) + '%;height:' + (100 / v[3]) + '%' : 'left:0;top:0;width:100%;height:100%';
      big.src = src.currentSrc || src.src; big.alt = src.alt || '';
      if (full !== big.src) { var pre = new Image(); pre.onload = function () { if (list[cur] === src) big.src = full; }; pre.src = full; }
      count.textContent = list.length > 1 ? (cur + 1) + ' / ' + list.length : '';
    }
    function onResize() { if (box) show(cur); }
    function close() { if (!box) return; box.remove(); box = null; document.documentElement.style.overflow = ''; document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(cur + 1);
      else if (e.key === 'ArrowLeft') show(cur - 1);
    }
    function open(img) {
      list = collect(); if (!list.length) return;
      box = document.createElement('div'); box.className = 'lb';
      box.innerHTML = '<div class="lb-frame"><img class="lb-img" alt=""></div><button class="lb-btn lb-close" aria-label="Close"></button>' +
        (list.length > 1 ? '<button class="lb-btn lb-prev" aria-label="Previous"></button><button class="lb-btn lb-next" aria-label="Next"></button>' : '') + '<span class="lb-count"></span>';
      big = box.querySelector('.lb-img'); frame = box.querySelector('.lb-frame'); count = box.querySelector('.lb-count');
      box.addEventListener('click', function (e) {
        if (e.target.closest('.lb-prev')) show(cur - 1);
        else if (e.target.closest('.lb-next')) show(cur + 1);
        else if (e.target === big && list.length > 1) show(cur + 1);
        else close();
      });
      box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 40 && list.length > 1) { show(cur + (dx < 0 ? 1 : -1)); e.preventDefault(); }
      });
      document.body.appendChild(box);
      document.documentElement.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
      show(Math.max(0, list.indexOf(img)));
    }
    document.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.page:not(.no-zoom) .blk-image img');
      if (img && !img.closest('a')) open(img);
    });
  }
  // A video stays invisible until it has a picture to show, so there is no black box while it loads
  function initReveal(el) {
    if (el.__rv) return; el.__rv = true;
    var isVideo = el.tagName === 'VIDEO';
    if (isVideo && el.readyState >= 2) return;
    var done = false, show = function () { if (done) return; done = true; el.style.opacity = ''; };
    el.style.transition = 'opacity .35s'; el.style.opacity = '0';
    if (isVideo) { el.addEventListener('loadeddata', show); el.addEventListener('playing', show); el.addEventListener('error', show); }
    else el.addEventListener('load', function () { setTimeout(show, 250); });
    setTimeout(show, isVideo ? 15000 : 8000); // never keep it hidden for good
  }
  function init(root) {
    (root || document).querySelectorAll('[data-ss]').forEach(initSlideshow);
    if (!document.body.classList.contains('is-edit')) (root || document).querySelectorAll('.blk-video video, .blk-video iframe').forEach(initReveal);
    if (!document.body.classList.contains('is-edit')) (root || document).querySelectorAll('video[data-hover-sound]').forEach(initVideo);
  }
  window.NSite = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); initLightbox(); });
  else { init(); initLightbox(); }
})();
