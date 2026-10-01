import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function files(directory){return fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name).replaceAll('\\','/')]);}
const assets=['index.html','admin.html','manifest.webmanifest',...['assets','css','js','data'].flatMap(files)].sort();
const buildFiles=[...assets,'tests/browser.html','tests/browser-tests.js'];
const moduleReference=/((?:from\s*|import\s*)['"])([^'"]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?(['"])/g;
const htmlReference=/((?:src|href)=['"])([^'"]+\.(?:js|css))(?:\?v=[a-zA-Z0-9_-]+)?(['"])/g;
function versionReferences(source,version){
 const rewrite=(_,prefix,url,suffix)=>prefix+url+(version?'?v='+version:'')+suffix;
 return source.replace(moduleReference,rewrite).replace(htmlReference,rewrite);
}
// Hash normalized references to make repeat builds stable; the generated query never hashes itself.
const normalized=new Map(),hash=crypto.createHash('sha256');
for(const asset of buildFiles){
 hash.update(asset);const content=fs.readFileSync(path.join(root,asset));
 if(/\.(?:html|js)$/.test(asset)){const text=versionReferences(content.toString('utf8'),'');normalized.set(asset,text);hash.update(text);}else hash.update(content);
}
const file=path.join(root,'sw.js'),worker=fs.readFileSync(file,'utf8');
hash.update(worker.replace(/const CACHE_NAME = CACHE_PREFIX \+ '[^']+';/,'').replace(/const ASSETS = \[[^\n]+\];/,''));
const version=hash.digest('hex').slice(0,12);
for(const [asset,content] of normalized)fs.writeFileSync(path.join(root,asset),versionReferences(content,version));
const source=worker.replace(/const CACHE_NAME = CACHE_PREFIX \+ '[^']+';/,`const CACHE_NAME = CACHE_PREFIX + '${version}';`).replace(/const ASSETS = \[[^\n]+\];/,`const ASSETS = ${JSON.stringify(['./',...assets.map(asset=>'./'+asset)])};`);
fs.writeFileSync(file,source);console.log(`PWA cache and asset URLs ${version}: ${assets.length+1} assets`);
