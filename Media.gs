// 2Base 2年3組版。Code.gs と同じ Apps Script プロジェクトに追加します。
// 設定はスクリプト プロパティに保存します。公開JSに編集キーを置かないでください。
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

function rowBelongsToClass_(row, type) {
  if (!Object.prototype.hasOwnProperty.call(row, "クラス")) return true;
  const value = String(row.クラス || "").trim();
  return value === SITE_CLASS || (type !== "timetable" && (!value || value === "全体"));
}

function requireEditorKey_(params) {
  const expected = PropertiesService.getScriptProperties().getProperty("EDITOR_KEY") || "";
  if (expected.length < 16) throw new Error("Apps Scriptのスクリプト プロパティに16文字以上のEDITOR_KEYを設定してください。");
  const actual = String(params.editorKey || "");
  let difference = expected.length ^ actual.length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0);
  if (difference) throw new Error("編集キーが正しくありません。");
}

function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 4500000) throw new Error("送信データが大きすぎます。写真は3MB以下にしてください。");
    const params = JSON.parse(e.postData.contents);
    if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("送信形式が正しくありません。");
    requireEditorKey_(params);
    const action = String(params.action || "");
    if (action === "mediaStatus") return output(mediaStatus_(), "");
    if (action === "classroomCourses") return output(classroomCourses_(), "");
    if (action === "classroomPhotos") return output(classroomPhotos_(params), "");
    if (!["add", "update", "uploadPhoto"].includes(action)) throw new Error("不明なactionです。");
    const requestId = String(params.requestId || "");
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) throw new Error("リクエストIDが正しくありません。");
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error("別の保存処理が進行中です。少し待ってから再送してください。");
    try {
      const cache = CacheService.getScriptCache();
      const key = "grade23_request_" + requestId;
      const fingerprint = requestFingerprint_(params);
      const saved = cache.get(key);
      if (saved) {
        const record = JSON.parse(saved);
        if (record.fingerprint !== fingerprint) throw new Error("同じリクエストIDで異なる内容は送信できません。");
        return output(record.result, "");
      }
      const result = action === "uploadPhoto" ? uploadPhoto_(params)
        : action === "add" ? addEntry_(params) : updateEntry(params);
      if (result.ok) {
        try { cache.put(key, JSON.stringify({ fingerprint: fingerprint, result: result }), 21600); } catch (_) {}
      }
      return output(result, "");
    } finally { lock.releaseLock(); }
  } catch (error) {
    return output({ ok: false, error: String(error.message || "保存できませんでした。") }, "");
  }
}

function requestFingerprint_(params) {
  const safe = {};
  Object.keys(params).sort().forEach(key => { if (key !== "editorKey") safe[key] = params[key]; });
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(safe)));
}

function addEntry_(params) {
  const type = String(params.type || "");
  const info = Object.prototype.hasOwnProperty.call(SHEETS, type) && SHEETS[type];
  if (!info) throw new Error("編集タイプが正しくありません。");
  if (params.クラス && params.クラス !== SITE_CLASS) throw new Error("保存先のクラスは2-3に固定されています。");
  const sheet = getSpreadsheet().getSheetByName(info.name);
  if (!sheet) throw new Error("必要なシートがありません。migrateGrade23を実行してください。");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(String);
  const values = headers.map(header => {
    if (header === "クラス") return SITE_CLASS;
    if (header === "作成日時" || header === "更新日時") return nowText();
    if (header === "表示") return cleanValue(header, params[header] || "TRUE");
    return cleanValue(header, params[header]);
  });
  sheet.appendRow(values);
  const rowNumber = sheet.getLastRow();
  try { appendLog(info.name, rowNumber, "2-3: 新しく追加", "", values.join(" | ")); } catch (_) {}
  clearDataCache_();
  let push = null;
  if (PUSH_ON_EDIT) {
    try { push = notifyPushOnEdit(type, info.name, rowNumber, "新しく追加", headers, values); }
    catch (_) { push = { sent: 0, failed: 1 }; }
  }
  return { ok: true, rowNumber: rowNumber, message: "追加しました", push: push };
}

function mediaStatus_() {
  const properties = PropertiesService.getScriptProperties();
  return {
    ok: true, apiVersion: 4, classId: SITE_CLASS,
    uploadEnabled: !!properties.getProperty("PHOTO_FOLDER_ID"),
    classroomEnabled: classroomCourseIds_().length > 0 && typeof Classroom !== "undefined",
    allowPublicPhotos: properties.getProperty("ALLOW_PUBLIC_PHOTOS") === "true",
    maxBytes: PHOTO_MAX_BYTES
  };
}

function uploadPhoto_(params) {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty("PHOTO_FOLDER_ID");
  if (!folderId) throw new Error("Apps ScriptにPHOTO_FOLDER_IDを設定してください。");
  const encoded = String(params.base64 || "");
  if (!encoded || encoded.length > Math.ceil(PHOTO_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("写真データが正しくありません。3MB以下の写真を選んでください。");
  }
  const bytes = Utilities.base64Decode(encoded);
  const mime = String(params.mimeType || "");
  if (!bytes.length || bytes.length > PHOTO_MAX_BYTES || !validPhotoBytes_(bytes, mime)) throw new Error("JPEG・PNG・WebPの写真を選んでください。");
  if (params.sharing !== "inherit" && params.sharing !== "link") throw new Error("共有方法が正しくありません。");
  if (params.sharing === "link" && properties.getProperty("ALLOW_PUBLIC_PHOTOS") !== "true") throw new Error("リンク共有は管理者によって許可されていません。");
  const extension = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[mime];
  const name = String(params.name || "photo").replace(/[\\/<>:"|?*\u0000-\u001f]/g, "_").replace(/\.[^.]*$/, "").slice(0, 70) || "photo";
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, SITE_CLASS + "_" + name + extension));
  try {
    file.setDescription("2Base / 2年3組のお知らせ用写真");
    if (params.sharing === "link") file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { ok: true, file: { id: file.getId(), name: file.getName(), url: file.getUrl(), sharing: params.sharing } };
  } catch (_) {
    try { file.setTrashed(true); } catch (_) {}
    throw new Error("写真の共有設定を保存できませんでした。学校のDrive共有設定を確認してください。");
  }
}

function validPhotoBytes_(bytes, mime) {
  const b = bytes.map(value => value & 255);
  if (mime === "image/jpeg") return b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => b[i] === value);
  if (mime === "image/webp") return b.length >= 12 && String.fromCharCode.apply(null, b.slice(0, 4)) === "RIFF" && String.fromCharCode.apply(null, b.slice(8, 12)) === "WEBP";
  return false;
}

function classroomCourseIds_() {
  return (PropertiesService.getScriptProperties().getProperty("CLASSROOM_COURSE_IDS") || "")
    .split(",").map(value => value.trim()).filter(value => /^[A-Za-z0-9_-]+$/.test(value)).slice(0, 12);
}

function requireClassroom_() {
  if (typeof Classroom === "undefined") throw new Error("Apps ScriptのサービスにGoogle Classroom APIを追加してください。");
}

function classroomCourses_() {
  requireClassroom_();
  const ids = classroomCourseIds_();
  if (!ids.length) throw new Error("CLASSROOM_COURSE_IDSに2年3組のコースIDを設定してください。");
  const warnings = [];
  const courses = [];
  ids.forEach(id => {
    try {
      const course = Classroom.Courses.get(id);
      courses.push({ id: id, name: String(course.name || id), section: String(course.section || "") });
    } catch (_) { warnings.push("コース " + id + " を取得できません。デプロイしたGoogleアカウントの参加状況とAPI権限を確認してください。"); }
  });
  return { ok: true, courses: courses, warnings: warnings };
}

function classroomPhotos_(params) {
  requireClassroom_();
  const courseId = String(params.courseId || "");
  if (!classroomCourseIds_().includes(courseId)) throw new Error("このコースは2年3組の引用対象に登録されていません。");
  const source = String(params.source || "announcements");
  const options = { pageSize: 20, orderBy: "updateTime desc" };
  if (params.pageToken) options.pageToken = String(params.pageToken).slice(0, 2000);
  let response;
  try {
    if (source === "announcements") {
      options.announcementStates = ["PUBLISHED"];
      response = Classroom.Courses.Announcements.list(courseId, options);
    } else if (source === "courseWork") {
      options.courseWorkStates = ["PUBLISHED"];
      response = Classroom.Courses.CourseWork.list(courseId, options);
    } else if (source === "courseWorkMaterials") {
      options.courseWorkMaterialStates = ["PUBLISHED"];
      response = Classroom.Courses.CourseWorkMaterials.list(courseId, options);
    } else { throw new Error("引用元の種類が正しくありません。"); }
  } catch (_) { throw new Error("Classroomを取得できません。参加アカウント・Classroom APIの有効化・読み取り権限を確認してください。"); }
  const photos = [];
  let skipped = 0;
  (response[source] || []).forEach(post => {
    (post.materials || []).forEach(material => {
      const attachment = material.driveFile && material.driveFile.driveFile;
      if (!attachment || !attachment.id) return;
      try {
        const file = DriveApp.getFileById(attachment.id);
        if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"].includes(file.getMimeType())) return;
        photos.push({
          id: String(attachment.id), name: String(attachment.title || file.getName()), url: file.getUrl(),
          sourceTitle: String(post.title || post.text || "Classroomの投稿").slice(0, 160),
          sourceUrl: /^https:\/\/classroom\.google\.com\//.test(post.alternateLink || "") ? post.alternateLink : "",
          date: String(post.updateTime || post.creationTime || "")
        });
      } catch (_) { skipped++; }
    });
  });
  // 元画像のコピー、権限変更、解答・提出物の取得は行いません。
  return { ok: true, photos: photos, nextPageToken: response.nextPageToken || "", skipped: skipped };
}

// 既存データを消さず、必要なシート・列だけを補います。setupSheetsの代わりに一度実行。
function migrateGrade23() {
  const ss = getSpreadsheet();
  Object.keys(SHEETS).forEach(type => {
    const info = SHEETS[type];
    let sheet = ss.getSheetByName(info.name);
    if (!sheet) sheet = ss.insertSheet(info.name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, info.headers.length).setValues([info.headers]);
    } else {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(String);
      const missing = info.headers.filter(header => !headers.includes(header));
      if (missing.length) sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    }
    sheet.setFrozenRows(1);
  });
  if (!ss.getSheetByName(LOG_SHEET_NAME)) setupLogSheet(ss);
  if (!ss.getSheetByName(PUSH_TOKENS_SHEET_NAME)) setupPushTokenSheet(ss);
  clearDataCache_();
  return { ok: true, message: "既存データを保持して2年3組版の準備を完了しました。" };
}

// 初回の権限承認用。フォルダ作成や共有設定の変更はしません。
function authorizeGrade23() {
  getSpreadsheet().getName();
  const folderId = PropertiesService.getScriptProperties().getProperty("PHOTO_FOLDER_ID");
  if (folderId) DriveApp.getFolderById(folderId).getName();
  const ids = classroomCourseIds_();
  if (ids.length) { requireClassroom_(); Classroom.Courses.get(ids[0]); }
  return { ok: true, message: "接続先を確認しました。新バージョンで再デプロイしてください。" };
}

// Apps Scriptの編集画面だけで実行する、実際のコースIDの確認用。
// Classroom画面URLの /c/ の後ろにある文字列とは異なる場合があります。
function listMyClassroomCourseIds() {
  requireClassroom_();
  const courses = [];
  let pageToken = "";
  do {
    const response = Classroom.Courses.list({ pageSize: 100, courseStates: ["ACTIVE"], pageToken: pageToken });
    (response.courses || []).forEach(course => courses.push({ id: course.id, name: course.name, section: course.section || "" }));
    pageToken = response.nextPageToken || "";
  } while (pageToken);
  console.log(JSON.stringify(courses, null, 2));
  return courses;
}
