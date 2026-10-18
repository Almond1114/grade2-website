import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

class Range {
  constructor(sheet, row, col, rows = 1, cols = 1) { Object.assign(this, { sheet, row, col, rows, cols }); }
  getDisplayValues() { return Array.from({ length: this.rows }, (_, i) => Array.from({ length: this.cols }, (_, j) => String(this.sheet.rows[this.row - 1 + i]?.[this.col - 1 + j] ?? ''))); }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValues(values) {
    values.forEach((row, i) => row.forEach((value, j) => { this.sheet.rows[this.row - 1 + i] ??= []; this.sheet.rows[this.row - 1 + i][this.col - 1 + j] = value; }));
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
  setHorizontalAlignment() { return this; } setNote() { return this; }
}
class Sheet {
  constructor(rows = []) { this.rows = structuredClone(rows); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  getRange(...args) { return new Range(this, ...args); }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  appendRow(row) { this.rows.push([...row]); }
  clear() { this.rows = []; }
  setFrozenRows() {} autoResizeColumns() {}
}

export function backendFixture(options = {}) {
  const properties = { SPREADSHEET_ID: 'fixture-spreadsheet-id', EDITOR_KEY: 'fixture-only-editor-key-123456', PHOTO_FOLDER_ID: 'test-folder', CLASSROOM_COURSE_IDS: 'course23', ...options.properties };
  const sheets = new Map();
  const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; }, getName: () => '2Base test sheet' };
  const files = new Map();
  const created = [];
  const calls = [];
  const cache = new Map();
  let locked = false;
  const createFile = blob => {
    const file = {
      id: `test-photo-${created.length + 1}`, name: blob.name, mime: blob.mime,
      sharingCalls: [], trashed: false,
      getId() { return this.id; }, getName() { return this.name; }, getMimeType() { return this.mime; },
      getUrl() { return `https://drive.google.com/file/d/${this.id}/view`; },
      setSharing(...args) { this.sharingCalls.push(args); if (options.sharingFails) throw Error('policy denied'); },
      setDescription() {}, setTrashed(value) { this.trashed = value; }
    };
    created.push(file); files.set(file.id, file); return file;
  };
  const classroomList = source => (courseId, params) => {
    calls.push({ source, courseId, params: structuredClone(params) });
    return options.classroomPages?.[source] || { [source]: [], nextPageToken: '' };
  };
  const context = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    SpreadsheetApp: { openById: () => ss },
    Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
    Utilities: {
      formatDate: () => '2026-10-18 22:00:00',
      base64Decode: value => [...Buffer.from(value, 'base64')],
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()],
      newBlob: (bytes, mime, name) => ({ bytes, mime, name })
    },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) ?? null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (locked) return false; locked = true; return true; }, releaseLock: () => { locked = false; } }) },
    ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: body => ({ body, setMimeType(mime) { return { body, mime }; } }) },
    DriveApp: { Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' }, getFolderById: () => ({ createFile, getName: () => '2-3 photos' }), getFileById: id => { if (!files.has(id)) throw Error('not accessible'); return files.get(id); } },
    Classroom: { Courses: { get: id => ({ name: '2年3組', id }), Announcements: { list: classroomList('announcements') }, CourseWork: { list: classroomList('courseWork') }, CourseWorkMaterials: { list: classroomList('courseWorkMaterials') } } }
  });
  vm.runInContext(fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../Media.gs', import.meta.url), 'utf8'), context);
  const definitions = vm.runInContext('SHEETS', context);
  for (const info of Object.values(definitions)) sheets.set(info.name, new Sheet([Array.from(info.headers)]));
  sheets.set('編集ログ', new Sheet([['日時','種類','行','内容','変更前','変更後']]));
  sheets.set('Push登録端末', new Sheet([['有効','端末ID','クラス','OS','Pushトークン','登録日時','更新日時','最終送信','状態','ユーザーエージェント']]));
  let counter = 0;
  const post = params => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ editorKey: properties.EDITOR_KEY, requestId: `fixture_request_${String(++counter).padStart(10, '0')}`, ...params }) } }).body);
  return { context, properties, sheets, created, files, calls, post, ss, definitions };
}
