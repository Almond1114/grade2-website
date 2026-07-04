// Google Apps Script 用コード
// 1. Googleスプレッドシートを作る
// 2. 拡張機能 → Apps Script を開く
// 3. このコードを貼る
// 4. SPREADSHEET_ID にスプレッドシートIDを入れる
// 5. setupSheets を1回実行する
// 6. デプロイ → 新しいデプロイ → ウェブアプリ
//    実行ユーザー: 自分
//    アクセスできるユーザー: 全員
// 7. 出てきたウェブアプリURLを app-config.js の GAS_URL に貼る

const SPREADSHEET_ID = "ここにスプレッドシートIDを入れる";

const SHEETS = {
  announcements: {
    name: "お知らせ",
    headers: ["表示", "日付", "カテゴリ", "クラス", "タイトル", "本文", "画像URL", "リンクURL", "作成日時", "更新日時"],
    sample: [
      ["TRUE", "2026-07-04", "連絡", "全体", "2Base公開", "時間割・提出物・テスト予定をここで確認できます。", "", "", nowText(), ""],
      ["TRUE", "2026-07-08", "行事", "全体", "学年集会", "朝の会後に体育館へ移動します。", "", "", nowText(), ""]
    ],
    note: "画像を出したいときは、画像URLに https:// から始まる画像リンクを入れます。"
  },
  timetable: {
    name: "時間割",
    headers: ["クラス", "曜日", "1時間目", "2時間目", "3時間目", "4時間目", "5時間目", "6時間目", "持ち物メモ", "更新日時"],
    sample: [
      ["2-1", "月", "国語", "数学", "英語", "理科", "体育", "総合", "体育着", ""],
      ["2-1", "火", "社会", "英語", "数学", "美術", "国語", "道徳", "美術セット", ""],
      ["2-2", "月", "数学", "英語", "国語", "体育", "社会", "総合", "体育着", ""],
      ["2-3", "月", "英語", "数学", "理科", "国語", "体育", "総合", "体育着・水筒", ""],
      ["2-3", "火", "国語", "社会", "数学", "美術", "英語", "道徳", "美術セット", ""],
      ["2-3", "水", "数学", "体育", "理科", "技術", "社会", "学活", "技術ファイル", ""],
      ["2-3", "木", "理科", "英語", "音楽", "数学", "国語", "総合", "音楽ファイル", ""],
      ["2-3", "金", "社会", "国語", "体育", "英語", "数学", "学活", "体育着", ""]
    ],
    note: "クラスと曜日で1行です。例：2-3 / 月。"
  },
  tests: {
    name: "テスト予定",
    headers: ["表示", "日付", "クラス", "教科", "タイトル", "範囲", "持ち物", "メモ", "作成日時", "更新日時"],
    sample: [
      ["TRUE", "2026-07-10", "全体", "数学", "数学 小テスト", "一次関数・連立方程式", "定規", "ワークも確認", nowText(), ""],
      ["TRUE", "2026-09-18", "全体", "5教科", "期末テスト", "後日発表", "筆記用具", "早めに準備", nowText(), ""]
    ],
    note: "表示をFALSEにするとサイトに表示されません。"
  },
  items: {
    name: "持ち物",
    headers: ["表示", "日付", "クラス", "タイトル", "持ち物", "メモ", "作成日時", "更新日時"],
    sample: [
      ["TRUE", "毎週月・金", "全体", "体育がある日", "ジャージ・体育館シューズ・水筒", "忘れやすいので前日に確認", nowText(), ""],
      ["TRUE", "美術の日", "全体", "美術セット", "絵の具セット・スケッチブック", "必要な週だけ", nowText(), ""]
    ],
    note: "日付は「毎週月・金」「7/10」など自由に書けます。"
  },
  homework: {
    name: "提出物",
    headers: ["表示", "締切", "クラス", "教科", "タイトル", "内容", "メモ", "作成日時", "更新日時"],
    sample: [
      ["TRUE", "2026-07-09", "全体", "数学", "数学ワーク", "P.32〜P.35", "丸付けまで", nowText(), ""],
      ["TRUE", "2026-07-11", "全体", "国語", "漢字プリント", "1枚提出", "名前を書く", nowText(), ""]
    ],
    note: "締切は yyyy-mm-dd 形式がおすすめです。例：2026-07-09。"
  },
  links: {
    name: "学習リンク",
    headers: ["表示", "カテゴリ", "タイトル", "URL", "説明", "作成日時", "更新日時"],
    sample: [
      ["TRUE", "学習", "NHK for School", "https://www.nhk.or.jp/school/", "授業の復習に使える動画サイト", nowText(), ""]
    ],
    note: "URLは https:// から始まるものだけサイトに表示されます。"
  }
};

const LOG_SHEET_NAME = "編集ログ";
const HELP_SHEET_NAME = "使い方";
const PUSH_TOKENS_SHEET_NAME = "Push登録端末";
const PUSH_ON_EDIT = true;
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";


function doGet(e) {
  const action = String(e.parameter.action || "data");
  const callback = String(e.parameter.callback || "");

  try {
    let result;

    if (action === "data") {
      result = { ok: true, data: getAllData() };
    } else if (action === "update") {
      result = updateEntry(e.parameter);
    } else if (action === "setup") {
      result = setupSheets();
    } else if (action === "registerPushToken") {
      result = registerPushToken(e.parameter);
    } else if (action === "unregisterPushToken") {
      result = unregisterPushToken(e.parameter);
    } else if (action === "sendPushTest") {
      result = sendPushTest(e.parameter);
    } else if (action === "pushStatus") {
      result = getPushStatus();
    } else if (action === "dailyPushNow") {
      result = sendDailyPreparationPush();
    } else if (action === "setupDailyPushTrigger") {
      result = setupDailyPushTrigger();
    } else {
      result = { ok: false, error: "不明なactionです" };
    }

    return output(result, callback);
  } catch (error) {
    return output({ ok: false, error: error.message }, callback);
  }
}

function output(obj, callback) {
  const json = JSON.stringify(obj);
  const text = callback ? `${callback}(${json});` : json;
  const mime = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(text).setMimeType(mime);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function nowText() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function setupSheets() {
  const ss = getSpreadsheet();

  Object.keys(SHEETS).forEach(key => {
    const info = SHEETS[key];
    let sheet = ss.getSheetByName(info.name);
    if (!sheet) sheet = ss.insertSheet(info.name);

    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.clear();
    sheet.getRange(1, 1, 1, info.headers.length).setValues([info.headers]);
    sheet.getRange(1, 1, 1, info.headers.length)
      .setFontWeight("bold")
      .setBackground("#0f172a")
      .setFontColor("#ffffff")
      .setHorizontalAlignment("center");

    if (info.sample.length) {
      sheet.getRange(2, 1, info.sample.length, info.headers.length).setValues(info.sample);
    }

    sheet.setFrozenRows(1);
    sheet.setRowHeights(1, Math.max(sheet.getLastRow(), 1), 32);
    sheet.autoResizeColumns(1, info.headers.length);
    sheet.getDataRange().setVerticalAlignment("middle");
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), info.headers.length).createFilter();

    const noteRange = sheet.getRange(1, 1);
    noteRange.setNote(info.note || "このシートの内容がサイトに表示されます。");

    applyValidations(sheet, info.headers);
  });

  setupLogSheet(ss);
  setupHelpSheet(ss);
  setupPushTokenSheet(ss);

  return { ok: true, message: "シート作成が完了しました" };
}

function setupLogSheet(ss) {
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, 6).setValues([["日時", "種類", "行", "内容", "変更前", "変更後"]]);
  sheet.getRange(1, 1, 1, 6)
    .setFontWeight("bold")
    .setBackground("#111827")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 6);
}

function setupHelpSheet(ss) {
  let sheet = ss.getSheetByName(HELP_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(HELP_SHEET_NAME);
  sheet.clear();
  const rows = [
    ["項目", "説明"],
    ["表示", "TRUEなら表示、FALSEなら非表示です。"],
    ["クラス", "全体 / 2-1 / 2-2 / 2-3 など。全体はどのクラスにも表示されます。"],
    ["日付・締切", "できれば 2026-07-09 の形で書くと、並び替えやカウントダウンが正しく動きます。"],
    ["画像URL", "https:// から始まる画像URLだけ使えます。"],
    ["編集履歴", "サイトから保存すると編集ログに残ります。荒らされたときの確認用です。"],
    ["復元", "Googleスプレッドシートの ファイル → 変更履歴 → 変更履歴を表示 から戻せます。"]
  ];
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function setupPushTokenSheet(ss) {
  let sheet = ss.getSheetByName(PUSH_TOKENS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(PUSH_TOKENS_SHEET_NAME);

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.clear();
  }

  const headers = ["有効", "端末ID", "クラス", "OS", "Pushトークン", "登録日時", "更新日時", "最終送信", "状態", "ユーザーエージェント"];

  if (sheet.getLastRow() < 1 || sheet.getRange(1, 1).getDisplayValue() !== "有効") {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#1e3a8a")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  sheet.getRange(1, 1).setNote("Push通知を許可した端末が自動登録されます。無効化したい端末は、有効をFALSEにしてください。");
}

function applyValidations(sheet, headers) {
  const maxRows = sheet.getMaxRows();

  headers.forEach((header, index) => {
    const col = index + 1;
    const range = sheet.getRange(2, col, maxRows - 1, 1);

    if (header === "表示") {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["TRUE", "FALSE"], true)
        .setAllowInvalid(false)
        .build();
      range.setDataValidation(rule);
    }

    if (header === "曜日") {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["月", "火", "水", "木", "金", "土", "日"], true)
        .setAllowInvalid(false)
        .build();
      range.setDataValidation(rule);
    }
  });
}

function getAllData() {
  const data = {};
  Object.keys(SHEETS).forEach(key => {
    data[key] = readSheet(SHEETS[key].name);
  });
  data.editLog = readEditLog();
  return data;
}

function readSheet(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values.slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(item => item.row.some(cell => String(cell).trim() !== ""))
    .map(item => {
      const obj = { __rowNumber: String(item.rowNumber) };
      headers.forEach((header, index) => {
        obj[header] = item.row[index] || "";
      });
      return obj;
    });
}

function readEditLog() {
  const sheet = getSpreadsheet().getSheetByName(LOG_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues();
  return values.reverse().slice(0, 20).map(row => ({
    日時: row[0],
    種類: row[1],
    行: row[2],
    内容: row[3],
    変更前: row[4],
    変更後: row[5]
  }));
}

function updateEntry(params) {
  const type = String(params.type || "");
  const rowNumber = Number(params.rowNumber || 0);
  const info = SHEETS[type];

  if (!info) return { ok: false, error: "編集タイプが正しくありません" };
  if (!Number.isInteger(rowNumber) || rowNumber < 2) return { ok: false, error: "編集する行が正しくありません" };

  const sheet = getSpreadsheet().getSheetByName(info.name);
  if (!sheet) throw new Error(`シート「${info.name}」がありません。setupSheetsを実行してください。`);
  if (rowNumber > sheet.getLastRow()) return { ok: false, error: "指定された行が見つかりません" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(String);
  const oldValues = sheet.getRange(rowNumber, 1, 1, headers.length).getDisplayValues()[0];
  const newValues = oldValues.slice();
  const changed = [];
  const now = nowText();

  headers.forEach((header, index) => {
    if (header === "作成日時") return;

    if (header === "更新日時") {
      newValues[index] = now;
      return;
    }

    if (Object.prototype.hasOwnProperty.call(params, header)) {
      const cleaned = cleanValue(header, params[header]);
      if (String(oldValues[index]) !== String(cleaned)) {
        changed.push(`${header}: ${oldValues[index]} → ${cleaned}`);
      }
      newValues[index] = cleaned;
    }
  });

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([newValues]);
  const detail = changed.length ? changed.join(" / ") : "保存ボタンが押されました";
  appendLog(info.name, rowNumber, detail, oldValues.join(" | "), newValues.join(" | "));

  let pushResult = null;
  if (PUSH_ON_EDIT) {
    pushResult = notifyPushOnEdit(type, info.name, rowNumber, detail, headers, newValues);
  }

  return { ok: true, message: "保存しました", push: pushResult };
}

function appendLog(typeName, rowNumber, detail, beforeText, afterText) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) setupLogSheet(ss);
  sheet = ss.getSheetByName(LOG_SHEET_NAME);
  sheet.appendRow([
    nowText(),
    typeName,
    rowNumber,
    String(detail).slice(0, 800),
    String(beforeText).slice(0, 1200),
    String(afterText).slice(0, 1200)
  ]);
}

function cleanValue(header, value) {
  let text = String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 1200);

  if (["画像URL", "リンクURL", "URL"].includes(header)) {
    if (!text) return "";
    if (!/^https:\/\//i.test(text)) return "";
    return text.slice(0, 600);
  }

  if (header === "表示") {
    return String(text).toUpperCase() === "FALSE" ? "FALSE" : "TRUE";
  }

  return text;
}


// ------------------------------------------------------------
// Firebase Cloud Messaging / Push通知
// ------------------------------------------------------------
// FirebaseのサービスアカウントJSONをコードに直接貼らず、Apps Scriptの「スクリプト プロパティ」に保存します。
// 必要なプロパティ:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// FIREBASE_PRIVATE_KEY は \n を含む1行でも、実際の改行を含む形でもOKです。

function setFirebaseConfigSample() {
  // これは見本です。実行する前に必ず自分のFirebase情報に書き換えてください。
  PropertiesService.getScriptProperties().setProperties({
    FIREBASE_PROJECT_ID: "your-firebase-project-id",
    FIREBASE_CLIENT_EMAIL: "firebase-adminsdk-xxxxx@your-firebase-project-id.iam.gserviceaccount.com",
    FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nここに秘密鍵\\n-----END PRIVATE KEY-----\\n"
  }, true);
}

function registerPushToken(params) {
  const token = String(params.token || "").trim();
  if (!token) return { ok: false, error: "Pushトークンが空です" };

  const ss = getSpreadsheet();
  setupPushTokenSheet(ss);
  const sheet = ss.getSheetByName(PUSH_TOKENS_SHEET_NAME);
  const now = nowText();
  const deviceId = cleanPushText(params.deviceId || "unknown", 120);
  const className = cleanPushText(params.className || "未選択", 80);
  const platform = cleanPushText(params.platform || "unknown", 40);
  const userAgent = cleanPushText(params.userAgent || "", 300);

  const values = sheet.getDataRange().getDisplayValues();
  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    const rowDeviceId = String(values[i][1] || "");
    const rowToken = String(values[i][4] || "");
    if (rowToken === token || rowDeviceId === deviceId) {
      targetRow = i + 1;
      break;
    }
  }

  const row = ["TRUE", deviceId, className, platform, token, now, now, "", "登録済み", userAgent];
  if (targetRow > 0) {
    const createdAt = sheet.getRange(targetRow, 6).getDisplayValue() || now;
    row[5] = createdAt;
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { ok: true, message: "Pushトークンを登録しました", count: countActivePushTokens() };
}

function unregisterPushToken(params) {
  const token = String(params.token || "").trim();
  const deviceId = String(params.deviceId || "").trim();
  const sheet = getSpreadsheet().getSheetByName(PUSH_TOKENS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return { ok: true, message: "登録端末はありません" };

  const values = sheet.getDataRange().getDisplayValues();
  let changed = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if ((token && row[4] === token) || (deviceId && row[1] === deviceId)) {
      sheet.getRange(i + 1, 1).setValue("FALSE");
      sheet.getRange(i + 1, 9).setValue("解除済み");
      sheet.getRange(i + 1, 7).setValue(nowText());
      changed++;
    }
  }

  return { ok: true, message: "Push登録を解除しました", changed, count: countActivePushTokens() };
}

function getPushStatus() {
  return {
    ok: true,
    configured: isFcmConfigured_(),
    count: countActivePushTokens()
  };
}

function sendPushTest(params) {
  const title = cleanPushText(params.title || "2Base", 80);
  const body = cleanPushText(params.body || "Firebase Push通知のテストです。", 180);
  const className = cleanPushText(params.className || "", 80);
  return sendPushToAll_({
    title,
    body,
    data: {
      type: "test",
      screen: "prep",
      className
    }
  });
}


// 毎日の確認通知をApps Script側から送るための関数です。
// 管理者がApps Script画面で setupDailyPushTrigger を1回実行すると、毎日20時ごろに通知します。
const DEFAULT_DAILY_PUSH_HOUR = 20;

function setupDailyPushTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === "sendDailyPreparationPush") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("sendDailyPreparationPush")
    .timeBased()
    .everyDays(1)
    .atHour(DEFAULT_DAILY_PUSH_HOUR)
    .create();

  return { ok: true, message: `毎日${DEFAULT_DAILY_PUSH_HOUR}時ごろのPush通知トリガーを作成しました` };
}

function sendDailyPreparationPush() {
  return sendPushToAll_({
    title: "2Base",
    body: "明日の時間割・提出物・テストを確認しよう。",
    data: {
      type: "daily",
      screen: "prep"
    }
  });
}

function notifyPushOnEdit(typeKey, typeName, rowNumber, detail, headers, newValues) {
  try {
    if (!isFcmConfigured_()) {
      appendLog("Push通知", rowNumber, "Firebase未設定のため送信しませんでした", "", "");
      return { ok: false, skipped: true, error: "Firebase未設定" };
    }

    const titleIndex = headers.indexOf("タイトル");
    const subjectIndex = headers.indexOf("教科");
    const classIndex = headers.indexOf("クラス");
    const rowTitle = titleIndex >= 0 ? newValues[titleIndex] : "";
    const subject = subjectIndex >= 0 ? newValues[subjectIndex] : "";
    const className = classIndex >= 0 ? newValues[classIndex] : "";
    const summary = cleanPushText(rowTitle || subject || detail || "内容が更新されました", 120);

    const result = sendPushToAll_({
      title: "2Baseが更新されました",
      body: `${typeName}: ${summary}`,
      data: {
        type: "edit",
        editType: typeKey,
        sheetName: typeName,
        rowNumber: String(rowNumber),
        className: cleanPushText(className, 80),
        screen: "home"
      }
    });

    appendLog("Push通知", rowNumber, `成功 ${result.sent || 0} / 失敗 ${result.failed || 0}`, "", JSON.stringify(result));
    return result;
  } catch (error) {
    appendLog("Push通知", rowNumber, `送信失敗: ${error.message}`, "", "");
    return { ok: false, error: error.message };
  }
}

function countActivePushTokens() {
  return readActivePushTokens_().length;
}

function readActivePushTokens_() {
  const sheet = getSpreadsheet().getSheetByName(PUSH_TOKENS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const tokens = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const enabled = String(row[0] || "TRUE").toUpperCase() !== "FALSE";
    const token = String(row[4] || "").trim();
    if (enabled && token) {
      tokens.push({ rowNumber: i + 1, token, platform: row[3] || "", className: row[2] || "" });
    }
  }
  return tokens;
}

function sendPushToAll_(message) {
  const tokens = readActivePushTokens_();
  if (!tokens.length) return { ok: true, sent: 0, failed: 0, message: "登録端末がありません" };
  if (!isFcmConfigured_()) return { ok: false, sent: 0, failed: 0, error: "Firebase設定が未完了です" };

  let sent = 0;
  let failed = 0;
  const errors = [];

  tokens.forEach(item => {
    const result = sendFcmMessage_(item.token, message.title, message.body, message.data || {});
    updatePushSendStatus_(item.rowNumber, result.ok ? "送信成功" : `送信失敗: ${result.error}`);
    if (result.ok) {
      sent++;
    } else {
      failed++;
      errors.push(result.error);
      if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(String(result.error))) {
        disablePushToken_(item.rowNumber, result.error);
      }
    }
  });

  return { ok: true, sent, failed, count: tokens.length, errors: errors.slice(0, 5) };
}

function sendFcmMessage_(token, title, body, data) {
  const cfg = getFcmConfig_();
  const accessToken = getFcmAccessToken_();
  const url = `https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`;

  const payload = {
    message: {
      token,
      notification: {
        title: cleanPushText(title, 80),
        body: cleanPushText(body, 180)
      },
      data: stringifyData_(data),
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "grade2_updates",
          sound: "default",
          click_action: "OPEN_GRADE2_APP"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      }
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${accessToken}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 200 && code < 300) return { ok: true, response: text };
  return { ok: false, error: `${code} ${text}`.slice(0, 500) };
}

function getFcmAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("FCM_ACCESS_TOKEN");
  if (cached) return cached;

  const cfg = getFcmConfig_();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url_(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url_(JSON.stringify({
    iss: cfg.clientEmail,
    scope: FCM_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signature = Utilities.computeRsaSha256Signature(unsignedJwt, cfg.privateKey);
  const jwt = `${unsignedJwt}.${base64Url_(signature)}`;

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error(`OAuthトークン取得失敗: ${code} ${text}`);
  const json = JSON.parse(text);
  if (!json.access_token) throw new Error("OAuthレスポンスにaccess_tokenがありません");
  cache.put("FCM_ACCESS_TOKEN", json.access_token, 3300);
  return json.access_token;
}

function getFcmConfig_() {
  const props = PropertiesService.getScriptProperties();
  const projectId = String(props.getProperty("FIREBASE_PROJECT_ID") || "").trim();
  const clientEmail = String(props.getProperty("FIREBASE_CLIENT_EMAIL") || "").trim();
  const privateKey = String(props.getProperty("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey || privateKey.indexOf("BEGIN PRIVATE KEY") === -1) {
    throw new Error("Firebase設定が未完了です。スクリプトプロパティに FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY を入れてください。");
  }
  return { projectId, clientEmail, privateKey };
}

function isFcmConfigured_() {
  try {
    getFcmConfig_();
    return true;
  } catch (_) {
    return false;
  }
}

function base64Url_(input) {
  const bytes = typeof input === "string" ? Utilities.newBlob(input).getBytes() : input;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function stringifyData_(data) {
  const result = {};
  Object.keys(data || {}).forEach(key => {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 40);
    if (safeKey) result[safeKey] = String(data[key] ?? "").slice(0, 200);
  });
  return result;
}

function cleanPushText(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength || 200);
}

function updatePushSendStatus_(rowNumber, status) {
  const sheet = getSpreadsheet().getSheetByName(PUSH_TOKENS_SHEET_NAME);
  if (!sheet) return;
  sheet.getRange(rowNumber, 8).setValue(nowText());
  sheet.getRange(rowNumber, 9).setValue(String(status).slice(0, 500));
}

function disablePushToken_(rowNumber, reason) {
  const sheet = getSpreadsheet().getSheetByName(PUSH_TOKENS_SHEET_NAME);
  if (!sheet) return;
  sheet.getRange(rowNumber, 1).setValue("FALSE");
  sheet.getRange(rowNumber, 9).setValue(`無効化: ${String(reason).slice(0, 450)}`);
}
