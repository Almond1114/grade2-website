import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function clientFixture(timerOverrides = {}) {
  const elements = Object.fromEntries(['unlockEditor', 'editorKey', 'editorAccessStatus'].map(id => [id, { value: '', disabled: false, listeners: {}, addEventListener(event, handler) { this.listeners[event] = handler; } }]));
  const calls = [];
  const handlers = {};
  const events = [];
  let ready;
  let respond = async () => ({ ok: true, json: async () => ({ ok: true, apiVersion: 4, classId: '2-3' }) });
  const context = vm.createContext({
    console, crypto, setTimeout, clearTimeout, AbortController, ...timerOverrides,
    CustomEvent: class { constructor(type) { this.type = type; } },
    window: { GRADE2_CONFIG: { GAS_URL: 'https://script.google.com/macros/s/fixture/exec' }, dispatchEvent(event) { events.push(event.type); }, addEventListener(type, fn) { handlers[type] = fn; } },
    document: { getElementById: id => elements[id], addEventListener(type, fn) { if (type === 'DOMContentLoaded') ready = fn; } },
    fetch: async (url, options) => { calls.push({ url, options }); return respond(url, options); }
  });
  vm.runInContext(source('backend-client.js'), context);
  ready();
  return { api: context.window.grade2Backend, elements, calls, events, handlers, setResponder(fn) { respond = fn; }, async unlock() { elements.editorKey.value = 'fixture-editor-key-123456'; await elements.unlockEditor.listeners.click(); } };
}

test('verified editor button explicitly locks without resending an empty key', async () => {
  const f = clientFixture();
  await f.unlock();
  assert.equal(f.api.isUnlocked(), true);
  assert.equal(f.elements.editorKey.disabled, true);
  assert.equal(f.elements.unlockEditor.textContent, '編集を終了する');
  await f.elements.unlockEditor.listeners.click();
  assert.equal(f.api.isUnlocked(), false);
  assert.equal(f.elements.editorKey.disabled, false);
  assert.equal(f.calls.length, 1);
  assert.match(f.elements.editorAccessStatus.textContent, /編集を終了しました/);
  await assert.rejects(f.api.request('add'), /編集キー/);
});

test('editor refuses successful responses from an incompatible API or another class', async () => {
  for (const result of [{ ok: true, apiVersion: 3, classId: '2-3' }, { ok: true, apiVersion: 4, classId: '2-1' }]) {
    const f = clientFixture();
    f.setResponder(async () => ({ ok: true, json: async () => result }));
    await f.unlock();
    assert.equal(f.api.isUnlocked(), false);
    assert.match(f.elements.editorAccessStatus.textContent, /2年3組版|新バージョン/);
  }
});

test('request timeout remains active while reading the response body', async () => {
  const timers = new Map();
  let count = 0;
  const f = clientFixture({ setTimeout(fn) { const id = ++count; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  await f.unlock();
  f.setResponder(async () => ({ ok: true, json: async () => {
    const timeout = Array.from(timers.values())[0];
    assert.ok(timeout, 'response parsing must still have a timeout');
    timeout();
    throw Object.assign(new Error('body aborted'), { name: 'AbortError' });
  } }));
  await assert.rejects(f.api.request('uploadPhoto', { base64: 'fixture' }), /応答がありません/);
  assert.equal(timers.size, 0);
});

test('leaving the page discards the key before a back-forward cache restore', async () => {
  const f = clientFixture();
  await f.unlock();
  assert.equal(typeof f.handlers.pagehide, 'function');
  f.handlers.pagehide();
  assert.equal(f.api.isUnlocked(), false);
  assert.ok(f.events.includes('grade2:editor-locked'));
  await assert.rejects(f.api.request('uploadPhoto', {}), /編集キー/);
  assert.equal(f.calls.length, 1);
});

test('a late verification response cannot unlock a page after navigation', async () => {
  const f = clientFixture();
  let finish;
  let started;
  const reading = new Promise(resolve => { started = resolve; });
  f.setResponder(async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; started(); }) }));
  const verification = f.unlock();
  await reading;
  f.handlers.pagehide();
  finish({ ok: true, apiVersion: 4, classId: '2-3' });
  await verification;
  assert.equal(f.api.isUnlocked(), false);
  assert.equal(f.elements.editorKey.disabled, false);
  assert.equal(f.elements.unlockEditor.textContent, '編集を有効にする');
  assert.ok(!f.events.includes('grade2:editor-unlocked'));
});

test('Drive URLs preserve resource keys and use the preview viewer; unsafe URLs are rejected', () => {
  const context = vm.createContext({ URL, window: {}, document: { addEventListener() {} } });
  vm.runInContext(source('media-display.js'), context);
  const { describe, markup } = context.window.grade2Media;
  const media = describe('https://drive.google.com/open?id=fixture_photo_1234&resourcekey=0-demo-key');
  assert.equal(media.previewUrl, 'https://drive.google.com/file/d/fixture_photo_1234/preview?resourcekey=0-demo-key');
  assert.match(markup(media.url, 'クラスの写真'), /title="クラスの写真：Driveの写真プレビュー"/);
  assert.match(markup(media.url, 'photo'), /Driveで写真を開く/);
  assert.equal(describe('javascript:alert(1)'), null);
  assert.equal(describe('data:image/svg+xml,<svg>'), null);
  assert.equal(describe('https://user:password@drive.google.com/file/d/fixture_photo_1234/view'), null);
  assert.equal(describe('https://drive.google.com/file/d/invalid/view'), null);
  assert.doesNotMatch(markup('https://example.com/a.jpg', '"><script>alert(1)</script>'), /<script>/);
});

test('Classroom photo search finds timetable synonyms and normalizes full-width query words', () => {
  const context = vm.createContext({ URL, window: {}, document: { addEventListener() {} } });
  vm.runInContext(source('media-display.js'), context);
  const search = context.window.grade2Media.filterPhotos;
  const photos = [{name:'photo.jpg',sourceTitle:'10月の週予定'}, {name:'時間わり.png',sourceTitle:'2年3組'}, {name:'学級だより.jpg',sourceTitle:'学校'}, {name:'MATH　２－３.jpg',sourceTitle:'復習用'}];
  assert.deepEqual(Array.from(search(photos,'時間割')),photos.slice(0,2));
  assert.deepEqual(Array.from(search(photos,'math 2-3')), [photos[3]]);
  assert.deepEqual(Array.from(search(photos,'  ')),photos);
  assert.equal(search(photos,'一致しない言葉').length,0);
});

test('a remembered or requested foreign class cannot change the class or expose foreign cached rows', () => {
  const storage = new Map([['grade2SelectedClass','2-1']]);
  const context = vm.createContext({
    URL, console,
    window: { GRADE2_CONFIG: { DEFAULT_CLASS: '2-5' }, dispatchEvent() {} },
    document: { addEventListener() {}, getElementById: () => null, body: { dataset: {} } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    CustomEvent: class { constructor(name, details) { Object.assign(this, { name, details }); } }
  });
  vm.runInContext(source('app-core.js'), context);
  const app = context.window.grade2App;
  assert.equal(app.getSelectedClass(), '2-3');
  app.setSelectedClass('2-1', { noRender: true });
  assert.equal(app.getSelectedClass(), '2-3');
  assert.equal(storage.get('grade2SelectedClass'), '2-3');
  const scoped = vm.runInContext('scopeClassData({announcements:[{クラス:"2-1"},{クラス:"2-3"},{クラス:"全体"}],timetable:[{クラス:"2-1"},{クラス:"2-3"},{クラス:"全体"}]})', context);
  assert.deepEqual(Array.from(scoped.announcements, row => row.クラス), ['2-3','全体']);
  assert.deepEqual(Array.from(scoped.timetable, row => row.クラス), ['2-3']);
  assert.deepEqual(Array.from(vm.runInContext('getClasses()', context)), ['2-3']);
});

test('editor sends credentials and photos in POST bodies, preserves retry IDs, and does not store the key', async () => {
  const elements = Object.fromEntries(['unlockEditor', 'editorKey', 'editorAccessStatus'].map(id => [id, { value: '', disabled: false, listeners: {}, addEventListener(event, handler) { this.listeners[event] = handler; } }]));
  let ready;
  const calls = [];
  const context = vm.createContext({
    console, crypto, setTimeout, clearTimeout, AbortController,
    CustomEvent: class {},
    window: { GRADE2_CONFIG: { GAS_URL: 'https://script.google.com/macros/s/fixture/exec' }, dispatchEvent() {}, addEventListener() {} },
    document: { getElementById: id => elements[id], addEventListener(event, handler) { if (event === 'DOMContentLoaded') ready = handler; } },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ ok: true, apiVersion: 4, classId: '2-3' }) }; },
    localStorage: { setItem() { throw new Error('Credentials must not be persisted'); } }
  });
  vm.runInContext(source('backend-client.js'), context);
  ready();
  const api = context.window.grade2Backend;
  await assert.rejects(api.request('add', { type: 'announcements' }), /編集キー/);
  elements.editorKey.value = 'fixture-key-for-client-test';
  await elements.unlockEditor.listeners.click();
  assert.equal(api.isUnlocked(), true);
  assert.equal(elements.editorKey.value, '');
  await api.request('uploadPhoto', { base64: 'image-data', sharing: 'inherit' });
  await api.request('uploadPhoto', { base64: 'image-data', sharing: 'inherit' });
  const first = JSON.parse(calls[1].options.body);
  const retry = JSON.parse(calls[2].options.body);
  assert.equal(first.requestId, retry.requestId);
  for (const call of calls) {
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.credentials, 'omit');
    assert.equal(call.options.headers['Content-Type'], 'text/plain;charset=UTF-8');
    assert.ok(!call.url.includes('fixture-key-for-client-test'));
  }
  assert.equal(first.editorKey, 'fixture-key-for-client-test');
  api.forgetRequests();
  await api.request('uploadPhoto', { base64: 'image-data', sharing: 'inherit' });
  assert.notEqual(JSON.parse(calls[3].options.body).requestId, first.requestId);
});

test('all root scripts and Apps Script sources parse, and linked local scripts/styles exist', () => {
  const root = new URL('..', import.meta.url);
  for (const name of fs.readdirSync(root)) {
    if (/\.(?:js|gs)$/.test(name)) assert.doesNotThrow(() => new vm.Script(source(name), { filename: name }));
    if (!name.endsWith('.html')) continue;
    const html = source(name);
    for (const match of html.matchAll(/(?:<script[^>]*src|<link[^>]*href)="([^"]+)"/g)) {
      if (/^(?:https?:|#)/.test(match[1])) continue;
      const target = match[1].split('?')[0];
      assert.ok(fs.existsSync(new URL(target, root)), `${name} references missing ${target}`);
    }
    if (html.includes('app-core.js')) assert.ok(html.indexOf('media-display.js') < html.indexOf('app-core.js'));
  }
});

test('PWA assets have unique existing paths and activation keeps caches for unrelated projects', async () => {
  const handlers = {};
  const removed = [];
  let currentCache;
  const context = vm.createContext({
    console, URL,
    self: { location: { origin: 'https://example.com' }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim() {} } },
    caches: { keys: async () => ['grade2-site-old', 'grade2-site-v4-grade23-20261018', currentCache, 'nankosai-offline-v1'], delete: async key => { removed.push(key); } },
    importScripts: () => { throw new Error('Firebase unavailable in unit test'); }
  });
  // Firebase初期化の失敗を記録せず、キャッシュの独立した動作を検証する。
  context.console = { error() {}, warn() {} };
  vm.runInContext(source('firebase-messaging-sw.js'), context);
  currentCache = vm.runInContext('SITE_CACHE', context);
  const assets = Array.from(vm.runInContext('SITE_ASSETS', context));
  assert.equal(new Set(assets).size, assets.length);
  for (const asset of assets) assert.ok(fs.existsSync(new URL('../' + asset.split('?')[0], import.meta.url)), `missing precache asset ${asset}`);
  const root = new URL('..',import.meta.url);
  for (const page of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    for (const match of source(page).matchAll(/(?:src|href)="([^"/:]+\.(?:js|css)\?[^"\s]+)"/g)) {
      assert.ok(assets.includes('./' + match[1]), `${page} requests an asset version that is not precached: ${match[1]}`);
    }
  }
  for (const match of source('theme.js').matchAll(/load(?:Css|Script)Once\("([^"]+)"/g)) assert.ok(assets.includes('./' + match[1]), `theme asset is not precached: ${match[1]}`);
  let complete;
  handlers.activate({ waitUntil: promise => { complete = promise; } });
  await complete;
  assert.deepEqual(removed, ['grade2-site-old', 'grade2-site-v4-grade23-20261018']);
});

test('a timetable photo notification opens the image section in the repository path', async () => {
  const handlers = {};
  let opened;
  const context = vm.createContext({
    URL, console:{error() {}}, importScripts() { throw Error('no Firebase in unit test'); },
    self:{ addEventListener:(name,fn) => {handlers[name] = fn;},registration:{scope:'https://example.com/grade2-website/'} },
    clients:{matchAll:async () => [],openWindow:async url => {opened = url;} }
  });
  vm.runInContext(source('firebase-messaging-sw.js'),context);
  let complete;
  handlers.notificationclick({notification:{close() {},data:{screen:'timetablePhotos'}},waitUntil:promise => {complete = promise;} });
  await complete;
  assert.equal(opened,'https://example.com/grade2-website/class-2-3.html#timetablePhotoSection');
});
