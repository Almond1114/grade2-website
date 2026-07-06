(function(){
  const key = "grade2Theme";
  const defaultTheme = "clear";

  function loadCssOnce(href, marker){
    if (document.querySelector(`link[data-css-loader="${marker}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.cssLoader = marker;
    document.head.appendChild(link);
  }

  function loadResponsiveCss(){
    loadCssOnce('responsive-ui.css?v=2', 'responsive-ui');
    loadCssOnce('mobile-editor-fix.css?v=1', 'mobile-editor-fix');
  }

  function installOrderFix(){
    try {
      if (window.__grade2OrderFixInstalled) return;
      if (typeof renderHome !== 'function' || typeof renderListPage !== 'function') return;
      window.__grade2OrderFixInstalled = true;

      function newestRows(rows, key) {
        return [...(rows || [])].sort((a, b) => {
          const da = parseDate(a[key]);
          const db = parseDate(b[key]);
          const ta = da ? da.getTime() : -1;
          const tb = db ? db.getTime() : -1;
          if (tb !== ta) return tb - ta;
          const ra = Number(a.__rowNumber || 999999);
          const rb = Number(b.__rowNumber || 999999);
          return ra - rb;
        });
      }

      const originalRenderHome = renderHome;
      renderHome = function() {
        originalRenderHome();
        if (!document.body.matches('[data-page="home"]')) return;
        const box = $("homeNoticeList");
        if (!box) return;
        const rows = newestRows(visibleRows("announcements", selectedClass), "日付").slice(0, 4);
        box.innerHTML = rows.length ? rows.map(r => noticeCard(r)).join("") : emptyState("お知らせはありません。");
      };

      const originalRenderClassPage = renderClassPage;
      renderClassPage = function() {
        originalRenderClassPage();
        if (!document.body.matches('[data-page="class"]')) return;
        const cls = getCurrentPageClass();
        const box = $("classAnnouncementList");
        if (!box) return;
        const rows = newestRows(visibleRows("announcements", cls), "日付").slice(0, 4);
        box.innerHTML = rows.length ? rows.map(r => noticeCard(r)).join("") : emptyState("お知らせはありません。");
      };

      const originalRenderListPage = renderListPage;
      renderListPage = function() {
        originalRenderListPage();
        if (document.body.dataset.page !== "announcements") return;
        const box = $("mainList");
        if (!box) return;
        const rows = newestRows(visibleRows("announcements", selectedClass), "日付");
        box.innerHTML = rows.length ? rows.map(r => noticeCard(r)).join("") : emptyState("お知らせはありません。");
      };
    } catch (error) {
      console.warn('order fix skipped', error);
    }
  }

  function apply(theme){
    document.documentElement.dataset.theme = theme || defaultTheme;
    localStorage.setItem(key, theme || defaultTheme);
    document.querySelectorAll('.theme-select').forEach(sel => sel.value = theme || defaultTheme);
  }

  function init(){
    loadResponsiveCss();
    installOrderFix();
    const saved = localStorage.getItem(key) || defaultTheme;
    apply(saved);
    document.querySelectorAll('.theme-select').forEach(sel => {
      sel.value = saved;
      sel.addEventListener('change', () => apply(sel.value));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
