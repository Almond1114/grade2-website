import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// フォーム値・イベント・通信境界のテスト。レイアウトや実ブラウザの代用にはしません。
function editorFixture(href) {
  let values = {};
  let photo = null;
  let respond = async () => ({ ok: true, rowNumber: 2 });
  const events = {};
  const nodes = {};
  for (const id of ['editForm','editFields','editFormTitle','editMode','formStatus','editTypeSelect','editRowList','editTypeCards','editSearch','resetEditorBtn','editorKey']) nodes[id] = {
    value: '', disabled: false, textContent: '', listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    closest() { return { scrollIntoView() {} }; }, focus() {}
  };
  const submit = { disabled: false };
  nodes.editForm.querySelector = () => submit;
  Object.defineProperty(nodes.editFields, 'innerHTML', { set(html) {
    values = {};
    for (const match of html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)) values[decode(match[1])] = decode(match[2]);
    for (const match of html.matchAll(/<textarea[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g)) values[decode(match[1])] = decode(match[2]);
    for (const match of html.matchAll(/<select name="([^"]+)">([\s\S]*?)<\/select>/g)) values[match[1]] = (match[2].match(/value="([^"]*)" selected/) || match[2].match(/value="([^"]*)"/) || [,''])[1];
  } });
  class FormData {
    constructor() { this.items = Object.entries(values); }
    [Symbol.iterator]() { return this.items[Symbol.iterator](); }
  }
  const fields = [['表示','select',['TRUE','FALSE']],['クラス','text'],['タイトル','text'],['本文','textarea'],['画像URL','url'],['リンクURL','url']];
  const context = vm.createContext({
    console, URL, FormData, CLASS_ID: '2-3', PERIODS: [], selectedEditType: 'announcements', selectedRowNumber: '2',
    appData: { announcements: [{ __rowNumber:'2', クラス:'2-3', タイトル:'保存済み2' }, { __rowNumber:'3', クラス:'2-3', タイトル:'保存済み3' }], homework: [], timetablePhotos: [] },
    EDIT_FIELDS: { announcements: fields, homework: [['クラス','text'],['タイトル','text']], timetablePhotos: [['日付','date'],...fields] },
    EDIT_TYPE_ORDER: ['announcements','homework','timetablePhotos'], TYPE_LABELS: { announcements:'お知らせ', homework:'提出物', timetablePhotos:'時間割の写真' },
    EDIT_TYPE_META: { announcements: { icon:'📢',short:'連絡' }, homework: { icon:'📝',short:'課題' }, timetablePhotos: { icon:'🖼️',short:'配布画像' } },
    document: { body: { matches: () => true, dataset:{} } },
    window: {
      location: href ? { href } : undefined,
      addEventListener(type, fn) { events[type] = fn; },
      grade2PhotoEditor: { snapshot: () => photo, dispose() { photo = null; }, mount(_fields, state, options) { photo = { ...state, purpose: options.purpose }; }, isBusy: () => false },
      grade2Backend: { isUnlocked: () => true, request: (...args) => respond(...args), forgetRequests() {} }
    },
    $: id => nodes[id] || null, dateKey: () => '2026-10-19', escapeHtml: escape,
    fieldHelpText: () => '', emptyState: message => `<p>${escape(message)}</p>`,
    rowsForEdit: () => context.appData[context.selectedEditType], rowTitle: (_type, row) => row.タイトル || '新規',
    renderEditLog() {}, clearLocalDataCache() {}, loadData: async () => ({ ok:false }), toast() {}
  });
  vm.runInContext(source('editor-add.js'), context);
  context.initEvents(); context.renderEditor();
  const choose = row => nodes.editRowList.onclick({ target: { closest: () => ({ dataset:{row} }) } });
  return {
    context, nodes, events, submit, get values() { return values; }, get photo() { return photo; }, choose,
    change(name, value) { values[name] = value; nodes.editForm.listeners.input(); },
    choosePhoto(file) { photo = { file, sharing:false }; nodes.editForm.listeners.change(); },
    add(type) { nodes.editTypeCards.onclick({ target: { closest: () => ({ dataset:{ addType:type } }) } }); },
    save() { return nodes.editForm.listeners.submit({ preventDefault() {}, currentTarget:nodes.editForm }); },
    setResponder(fn) { respond = fn; }, reset() { nodes.resetEditorBtn.listeners.click(); }
  };
}

test('row switching restores separate text and unuploaded-photo drafts', () => {
  const f = editorFixture();
  const file = { name:'写真.jpg', size:1234 };
  f.change('タイトル','下書きA'); f.choosePhoto(file);
  f.choose('3'); f.change('本文','下書きB');
  f.choose('2');
  assert.equal(f.values.タイトル, '下書きA');
  assert.equal(f.photo.file, file);
  f.choose('3');
  assert.equal(f.values.本文, '下書きB');
});

test('new drafts survive switching types and tapping the same add card again', () => {
  const f = editorFixture();
  f.add('announcements'); f.change('タイトル','新しい連絡');
  f.add('homework'); f.change('タイトル','新しい提出物');
  f.add('announcements'); f.add('announcements');
  assert.equal(f.values.タイトル, '新しい連絡');
  f.add('homework'); assert.equal(f.values.タイトル, '新しい提出物');
});

test('the timetable registration link opens its new-photo form with the fixed class and today date', () => {
  const f = editorFixture('https://example.com/edit.html?type=timetablePhotos&mode=add');
  assert.equal(f.context.selectedEditType, 'timetablePhotos');
  assert.equal(f.context.selectedRowNumber, '__new__');
  assert.equal(f.values.クラス, '2-3');
  assert.equal(f.values.日付, '2026-10-19');
  assert.equal(f.photo.purpose, 'timetablePhotos');
  const invalid = editorFixture('https://example.com/edit.html?type=constructor&mode=add');
  assert.equal(invalid.context.selectedEditType, 'announcements');
});

test('reset discards only the current draft, and leaving warns while another draft exists', () => {
  const f = editorFixture();
  f.change('タイトル','下書き2'); f.choose('3'); f.change('タイトル','下書き3'); f.reset();
  assert.equal(f.values.タイトル,'保存済み3');
  let warned = false;
  f.events.beforeunload({ preventDefault() { warned = true; } });
  assert.equal(warned, true);
  f.choose('2'); assert.equal(f.values.タイトル, '下書き2'); f.reset();
  warned = false; f.events.beforeunload({ preventDefault() { warned = true; } });
  assert.equal(warned, false);
});

test('acknowledged save remains successful when refresh fails and uses the canonical saved row', async () => {
  const f = editorFixture();
  f.change('タイトル',' 入力した内容 ');
  f.setResponder(async (_action, payload) => {
    assert.equal(f.nodes.editFields.disabled, true);
    assert.equal(payload.タイトル, ' 入力した内容 ');
    return { ok:true,rowNumber:2,row:{ __rowNumber:'2', クラス:'2-3', タイトル:'入力した内容' } };
  });
  await f.save();
  assert.equal(f.values.タイトル, '入力した内容');
  assert.match(f.nodes.formStatus.textContent, /^保存しました/);
  assert.match(f.nodes.formStatus.textContent, /未完了/);
  assert.equal(f.nodes.editFields.disabled, false);
});

test('saving cannot discard a photo that was selected but has not been uploaded', async () => {
  const f = editorFixture();
  const file = { name:'時間割.jpg',size:1234 };
  f.choosePhoto(file);
  let saves = 0;
  f.setResponder(async () => { saves++; return {ok:true,rowNumber:2}; });
  await f.save();
  assert.equal(saves,0);
  assert.equal(f.photo.file,file);
  assert.match(f.nodes.formStatus.textContent,/まだDriveに保存されていません/);
  f.choosePhoto(null); await f.save();
  assert.equal(saves,1);
});

test('an unexpected refresh exception does not turn an acknowledged save into a failed write', async () => {
  const f = editorFixture();
  f.context.console = { warn() {} };
  f.context.loadData = async () => { throw Error('refresh error'); };
  f.change('タイトル','保存した内容'); await f.save();
  assert.match(f.nodes.formStatus.textContent,/^保存しました/);
  assert.equal(f.values.タイトル,'保存した内容');
});

test('a later successful sync replaces the saved fallback while keeping any new draft', async () => {
  const f = editorFixture();
  f.change('タイトル','保存した内容'); await f.save();
  f.context.appData.announcements[0].タイトル = '後から同期した内容';
  f.events['grade2:data-updated']();
  assert.equal(f.values.タイトル,'後から同期した内容');
  f.change('タイトル','次の下書き'); await f.save();
  f.change('タイトル','まだ保存していない内容');
  f.context.appData.announcements[0].タイトル = 'サーバー上の別の更新';
  f.events['grade2:data-updated']();
  assert.equal(f.values.タイトル,'まだ保存していない内容');
});

test('failed saves retain the draft and pending saves prevent switching rows', async () => {
  const f = editorFixture();
  f.change('タイトル','失いたくない内容');
  let finish;
  f.setResponder(() => new Promise((_resolve,reject) => { finish = reject; }));
  const saving = f.save();
  f.choose('3');
  assert.equal(f.context.selectedRowNumber, '2');
  assert.equal(f.submit.disabled, true);
  finish(new Error('通信失敗')); await saving;
  assert.equal(f.submit.disabled, false);
  f.choose('3'); f.choose('2');
  assert.equal(f.values.タイトル, '失いたくない内容');
});

function dataFixture() {
  const pending = [];
  const store = new Map();
  const context = vm.createContext({
    URL, console:{ warn() {} }, CustomEvent:class {},
    window:{ GRADE2_CONFIG:{ GAS_URL:'https://script.google.com/fixture' },dispatchEvent(){} },
    document:{ addEventListener(){},getElementById:()=>null,body:{dataset:{}} },
    localStorage:{ getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key) }
  });
  vm.runInContext(source('media-display.js'), context);
  vm.runInContext(source('app-core.js'), context);
  context.renderAll = () => {};
  context.renderConnection = () => {};
  context.jsonp = () => new Promise((resolve,reject)=>pending.push({resolve,reject}));
  return { context,pending };
}
const data = title => ({ ok:true,data:{announcements:[{ __rowNumber:'2', クラス:'2-3',タイトル:title }]} });

test('an older reload cannot overwrite a newer response or change its connection state', async () => {
  const f = dataFixture();
  const first = f.context.loadData(); const second = f.context.loadData();
  f.pending[1].resolve(data('新しいデータ')); await second;
  f.pending[0].resolve(data('古いデータ'));
  assert.equal((await first).superseded, true);
  assert.equal(f.context.window.grade2App.getSnapshot().data.announcements[0].タイトル,'新しいデータ');
});

test('refresh failure keeps verified live data, and missing data is not treated as live', async () => {
  const f = dataFixture();
  const first = f.context.loadData(); f.pending[0].resolve(data('保持するデータ')); await first;
  const retry = f.context.loadData(); f.pending[1].reject(new Error('offline'));
  assert.equal((await retry).ok, false);
  assert.equal(f.context.window.grade2App.getSnapshot().data.announcements[0].タイトル,'保持するデータ');
  const invalid = dataFixture();
  const loading = invalid.context.loadData(); invalid.pending[0].resolve({ok:true});
  assert.equal((await loading).ok, false);
});

test('summary cards escape sheet-provided notes and render countdown badges as elements', () => {
  const f = dataFixture();
  const html = vm.runInContext('card("次のテスト","数学","<img src=x onerror=alert(1)>","",dueBadge("2030-01-01"))',f.context);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<span class="badge/);
  assert.doesNotMatch(html, /&lt;span/);
});

test('the timetable photo uses the newest valid visible 2-3 row and falls back when hidden', () => {
  const f = dataFixture();
  const row = (id, date, extra = {}) => ({ __rowNumber:String(id), 日付:date, クラス:'2-3', 表示:'TRUE', タイトル:'写真' + id, 画像URL:'https://drive.google.com/file/d/fixture_photo_1234/view', ...extra });
  f.context.rows = [row(2,'2026-10-01'), row(3,'2026-10-18'), row(4,'2026-10-18'), row(5,'2030-01-01',{表示:'FALSE'}), row(6,'2030-01-01',{クラス:'2-1'}), row(7,'2030-01-01',{クラス:'全体'}), row(8,'2030-01-01',{画像URL:'https://drive.google.com/file/d/bad/view'}), row(9,'2030-01-01',{画像URL:''})];
  vm.runInContext('appData = scopeClassData({timetablePhotos:rows})', f.context);
  assert.equal(f.context.latestTimetablePhoto().タイトル, '写真4');
  vm.runInContext('appData.timetablePhotos.find(row => row.__rowNumber === "4").表示 = "FALSE"', f.context);
  assert.equal(f.context.latestTimetablePhoto().タイトル, '写真3');
  vm.runInContext('appData.timetablePhotos = []', f.context);
  assert.equal(f.context.latestTimetablePhoto(), null);
});
