// Grade 2 Website v2 common app logic
// app-config.js に window.GRADE2_CONFIG を置くと本番データに接続します。
const APP_CONFIG = window.GRADE2_CONFIG || {};
const GAS_URL = String(APP_CONFIG.GAS_URL || "").trim();
const SHEET_URL = String(APP_CONFIG.SHEET_URL || "").trim();
const AI_ENDPOINT = String(APP_CONFIG.AI_ENDPOINT || "").trim();
const SITE_TITLE = String(APP_CONFIG.SITE_TITLE || "2Base").trim();
const SITE_SUBTITLE = String(APP_CONFIG.SITE_SUBTITLE || "2学年総合web").trim();
const SITE_MARK = String(APP_CONFIG.SITE_MARK || "2").trim();
const DATA_CACHE_MAX_AGE = Number(APP_CONFIG.DATA_CACHE_MAX_AGE || 10 * 60 * 1000);

const SAMPLE_DATA = {
  announcements: [
    { __rowNumber: "2", 表示: "TRUE", 日付: "2026-07-04", カテゴリ: "連絡", クラス: "全体", タイトル: "2Base公開", 本文: "時間割・提出物・テスト予定をここで確認できます。", 画像URL: "", リンクURL: "" },
    { __rowNumber: "3", 表示: "TRUE", 日付: "2026-07-08", カテゴリ: "行事", クラス: "全体", タイトル: "学年集会", 本文: "朝の会後に体育館へ移動します。", 画像URL: "", リンクURL: "" }
  ],
  timetable: [
    { __rowNumber: "2", クラス: "2-1", 曜日: "月", "1時間目": "国語", "2時間目": "数学", "3時間目": "英語", "4時間目": "理科", "5時間目": "体育", "6時間目": "総合", 持ち物メモ: "体育着" },
    { __rowNumber: "3", クラス: "2-1", 曜日: "火", "1時間目": "社会", "2時間目": "英語", "3時間目": "数学", "4時間目": "美術", "5時間目": "国語", "6時間目": "道徳", 持ち物メモ: "美術セット" },
    { __rowNumber: "4", クラス: "2-2", 曜日: "月", "1時間目": "数学", "2時間目": "英語", "3時間目": "国語", "4時間目": "体育", "5時間目": "社会", "6時間目": "総合", 持ち物メモ: "体育着" },
    { __rowNumber: "5", クラス: "2-3", 曜日: "月", "1時間目": "英語", "2時間目": "数学", "3時間目": "理科", "4時間目": "国語", "5時間目": "体育", "6時間目": "総合", 持ち物メモ: "体育着・水筒" },
    { __rowNumber: "6", クラス: "2-3", 曜日: "火", "1時間目": "国語", "2時間目": "社会", "3時間目": "数学", "4時間目": "美術", "5時間目": "英語", "6時間目": "道徳", 持ち物メモ: "美術セット" },
    { __rowNumber: "7", クラス: "2-3", 曜日: "水", "1時間目": "数学", "2時間目": "体育", "3時間目": "理科", "4時間目": "技術", "5時間目": "社会", "6時間目": "学活", 持ち物メモ: "技術ファイル" },
    { __rowNumber: "8", クラス: "2-3", 曜日: "木", "1時間目": "理科", "2時間目": "英語", "3時間目": "音楽", "4時間目": "数学", "5時間目": "国語", "6時間目": "総合", 持ち物メモ: "音楽ファイル" },
    { __rowNumber: "9", クラス: "2-3", 曜日: "金", "1時間目": "社会", "2時間目": "国語", "3時間目": "体育", "4時間目": "英語", "5時間目": "数学", "6時間目": "学活", 持ち物メモ: "体育着" }
  ],
  tests: [
    { __rowNumber: "2", 表示: "TRUE", 日付: "2026-07-10", クラス: "全体", 教科: "数学", タイトル: "数学 小テスト", 範囲: "一次関数・連立方程式", 持ち物: "定規", メモ: "ワークも確認" },
    { __rowNumber: "3", 表示: "TRUE", 日付: "2026-09-18", クラス: "全体", 教科: "5教科", タイトル: "期末テスト", 範囲: "後日発表", 持ち物: "筆記用具", メモ: "早めに準備" }
  ],
  items: [
    { __rowNumber: "2", 表示: "TRUE", 日付: "毎週月・金", クラス: "全体", タイトル: "体育がある日", 持ち物: "ジャージ・体育館シューズ・水筒", メモ: "忘れやすいので前日に確認" },
    { __rowNumber: "3", 表示: "TRUE", 日付: "美術の日", クラス: "全体", タイトル: "美術セット", 持ち物: "絵の具セット・スケッチブック", メモ: "必要な週だけ" }
  ],
  homework: [
    { __rowNumber: "2", 表示: "TRUE", 締切: "2026-07-09", クラス: "全体", 教科: "数学", タイトル: "数学ワーク", 内容: "P.32〜P.35", メモ: "丸付けまで" },
    { __rowNumber: "3", 表示: "TRUE", 締切: "2026-07-11", クラス: "全体", 教科: "国語", タイトル: "漢字プリント", 内容: "1枚提出", メモ: "名前を書く" }
  ],
  links: [
    { __rowNumber: "2", 表示: "TRUE", カテゴリ: "学習", タイトル: "NHK for School", URL: "https://www.nhk.or.jp/school/", 説明: "授業の復習に使える動画サイト" }
  ],
  editLog: [
    { 日時: "サンプル", 種類: "サイト", 行: "-", 内容: "ここに編集履歴が表示されます" }
  ]
};

const EDIT_FIELDS = {
  announcements: [
    ["表示", "select", ["TRUE", "FALSE"]], ["日付", "date"], ["カテゴリ", "text"], ["クラス", "text"], ["タイトル", "text"], ["本文", "textarea"], ["画像URL", "url"], ["リンクURL", "url"]
  ],
  timetable: [
    ["クラス", "text"], ["曜日", "select", ["月", "火", "水", "木", "金", "土", "日"]], ["1時間目", "text"], ["2時間目", "text"], ["3時間目", "text"], ["4時間目", "text"], ["5時間目", "text"], ["6時間目", "text"], ["持ち物メモ", "textarea"]
  ],
  tests: [
    ["表示", "select", ["TRUE", "FALSE"]], ["日付", "date"], ["クラス", "text"], ["教科", "text"], ["タイトル", "text"], ["範囲", "textarea"], ["持ち物", "text"], ["メモ", "textarea"]
  ],
  items: [
    ["表示", "select", ["TRUE", "FALSE"]], ["日付", "text"], ["クラス", "text"], ["タイトル", "text"], ["持ち物", "textarea"], ["メモ", "textarea"]
  ],
  homework: [
    ["表示", "select", ["TRUE", "FALSE"]], ["締切", "date"], ["クラス", "text"], ["教科", "text"], ["タイトル", "text"], ["内容", "textarea"], ["メモ", "textarea"]
  ],
  links: [
    ["表示", "select", ["TRUE", "FALSE"]], ["カテゴリ", "text"], ["タイトル", "text"], ["URL", "url"], ["説明", "textarea"]
  ]
};

const TYPE_LABELS = {
  announcements: "お知らせ",
  timetable: "時間割",
  tests: "テスト予定",
  items: "持ち物",
  homework: "提出物",
  links: "学習リンク"
};

const EDIT_TYPE_META = {
  announcements: { icon: "📢", short: "学年・クラス連絡", hint: "日付・タイトル・本文・画像URLを変更" },
  timetable: { icon: "📅", short: "曜日ごとの授業", hint: "クラス・曜日・1〜6時間目・持ち物メモを変更" },
  homework: { icon: "📝", short: "締切と内容", hint: "教科・締切・内容・メモを変更" },
  tests: { icon: "🧪", short: "テスト日程", hint: "日付・教科・範囲・持ち物を変更" },
  items: { icon: "🎒", short: "忘れ物対策", hint: "持ち物名・対象クラス・メモを変更" },
  links: { icon: "🔗", short: "学習リンク", hint: "タイトル・URL・説明を変更" }
};
const EDIT_TYPE_ORDER = ["announcements", "timetable", "homework", "tests", "items", "links"];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const SCHOOL_DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = ["1時間目", "2時間目", "3時間目", "4時間目", "5時間目", "6時間目"];
const DEFAULT_CLASSES = ["2-1", "2-2", "2-3", "2-4", "2-5"];

let appData = cloneData(SAMPLE_DATA);
let selectedClass = localStorage.getItem("grade2SelectedClass") || APP_CONFIG.DEFAULT_CLASS || "2-3";
let dataMode = "loading";
let selectedEditType = "announcements";
let selectedRowNumber = "";

const $ = (id) => document.getElementById(id);

function cloneData(data) { return JSON.parse(JSON.stringify(data)); }
function clear(node) { if (node) node.innerHTML = ""; }
function text(value) { return String(value ?? "").trim(); }
function isTrue(value) { return !["FALSE", "false", "0", "非表示"].includes(text(value)); }
function isVisible(row) { return isTrue(row.表示 || "TRUE"); }
function classMatch(row, className = selectedClass) {
  const rowClass = text(row.クラス || "全体");
  return rowClass === "" || rowClass === "全体" || rowClass === className;
}
function escapeHtml(str) {
  return text(str).replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
}
function safeUrl(url) {
  const value = text(url);
  return value.startsWith("https://") ? value : "";
}
function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replace(/[/.]/g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
function todayStart() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dateLabel(value) {
  const d = parseDate(value);
  if (!d) return text(value) || "日付未定";
  return `${d.getMonth()+1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}
function dayDiff(value) {
  const d = parseDate(value);
  if (!d) return null;
  d.setHours(0,0,0,0);
  return Math.ceil((d - todayStart()) / 86400000);
}
function dueBadge(value) {
  const diff = dayDiff(value);
  if (diff === null) return "";
  if (diff < 0) return `<span class="badge muted-badge">終了</span>`;
  if (diff === 0) return `<span class="badge danger">今日</span>`;
  if (diff === 1) return `<span class="badge warning">明日</span>`;
  if (diff <= 3) return `<span class="badge warning">あと${diff}日</span>`;
  return `<span class="badge">あと${diff}日</span>`;
}
function sortUpcoming(rows, key) {
  return [...rows].sort((a,b) => {
    const da = parseDate(a[key]);
    const db = parseDate(b[key]);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}
function visibleRows(type, className = selectedClass) {
  return (appData[type] || []).filter(row => isVisible(row) && classMatch(row, className));
}
function upcomingRows(type, key, className = selectedClass) {
  return sortUpcoming(visibleRows(type, className).filter(row => {
    const d = parseDate(row[key]);
    return !d || d >= todayStart();
  }), key);
}
function getClasses() {
  const classes = new Set(DEFAULT_CLASSES);
  (appData.timetable || []).forEach(row => {
    const cls = text(row.クラス);
    if (/^2-\d+/.test(cls)) classes.add(cls);
  });
  return [...classes].sort((a,b) => a.localeCompare(b, "ja"));
}
function getCurrentPageClass() {
  const fromBody = document.body?.dataset?.class || "";
  return fromBody || selectedClass;
}
function setSelectedClass(className, options = {}) {
  selectedClass = className || selectedClass;
  localStorage.setItem("grade2SelectedClass", selectedClass);
  window.dispatchEvent(new CustomEvent("grade2:class-changed", { detail: { selectedClass }}));
  if (!options.noRender) renderAll();
}
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "grade2_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    const timer = setTimeout(() => { cleanup(); reject(new Error("通信がタイムアウトしました")); }, 18000);
    function cleanup(){ clearTimeout(timer); delete window[callbackName]; script.remove(); }
    window[callbackName] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("読み込みに失敗しました")); };
    script.src = `${url}${sep}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}
async function loadData() {
  renderConnection("loading");
  if (!GAS_URL) {
    appData = cloneData(SAMPLE_DATA);
    dataMode = "sample";
    renderAll();
    renderConnection("sample");
    return;
  }

  const cached = readLocalDataCache();
  if (cached?.data) {
    appData = cached.data;
    dataMode = "cached";
    renderAll();
    renderConnection("cached", cached.savedAt);
    window.dispatchEvent(new CustomEvent("grade2:data-updated"));
  }

  try {
    const res = await jsonp(`${GAS_URL}?action=data`);
    if (!res?.ok) throw new Error(res?.error || "データ取得エラー");
    appData = res.data || cloneData(SAMPLE_DATA);
    saveLocalDataCache(appData);
    dataMode = "live";
    renderAll();
    renderConnection("live");
    window.dispatchEvent(new CustomEvent("grade2:data-updated"));
  } catch (error) {
    console.warn(error);
    if (cached?.data) {
      dataMode = "cached";
      renderConnection("cached-error", cached.savedAt);
      return;
    }
    appData = cloneData(SAMPLE_DATA);
    dataMode = "sample";
    renderAll();
    renderConnection("sample", error.message);
  }
}
function renderConnection(mode, detail = "") {
  const box = $("connectionBanner");
  if (!box) return;
  box.className = `connection-banner ${mode}`;
  if (mode === "loading") box.textContent = "データを読み込んでいます...";
  else if (mode === "live") box.textContent = "ライブ接続中：スプレッドシートの最新データを表示しています。";
  else if (mode === "cached") {
    const when = detail ? new Date(Number(detail)).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "前回";
    box.textContent = `高速表示：${when}に保存したデータを先に表示中。裏で最新版を確認しています。`;
  } else if (mode === "cached-error") {
    const when = detail ? new Date(Number(detail)).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "前回";
    box.textContent = `通信が不安定なので、${when}に保存したデータを表示しています。`;
  } else box.textContent = detail ? `サンプル表示中：${detail}` : "サンプル表示中：app-config.js に GAS_URL を入れると本番データになります。";
}
function card(title, body, meta = "", href = "") {
  const inner = `<h3>${escapeHtml(title)}</h3>${body ? `<p>${escapeHtml(body)}</p>` : ""}${meta ? `<small>${meta}</small>` : ""}`;
  return href ? `<a class="content-card link-card" href="${escapeHtml(href)}">${inner}</a>` : `<article class="content-card">${inner}</article>`;
}
function emptyState(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }

function getTomorrowInfo(className = selectedClass) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowDay = WEEKDAYS[tomorrow.getDay()];
  const timetable = (appData.timetable || []).find(r => text(r.クラス) === className && text(r.曜日) === tomorrowDay);
  const date = dateKey(tomorrow);
  const homework = upcomingRows("homework", "締切", className).filter(r => text(r.締切).startsWith(date));
  const tests = upcomingRows("tests", "日付", className).filter(r => text(r.日付).startsWith(date));
  const items = visibleRows("items", className).slice(0, 3);
  return { date, day: tomorrowDay, timetable, homework, tests, items };
}
function nextHomework(className = selectedClass) { return upcomingRows("homework", "締切", className)[0] || null; }
function nextTest(className = selectedClass) { return upcomingRows("tests", "日付", className)[0] || null; }

function renderCommon() {
  const today = new Date();
  document.querySelectorAll("[data-today]").forEach(el => el.textContent = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日（${WEEKDAYS[today.getDay()]}）`);
  document.querySelectorAll("[data-selected-class]").forEach(el => el.textContent = selectedClass);

  document.querySelectorAll(".class-select").forEach(select => {
    const pageClass = getCurrentPageClass();
    const current = document.body.dataset.class ? pageClass : selectedClass;
    select.innerHTML = getClasses().map(cls => `<option value="${escapeHtml(cls)}" ${cls === current ? "selected" : ""}>${escapeHtml(cls)}</option>`).join("");
    select.onchange = () => {
      const next = select.value;
      setSelectedClass(next, { noRender: true });
      if (document.body.dataset.class) {
        location.href = `class-${next.replace("-", "-")}.html`;
      } else {
        renderAll();
      }
    };
  });

  const sheetLink = $("sheetLink");
  if (sheetLink) {
    if (SHEET_URL) sheetLink.href = SHEET_URL;
    else sheetLink.style.display = "none";
  }
}

function renderHome() {
  if (!document.body.matches('[data-page="home"]')) return;
  const cls = selectedClass;
  const t = nextTest(cls);
  const h = nextHomework(cls);
  const tomorrow = getTomorrowInfo(cls);
  const quick = $("gradeQuickStats");
  if (quick) {
    quick.innerHTML = [
      card("今日", `${new Date().getMonth()+1}/${new Date().getDate()}（${WEEKDAYS[new Date().getDay()]}）`, SITE_SUBTITLE),
      card("次のテスト", t ? `${t.タイトル || t.教科} ${dueBadge(t.日付)}` : "予定なし", t ? `${dateLabel(t.日付)} / ${escapeHtml(t.範囲 || "")}` : ""),
      card("次の提出物", h ? `${h.タイトル || h.教科} ${dueBadge(h.締切)}` : "予定なし", h ? `${dateLabel(h.締切)} / ${escapeHtml(h.内容 || "")}` : ""),
      card("明日の準備", tomorrow.timetable ? PERIODS.map(p => tomorrow.timetable[p]).filter(Boolean).slice(0,3).join("・") + "..." : "時間割未入力", `${cls} / ${tomorrow.day}曜日`)
    ].join("");
  }

  const notices = $("homeNoticeList");
  if (notices) {
    const rows = sortUpcoming(visibleRows("announcements", cls), "日付").slice(0, 4);
    notices.innerHTML = rows.length ? rows.map(r => noticeCard(r)).join("") : emptyState("お知らせはありません。");
  }

  const upcoming = $("homeUpcomingList");
  if (upcoming) {
    const rows = [
      ...upcomingRows("tests", "日付", cls).slice(0, 3).map(r => ({type:"テスト", date:r.日付, title:r.タイトル || r.教科, sub:r.範囲 || r.メモ})),
      ...upcomingRows("homework", "締切", cls).slice(0, 3).map(r => ({type:"提出物", date:r.締切, title:r.タイトル || r.教科, sub:r.内容 || r.メモ}))
    ].sort((a,b) => (parseDate(a.date) || 9999999999999) - (parseDate(b.date) || 9999999999999)).slice(0, 6);
    upcoming.innerHTML = rows.length ? rows.map(r => `<article class="list-card"><div><span class="mini-label">${escapeHtml(r.type)}</span><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.sub)}</p></div><div>${dueBadge(r.date)}<small>${dateLabel(r.date)}</small></div></article>`).join("") : emptyState("近い予定はありません。");
  }

  const classes = $("classCards");
  if (classes) {
    classes.innerHTML = getClasses().map(cls => {
      const nT = nextTest(cls);
      const nH = nextHomework(cls);
      const tomorrow = getTomorrowInfo(cls);
      return `<a class="class-card" href="class-${escapeHtml(cls)}.html">
        <strong>${escapeHtml(cls)}</strong>
        <span>${tomorrow.timetable ? PERIODS.map(p => tomorrow.timetable[p]).filter(Boolean).slice(0,3).join("・") : "時間割未入力"}</span>
        <small>${nT ? `テスト: ${escapeHtml(nT.タイトル || nT.教科)}` : "テスト予定なし"} / ${nH ? `提出物: ${escapeHtml(nH.タイトル || nH.教科)}` : "提出物なし"}</small>
      </a>`;
    }).join("");
  }
}
function noticeCard(row) {
  const img = safeUrl(row.画像URL);
  const link = safeUrl(row.リンクURL);
  const html = `<article class="content-card notice-card">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : ""}<div><span class="mini-label">${escapeHtml(row.カテゴリ || "連絡")} / ${escapeHtml(row.クラス || "全体")}</span><h3>${escapeHtml(row.タイトル)}</h3><p>${escapeHtml(row.本文)}</p><small>${dateLabel(row.日付)}</small>${link ? `<a class="text-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">リンクを開く</a>` : ""}</div></article>`;
  return html;
}
function renderClassPage() {
  if (!document.body.matches('[data-page="class"]')) return;
  const cls = getCurrentPageClass();
  selectedClass = cls;
  localStorage.setItem("grade2SelectedClass", cls);
  document.querySelectorAll("[data-class-name]").forEach(el => el.textContent = cls);
  const t = nextTest(cls);
  const h = nextHomework(cls);
  const tomorrow = getTomorrowInfo(cls);
  const quick = $("classQuickCards");
  if (quick) {
    quick.innerHTML = [
      card("明日の時間割", tomorrow.timetable ? PERIODS.map(p => tomorrow.timetable[p]).filter(Boolean).join("・") : "未入力", `${tomorrow.day}曜日 / ${tomorrow.timetable?.持ち物メモ || "持ち物メモなし"}`),
      card("次の提出物", h ? `${h.タイトル || h.教科} ${dueBadge(h.締切)}` : "予定なし", h ? `${dateLabel(h.締切)} / ${escapeHtml(h.内容 || "")}` : ""),
      card("次のテスト", t ? `${t.タイトル || t.教科} ${dueBadge(t.日付)}` : "予定なし", t ? `${dateLabel(t.日付)} / ${escapeHtml(t.範囲 || "")}` : ""),
      card("よく使う", "時間割・提出物・テストを上にまとめています。", "このページだけで準備確認OK")
    ].join("");
  }
  const prep = $("classTomorrowPrep");
  if (prep) prep.innerHTML = buildPrepHtml(cls);
  const table = $("classTimetable");
  if (table) table.innerHTML = buildTimetableHtml(cls);
  const hw = $("classHomeworkList");
  if (hw) hw.innerHTML = renderSimpleRows(upcomingRows("homework", "締切", cls), "homework");
  const tests = $("classTestList");
  if (tests) tests.innerHTML = renderSimpleRows(upcomingRows("tests", "日付", cls), "tests");
  const items = $("classItemList");
  if (items) items.innerHTML = renderSimpleRows(visibleRows("items", cls), "items");
  const notices = $("classAnnouncementList");
  if (notices) notices.innerHTML = visibleRows("announcements", cls).slice(0,4).map(noticeCard).join("") || emptyState("お知らせはありません。");
}
function buildPrepHtml(cls) {
  const t = getTomorrowInfo(cls);
  const subjects = t.timetable ? PERIODS.map(p => `<li><b>${p}</b><span>${escapeHtml(t.timetable[p] || "-")}</span></li>`).join("") : "";
  const hw = t.homework.length ? t.homework.map(r => `<li>${escapeHtml(r.教科)}：${escapeHtml(r.タイトル)} / ${escapeHtml(r.内容)}</li>`).join("") : `<li>明日締切の提出物は見つかりません。</li>`;
  const tests = t.tests.length ? t.tests.map(r => `<li>${escapeHtml(r.教科)}：${escapeHtml(r.タイトル)} / ${escapeHtml(r.範囲)}</li>`).join("") : `<li>明日のテストは見つかりません。</li>`;
  return `<div class="prep-board">
    <article><span class="mini-label">${escapeHtml(cls)} / 明日 ${escapeHtml(t.day)}曜日</span><h3>時間割</h3>${subjects ? `<ul class="period-list">${subjects}</ul>` : `<p>明日の時間割が未入力です。</p>`}<small>${escapeHtml(t.timetable?.持ち物メモ || "持ち物メモなし")}</small></article>
    <article><h3>提出物</h3><ul>${hw}</ul></article>
    <article><h3>テスト</h3><ul>${tests}</ul></article>
  </div>`;
}
function buildTimetableHtml(cls) {
  const rows = SCHOOL_DAYS.map(day => (appData.timetable || []).find(r => text(r.クラス) === cls && text(r.曜日) === day) || {曜日:day});
  return `<table class="data-table"><thead><tr><th>曜日</th>${PERIODS.map(p=>`<th>${p}</th>`).join("")}<th>持ち物</th></tr></thead><tbody>${rows.map(r => `<tr><th>${escapeHtml(r.曜日)}</th>${PERIODS.map(p=>`<td>${escapeHtml(r[p] || "-")}</td>`).join("")}<td>${escapeHtml(r.持ち物メモ || "-")}</td></tr>`).join("")}</tbody></table>`;
}
function renderSimpleRows(rows, type) {
  if (!rows.length) return emptyState("表示できるデータがありません。");
  return rows.map(row => {
    if (type === "tests") return `<article class="list-card"><div><span class="mini-label">${escapeHtml(row.教科)} / ${escapeHtml(row.クラス || "全体")}</span><h3>${escapeHtml(row.タイトル)}</h3><p>${escapeHtml(row.範囲 || row.メモ)}</p><small>${escapeHtml(row.持ち物 || "")}</small></div><div>${dueBadge(row.日付)}<small>${dateLabel(row.日付)}</small></div></article>`;
    if (type === "homework") return `<article class="list-card"><div><span class="mini-label">${escapeHtml(row.教科)} / ${escapeHtml(row.クラス || "全体")}</span><h3>${escapeHtml(row.タイトル)}</h3><p>${escapeHtml(row.内容 || row.メモ)}</p></div><div>${dueBadge(row.締切)}<small>${dateLabel(row.締切)}</small></div></article>`;
    if (type === "items") return `<article class="list-card"><div><span class="mini-label">${escapeHtml(row.日付 || "持ち物")}</span><h3>${escapeHtml(row.タイトル)}</h3><p>${escapeHtml(row.持ち物)}</p><small>${escapeHtml(row.メモ || "")}</small></div></article>`;
    if (type === "links") {
      const url = safeUrl(row.URL);
      return `<a class="list-card link-row" href="${escapeHtml(url || '#')}" target="_blank" rel="noopener noreferrer"><div><span class="mini-label">${escapeHtml(row.カテゴリ)}</span><h3>${escapeHtml(row.タイトル)}</h3><p>${escapeHtml(row.説明)}</p></div></a>`;
    }
    return noticeCard(row);
  }).join("");
}
function renderListPage() {
  const page = document.body.dataset.page;
  const cls = selectedClass;
  if (page === "tests") {
    const box = $("mainList"); if (box) box.innerHTML = renderSimpleRows(upcomingRows("tests", "日付", cls), "tests");
  }
  if (page === "homework") {
    const box = $("mainList"); if (box) box.innerHTML = renderSimpleRows(upcomingRows("homework", "締切", cls), "homework");
  }
  if (page === "announcements") {
    const box = $("mainList"); if (box) box.innerHTML = (visibleRows("announcements", cls).map(noticeCard).join("") || emptyState("お知らせはありません。"));
  }
  if (page === "links") {
    const box = $("mainList"); if (box) box.innerHTML = renderSimpleRows(visibleRows("links", cls), "links");
  }
  if (page === "classes") {
    const box = $("classCardsLarge");
    if (box) box.innerHTML = getClasses().map(cls => `<a class="class-card large" href="class-${escapeHtml(cls)}.html"><strong>${escapeHtml(cls)}</strong><span>時間割・提出物・テスト・持ち物を確認</span><small>クラス専用ページへ</small></a>`).join("");
  }
}

function renderEditor() {
  if (!document.body.matches('[data-page="edit"]')) return;
  renderEditTypeCards();
  renderEditRowList();
  renderEditForm();
  renderEditLog();
}
function rowsForEdit() {
  const rows = appData[selectedEditType] || [];
  const q = text($("editSearch")?.value).toLowerCase();
  if (!q) return rows;
  return rows.filter(row => Object.values(row).some(v => text(v).toLowerCase().includes(q)));
}
function rowTitle(type, row) {
  if (type === "announcements") return `${row.日付 || "日付なし"} ${row.タイトル || "無題"}`;
  if (type === "timetable") return `${row.クラス || "?"} ${row.曜日 || "?"}曜日`;
  if (type === "tests") return `${row.日付 || "日付なし"} ${row.教科 || ""} ${row.タイトル || ""}`;
  if (type === "items") return `${row.クラス || "全体"} ${row.タイトル || "持ち物"}`;
  if (type === "homework") return `${row.締切 || "締切なし"} ${row.教科 || ""} ${row.タイトル || ""}`;
  if (type === "links") return `${row.カテゴリ || "リンク"} ${row.タイトル || ""}`;
  return `行 ${row.__rowNumber}`;
}
function renderEditTypeCards() {
  const box = $("editTypeCards"); if (!box) return;
  box.innerHTML = EDIT_TYPE_ORDER.map(type => {
    const meta = EDIT_TYPE_META[type] || { icon: "✏️", short: "編集", hint: "内容を変更" };
    const count = (appData[type] || []).length;
    return `<button class="edit-type-card editor-menu-card ${type===selectedEditType ? 'active' : ''}" data-edit-type="${type}" type="button">
      <span class="edit-type-icon">${meta.icon}</span>
      <span class="edit-type-copy"><strong>${TYPE_LABELS[type]}</strong><span>${meta.short}</span><small>${meta.hint}</small></span>
      <em>${count}件</em>
    </button>`;
  }).join("");
  box.querySelectorAll("[data-edit-type]").forEach(btn => btn.onclick = () => { selectedEditType = btn.dataset.editType; selectedRowNumber = ""; renderEditor(); });
}
function renderEditRowList() {
  const list = $("editRowList"); if (!list) return;
  const rows = rowsForEdit();
  if (!selectedRowNumber && rows[0]) selectedRowNumber = rows[0].__rowNumber;
  const meta = EDIT_TYPE_META[selectedEditType] || {};
  list.innerHTML = rows.length ? rows.map(row => {
    const sub = selectedEditType === "timetable"
      ? `${row["1時間目"] || ""} ${row["2時間目"] || ""} ${row["3時間目"] || ""}`
      : (row.本文 || row.内容 || row.範囲 || row.持ち物 || row.説明 || row.メモ || "");
    const cls = row.クラス ? ` / ${row.クラス}` : "";
    return `<button type="button" class="edit-row ${row.__rowNumber === selectedRowNumber ? 'active' : ''}" data-row="${row.__rowNumber}">
      <span>${escapeHtml(rowTitle(selectedEditType,row))}</span>
      <small>${escapeHtml(TYPE_LABELS[selectedEditType])}${escapeHtml(cls)} / シート ${escapeHtml(row.__rowNumber)} 行目</small>
      ${sub ? `<p>${escapeHtml(sub).slice(0, 80)}</p>` : ""}
    </button>`;
  }).join("") : emptyState(`${TYPE_LABELS[selectedEditType] || "この種類"}の行が見つかりません。検索条件を変えてください。`);
}
function selectedEditRow() {
  return (appData[selectedEditType] || []).find(r => r.__rowNumber === selectedRowNumber) || null;
}
function renderEditForm() {
  const form = $("editForm"); const fieldsBox = $("editFields"); const title = $("editFormTitle");
  if (!form || !fieldsBox) return;
  const row = selectedEditRow();
  if (!row) {
    if (title) title.textContent = "行を選んでください";
    fieldsBox.innerHTML = emptyState("左から編集する行を選んでください。");
    return;
  }
  if (title) title.textContent = rowTitle(selectedEditType, row);
  const meta = EDIT_TYPE_META[selectedEditType] || {};
  const preview = `<div class="edit-current-preview wide"><span>${meta.icon || "✏️"} ${escapeHtml(TYPE_LABELS[selectedEditType])}を編集中</span><strong>${escapeHtml(rowTitle(selectedEditType, row))}</strong><small>保存先：スプレッドシート ${escapeHtml(row.__rowNumber)} 行目</small></div>`;
  const fields = EDIT_FIELDS[selectedEditType].map(([name, type, choices]) => {
    const value = row[name] || "";
    const help = fieldHelpText(name, selectedEditType);
    if (type === "select") return `<label><span>${escapeHtml(name)}</span><select name="${escapeHtml(name)}">${choices.map(c => `<option value="${escapeHtml(c)}" ${c===value ? 'selected' : ''}>${escapeHtml(c)}</option>`).join("")}</select>${help}</label>`;
    if (type === "textarea") return `<label class="wide"><span>${escapeHtml(name)}</span><textarea name="${escapeHtml(name)}" rows="4">${escapeHtml(value)}</textarea>${help}</label>`;
    return `<label><span>${escapeHtml(name)}</span><input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}">${help}</label>`;
  }).join("");
  fieldsBox.innerHTML = preview + fields;
}
function fieldHelpText(name, type) {
  const helps = {
    表示: "TRUEで表示、FALSEで非表示",
    クラス: "全体 / 2-1 / 2-2 など",
    日付: "できれば 2026-07-10 の形",
    締切: "できれば 2026-07-10 の形",
    画像URL: "https:// から始まる画像URLだけ表示",
    リンクURL: "https:// から始まるURLだけ表示",
    URL: "https:// から始まるURL",
    曜日: "時間割はクラス＋曜日で1行"
  };
  return helps[name] ? `<small class="field-help">${escapeHtml(helps[name])}</small>` : "";
}
async function submitEdit(event) {
  event.preventDefault();
  const status = $("formStatus");
  const row = selectedEditRow();
  if (!row) return;
  if (!GAS_URL) { if (status) status.textContent = "GAS_URLが未設定なので保存できません。"; return; }
  const formData = new FormData(event.currentTarget);
  const params = new URLSearchParams({ action: "update", type: selectedEditType, rowNumber: row.__rowNumber });
  for (const [key, value] of formData.entries()) params.set(key, value);
  if (status) status.textContent = "保存中...";
  try {
    const res = await jsonp(`${GAS_URL}?${params.toString()}&_=${Date.now()}`);
    if (!res?.ok) throw new Error(res?.error || "保存エラー");
    if (status) status.textContent = `保存しました。${res.push ? `通知: 成功${res.push.sent||0} 失敗${res.push.failed||0}` : ""}`;
    clearLocalDataCache();
    await loadData();
  } catch (error) {
    if (status) status.textContent = `保存できませんでした: ${error.message}`;
  }
}
function renderEditLog() {
  const box = $("editLogList"); if (!box) return;
  const rows = appData.editLog || [];
  box.innerHTML = rows.length ? rows.slice(0,12).map(r => `<article class="log-item"><strong>${escapeHtml(r.種類)} / ${escapeHtml(r.行)}行</strong><p>${escapeHtml(r.内容)}</p><small>${escapeHtml(r.日時)}</small></article>`).join("") : emptyState("編集履歴はまだありません。");
}
function copyPrep() {
  const summary = getTomorrowInfo(selectedClass);
  const lines = [`${selectedClass} 明日（${summary.day}）の準備`];
  if (summary.timetable) lines.push("時間割: " + PERIODS.map(p => summary.timetable[p]).filter(Boolean).join("・"));
  if (summary.timetable?.持ち物メモ) lines.push("持ち物: " + summary.timetable.持ち物メモ);
  if (summary.homework.length) lines.push("提出物: " + summary.homework.map(r => `${r.教科} ${r.タイトル}`).join(" / "));
  navigator.clipboard?.writeText(lines.join("\n"));
  toast("明日の準備をコピーしました");
}
function toast(message) {
  let box = $("toast");
  if (!box) { box = document.createElement("div"); box.id = "toast"; box.className = "toast"; document.body.appendChild(box); }
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove("show"), 2300);
}
async function renderTodayMessage() {
  const box = $("todayMessage"); if (!box) return;
  const t = nextTest(selectedClass);
  const h = nextHomework(selectedClass);
  if (AI_ENDPOINT) {
    try {
      const res = await fetch(AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedClass, nextTest: t, nextHomework: h, tomorrow: getTomorrowInfo(selectedClass) }) });
      const data = await res.json();
      if (data?.message) { box.textContent = data.message; return; }
    } catch (e) { console.warn(e); }
  }
  const messages = [
    "今日のうちに、明日の自分を少し楽にしよう。",
    "提出物チェックだけで、明日の朝がかなり変わる。",
    "焦らず一つずつ。準備できた人から強い。",
    "時間割を見て、忘れ物ゼロでいこう。"
  ];
  box.textContent = messages[new Date().getDate() % messages.length];
}
function renderAll() {
  renderCommon();
  renderHome();
  renderClassPage();
  renderListPage();
  renderEditor();
  renderTodayMessage();
}
function initEvents() {
  $("reloadBtn")?.addEventListener("click", loadData);
  $("copyPrepBtn")?.addEventListener("click", copyPrep);
  $("editSearch")?.addEventListener("input", () => { selectedRowNumber = ""; renderEditRowList(); renderEditForm(); });
  $("editForm")?.addEventListener("submit", submitEdit);
  $("resetEditorBtn")?.addEventListener("click", () => renderEditForm());
}
function initPwaInstall() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(console.warn);
}
window.grade2App = {
  reload: loadData,
  getSnapshot: () => ({
    selectedClass,
    data: appData,
    tomorrow: getTomorrowInfo(selectedClass),
    nextHomework: nextHomework(selectedClass),
    nextTest: nextTest(selectedClass)
  }),
  setSelectedClass,
  getSelectedClass: () => selectedClass
};

document.addEventListener("DOMContentLoaded", () => {
  applySiteIdentity();
  initEvents();
  initPwaInstall();
  loadData();
});
