import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
import { Element } from './dom-fixture.mjs';

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
  f.find('.photo-editor').remove();
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
