/**
 * MEDICAL LIBRARY — SHARED DOCUMENT TEMPLATE SCRIPT (V2)
 * Linked once from every file in /documents/:
 *   <script src="../assets/js/document-template.js" defer></script>
 *
 * Each document only needs a small JSON config block (see
 * document-example.html) plus a few empty mount points in the
 * hero. This script renders the contact line, the print
 * header/footer, builds the TOC, and tracks reading progress —
 * so none of that markup has to be hand-copied per document.
 */
(function () {
  "use strict";

  const root = document.documentElement;
  const FONT_KEY = "ml-integrated-font";
  const THEME_KEY = "ml-integrated-theme";

  // ---------------------------------------------------------
  // 0. Embed detection — if we're inside reader.html's iframe,
  //    the shell already renders TOC / progress / hero chrome.
  //    Flag it so document-template.css can collapse our own
  //    copies, and skip the matching JS work below.
  // ---------------------------------------------------------
  let isEmbedded = false;
  try { isEmbedded = window.self !== window.top; } catch (e) { isEmbedded = true; }
  if (isEmbedded) root.classList.add("is-embedded");

  // ---------------------------------------------------------
  // 1. Config — one JSON block per document instead of
  //    hand-copied hero-contact / print-header HTML.
  // ---------------------------------------------------------
  function readConfig() {
    const node = document.getElementById("doc-config");
    if (!node) return {};
    try { return JSON.parse(node.textContent); } catch (e) {
      console.warn("document-template: invalid #doc-config JSON", e);
      return {};
    }
  }

  const cfg = readConfig();

  function cssString(value) {
    // Wrap for CSS `content:` — used only by the @page print rules.
    return '"' + String(value || "").replace(/"/g, '\\"') + '"';
  }

  function applyPrintVars() {
    root.style.setProperty("--print-brand-text", cssString(cfg.printBrandText || "Medical Library"));
    root.style.setProperty("--print-credit-text", cssString(cfg.authorName ? `${cfg.authorLabel || "Biên dịch"}: ${cfg.authorName}` : ""));
    root.style.setProperty("--print-reading-link", cssString(cfg.readingLink ? `Link bài đọc: ${cfg.readingLink}` : ""));
  }

  const facebookIconSVG = '<svg class="contact-icon facebook-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.019 4.388 11.006 10.125 11.923v-8.432H7.078v-3.491h3.047V9.413c0-3.017 1.792-4.689 4.533-4.689 1.312 0 2.686.235 2.686.235v2.973h-1.514c-1.491 0-1.955.93-1.955 1.885v2.261h3.328l-.532 3.491h-2.796v8.432C19.612 23.079 24 18.092 24 12.073z"/></svg>';
  const mailIconSVG = '<svg class="contact-icon mail-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z"/></svg>';

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function renderHeroContact() {
    const mount = document.getElementById("heroContact");
    if (!mount) return;
    const items = [];
    if (cfg.facebookUrl) {
      items.push(`<div class="hero-contact-item"><span class="hero-contact-label" aria-label="Facebook">${facebookIconSVG}</span><a href="${escapeHTML(cfg.facebookUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(cfg.facebookLabel || "Facebook")}</a></div>`);
    }
    if (cfg.email) {
      items.push(`<div class="hero-contact-item"><span class="hero-contact-label" aria-label="Email">${mailIconSVG}</span><a href="mailto:${escapeHTML(cfg.email)}">${escapeHTML(cfg.email)}</a></div>`);
    }
    mount.innerHTML = items.join("");
    mount.hidden = items.length === 0;

    const linkMount = document.getElementById("heroReadingLink");
    if (linkMount) {
      if (cfg.readingLink) {
        linkMount.innerHTML = `<span class="hero-reading-link-label">Link bài đọc:</span><a href="${escapeHTML(cfg.readingLink)}" target="_blank" rel="noopener noreferrer">${escapeHTML(cfg.readingLink)}</a>`;
        linkMount.hidden = false;
      } else {
        linkMount.hidden = true;
      }
    }
  }

  function renderPrintChrome() {
    if (isEmbedded) return; // shell prints its own chrome; avoid duplicating in a nested context
    if (!cfg.authorName && !cfg.readingLink) return;

    const layout = (side) => `
      <div class="print-layout-left">${facebookIconSVG}<span>${escapeHTML(cfg.facebookLabel || "")}</span></div>
      <div class="print-layout-center"><span>Link bài đọc:</span><a href="${escapeHTML(cfg.readingLink || "")}">${escapeHTML(cfg.readingLink || "")}</a></div>
      <div class="print-layout-right">${mailIconSVG}<span>${escapeHTML(cfg.email || "")}</span></div>
    `;

    const header = document.createElement("div");
    header.className = "print-header";
    header.setAttribute("aria-hidden", "true");
    header.innerHTML = layout();

    const footer = document.createElement("div");
    footer.className = "print-footer";
    footer.setAttribute("aria-hidden", "true");
    footer.innerHTML = layout();

    document.body.append(header, footer);

    if (cfg.printWatermarkUrl) {
      const watermark = document.createElement("div");
      watermark.className = "print-watermark";
      watermark.setAttribute("aria-hidden", "true");
      watermark.innerHTML = `<img src="${escapeHTML(cfg.printWatermarkUrl)}" alt="">`;
      document.body.append(watermark);
    }
  }

  // ---------------------------------------------------------
  // 2. TOC — built from the document's own h2/h3/h4. Skipped
  //    when embedded: reader.js in the parent shell builds an
  //    equivalent TOC from the same headings already.
  // ---------------------------------------------------------
  function normalize(t) { return String(t || "").replace(/\s+/g, " ").trim(); }

  function getHeadings() {
    return Array.from(document.querySelectorAll(".document-surface article h2, .document-surface article h3, .document-surface article h4"));
  }

  function assignHeadingIds(headings) {
    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = "section-" + (index + 1);
    });
  }

  function buildTOC(headings) {
    const tocList = document.getElementById("tocList");
    const mobileToc = document.getElementById("mobileToc");
    if (!tocList || !mobileToc) return;

    tocList.innerHTML = "";
    mobileToc.innerHTML = '<option value="">Mục lục tài liệu…</option>';

    headings.forEach((heading) => {
      const level = Number(heading.tagName.slice(1));
      const label = normalize(heading.textContent);

      const li = document.createElement("li");
      li.className = "level-" + level;
      const link = document.createElement("a");
      link.href = "#" + heading.id;
      link.dataset.target = heading.id;
      link.textContent = label;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#" + encodeURIComponent(heading.id));
      });
      li.append(link);
      tocList.append(li);

      const option = document.createElement("option");
      option.value = heading.id;
      option.textContent = "— ".repeat(Math.max(0, level - 2)) + label;
      mobileToc.append(option);
    });

    mobileToc.addEventListener("change", function () {
      if (!this.value) return;
      const target = document.getElementById(this.value);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function watchActiveHeading(headings) {
    const tocLinks = document.querySelectorAll("#tocList a");
    const mobileToc = document.getElementById("mobileToc");
    if (!headings.length || !("IntersectionObserver" in window)) return;

    const setActive = (id) => {
      tocLinks.forEach((link) => link.classList.toggle("active", link.dataset.target === id));
      if (mobileToc) mobileToc.value = id;
    };

    // A heading counts as "current" once it crosses ~15% from the
    // top of the viewport; the last one that has crossed wins.
    const observer = new IntersectionObserver(
      (entries) => {
        const crossed = entries
          .filter((entry) => entry.boundingClientRect.top < window.innerHeight * 0.3)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (crossed.length) setActive(crossed[crossed.length - 1].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((heading) => observer.observe(heading));
    setActive(headings[0].id);
  }

  // ---------------------------------------------------------
  // 3. Reading progress
  // ---------------------------------------------------------
  function updateProgress() {
    const progressText = document.getElementById("progressText");
    if (!progressText) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const percent = Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100)));
    progressText.textContent = percent + "%";
  }

  // ---------------------------------------------------------
  // 4. Font scale + theme (persisted per-browser, shared key
  //    with reader.js so a preference set in one place holds
  //    whether the document is opened standalone or embedded)
  // ---------------------------------------------------------
  function applyFont(scale) {
    root.style.setProperty("--font-scale", scale.toFixed(2));
    localStorage.setItem(FONT_KEY, scale.toFixed(2));
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }

  function restoreHash() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!hash) return;
    const target = document.getElementById(hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "auto", block: "start" }), 100);
  }

  // ---------------------------------------------------------
  // init
  // ---------------------------------------------------------
  function init() {
    applyPrintVars();
    renderHeroContact();
    renderPrintChrome();
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    applyFont(Number(localStorage.getItem(FONT_KEY) || "1"));

    if (!isEmbedded) {
      const headings = getHeadings();
      assignHeadingIds(headings);
      buildTOC(headings);
      watchActiveHeading(headings);
      window.addEventListener("scroll", updateProgress, { passive: true });
      updateProgress();
    }

    restoreHash();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
