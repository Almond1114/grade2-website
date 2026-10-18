import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const decode = value => value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

// 写真処理とフォームの境界を検証する小さなDOM。描画やブラウザ互換性は扱いません。
class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.disabled = false; this.checked = false; this.hidden = false; this.files = []; this.dataset = {}; }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase())] = String(value);
  }
  removeAttribute(name) { delete this.attrs[name]; }
  get id() { return this.attrs.id; } set id(value) { this.setAttribute('id',value); }
  get className() { return this.attrs.class || ''; } set className(value) { this.setAttribute('class',value); }
  get value() { return this._value ?? (this.tag === 'select' ? (this.children.find(child => 'selected' in child.attrs) || this.children[0])?.value || '' : this.attrs.value || ''); }
  set value(value) { this._value = String(value); if (this.tag === 'input' && this.attrs.type === 'file' && value === '') this.files = []; }
  get src() { return this.attrs.src; } set src(value) { this.setAttribute('src',value); }
  get isConnected() { return this.connected || !!this.parent?.isConnected; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  after(child) { child.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1,0,child); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('[')) {
      const [, key, value] = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) || [];
      return key in this.attrs && (value === undefined || this.attrs[key] === value);
    }
    return this.tag === selector;
  }
  querySelectorAll(selector) {
    const results = [];
    for (const child of this.children) {
      if (selector.split(',').some(item => child.matches(item))) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); }
  focus() {}
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text || ''; }
  set innerHTML(html) {
    this.html = html; this.children = []; const stack = [this];
    for (const token of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
      const [, closing, tag, attributes] = token;
      if (closing) { if (stack.at(-1).tag === tag) stack.pop(); continue; }
      const child = new Element(tag);
      for (const attr of attributes.matchAll(/([a-z][a-z0-9-]*)(?:="([^"]*)"|='([^']*)')?/gi)) child.setAttribute(attr[1],decode(attr[2] ?? attr[3] ?? ''));
      child.hidden = 'hidden' in child.attrs;
      stack.at(-1).appendChild(child);
      if (!['input','img','br','hr'].includes(tag)) stack.push(child);
    }
  }
  get innerHTML() { return this.html || ''; }
}

function photoFixture(initial = {}) {
  const events = {};
  const requests = [];
  const urls = [];
  const revoked = [];
  const canvases = [];
  const fields = new Element('fieldset'); fields.connected = true;
  fields.innerHTML = `<input name="画像URL" value="${escape(initial.image || '')}"><input name="リンクURL" value="${escape(initial.source || '')}"><input name="タイトル" value="">`;
  let respond = async () => ({ file:{url:'https://drive.google.com/file/d/uploaded_photo_1234/view'} });
  class LocalURL extends URL {
    static createObjectURL(file) { const url = 'blob:fixture-' + urls.length; urls.push({url,file}); return url; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  class Image {
    naturalWidth = 4000; naturalHeight = 2000;
    set src(_url) { queueMicrotask(() => this.onload()); }
  }
  class FileReader {
    readAsDataURL(_blob) { this.result = 'data:image/jpeg;base64,fixture-jpeg'; queueMicrotask(() => this.onload()); }
  }
  const context = vm.createContext({
    console, URL:LocalURL, Image, FileReader, escapeHtml:escape,
    Event:class { constructor(type) { this.type = type; } },
    emptyState:message => `<p>${escape(message)}</p>`,
    document:{
      addEventListener() {}, getElementById:() => null,
      createElement(tag) {
        if (tag !== 'canvas') return new Element(tag);
        const canvas = { getContext:() => ({ fillRect() {},drawImage() {} }), toBlob(resolve,mime) { resolve({size:300000,type:mime}); } };
        canvases.push(canvas); return canvas;
      }
    },
    window:{ addEventListener(type,fn) { events[type] = fn; }, grade2Backend:{
      getStatus:() => ({ uploadEnabled:true,classroomEnabled:true,allowPublicPhotos:false }), isUnlocked:() => true,
      request:async (action,payload) => { requests.push({action,payload}); return respond(action,payload); }
    } }
  });
  vm.runInContext(source('media-display.js'),context);
  vm.runInContext(source('media-editor.js'),context);
  const api = context.window.grade2PhotoEditor;
  const f = {
    api,fields,requests,urls,revoked,canvases,events,
    find:selector => fields.querySelector(selector),
    mount(state, options) { api.mount(fields,state,options); },
    choose(file) { const input = f.find('.photo-file'); input.files = file ? [file] : []; input.dispatchEvent({type:'change'}); },
    click(selector) { const button = f.find(selector); return button.onclick({currentTarget:button,target:button}); },
    setResponder(fn) { respond = fn; }
  };
  f.mount(initial.state,initial.options);
  return f;
}
const file = {name:'学校の写真.jpg',size:4000000,type:'image/jpeg'};
const original = {image:'https://drive.google.com/file/d/original_photo_1234/view',source:'https://classroom.google.com/c/course23/p/weekly'};

test('choosing a photo stays local and its pending file survives a form remount without retaining old blob URLs', () => {
  const f = photoFixture(); f.choose(file);
  assert.equal(f.requests.length,0);
  assert.match(f.find('.photo-selection').textContent,/学校の写真.jpg/);
  assert.equal(f.find('.photo-local-preview').hidden,false);
  const oldUrl = f.find('.photo-local-preview').querySelector('img').src;
  const state = f.api.snapshot();
  f.api.dispose(); assert.ok(f.revoked.includes(oldUrl));
  f.find('.photo-editor').parent.children = f.fields.children.filter(node => !node.matches('.photo-editor'));
  f.mount(state);
  assert.equal(f.api.snapshot().file,file);
  assert.notEqual(f.find('.photo-local-preview').querySelector('img').src,oldUrl);
  f.click('.photo-selection-clear');
  assert.equal(f.api.snapshot().file,null);
  assert.equal(f.find('.photo-local-preview').hidden,true);
  f.choose({...file,size:26*1024*1024});
  assert.equal(f.api.snapshot().file,null);
  assert.match(f.find('.photo-status').textContent,/25MB/);
  assert.equal(f.requests.length,0);
});

test('upload scales the image, freezes selection during the request and replaces an automatic Classroom citation', async () => {
  const f = photoFixture(original); f.choose(file);
  let finish; let started;
  const pending = new Promise(resolve => { started = resolve; });
  f.setResponder((_action,_payload) => new Promise(resolve => { finish = resolve; started(); }));
  const uploading = f.click('.photo-upload'); await pending;
  assert.equal(f.canvases[0].width,2000); assert.equal(f.canvases[0].height,1000);
  assert.ok(f.find('.photo-editor').querySelectorAll('button,input,select').every(node => node.disabled));
  assert.equal(f.requests[0].payload.mimeType,'image/jpeg');
  assert.equal(f.requests[0].payload.sharing,'inherit');
  finish({file:{url:'https://drive.google.com/file/d/uploaded_photo_1234/view'}});
  await uploading;
  assert.equal(f.find('[name="画像URL"]').value,'https://drive.google.com/file/d/uploaded_photo_1234/view');
  assert.equal(f.find('[name="リンクURL"]').value,'');
  assert.equal(f.api.snapshot().file,null);
  assert.equal(f.api.isBusy(),false);
  assert.equal(f.find('.photo-file').disabled,false);
  assert.ok(f.urls.every(({url}) => f.revoked.includes(url)));
});

test('a failed upload keeps the chosen file and original photo available for retry', async () => {
  const f = photoFixture(original); f.choose(file);
  f.setResponder(async () => { throw Error('Driveに接続できません'); });
  await f.click('.photo-upload');
  assert.equal(f.api.snapshot().file,file);
  assert.equal(f.find('[name="画像URL"]').value,original.image);
  assert.equal(f.find('[name="リンクURL"]').value,original.source);
  assert.match(f.find('.photo-status').textContent,/Driveに接続できません/);
  assert.equal(f.find('.photo-upload').disabled,false);
});

test('removing or replacing a photo keeps a source link that the editor changed manually', async () => {
  const f = photoFixture(original);
  f.find('[name="リンクURL"]').value = 'https://example.com/class-notes';
  f.choose(file); await f.click('.photo-upload');
  assert.equal(f.find('[name="リンクURL"]').value,'https://example.com/class-notes');
  f.click('.photo-remove');
  assert.equal(f.find('[name="画像URL"]').value,'');
  assert.equal(f.find('[name="リンクURL"]').value,'https://example.com/class-notes');
});

test('the timetable picker filters names without extra requests and selects the correct original photo', async () => {
  const f = photoFixture({options:{purpose:'timetablePhotos'}});
  assert.equal(f.find('#photoClassroomPanel').hidden,false);
  assert.equal(f.find('.photo-classroom-search').value,'時間割');
  f.setResponder(async action => action === 'classroomCourses' ? {courses:[{id:'course23',name:'2年3組'}]} : {photos:[{name:'美術.jpg',sourceTitle:'作品',url:'https://example.com/art.jpg'}, {name:'配布.jpg',sourceTitle:'今週の週予定',url:original.image,sourceUrl:original.source}],nextPageToken:'next-page'});
  await f.click('.photo-classroom-load');
  assert.equal(f.find('.photo-course').value,'course23');
  assert.equal(f.find('.classroom-photo-list').querySelectorAll('[data-use-photo]').length,1);
  const choice = f.find('[data-use-photo]');
  assert.equal(choice.dataset.usePhoto,'1');
  f.find('.classroom-photo-list').onclick({target:choice});
  assert.equal(f.find('[name="画像URL"]').value,original.image);
  assert.equal(f.find('[name="リンクURL"]').value,original.source);
  assert.equal(f.find('[name="タイトル"]').value,'今週の週予定');
  f.find('.photo-classroom-search').value = '';
  f.find('.photo-classroom-search').dispatchEvent({type:'input'});
  assert.equal(f.find('.classroom-photo-list').querySelectorAll('[data-use-photo]').length,2);
  assert.equal(f.requests.length,2);
  assert.equal(f.api.snapshot().query,'');
  await f.click('.photo-classroom-more');
  assert.equal(f.requests[2].payload.pageToken,'next-page');
});
