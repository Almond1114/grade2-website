import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function files(directory){return fs.readdirSync(path.join(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name).replaceAll('\\','/')]);}
const assets=['index.html','admin.html','manifest.webmanifest',...['assets','css','js','data'].flatMap(files)].sort();
const hash=crypto.createHash('sha256');for(const asset of assets){hash.update(asset);hash.update(fs.readFileSync(path.join(root,asset)));}
const version=hash.digest('hex').slice(0,12),file=path.join(root,'sw.js');
const source=fs.readFileSync(file,'utf8').replace(/const CACHE_NAME = CACHE_PREFIX \+ '[^']+';/,`const CACHE_NAME = CACHE_PREFIX + '${version}';`).replace(/const ASSETS = \[[^\n]+\];/,`const ASSETS = ${JSON.stringify(['./',...assets.map(asset=>'./'+asset)])};`);
fs.writeFileSync(file,source);console.log(`PWA cache ${version}: ${assets.length+1} assets`);
