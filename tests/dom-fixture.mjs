const decode = value => value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');

// イベントとフォーム値の境界を検証する小さなDOM。描画やブラウザ互換性は扱いません。
export class Element {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.listeners = {}; this.disabled = false; this.checked = false; this.hidden = false; this.files = []; this.dataset = {}; }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase())] = String(value);
  }
  removeAttribute(name) { delete this.attrs[name]; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  get id() { return this.attrs.id; } set id(value) { this.setAttribute('id',value); }
  get className() { return this.attrs.class || ''; } set className(value) { this.setAttribute('class',value); }
  get classList() {
    const set = () => new Set(this.className.split(/\s+/).filter(Boolean));
    return {
      contains:name => set().has(name),
      add:(...names) => { this.className = [...new Set([...set(),...names])].join(' '); },
      remove:(...names) => { this.className = [...set()].filter(name => !names.includes(name)).join(' '); },
      toggle:(name,force) => { const values = set(); const add = force ?? !values.has(name); add ? values.add(name) : values.delete(name); this.className = [...values].join(' '); }
    };
  }
  get tagName() { return this.tag.toUpperCase(); }
  get ownerDocument() { return this.document || this.parent?.ownerDocument || null; }
  get style() { return {setProperty() {},removeProperty() {}}; }
  get value() { return this._value ?? (this.tag === 'select' ? (this.children.find(child => 'selected' in child.attrs) || this.children[0])?.value || '' : this.attrs.value || ''); }
  set value(value) { this._value = String(value); if (this.tag === 'input' && this.attrs.type === 'file' && value === '') this.files = []; }
  get src() { return this.attrs.src; } set src(value) { this.setAttribute('src',value); }
  get isConnected() { return this.connected || !!this.parent?.isConnected; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  after(child) { child.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1,0,child); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.includes('[')) {
      const [, tag, key, value] = selector.match(/^([a-z]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/) || [];
      return (!tag || this.tag === tag) && key in this.attrs && (value === undefined || this.attrs[key] === value);
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
  click() { const event = {type:'click',target:this,currentTarget:this,preventDefault() {}}; this.dispatchEvent(event); this.onclick?.(event); }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
  set textContent(value) { this.text = String(value); this.children.forEach(child => {child.parent = null;}); this.children = []; }
  get textContent() { return this.text || ''; }
  set innerHTML(html) {
    this.html = html; this.children.forEach(child => {child.parent = null;}); this.children = []; const stack = [this];
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
