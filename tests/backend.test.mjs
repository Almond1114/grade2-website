import test from 'node:test';
import assert from 'node:assert/strict';
import { backendFixture } from './apps-script-fixture.mjs';

const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 255, 217]).toString('base64');
const upload = { action: 'uploadPhoto', base64: jpeg, mimeType: 'image/jpeg', name: 'school.jpeg', sharing: 'inherit' };

test('unauthorized and GET writes cannot change Sheets or create Drive files', () => {
  const f = backendFixture();
  for (const action of ['uploadPhoto', 'add', 'update', 'classroomPhotos']) {
    assert.equal(f.post({ ...upload, action, editorKey: 'incorrect-key' }).ok, false);
  }
  for (const action of ['setup', 'add', 'update', 'dailyPushNow', 'setupDailyPushTrigger']) {
    const result = JSON.parse(f.context.doGet({ parameter: { action } }).body);
    assert.equal(result.ok, false);
  }
  assert.equal(f.created.length, 0);
  assert.equal(f.sheets.get('お知らせ').rows.length, 1);
});

test('missing server key fails closed even for a caller sending an empty key', () => {
  const f = backendFixture({ properties: { EDITOR_KEY: '' } });
  assert.match(f.post({ action: 'mediaStatus', editorKey: '' }).error, /EDITOR_KEY/);
});

test('public data returns 2-3 and shared notices, without other classes or raw edit logs', () => {
  const f = backendFixture();
  const sheet = f.sheets.get('お知らせ');
  const header = sheet.rows[0];
  for (const cls of ['2-1','2-2','2-3','2-4','2-5','全体']) sheet.appendRow(header.map(name => name === 'クラス' ? cls : name === 'タイトル' ? cls + 'のお知らせ' : ''));
  f.sheets.get('編集ログ').appendRow(['now', 'お知らせ', 2, '2-1の機密', '', '']);
  const data = f.context.getAllData();
  assert.deepEqual(Array.from(data.announcements, row => row.クラス), ['2-3', '全体']);
  assert.equal(data.editLog.length, 0);
  assert.equal(data.meta.classId, '2-3');
});

test('add stores fixed class, neutralizes formulas and returns the created row', () => {
  const f = backendFixture();
  const result = f.post({ action: 'add', type: 'announcements', タイトル: '=IMPORTXML("https://example.com")' });
  assert.equal(result.ok, true);
  assert.equal(result.rowNumber, 2);
  assert.equal(result.row.__rowNumber, '2');
  assert.equal(result.row.クラス, '2-3');
  const row = f.context.readSheet('お知らせ')[0];
  assert.equal(row.クラス, '2-3');
  assert.ok(row.タイトル.startsWith("'="));
  assert.equal(f.post({ action: 'add', type: 'announcements', クラス: '2-4' }).ok, false);
  assert.equal(f.post({ action: 'add', type: 'constructor' }).ok, false);
});

test('timetable photos store their source and expose only exact 2-3 rows', () => {
  const f = backendFixture();
  const image = 'https://drive.google.com/file/d/fixture_timetable_1234/view';
  const source = 'https://classroom.google.com/c/course23/p/weekly';
  const result = f.post({ action:'add', type:'timetablePhotos', 日付:'2026-10-18', タイトル:'今週の時間割', 画像URL:image, リンクURL:source });
  assert.equal(result.ok, true);
  assert.equal(result.row.クラス, '2-3');
  assert.equal(result.row.画像URL, image);
  assert.equal(result.row.リンクURL, source);
  const sheet = f.sheets.get('時間割の写真');
  for (const cls of ['2-1','全体','']) sheet.appendRow(sheet.rows[0].map(name => name === 'クラス' ? cls : name === '画像URL' ? image : ''));
  assert.equal(f.context.getAllData().timetablePhotos.length, 1);
  assert.equal(f.post({ action:'update', type:'timetablePhotos', rowNumber:3, タイトル:'上書き' }).ok, false);
});

test('foreign row numbers and modified class values are rejected on update', () => {
  const f = backendFixture();
  const sheet = f.sheets.get('お知らせ');
  for (const cls of ['2-1', '2-3']) sheet.appendRow(sheet.rows[0].map(header => header === 'クラス' ? cls : ''));
  assert.equal(f.post({ action: 'update', type: 'announcements', rowNumber: 2, タイトル: 'changed' }).ok, false);
  assert.equal(f.post({ action: 'update', type: 'announcements', rowNumber: 3, クラス: '2-1' }).ok, false);
  const result = f.post({ action: 'update', type: 'announcements', rowNumber: 3, クラス: '2-3', タイトル: 'new title' });
  assert.equal(result.ok, true);
  assert.equal(result.rowNumber, 3);
  assert.equal(result.row.タイトル, 'new title');
  assert.equal(f.context.readSheet('お知らせ')[0].タイトル, '');
});

test('photo save inherits folder permissions and repeated request does not create a second file', () => {
  const f = backendFixture();
  const payload = { ...upload, requestId: 'same_photo_request_123456' };
  const first = f.post(payload);
  assert.equal(first.ok, true);
  assert.equal(f.post(payload).file.id, first.file.id);
  assert.equal(f.created.length, 1);
  assert.equal(f.created[0].sharingCalls.length, 0);
  assert.match(first.file.url, /^https:\/\/drive.google.com\/file\/d\//);
  assert.equal(f.post({ ...payload, name: 'other.jpg' }).ok, false);
});

test('a duplicate add reuses its result while a new request can add the same content intentionally', () => {
  const f = backendFixture();
  const payload = { action: 'add', type: 'homework', タイトル: 'ワーク', requestId: 'same_add_request_12345678' };
  assert.equal(f.post(payload).rowNumber, 2);
  assert.equal(f.post(payload).rowNumber, 2);
  assert.equal(f.post({ ...payload, requestId: 'another_add_request_123456' }).rowNumber, 3);
  assert.equal(f.sheets.get('提出物').rows.length, 3);
});

test('oversized data, active formats and spoofed MIME types are rejected before Drive writes', () => {
  const f = backendFixture();
  const svg = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
  for (const payload of [{ ...upload, base64: svg }, { ...upload, mimeType: 'image/svg+xml', base64: svg }, { ...upload, base64: 'A'.repeat(4200000) }]) {
    assert.equal(f.post(payload).ok, false);
  }
  assert.equal(f.created.length, 0);
});

test('public sharing is explicit, server gated, and permission failure cleans up only the new file', () => {
  const restricted = backendFixture();
  assert.equal(restricted.post({ ...upload, sharing: 'link' }).ok, false);
  assert.equal(restricted.created.length, 0);
  const allowed = backendFixture({ properties: { ALLOW_PUBLIC_PHOTOS: 'true' } });
  assert.equal(allowed.post({ ...upload, sharing: 'link' }).ok, true);
  assert.deepEqual(allowed.created[0].sharingCalls, [['link','view']]);
  const denied = backendFixture({ sharingFails: true, properties: { ALLOW_PUBLIC_PHOTOS: 'true' } });
  assert.equal(denied.post({ ...upload, sharing: 'link' }).ok, false);
  assert.equal(denied.created[0].trashed, true);
});

test('Classroom only lists allowlisted courses, follows pagination and leaves source permissions untouched', () => {
  const material = id => ({ driveFile: { driveFile: { id, title: id } } });
  const f = backendFixture({ classroomPages: { announcements: { announcements: [{ text: '写真の連絡', alternateLink: 'https://classroom.google.com/c/course23/p/123', materials: [material('original-image-123'), material('document-123'), material('not-readable-123')] }], nextPageToken: 'next-page' } } });
  let permissionWrites = 0;
  f.files.set('original-image-123', { getMimeType: () => 'image/jpeg', getName: () => 'photo.jpg', getUrl: () => 'https://drive.google.com/file/d/original-image-123/view', setSharing: () => permissionWrites++ });
  f.files.set('document-123', { getMimeType: () => 'application/pdf' });
  assert.equal(f.post({ action: 'classroomPhotos', courseId: 'other-class' }).ok, false);
  assert.equal(f.calls.length, 0);
  const result = f.post({ action: 'classroomPhotos', courseId: 'course23', pageToken: 'previous-page' });
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0].sourceUrl, 'https://classroom.google.com/c/course23/p/123');
  assert.equal(result.nextPageToken, 'next-page');
  assert.equal(result.skipped, 1);
  assert.equal(f.calls[0].params.pageToken, 'previous-page');
  assert.deepEqual(f.calls[0].params.announcementStates, ['PUBLISHED']);
  assert.equal(f.created.length, 0);
  assert.equal(permissionWrites, 0);
  for (const source of ['courseWork', 'courseWorkMaterials']) assert.equal(f.post({ action: 'classroomPhotos', courseId: 'course23', source }).ok, true);
});

test('migration appends missing headers and preserves all existing rows', () => {
  const f = backendFixture();
  const sheet = f.sheets.get('お知らせ');
  sheet.rows = [['クラス','タイトル'], ['2-1','残す'], ['2-3','これも残す']];
  f.sheets.delete('時間割の写真');
  f.context.migrateGrade23();
  assert.ok(f.sheets.get('時間割の写真').rows[0].includes('画像URL'));
  assert.deepEqual(sheet.rows.slice(1), [['2-1','残す'],['2-3','これも残す']]);
  assert.ok(sheet.rows[0].includes('画像URL'));
  assert.equal(sheet.rows[0].filter(value => value === 'タイトル').length, 1);
  assert.equal(f.context.setupSheets().ok, false);
  assert.deepEqual(sheet.rows.slice(1), [['2-1','残す'],['2-3','これも残す']]);
});

test('push recipients are limited to 2-3 even when old registrations remain', () => {
  const f = backendFixture();
  const sheet = f.sheets.get('Push登録端末');
  sheet.appendRow(['TRUE','old','2-1','web','token1']);
  sheet.appendRow(['TRUE','current','2-3','web','token23']);
  assert.equal(f.context.countActivePushTokens(), 1);
});

test('timetable photo update notifications target the class timetable photo', () => {
  const f = backendFixture();
  let message;
  f.context.isFcmConfigured_ = () => true;
  f.context.sendPushToAll_ = value => { message = value; return {sent:1,failed:0}; };
  f.context.notifyPushOnEdit('timetablePhotos','時間割の写真',2,'追加',['タイトル','クラス'],['今週の時間割','2-3']);
  assert.equal(message.data.screen,'timetablePhotos');
});

test('JSONP callback is constrained to an identifier', () => {
  const f = backendFixture();
  const result = f.context.output({ ok: true }, 'alert(1)//');
  assert.equal(result.mime, 'json');
  assert.equal(result.body, '{"ok":true}');
});
