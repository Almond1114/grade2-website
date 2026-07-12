(function(){
  window.GRADE2_CONFIG = window.GRADE2_CONFIG || {};
  window.GRADE2_CONFIG.DATA_CACHE_MAX_AGE = 60 * 1000;
  window.GRADE2_CONFIG.APP_VERSION = "2.3.0-exceptional-ui";

  const key = "grade2Theme";
  const defaultTheme = "clear";

  function normalizeSwPath(value) {
    try { return new URL(value, location.href).pathname; }
    catch (_) { return String(value || ""); }
  }

  function installServiceWorkerRedirect() {
    if (!("serviceWorker" in navigator) || window.__grade2SwRedirectInstalled) return;
    window.__grade2SwRedirectInstalled = true;
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = function(scriptURL, options) {
      const path = normalizeSwPath(scriptURL);
      if (path.endsWith("/sw.js") || path === "sw.js") return originalRegister("firebase-messaging-sw.js", options);
      return originalRegister(scriptURL, options);
    };
  }

  function loadCssOnce(href, marker){
    if (document.querySelector(`link[data-css-loader="${marker}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.cssLoader = marker;
    document.head.appendChild(link);
  }

  function loadScriptOnce(src, marker){
    if (document.querySelector(`script[data-script-loader="${marker}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.scriptLoader = marker;
    document.head.appendChild(script);
  }

  function loadSiteAssets(){
    loadCssOnce("responsive-ui.css?v=5", "responsive-ui");
    loadCssOnce("mobile-editor-fix.css?v=4", "mobile-editor-fix");
    loadCssOnce("brand-icon.css?v=3", "brand-icon");
    loadCssOnce("stylish-ui.css?v=3", "stylish-ui");
    loadCssOnce("exceptional-ui.css?v=1", "exceptional-ui");
    loadScriptOnce("ux-enhancements.js?v=1", "ux-enhancements");
  }

  function parseTimestamp(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const normalized = raw.replace(/\s+/, "T").replace(/[/.]/g, "-");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function newestRows(rows, dateKey) {
    return [...(rows || [])].sort((a, b) => {
      const createdA = parseTimestamp(a.作成日時);
      const createdB = parseTimestamp(b.作成日時);
      if (createdA !== null || createdB !== null) {
        if (createdA === null) return 1;
        if (createdB === null) return -1;
        if (createdB !== createdA) return createdB - createdA;
      }
      const dateA = typeof parseDate === "function" ? parseDate(a[dateKey]) : null;
      const dateB = typeof parseDate === "function" ? parseDate(b[dateKey]) : null;
      const timeA = dateA ? dateA.getTime() : -1;
      const timeB = dateB ? dateB.getTime() : -1;
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.__rowNumber || 0) - Number(a.__rowNumber || 0);
    });
  }

  function installOrderFix(){
    try {
      if (window.__grade2OrderFixInstalled) return;
      if (typeof renderHome !== "function" || typeof renderListPage !== "function") return;
      window.__grade2OrderFixInstalled = true;

      const originalRenderHome = renderHome;
      renderHome = function() {
        originalRenderHome();
        if (!document.body.matches('[data-page="home"]')) return;
        const box = $("homeNoticeList");
        if (!box) return;
        const rows = newestRows(visibleRows("announcements", selectedClass), "日付").slice(0, 6);
        box.innerHTML = rows.length ? rows.map(noticeCard).join("") : emptyState("お知らせはありません。");
      };

      const originalRenderClassPage = renderClassPage;
      renderClassPage = function() {
        originalRenderClassPage();
        if (!document.body.matches('[data-page="class"]')) return;
        const cls = getCurrentPageClass();
        const noticeBox = $("classAnnouncementList");
        if (noticeBox) {
          const notices = newestRows(visibleRows("announcements", cls), "日付").slice(0, 6);
          noticeBox.innerHTML = notices.length ? notices.map(noticeCard).join("") : emptyState("お知らせはありません。");
        }
        const itemBox = $("classItemList");
        if (itemBox) itemBox.innerHTML = renderSimpleRows(newestRows(visibleRows("items", cls), "日付"), "items");
      };

      const originalRenderListPage = renderListPage;
      renderListPage = function() {
        originalRenderListPage();
        const page = document.body.dataset.page;
        const box = $("mainList");
        if (!box) return;
        if (page === "announcements") {
          const rows = newestRows(visibleRows("announcements", selectedClass), "日付");
          box.innerHTML = rows.length ? rows.map(noticeCard).join("") : emptyState("お知らせはありません。");
        }
        if (page === "links") box.innerHTML = renderSimpleRows(newestRows(visibleRows("links", selectedClass), "作成日時"), "links");
      };

      if (typeof rowsForEdit === "function") {
        const originalRowsForEdit = rowsForEdit;
        rowsForEdit = function() {
          const rows = originalRowsForEdit();
          if (selectedEditType === "announcements") return newestRows(rows, "日付");
          if (selectedEditType === "items") return newestRows(rows, "日付");
          if (selectedEditType === "links") return newestRows(rows, "作成日時");
          return rows;
        };
      }
    } catch (error) { console.warn("2Base order fix skipped", error); }
  }

  function installBrandIcon() {
    document.querySelectorAll(".brand-mark").forEach(mark => {
      if (mark.querySelector(".brand-icon-image")) return;
      mark.textContent = "";
      const image = document.createElement("img");
      image.className = "brand-icon-image";
      image.src = "icons/brand-icon.svg?v=3";
      image.alt = "2Base";
      image.width = 64;
      image.height = 64;
      mark.appendChild(image);
    });
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/svg+xml";
    favicon.href = "icons/brand-icon.svg?v=3";
  }

  function apply(theme){
    const value = theme || defaultTheme;
    document.documentElement.dataset.theme = value;
    localStorage.setItem(key, value);
    document.querySelectorAll(".theme-select").forEach(sel => { sel.value = value; });
  }

  function init(){
    loadSiteAssets();
    installOrderFix();
    const saved = localStorage.getItem(key) || defaultTheme;
    apply(saved);
    document.querySelectorAll(".theme-select").forEach(sel => {
      sel.value = saved;
      if (sel.dataset.themeBound === "true") return;
      sel.dataset.themeBound = "true";
      sel.addEventListener("change", () => apply(sel.value));
    });
    setTimeout(installBrandIcon, 0);
    window.addEventListener("pageshow", installBrandIcon);
    window.addEventListener("grade2:data-updated", installBrandIcon);
  }

  installServiceWorkerRedirect();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
