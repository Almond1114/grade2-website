import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url),worker=fs.readFileSync(new URL('sw.js',root),'utf8');
const version=worker.match(/CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1];
test('HTMLのCSS・JavaScript参照は同じ公開版を使う',()=>{
 for(const name of ['index.html','admin.html','tests/browser.html']){
  const file=new URL(name,root),source=fs.readFileSync(file,'utf8');
  for(const [,reference] of source.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)){
   const url=new URL(reference,file);assert.equal(url.searchParams.get('v'),version,reference);assert.ok(fs.existsSync(url),reference);
  }
 }
});
test('ES Moduleの依存先も同じ版と実在するファイルを使う',()=>{
 const names=fs.readdirSync(new URL('js/',root)).filter(name=>name.endsWith('.js')).map(name=>'js/'+name).concat('tests/browser-tests.js');
 for(const name of names){const file=new URL(name,root),source=fs.readFileSync(file,'utf8');
  for(const [,reference] of source.matchAll(/from\s*['"]([^'"]+\.js(?:\?[^'"]*)?)['"]/g)){
   const url=new URL(reference,file);assert.equal(url.searchParams.get('v'),version,`${name}: ${reference}`);assert.ok(fs.existsSync(url),reference);
  }
 }
});
test('PWAの事前保存資材に欠けたファイルがない',()=>{
 const assets=JSON.parse(worker.match(/const ASSETS = (\[[^\n]+\]);/)[1]);
 for(const asset of assets)assert.ok(fs.existsSync(new URL(asset,root)),asset);
});
