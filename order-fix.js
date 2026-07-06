// 2Base order fix v1
// お知らせは新しいものを上、古いものを下に表示します。
(function(){
  if (window.__grade2OrderFix) return;
  window.__grade2OrderFix = true;

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
    const page = document.body.dataset.page;
    if (page !== "announcements") return;
    const box = $("mainList");
    if (!box) return;
    const rows = newestRows(visibleRows("announcements", selectedClass), "日付");
    box.innerHTML = rows.length ? rows.map(r => noticeCard(r)).join("") : emptyState("お知らせはありません。");
  };
})();
