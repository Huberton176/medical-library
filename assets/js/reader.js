const state = {
  documents: [],
  doc: null,
  headings: [],
  fontScale: Number(localStorage.getItem("ml-font-scale") || "1"),
  theme: localStorage.getItem("ml-theme") || "light"
};

const $ = (selector) => document.querySelector(selector);

const els = {
  frame: $("#documentFrame"),
  title: $("#readerTitle"),
  meta: $("#readerMeta"),
  heroTitle: $("#heroTitle"),
  heroDescription: $("#heroDescription"),
  heroMeta: $("#heroMeta"),
  kicker: $("#readerKicker"),
  tocList: $("#tocList"),
  mobileToc: $("#mobileToc"),
  progressBar: $("#progressBar"),
  progressText: $("#progressText"),
  toTop: $("#toTop"),
  error: $("#errorState"),
  errorMessage: $("#errorMessage")
};

init();

async function init() {
  applyTheme(state.theme);

  try {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) throw new Error("Thiếu mã tài liệu.");

    const [htmlResponse, driveResponse] = await Promise.all([
      fetch("data/html-documents.json"),
      fetch("data/drive-documents.json")
    ]);

    if (!htmlResponse.ok || !driveResponse.ok) {
      throw new Error("Không thể tải dữ liệu thư viện.");
    }

    state.documents = [
      ...(await htmlResponse.json()),
      ...(await driveResponse.json())
    ];

    state.doc = state.documents.find(doc => doc.id === id);
    if (!state.doc) throw new Error("Không tìm thấy tài liệu.");

    renderMetadata();
    bindShell();

    els.frame.addEventListener("load", onDocumentLoaded, { once: true });
    els.frame.src = state.doc.url;
  } catch (error) {
    showError(error.message);
  }
}

function renderMetadata() {
  const type = labelType(state.doc.type);
  document.title = `${state.doc.shortTitle || state.doc.title} — Medical Library`;

  els.title.textContent = state.doc.shortTitle || state.doc.title;
  els.meta.textContent = `${state.doc.source || "Nguồn"} · ${state.doc.year || ""} · ${type}`;

  els.heroTitle.textContent = state.doc.title;
  els.heroDescription.textContent = state.doc.description || "Clinical document";
  els.kicker.textContent =
    `${String(state.doc.sourceType || "HTML").toUpperCase()} · ${String(type).toUpperCase()}`;

  const values = [
    state.doc.source,
    state.doc.year,
    ...(state.doc.specialty || []),
    ...(state.doc.tags || []).slice(0, 3)
  ].filter(Boolean);

  els.heroMeta.innerHTML = values
    .map(value => `<span>${escapeHTML(String(value))}</span>`)
    .join("");
}

function bindShell() {
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    if (action === "font-down") changeFont(-0.05);
    if (action === "font-up") changeFont(0.05);
    if (action === "theme") toggleTheme();
    if (action === "print") printDocument();
  });

  $("#backButton").addEventListener("click", backToLibrary);
  $("#backToLibrary").addEventListener("click", backToLibrary);

  els.mobileToc.addEventListener("change", () => {
    if (els.mobileToc.value) scrollToHeading(els.mobileToc.value);
  });

  els.toTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );

  window.addEventListener("scroll", onOuterScroll, { passive: true });
  window.addEventListener("resize", () => {
    resizeFrame();
    onOuterScroll();
  });
}

function onDocumentLoaded() {
  try {
    const doc = els.frame.contentDocument;
    if (!doc) throw new Error("Không thể truy cập nội dung tài liệu.");

    injectDocumentStyle(doc);

    state.headings = [...doc.querySelectorAll("h2, h3, h4")]
      .filter(heading => heading.textContent.trim());

    state.headings.forEach((heading, index) => {
      if (!heading.id) {
        heading.id = uniqueSlug(heading.textContent, index);
      }
    });

    buildToc();
    resizeFrame();
    restoreHash();
    onOuterScroll();

    // MathJax may reflow equations after the initial load.
    [350, 800, 1500, 2500].forEach(ms => setTimeout(resizeFrame, ms));

  } catch (error) {
    showError(error.message);
  }
}

function buildToc() {
  els.tocList.innerHTML = "";
  els.mobileToc.innerHTML = `<option value="">Mục lục tài liệu…</option>`;

  state.headings.forEach(heading => {
    const level = Number(heading.tagName.slice(1));
    const label = heading.textContent.replace(/\s+/g, " ").trim();

    const li = document.createElement("li");
    li.className = `level-${level}`;

    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.dataset.target = heading.id;
    link.textContent = label;
    link.addEventListener("click", event => {
      event.preventDefault();
      scrollToHeading(heading.id);
    });

    li.append(link);
    els.tocList.append(li);

    const option = document.createElement("option");
    option.value = heading.id;
    option.textContent = `${"— ".repeat(Math.max(0, level - 2))}${label}`;
    els.mobileToc.append(option);
  });
}

function scrollToHeading(id) {
  const doc = els.frame.contentDocument;
  const heading = doc?.getElementById(id);
  if (!heading) return;

  const frameTop = els.frame.getBoundingClientRect().top + window.scrollY;
  const targetTop =
    frameTop +
    heading.getBoundingClientRect().top +
    els.frame.contentWindow.scrollY;

  const headerHeight =
    parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header")) || 66;

  window.scrollTo({
    top: Math.max(0, targetTop - headerHeight - 22),
    behavior: "smooth"
  });

  history.replaceState(
    null,
    "",
    `?id=${encodeURIComponent(state.doc.id)}#${encodeURIComponent(id)}`
  );

  els.mobileToc.value = id;
}

function onOuterScroll() {
  if (!state.headings.length) return;

  const frameTop = els.frame.getBoundingClientRect().top + window.scrollY;
  const cursor = window.scrollY + 95;
  let current = state.headings[0];

  for (const heading of state.headings) {
    const absoluteTop = frameTop + heading.offsetTop;
    if (absoluteTop <= cursor) current = heading;
    else break;
  }

  els.tocList.querySelectorAll("a").forEach(link => {
    link.classList.toggle("active", link.dataset.target === current.id);
  });

  els.mobileToc.value = current.id;

  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const percent = Math.min(100, Math.max(0, Math.round(window.scrollY / max * 100)));

  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = `${percent}%`;
  els.toTop.classList.toggle("show", window.scrollY > 650);
}

function resizeFrame() {
  const doc = els.frame.contentDocument;
  if (!doc?.documentElement) return;

  const height = Math.max(
    doc.documentElement.scrollHeight,
    doc.body?.scrollHeight || 0,
    doc.documentElement.offsetHeight,
    900
  );

  els.frame.style.height = `${height + 12}px`;
}

function injectDocumentStyle(doc) {
  const style = doc.createElement("style");
  style.id = "ml-universal-reader-style";

  style.textContent = `
    html {
      --ml-reader-scale: ${state.fontScale};
      scroll-behavior: smooth !important;
    }

    body {
      font-size: calc(18px * var(--ml-reader-scale)) !important;
    }

    h1,h2,h3,h4,h5 {
      scroll-margin-top: 80px !important;
    }

    html.ml-dark body {
      background: #15181c !important;
      color: #eef2f6 !important;
    }

    html.ml-dark p,
    html.ml-dark li,
    html.ml-dark dt,
    html.ml-dark dd,
    html.ml-dark td:not(.class-I):not(.class-IIa):not(.class-IIb):not(.class-III):not(.level-A):not(.level-B):not(.level-C),
    html.ml-dark th:not(.class-I):not(.class-IIa):not(.class-IIb):not(.class-III):not(.level-A):not(.level-B):not(.level-C) {
      color: #eef2f6 !important;
    }

    html.ml-dark .vi-trans,
    html.ml-dark .image-caption,
    html.ml-dark .abbreviations {
      color: #b8c1cc !important;
    }

    html.ml-dark .abbr-container,
    html.ml-dark .step-card,
    html.ml-dark .info-box,
    html.ml-dark .abbreviations,
    html.ml-dark .figure-placeholder {
      background: #1a1e23 !important;
      border-color: #30363d !important;
    }

    html.ml-dark table,
    html.ml-dark th,
    html.ml-dark td {
      border-color: #30363d !important;
    }

    html.ml-dark th:not(.class-I):not(.class-IIa):not(.class-IIb):not(.class-III):not(.level-A):not(.level-B):not(.level-C) {
      background: #20252b !important;
    }

    html.ml-dark .table-section-header {
      background: #29333d !important;
      color: #eef2f6 !important;
    }

    html.ml-dark .rec-table th {
      background: #173f49 !important;
      color: #fff !important;
    }

    html.ml-dark a { color: #8ab4ff !important; }

    /* Existing inline black text in the document header/credits. */
    html.ml-dark [style*="color: #000000"],
    html.ml-dark [style*="color:#000000"],
    html.ml-dark [style*="color: #000"] {
      color: #eef2f6 !important;
    }
  `;

  doc.head.append(style);
  applyDocumentPreferences();
}

function changeFont(delta) {
  state.fontScale = Math.min(
    1.28,
    Math.max(0.88, +(state.fontScale + delta).toFixed(2))
  );
  localStorage.setItem("ml-font-scale", state.fontScale.toFixed(2));
  applyDocumentPreferences();
}

function applyDocumentPreferences() {
  const doc = els.frame.contentDocument;
  if (!doc) return;

  doc.documentElement.style.setProperty("--ml-reader-scale", state.fontScale);
  doc.documentElement.classList.toggle("ml-dark", state.theme === "dark");
  setTimeout(resizeFrame, 0);
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("ml-theme", state.theme);
  applyTheme(state.theme);
  applyDocumentPreferences();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (els.frame.contentDocument) {
    els.frame.contentDocument.documentElement.classList.toggle(
      "ml-dark",
      theme === "dark"
    );
  }
}

function restoreHash() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!hash) return;

  const match = state.headings.find(heading => heading.id === hash);
  if (match) setTimeout(() => scrollToHeading(match.id), 80);
}

function printDocument() {
  els.frame.contentWindow?.focus();
  els.frame.contentWindow?.print();
}

function backToLibrary() {
  if (document.referrer.includes("/medical-library/")) {
    history.back();
  } else {
    location.href = "./";
  }
}

function labelType(type) {
  return ({
    guideline: "Guideline",
    textbook: "Textbook",
    review: "Review",
    protocol: "Protocol",
    drug: "Dược lý",
    lecture: "Bài giảng",
    other: "Tài liệu"
  })[type] || type || "Tài liệu";
}

function uniqueSlug(text, index) {
  let slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);

  if (!slug) slug = `section-${index + 1}`;
  return `${slug}-${index + 1}`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(message) {
  document.querySelector(".reader-layout")?.remove();
  document.querySelector(".reader-header")?.remove();
  document.querySelector(".progress-track")?.remove();
  els.error.hidden = false;
  els.errorMessage.textContent = message || "Không thể mở tài liệu.";
}
