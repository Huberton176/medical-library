
(function(){
  "use strict";

  const doc = document.querySelector("article.ml-document");
  if (!doc) return;

  const topbar = document.querySelector(".ml-topbar");
  const toc = document.querySelector(".ml-toc");
  const mobileToc = document.querySelector(".ml-mobile-toc");
  const progress = document.querySelector(".ml-reading-progress");
  const topBtn = document.querySelector(".ml-top-anchor");
  const root = document.documentElement;
  const body = document.body;

  // Add stable IDs to headings and build the navigation tree.
  const headings = [...doc.querySelectorAll("h2,h3,h4")];
  const used = new Set();

  function slug(text){
    return text.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/đ/g,"d").replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"").slice(0,80) || "section";
  }

  headings.forEach((h,i)=>{
    if (!h.id){
      let id = slug(h.textContent);
      let base = id, n = 2;
      while(used.has(id) || document.getElementById(id)) id = base+"-"+(n++);
      h.id = id;
    }
    used.add(h.id);
  });

  function makeToc(target){
    if (!target) return;
    target.innerHTML = "";
    headings.forEach(h=>{
      const li = document.createElement("li");
      const a = document.createElement("a");
      const level = h.tagName.toLowerCase();
      a.href = "#"+h.id;
      a.textContent = h.textContent.trim();
      a.className = "lvl-"+level.slice(1);
      a.dataset.target = h.id;
      a.addEventListener("click", ()=> {
        setTimeout(()=>window.scrollBy({top:-8,behavior:"smooth"}), 0);
      });
      li.appendChild(a);
      target.appendChild(li);
    });
  }
  makeToc(toc);

  if (mobileToc){
    headings.forEach(h=>{
      const opt = document.createElement("option");
      opt.value = h.id;
      opt.textContent = h.textContent.trim();
      mobileToc.appendChild(opt);
    });
    mobileToc.addEventListener("change", e=>{
      const el = document.getElementById(e.target.value);
      if (el) el.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }

  // Reading progress.
  function updateProgress(){
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, window.scrollY / max * 100)) : 0;
    if (progress) progress.style.width = pct + "%";
    if (topBtn) topBtn.classList.toggle("show", window.scrollY > 700);
  }
  window.addEventListener("scroll", updateProgress, {passive:true});
  window.addEventListener("resize", updateProgress);
  updateProgress();

  // Active section in TOC.
  const links = [...document.querySelectorAll(".ml-toc a")];
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting){
        links.forEach(a=>a.classList.toggle("active", a.dataset.target===entry.target.id));
      }
    });
  }, {rootMargin:"-90px 0px -65% 0px", threshold:0});
  headings.forEach(h=>observer.observe(h));

  // Font size. Persist per browser/device.
  let scale = Number(localStorage.getItem("ml-font-scale") || "1");
  function applyScale(){
    doc.style.fontSize = (18 * scale) + "px";
  }
  applyScale();

  document.querySelector("[data-action='font-down']")?.addEventListener("click", ()=>{
    scale = Math.max(.85, +(scale-.05).toFixed(2));
    localStorage.setItem("ml-font-scale", scale);
    applyScale();
  });
  document.querySelector("[data-action='font-up']")?.addEventListener("click", ()=>{
    scale = Math.min(1.25, +(scale+.05).toFixed(2));
    localStorage.setItem("ml-font-scale", scale);
    applyScale();
  });

  // Dark mode.
  const dark = localStorage.getItem("ml-dark-mode")==="1";
  if (dark) body.classList.add("ml-dark");
  document.querySelector("[data-action='dark']")?.addEventListener("click", ()=>{
    body.classList.toggle("ml-dark");
    localStorage.setItem("ml-dark-mode", body.classList.contains("ml-dark") ? "1" : "0");
  });

  // Return to library.
  document.querySelector("[data-action='back']")?.addEventListener("click", ()=>{
    if (history.length > 1) history.back();
    else window.location.href = "../index.html";
  });

  // Scroll to top.
  topBtn?.addEventListener("click", ()=>window.scrollTo({top:0,behavior:"smooth"}));

  // Keyboard shortcuts.
  document.addEventListener("keydown", e=>{
    if (e.key === "Escape" && document.activeElement) document.activeElement.blur();
    if ((e.ctrlKey || e.metaKey) && e.key === "+"){ e.preventDefault(); document.querySelector("[data-action='font-up']")?.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "-"){ e.preventDefault(); document.querySelector("[data-action='font-down']")?.click(); }
  });
})();
