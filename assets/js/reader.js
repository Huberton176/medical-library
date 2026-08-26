/* =========================================================
   MEDICAL LIBRARY — READER V1.1
   ========================================================= */
(() => {
  'use strict';

  const body = document.body;
  const article = body.querySelector('article');
  if (!article) return;

  body.classList.add('ml-reader-page');
  article.classList.add('ml-document');

  const title = document.title.replace(/\s+/g, ' ').trim();
  const firstH1 = article.querySelector('h1');
  const displayTitle = firstH1 ? firstH1.textContent.replace(/\s+/g, ' ').trim() : title;

  // Shell
  const topbar = document.createElement('header');
  topbar.className = 'ml-topbar';
  topbar.innerHTML = `
    <div class="ml-brand-block">
      <button class="ml-back" type="button" aria-label="Quay lại thư viện">←</button>
      <div class="ml-logo" aria-hidden="true">M</div>
      <div>
        <div class="ml-brand-name">MEDICAL LIBRARY</div>
        <div class="ml-brand-sub">Clinical Medical Knowledge</div>
      </div>
    </div>
    <div class="ml-doc-head">
      <div class="ml-doc-title">${escapeHtml(displayTitle)}</div>
      <div class="ml-doc-meta">ESC 2024 · Hướng dẫn lâm sàng</div>
    </div>
    <div class="ml-actions">
      <button class="ml-action" data-action="font-down" aria-label="Giảm cỡ chữ">A−</button>
      <button class="ml-action" data-action="font-up" aria-label="Tăng cỡ chữ">A+</button>
      <button class="ml-action" data-action="theme" aria-label="Đổi giao diện">☾</button>
    </div>`;
  document.body.prepend(topbar);

  const sidebar = document.createElement('aside');
  sidebar.className = 'ml-sidebar';
  sidebar.innerHTML = `
    <div class="ml-sidebar-head">
      <span class="ml-sidebar-label">Nội dung</span>
      <span class="ml-progress" data-progress>0%</span>
    </div>
    <nav aria-label="Mục lục tài liệu"><ul class="ml-toc"></ul></nav>`;
  document.body.appendChild(sidebar);

  const mobileToc = document.createElement('div');
  mobileToc.className = 'ml-mobile-toc';
  mobileToc.innerHTML = '<select class="ml-mobile-select" aria-label="Chọn mục trong tài liệu"><option>Chuyển đến mục…</option></select>';
  document.body.appendChild(mobileToc);

  const toTop = document.createElement('button');
  toTop.className = 'ml-to-top';
  toTop.type = 'button';
  toTop.textContent = '↑';
  toTop.setAttribute('aria-label', 'Về đầu trang');
  document.body.appendChild(toTop);

  // Compact hero; original cover/content remains untouched below it.
  if (!article.querySelector('.ml-hero')) {
    const hero = document.createElement('section');
    hero.className = 'ml-hero';
    hero.innerHTML = `
      <div class="ml-kicker">ESC · 2024 · GUIDELINE</div>
      <h1>${escapeHtml(displayTitle)}</h1>
      <p>Clinical document · Vietnamese edition</p>`;
    article.insertBefore(hero, article.firstChild);
  }

  buildToc();
  bindControls();
  restorePreferences();
  observeActiveSection();
  updateProgress();

  function buildToc() {
    const toc = sidebar.querySelector('.ml-toc');
    const select = mobileToc.querySelector('select');
    const headings = [...article.querySelectorAll('h2, h3, h4')].filter(h => !h.closest('.ml-hero'));
    headings.forEach((h, index) => {
      if (!h.id) h.id = slugify(h.textContent) || `section-${index + 1}`;
      const level = Number(h.tagName.substring(1));
      const li = document.createElement('li');
      li.className = `level-${level}`;
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent.replace(/\s+/g, ' ').trim();
      a.dataset.target = h.id;
      li.appendChild(a);
      toc.appendChild(li);

      const option = document.createElement('option');
      option.value = h.id;
      option.textContent = `${level === 2 ? '' : '· '.repeat(level - 2)}${a.textContent}`;
      select.appendChild(option);
    });
    select.addEventListener('change', e => {
      if (e.target.value) document.getElementById(e.target.value)?.scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  function bindControls() {
    topbar.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'font-down') setFontScale(-0.05);
      if (action === 'font-up') setFontScale(0.05);
      if (action === 'theme') toggleTheme();
    });
    topbar.querySelector('.ml-back').addEventListener('click', () => {
      const library = new URL('../index.html', location.href).href;
      if (document.referrer && document.referrer.includes('/medical-library/')) history.back();
      else location.href = library;
    });
    sidebar.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      document.getElementById(a.dataset.target)?.scrollIntoView({behavior:'smooth', block:'start'});
      history.replaceState(null, '', `#${a.dataset.target}`);
    });
    toTop.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    window.addEventListener('scroll', () => { updateProgress(); toTop.classList.toggle('show', window.scrollY > 700); }, {passive:true});
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') e.preventDefault();
      if (e.key === 'Escape') document.activeElement?.blur();
    });
  }

  function observeActiveSection() {
    const links = [...sidebar.querySelectorAll('a')];
    const headings = links.map(a => document.getElementById(a.dataset.target)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach(a => a.classList.toggle('active', a.dataset.target === visible.target.id));
      const active = links.find(a => a.classList.contains('active'));
      if (active) active.scrollIntoView({block:'nearest'});
    }, {rootMargin:'-110px 0px -68% 0px', threshold:0});
    headings.forEach(h => observer.observe(h));
  }

  function updateProgress() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const percent = Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100)));
    const el = sidebar.querySelector('[data-progress]');
    if (el) el.textContent = `${percent}%`;
  }

  function setFontScale(delta) {
    let value = parseFloat(localStorage.getItem('ml-font-scale') || '1');
    value = Math.min(1.25, Math.max(0.9, value + delta));
    document.documentElement.style.setProperty('--ml-font-scale', value.toFixed(2));
    localStorage.setItem('ml-font-scale', value.toFixed(2));
  }

  function restorePreferences() {
    const scale = localStorage.getItem('ml-font-scale');
    if (scale) document.documentElement.style.setProperty('--ml-font-scale', scale);
    const theme = localStorage.getItem('ml-theme');
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  }

  function toggleTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    localStorage.setItem('ml-theme', dark ? 'light' : 'dark');
  }

  function slugify(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,100);
  }
  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
})();
