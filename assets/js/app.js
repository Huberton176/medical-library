const state = {
  documents: [],
  filtered: [],
  query: "",
  type: "all",
  specialty: "all",
  year: "all",
  source: "all",
  sort: "updated"
};

const els = {
  search: document.querySelector("#searchInput"),
  type: document.querySelector("#typeFilter"),
  specialty: document.querySelector("#specialtyFilter"),
  year: document.querySelector("#yearFilter"),
  source: document.querySelector("#sourceFilter"),
  sort: document.querySelector("#sortSelect"),
  grid: document.querySelector("#documentGrid"),
  recent: document.querySelector("#recentGrid"),
  specialties: document.querySelector("#specialtyGrid"),
  summary: document.querySelector("#resultSummary"),
  noResults: document.querySelector("#noResults"),
  total: document.querySelector("#totalCount"),
  html: document.querySelector("#htmlCount"),
  drive: document.querySelector("#driveCount"),
  clear: document.querySelector("#clearFilters")
};

function normalizeVietnamese(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function searchableText(doc) {
  return normalizeVietnamese([
    doc.title,
    doc.shortTitle,
    doc.description,
    doc.type,
    doc.source,
    doc.year,
    ...(doc.specialty || []),
    ...(doc.topics || []),
    ...(doc.tags || [])
  ].filter(Boolean).join(" "));
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

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "vi", { numeric: true })
  );
}

function populateSelect(select, values) {
  const first = select.querySelector("option");
  select.innerHTML = "";
  select.append(first);
  uniqueSorted(values).forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function buildFilters() {
  populateSelect(els.type, state.documents.map(d => labelType(d.type)));
  populateSelect(els.specialty, state.documents.flatMap(d => d.specialty || []));
  populateSelect(els.year, state.documents.map(d => d.year));
  populateSelect(els.source, state.documents.map(d => d.source));
}

function cardHTML(doc) {
  const tags = (doc.tags || []).slice(0, 4)
    .map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("");

  return `
    <article class="card">
      <div class="card-top">
        <span class="badge">${escapeHTML(labelType(doc.type))}</span>
        <span class="year">${escapeHTML(doc.year ?? "—")}</span>
      </div>
      <h3>${escapeHTML(doc.title)}</h3>
      <p class="card-desc">${escapeHTML(doc.description || "Chưa có mô tả.")}</p>
      <div class="tags">${tags}</div>
      <div class="card-meta">
        <span>${escapeHTML((doc.specialty || []).join(" · ") || "Chưa phân loại")}</span>
        <span>·</span>
        <span>${escapeHTML(doc.source || "—")}</span>
      </div>
      <div class="card-action">
        <span class="source-label">${doc.sourceType === "drive" ? "Google Drive" : "HTML Library"}</span>
        <a class="read-link" href="${safeURL(doc.url)}" ${doc.sourceType === "drive" ? 'target="_blank" rel="noopener"' : ""}>
          ${doc.sourceType === "drive" ? "Mở tài liệu ↗" : "Đọc tài liệu →"}
        </a>
      </div>
    </article>
  `;
}

function render() {
  const results = [...state.documents]
    .filter(doc => {
      const q = normalizeVietnamese(state.query);
      const matchesQuery = !q || searchableText(doc).includes(q);
      const matchesType = state.type === "all" || labelType(doc.type) === state.type;
      const matchesSpecialty = state.specialty === "all" || (doc.specialty || []).includes(state.specialty);
      const matchesYear = state.year === "all" || String(doc.year) === String(state.year);
      const matchesSource = state.source === "all" || doc.source === state.source;
      return matchesQuery && matchesType && matchesSpecialty && matchesYear && matchesSource;
    })
    .sort((a, b) => {
      if (state.sort === "title") return a.title.localeCompare(b.title, "vi");
      if (state.sort === "year") return Number(b.year || 0) - Number(a.year || 0);
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

  state.filtered = results;
  els.grid.innerHTML = results.map(cardHTML).join("");
  els.noResults.hidden = results.length !== 0;

  const queryText = state.query ? ` cho “${state.query}”` : "";
  els.summary.textContent = `${results.length} tài liệu${queryText}`;
}

function renderRecent() {
  const recent = [...state.documents]
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 6);
  els.recent.innerHTML = recent.map(cardHTML).join("");
}

function renderSpecialties() {
  const map = new Map();
  state.documents.forEach(doc => (doc.specialty || []).forEach(s => map.set(s, (map.get(s) || 0) + 1)));
  const list = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  els.specialties.innerHTML = list.map(([name, count]) => `
    <button class="specialty-card" type="button" data-specialty="${escapeHTML(name)}">
      <strong>${escapeHTML(name)}</strong>
      <span>${count} tài liệu</span>
    </button>
  `).join("");

  els.specialties.querySelectorAll("[data-specialty]").forEach(btn => {
    btn.addEventListener("click", () => {
      els.specialty.value = btn.dataset.specialty;
      state.specialty = btn.dataset.specialty;
      document.querySelector("#library").scrollIntoView({ behavior: "smooth" });
      render();
    });
  });
}

function updateStats() {
  els.total.textContent = state.documents.length;
  els.html.textContent = state.documents.filter(d => d.sourceType === "html").length;
  els.drive.textContent = state.documents.filter(d => d.sourceType === "drive").length;
}

function bind() {
  els.search.addEventListener("input", e => {
    state.query = e.target.value;
    render();
  });

  els.type.addEventListener("change", e => { state.type = e.target.value; render(); });
  els.specialty.addEventListener("change", e => { state.specialty = e.target.value; render(); });
  els.year.addEventListener("change", e => { state.year = e.target.value; render(); });
  els.source.addEventListener("change", e => { state.source = e.target.value; render(); });
  els.sort.addEventListener("change", e => { state.sort = e.target.value; render(); });

  els.clear.addEventListener("click", () => {
    state.query = ""; state.type = state.specialty = state.year = state.source = "all";
    els.search.value = "";
    els.type.value = els.specialty.value = els.year.value = els.source.value = "all";
    render();
  });

  document.querySelectorAll("[data-search]").forEach(btn => {
    btn.addEventListener("click", () => {
      els.search.value = btn.dataset.search;
      state.query = btn.dataset.search;
      render();
      document.querySelector("#library").scrollIntoView({ behavior: "smooth" });
    });
  });

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      els.search.focus();
      els.search.select();
    }
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeURL(url = "#") {
  return String(url).replace(/["'<>]/g, "");
}

async function loadData() {
  const [htmlResponse, driveResponse] = await Promise.all([
    fetch("data/html-documents.json"),
    fetch("data/drive-documents.json")
  ]);

  if (!htmlResponse.ok || !driveResponse.ok) {
    throw new Error("Không thể tải dữ liệu thư viện.");
  }

  const htmlDocs = await htmlResponse.json();
  const driveDocs = await driveResponse.json();
  state.documents = [...htmlDocs, ...driveDocs];
}

async function init() {
  try {
    await loadData();
    updateStats();
    buildFilters();
    renderRecent();
    renderSpecialties();
    render();
  } catch (error) {
    console.error(error);
    els.grid.innerHTML = `<div class="empty-state"><h3>Không thể tải thư viện</h3><p>Kiểm tra đường dẫn JSON và cấu hình GitHub Pages.</p></div>`;
    els.summary.textContent = "Lỗi tải dữ liệu";
  }
  bind();
}

init();
