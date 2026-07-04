// サイト設定は app-config.js にまとめています。
// 生徒・利用者はここを編集しません。公開前に管理者が app-config.js だけ設定します。
const APP_CONFIG = window.GRADE2_CONFIG || {};
const GAS_URL = String(APP_CONFIG.GAS_URL || "").trim();
const SHEET_URL = String(APP_CONFIG.SHEET_URL || "").trim();
const AI_ENDPOINT = String(APP_CONFIG.AI_ENDPOINT || "").trim();

const SAMPLE_DATA = {
  announcements: [
    { __rowNumber: "2", 表示: "TRUE", 日付: "2026-07-04", カテゴリ: "連絡", クラス: "全体", タイトル: "2年便利サイト公開", 本文: "時間割・提出物・テスト予定をここで確認できます。", 画像URL: "", リンクURL: "" },
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

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const PERIODS = ["1時間目", "2時間目", "3時間目", "4時間目", "5時間目", "6時間目"];

let appData = cloneData(SAMPLE_DATA);
let selectedClass = localStorage.getItem("grade2SelectedClass") || "2-3";

const $ = (id) => document.getElementById(id);

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => box.classList.remove("show"), 2200);
}

function isVisible(row) {
  const value = String(row.表示 ?? "TRUE").trim().toLowerCase();
  return !["false", "no", "非表示", "0", "×", "なし"].includes(value);
}

function matchesClass(row) {
  if (!selectedClass || selectedClass === "全体") return true;
  const target = String(row.クラス || "全体").trim();
  return target === "" || target === "全体" || target === selectedClass;
}

function safeUrl(url) {
  const text = String(url || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function makePill(text) {
  return el("span", "pill", text || "未設定");
}

function parseDate(text) {
  const value = String(text || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayDiff(dateText) {
  const target = parseDate(dateText);
  if (!target) return null;
  return Math.ceil((target - todayStart()) / 86400000);
}

function dateLabel(dateText) {
  const d = parseDate(dateText);
  if (!d) return dateText || "日付未定";
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

function sortByDate(rows, key) {
  return [...rows].sort((a, b) => {
    const da = parseDate(a[key]);
    const db = parseDate(b[key]);
    if (!da && !db) return String(a[key] || "").localeCompare(String(b[key] || ""));
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });
}

function visibleRows(type) {
  return (appData[type] || []).filter(isVisible).filter(matchesClass);
}

function getNextDate(rows, key) {
  return sortByDate(rows.filter(isVisible).filter(matchesClass), key).find(row => {
    const date = parseDate(row[key]);
    return date && date >= todayStart();
  });
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "callback_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const separator = url.includes("?") ? "&" : "?";

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }

    script.onerror = () => {
      cleanup();
      reject(new Error("読み込みに失敗しました"));
    };

    script.src = `${url}${separator}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function loadData() {
  renderConnectionBanner("loading");

  if (!GAS_URL) {
    appData = cloneData(SAMPLE_DATA);
    renderAll();
    renderConnectionBanner("sample");
    return;
  }

  try {
    const response = await jsonp(`${GAS_URL}?action=data&_=${Date.now()}`);
    if (!response.ok) throw new Error(response.error || "データ取得エラー");
    appData = response.data;
    renderAll();
    renderConnectionBanner("live");
  } catch (error) {
    console.warn(error);
    appData = cloneData(SAMPLE_DATA);
    renderAll();
    renderConnectionBanner("sample", `通信エラー：${error.message}`);
  }
}

function renderConnectionBanner(mode, detail = "") {
  const banner = $("connectionBanner");
  banner.className = "mode-banner";
  if (mode === "loading") {
    banner.textContent = "データを読み込んでいます...";
    return;
  }
  if (mode === "live") {
    banner.classList.add("live");
    banner.textContent = "ライブ接続中：スプレッドシートの内容を表示しています。";
    return;
  }
  banner.classList.add("sample");
  banner.textContent = detail || "サンプル表示中：script.js の GAS_URL に Apps Script のURLを入れると本番データになります。";
}

function renderAll() {
  renderDate();
  renderClassSelect();
  renderHeroStats();
  renderTomorrowPrep();
  renderAnnouncements();
  renderTimetable();
  renderTests();
  renderItems();
  renderHomework();
  renderLinks();
  renderEditLog();
  renderSheetLink();
  renderRowSelect();
  renderEditFields();
  window.dispatchEvent(new CustomEvent("grade2:data-updated", { detail: getAppSnapshot() }));
}

function renderDate() {
  const now = new Date();
  $("todayDate").textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAYS[now.getDay()]}）`;
}

function renderClassSelect() {
  const select = $("globalClassSelect");
  const current = selectedClass;
  clear(select);

  const classes = ["全体", ...new Set((appData.timetable || []).map(row => row.クラス).filter(Boolean))].sort((a, b) => {
    if (a === "全体") return -1;
    if (b === "全体") return 1;
    return a.localeCompare(b, "ja");
  });

  if (!classes.includes(selectedClass)) selectedClass = classes.includes("2-3") ? "2-3" : classes[0] || "全体";

  classes.forEach(className => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    if (className === current || className === selectedClass) option.selected = true;
    select.appendChild(option);
  });
}

function renderHeroStats() {
  const nextTest = getNextDate(appData.tests || [], "日付");
  const nextHomework = getNextDate(appData.homework || [], "締切");

  if (nextTest) {
    const diff = dayDiff(nextTest.日付);
    $("nextTestText").textContent = diff === 0 ? "今日" : `あと${diff}日`;
    $("nextTestSub").textContent = `${dateLabel(nextTest.日付)}｜${nextTest.教科 || "教科未定"}`;
  } else {
    $("nextTestText").textContent = "予定なし";
    $("nextTestSub").textContent = "表示できるテスト予定がありません";
  }

  if (nextHomework) {
    const diff = dayDiff(nextHomework.締切);
    $("nextHomeworkText").textContent = diff === 0 ? "今日" : `あと${diff}日`;
    $("nextHomeworkSub").textContent = `${dateLabel(nextHomework.締切)}｜${nextHomework.タイトル || "提出物"}`;
  } else {
    $("nextHomeworkText").textContent = "予定なし";
    $("nextHomeworkSub").textContent = "表示できる提出物がありません";
  }

  renderTodayMessage(nextTest, nextHomework);
}

async function renderTodayMessage(nextTest, nextHomework) {
  const context = buildSiteContext(nextTest, nextHomework);

  if (AI_ENDPOINT) {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context })
      });
      const data = await res.json();
      if (data.message) {
        $("todayMessage").textContent = String(data.message).slice(0, 80);
        $("aiNote").textContent = "AIから取得しました。";
        return;
      }
    } catch (error) {
      console.warn(error);
    }
  }

  const candidates = [];
  if (nextHomework) candidates.push(`「${nextHomework.タイトル}」は早めに終わらせると楽。`);
  if (nextTest) candidates.push(`${nextTest.教科 || "テスト"}は少しずつ積み上げよう。`);
  candidates.push(
    "30秒の確認で、明日の忘れ物は減らせる。",
    "今日の小さな準備が、明日の自分を助ける。",
    "焦らず、でも止まらず。今日も一つ進めよう。",
    "提出物と持ち物、寝る前に一回だけ確認。"
  );

  $("todayMessage").textContent = candidates[new Date().getDate() % candidates.length];
  $("aiNote").textContent = AI_ENDPOINT ? "AI接続に失敗したため、サイト内の文章で表示中。" : "本物のAI連携はAI_ENDPOINTにサーバーURLを入れると追加できます。";
}

function buildSiteContext(nextTest, nextHomework) {
  return {
    class: selectedClass,
    nextTest: nextTest || null,
    nextHomework: nextHomework || null,
    announcements: visibleRows("announcements").slice(0, 3),
    tomorrow: getTomorrowSummary()
  };
}

function getTomorrowSummary() {
  const tomorrow = new Date(todayStart());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = WEEKDAYS[tomorrow.getDay()];
  const date = dateKey(tomorrow);
  const row = (appData.timetable || []).find(item => item.クラス === selectedClass && item.曜日 === day);
  const homework = visibleRows("homework").filter(item => item.締切 === date);
  return { date, day, timetable: row || null, homework };
}

function renderTomorrowPrep() {
  const box = $("tomorrowPrep");
  clear(box);
  const summary = getTomorrowSummary();

  const timetableBox = el("article", "prep-box");
  timetableBox.appendChild(el("h3", "", `${summary.date}（${summary.day}）の時間割`));

  if (summary.timetable) {
    PERIODS.forEach(period => {
      const row = el("div", "lesson-row");
      row.appendChild(el("b", "", period));
      row.appendChild(el("span", "", summary.timetable[period] || "-"));
      timetableBox.appendChild(row);
    });
    if (summary.timetable.持ち物メモ) {
      const note = el("p", "", `持ち物メモ：${summary.timetable.持ち物メモ}`);
      note.style.marginTop = "14px";
      note.style.color = "var(--yellow)";
      timetableBox.appendChild(note);
    }
  } else {
    timetableBox.appendChild(el("p", "empty", `${selectedClass} の${summary.day}曜日の時間割がありません。`));
  }

  const sideBox = el("article", "prep-box");
  sideBox.appendChild(el("h3", "", "チェックリスト"));
  const mini = el("div", "mini-list");

  const itemNotes = visibleRows("items").filter(item => {
    const text = `${item.日付 || ""} ${item.タイトル || ""} ${item.メモ || ""}`;
    return text.includes(summary.day) || text.includes("毎日") || text.includes("全体");
  });

  if (summary.homework.length) {
    summary.homework.forEach(hw => mini.appendChild(el("p", "", `提出：${hw.教科 || ""} ${hw.タイトル || ""}（${hw.内容 || ""}）`)));
  } else {
    mini.appendChild(el("p", "", "明日締切の提出物は今のところありません。"));
  }

  if (itemNotes.length) {
    itemNotes.slice(0, 4).forEach(item => mini.appendChild(el("p", "", `持ち物：${item.持ち物 || item.タイトル || "確認"}`)));
  } else {
    mini.appendChild(el("p", "", "特別な持ち物メモはありません。"));
  }

  sideBox.appendChild(mini);
  box.appendChild(timetableBox);
  box.appendChild(sideBox);
}

function renderAnnouncements() {
  const box = $("announcementList");
  clear(box);
  const rows = sortByDate(visibleRows("announcements"), "日付").reverse();
  if (!rows.length) return box.appendChild(el("p", "empty", "お知らせはまだありません。"));

  rows.forEach(row => {
    const card = el("article", "cool-card");
    const imageUrl = safeUrl(row.画像URL);
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = row.タイトル || "お知らせ画像";
      img.loading = "lazy";
      card.appendChild(img);
    }

    const body = el("div", "cool-card-body");
    const meta = el("div", "meta");
    meta.appendChild(makePill(row.カテゴリ || "お知らせ"));
    meta.appendChild(makePill(row.クラス || "全体"));
    meta.appendChild(el("span", "", dateLabel(row.日付)));
    body.appendChild(meta);
    body.appendChild(el("h3", "", row.タイトル || "無題"));
    body.appendChild(el("p", "", row.本文 || ""));

    const link = safeUrl(row.リンクURL);
    if (link) {
      const a = el("a", "safe-link", "詳しく見る →");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      body.appendChild(a);
    }

    card.appendChild(body);
    box.appendChild(card);
  });
}

function renderTimetable() {
  const table = $("timetableTable");
  clear(table);

  const rows = (appData.timetable || []).filter(row => selectedClass === "全体" ? true : row.クラス === selectedClass);
  const header = document.createElement("tr");
  ["クラス", "曜日", ...PERIODS, "持ち物メモ"].forEach(text => header.appendChild(el("th", "", text)));
  table.appendChild(header);

  const order = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 7 };
  rows.sort((a, b) => String(a.クラス || "").localeCompare(String(b.クラス || ""), "ja") || (order[a.曜日] || 99) - (order[b.曜日] || 99)).forEach(row => {
    const tr = document.createElement("tr");
    ["クラス", "曜日", ...PERIODS, "持ち物メモ"].forEach(key => tr.appendChild(el(key === "クラス" || key === "曜日" ? "th" : "td", "", row[key] || "-")));
    table.appendChild(tr);
  });

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = el("td", "", "時間割がありません。");
    td.colSpan = 9;
    tr.appendChild(td);
    table.appendChild(tr);
  }
}

function listRow({ title, badge, lines, urgent }) {
  const item = el("article", urgent ? "list-row urgent" : "list-row");
  const top = el("div", "row-top");
  top.appendChild(el("h3", "", title));
  top.appendChild(el("span", "due", badge));
  item.appendChild(top);
  lines.filter(Boolean).forEach(line => item.appendChild(el("p", "", line)));
  return item;
}

function renderTests() {
  const box = $("testList");
  clear(box);
  const rows = sortByDate(visibleRows("tests"), "日付");
  if (!rows.length) return box.appendChild(el("p", "empty", "テスト予定はまだありません。"));

  rows.forEach(row => {
    const diff = dayDiff(row.日付);
    box.appendChild(listRow({
      title: row.タイトル || "テスト",
      badge: dateLabel(row.日付),
      urgent: diff !== null && diff >= 0 && diff <= 3,
      lines: [
        `${row.教科 || "教科未定"}｜${row.範囲 || "範囲未定"}`,
        row.持ち物 ? `持ち物：${row.持ち物}` : "",
        row.メモ ? `メモ：${row.メモ}` : ""
      ]
    }));
  });
}

function renderItems() {
  const box = $("itemList");
  clear(box);
  const rows = visibleRows("items");
  if (!rows.length) return box.appendChild(el("p", "empty", "持ち物はまだありません。"));

  rows.forEach(row => {
    box.appendChild(listRow({
      title: row.タイトル || "持ち物",
      badge: row.日付 || row.クラス || "全体",
      lines: [row.持ち物 || "", row.メモ ? `メモ：${row.メモ}` : ""]
    }));
  });
}

function renderHomework() {
  const box = $("homeworkList");
  clear(box);
  const rows = sortByDate(visibleRows("homework"), "締切");
  if (!rows.length) return box.appendChild(el("p", "empty", "提出物はまだありません。"));

  rows.forEach(row => {
    const diff = dayDiff(row.締切);
    box.appendChild(listRow({
      title: row.タイトル || "提出物",
      badge: row.締切 ? `締切：${dateLabel(row.締切)}` : "締切未定",
      urgent: diff !== null && diff >= 0 && diff <= 2,
      lines: [
        `${row.教科 || "教科未定"}｜${row.内容 || "内容未定"}`,
        row.メモ ? `メモ：${row.メモ}` : ""
      ]
    }));
  });
}

function renderLinks() {
  const box = $("linkList");
  clear(box);
  const rows = (appData.links || []).filter(isVisible);
  if (!rows.length) return box.appendChild(el("p", "empty", "リンクはまだありません。"));

  rows.forEach(row => {
    const card = el("article", "cool-card");
    const body = el("div", "cool-card-body");
    const meta = el("div", "meta");
    meta.appendChild(makePill(row.カテゴリ || "リンク"));
    body.appendChild(meta);
    body.appendChild(el("h3", "", row.タイトル || "リンク"));
    body.appendChild(el("p", "", row.説明 || ""));
    const link = safeUrl(row.URL);
    if (link) {
      const a = el("a", "safe-link", "開く →");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      body.appendChild(a);
    }
    card.appendChild(body);
    box.appendChild(card);
  });
}

function renderEditLog() {
  const box = $("editLogList");
  clear(box);
  const logs = (appData.editLog || []).slice(0, 12);
  if (!logs.length) return box.appendChild(el("p", "empty", "編集履歴はまだありません。"));

  logs.forEach(log => {
    const item = el("div", "log-item");
    item.appendChild(el("b", "", `${log.種類 || "編集"} / ${log.行 || "?"}行目`));
    item.appendChild(el("p", "", `${log.日時 || "日時不明"}｜${log.内容 || "変更"}`));
    box.appendChild(item);
  });
}

function renderSheetLink() {
  const link = $("sheetLink");
  if (SHEET_URL) {
    link.href = SHEET_URL;
    link.style.display = "inline-block";
  } else {
    link.href = "#";
    link.style.display = "none";
  }
}

function rowLabel(type, row) {
  if (type === "timetable") return `${row.クラス || "クラス未定"}｜${row.曜日 || "曜日未定"}｜${row["1時間目"] || "1時間目未定"}`;
  if (type === "tests") return `${dateLabel(row.日付)}｜${row.教科 || "教科未定"}｜${row.タイトル || "テスト"}`;
  if (type === "homework") return `${dateLabel(row.締切)}｜${row.教科 || "教科未定"}｜${row.タイトル || "提出物"}`;
  if (type === "items") return `${row.日付 || "日付未定"}｜${row.タイトル || "持ち物"}`;
  if (type === "links") return `${row.カテゴリ || "リンク"}｜${row.タイトル || "無題"}`;
  return `${dateLabel(row.日付)}｜${row.タイトル || "無題"}`;
}

function getEditType() {
  return $("editType").value;
}

function getRowsForEdit() {
  const query = String($("editSearch").value || "").trim().toLowerCase();
  const rows = appData[getEditType()] || [];
  if (!query) return rows;
  return rows.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(query)));
}

function getSelectedRow() {
  const type = getEditType();
  const allRows = appData[type] || [];
  const rowNumber = $("rowSelect").value;
  return allRows.find(row => String(row.__rowNumber) === String(rowNumber)) || getRowsForEdit()[0] || null;
}

function renderRowSelect() {
  const type = getEditType();
  const select = $("rowSelect");
  const current = select.value;
  clear(select);

  const rows = getRowsForEdit();
  rows.forEach((row, index) => {
    const option = document.createElement("option");
    option.value = row.__rowNumber || String(index + 2);
    option.textContent = rowLabel(type, row);
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function makeField(name, inputType, choices, value) {
  const label = el("label", "", name);
  let input;

  if (inputType === "textarea") {
    input = document.createElement("textarea");
  } else if (inputType === "select") {
    input = document.createElement("select");
    choices.forEach(choice => {
      const option = document.createElement("option");
      option.value = choice;
      option.textContent = choice;
      input.appendChild(option);
    });
  } else {
    input = document.createElement("input");
    input.type = inputType;
  }

  input.name = name;
  input.value = value || "";
  input.placeholder = `${name}を入力`;
  label.appendChild(input);
  return label;
}

function renderEditFields() {
  const type = getEditType();
  const wrap = $("editFields");
  const status = $("formStatus");
  clear(wrap);
  status.textContent = "";

  const row = getSelectedRow();
  if (!row) {
    wrap.appendChild(el("p", "empty", "編集できる行がありません。検索を変えるか、スプレッドシートに行を作ってください。"));
    return;
  }

  wrap.appendChild(el("p", "editor-info", `編集対象：${TYPE_LABELS[type]} / スプレッドシート${row.__rowNumber || "?"}行目`));

  EDIT_FIELDS[type].forEach(([name, inputType, choices]) => {
    wrap.appendChild(makeField(name, inputType, choices || [], row[name] || ""));
  });
}

async function submitEdit(event) {
  event.preventDefault();
  const status = $("formStatus");
  const row = getSelectedRow();

  if (!GAS_URL) {
    status.textContent = "先に script.js の GAS_URL に Apps Script のURLを入れてください。今はサンプル表示だけです。";
    return;
  }

  if (!row) {
    status.textContent = "編集する行がありません。";
    return;
  }

  const params = new URLSearchParams(new FormData(event.currentTarget));
  params.set("action", "update");
  params.set("type", getEditType());
  params.set("rowNumber", row.__rowNumber || "");

  status.textContent = "保存中...";

  try {
    const response = await jsonp(`${GAS_URL}?${params.toString()}&_=${Date.now()}`);
    if (!response.ok) throw new Error(response.error || "保存できませんでした");
    status.textContent = "保存しました。表示を更新しました。";
    toast("保存しました");
    await loadData();
  } catch (error) {
    status.textContent = `エラー：${error.message}`;
    toast("保存に失敗しました");
  }
}

function resetEditor() {
  renderEditFields();
  toast("編集欄を元に戻しました");
}

function copyTomorrowPrep() {
  const summary = getTomorrowSummary();
  const lines = [];
  lines.push(`【${selectedClass} 明日の準備】`);
  lines.push(`${summary.date}（${summary.day}）`);
  if (summary.timetable) {
    PERIODS.forEach(period => lines.push(`${period}: ${summary.timetable[period] || "-"}`));
    if (summary.timetable.持ち物メモ) lines.push(`持ち物メモ: ${summary.timetable.持ち物メモ}`);
  } else {
    lines.push("時間割: 未登録");
  }
  if (summary.homework.length) {
    lines.push("提出物:");
    summary.homework.forEach(hw => lines.push(`- ${hw.教科 || ""} ${hw.タイトル || ""} ${hw.内容 || ""}`));
  }

  navigator.clipboard.writeText(lines.join("\n"))
    .then(() => toast("明日の準備をコピーしました"))
    .catch(() => toast("コピーできませんでした"));
}


function getAppSnapshot() {
  const nextTest = getNextDate(appData.tests || [], "日付");
  const nextHomework = getNextDate(appData.homework || [], "締切");
  return {
    selectedClass,
    tomorrow: getTomorrowSummary(),
    nextTest: nextTest || null,
    nextHomework: nextHomework || null,
    data: appData
  };
}

window.grade2App = {
  getSnapshot: getAppSnapshot,
  getTomorrowSummary,
  getSelectedClass: () => selectedClass,
  reload: loadData,
  copyTomorrowPrep
};

$("globalClassSelect").addEventListener("change", (event) => {
  selectedClass = event.target.value;
  localStorage.setItem("grade2SelectedClass", selectedClass);
  renderAll();
  window.dispatchEvent(new CustomEvent("grade2:class-changed", { detail: { selectedClass } }));
});

$("editType").addEventListener("change", () => {
  $("editSearch").value = "";
  renderRowSelect();
  renderEditFields();
});

$("editSearch").addEventListener("input", () => {
  renderRowSelect();
  renderEditFields();
});

$("rowSelect").addEventListener("change", renderEditFields);
$("editForm").addEventListener("submit", submitEdit);
$("resetEditorBtn").addEventListener("click", resetEditor);
$("reloadBtn").addEventListener("click", loadData);
$("copyPrepBtn").addEventListener("click", copyTomorrowPrep);

loadData();
