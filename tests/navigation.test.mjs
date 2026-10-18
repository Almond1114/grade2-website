import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Element } from './dom-fixture.mjs';
const source = fs.readFileSync(new URL('../ux-enhancements.js',import.meta.url),'utf8');

function navigationFixture(page = 'home') {
  const html = new Element('html'); html.connected = true; html.scrollHeight = 1000;
  const body = new Element('body'); body.dataset.page = page; html.appendChild(body);
  body.innerHTML = '<header class="site-header"><div class="header-tools"></div></header>';
  const keys = {};
  const document = {
    body,documentElement:html,readyState:'complete',activeElement:body,
    createElement:tag => { const element = new Element(tag); element.document = document; return element; },
    querySelector:selector => html.querySelector(selector),querySelectorAll:selector => html.querySelectorAll(selector),addEventListener() {}
  };
  html.document = document;
  vm.runInNewContext(source,{document,window:{},innerHeight:700,scrollY:0,addEventListener:(type,fn) => {keys[type] = fn;} });
  return {document,find:selector => document.querySelector(selector),key:event => keys.keydown(event)};
}

test('mobile navigation has four direct school links plus one menu, with the current page identified', () => {
  const f = navigationFixture('homework');
  const nav = f.find('.mobile-nav');
  assert.equal(nav.children.length,5);
  assert.deepEqual(nav.querySelectorAll('a').map(link => link.getAttribute('href')),['index.html','class-2-3.html','homework.html','announcements.html']);
  assert.equal(nav.querySelector('[aria-current="page"]').getAttribute('href'),'homework.html');
  assert.equal(f.find('.mobile-menu-more').getAttribute('aria-controls'),'grade2QuickMenu');
});

test('the phone menu opens without the search keyboard, exposes all pages and restores focus on Escape', () => {
  const f = navigationFixture();
  const more = f.find('.mobile-menu-more'); more.focus(); more.click();
  assert.equal(more.getAttribute('aria-expanded'),'true');
  assert.equal(f.document.activeElement.tagName,'A');
  assert.equal(f.document.documentElement.classList.contains('ux-menu-open'),true);
  const links = f.find('.ux-palette-list').querySelectorAll('a');
  assert.equal(links.length,8);
  assert.ok(links.some(link => link.getAttribute('href') === 'edit.html'));
  assert.ok(links.some(link => link.getAttribute('href') === 'tests.html'));
  assert.ok(links.every(link => !link.getAttribute('href').includes('fps-game')));
  f.key({key:'Escape'});
  assert.equal(more.getAttribute('aria-expanded'),'false');
  assert.equal(f.document.activeElement,more);
  assert.equal(f.document.documentElement.classList.contains('ux-menu-open'),false);
});

test('menu keyboard focus stays in the dialog, including when a search returns no pages', () => {
  const f = navigationFixture(); f.find('.mobile-menu-more').click();
  const overlay = f.find('.ux-palette');
  const input = overlay.querySelector('input');
  input.focus();
  let prevented = false;
  overlay.dispatchEvent({type:'keydown',key:'Tab',shiftKey:true,preventDefault() {prevented = true;} });
  assert.equal(prevented,true);
  assert.equal(f.document.activeElement,f.find('.ux-palette-list').querySelectorAll('a').at(-1));
  overlay.dispatchEvent({type:'keydown',key:'Tab',preventDefault() {}});
  assert.equal(f.document.activeElement,input);
  input.value = '一致するページなし'; input.dispatchEvent({type:'input'});
  assert.equal(f.find('.ux-palette-list').querySelectorAll('a').length,0);
  f.find('.ux-palette-close').focus();
  overlay.dispatchEvent({type:'keydown',key:'Tab',preventDefault() {}});
  assert.equal(f.document.activeElement,input);
});
