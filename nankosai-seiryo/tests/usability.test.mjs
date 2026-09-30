import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectSlots,projectSummary,favoriteSlots,overlappingSlots,matchesSearch} from '../js/festival-data.js';
import {validateRecord,validateSettings,validDate} from '../js/schema.js';
import {eventState,japanNow,escapeHTML} from '../js/utils.js';

const seed=JSON.parse(fs.readFileSync(new URL('../data/demo.json',import.meta.url),'utf8'));
const exhibit={id:'exhibit',title:'展示',status:'published',dates:'2027-07-10,2027-07-11',start:'09:00',end:'16:00',locationId:'cafe'};
const stage={...exhibit,id:'stage',title:'吹奏楽部ステージ'};
const event={id:'event',projectId:'stage',status:'published',date:'2027-07-11',start:'13:00',end:'13:30',locationId:'gym',title:'変更後のステージ'};
const fixture=()=>({projects:[exhibit,stage],schedule:[event]});

test('変更した開催日・時刻・場所を関連企画へ反映する',()=>{
 const slots=projectSlots(stage,fixture());assert.equal(slots.length,1);assert.equal(slots[0].date,'2027-07-11');
 assert.equal(projectSummary(stage,fixture()).start,'13:00');assert.equal(projectSummary(stage,fixture()).locationId,'gym');
 assert.equal(projectSlots(stage,fixture(),'2027-07-10').length,0);
});
test('関連する公開時刻表がない展示は本来の開催日を使う',()=>{
 const data={...fixture(),schedule:[{...event,status:'draft'},{...event,id:'deleted',deletedAt:'2026-10-01'}]};
 assert.equal(projectSlots(stage,data).length,2);assert.equal(projectSummary(stage,data).start,'09:00');
});
test('中止したステージが終日開催へ戻らない',()=>{
 const data={...fixture(),schedule:[{...event,cancelled:true}]};const summary=projectSummary(stage,data,'2027-07-11');
 assert.equal(summary.cancelled,true);assert.equal(eventState(summary.slots[0],{date:'2027-07-11',time:'13:05'}),'cancelled');
});
test('複数回公演では中止していない回をカードへ優先表示する',()=>{
 const data={...fixture(),schedule:[{...event,cancelled:true},{...event,id:'later',start:'14:00',end:'14:30'}]};
 assert.equal(projectSummary(stage,data).start,'14:00');assert.equal(projectSummary(stage,data).cancelled,false);assert.equal(projectSummary(stage,data).multiple,true);
});
test('お気に入りの予定は日別・時刻順で、下書きと削除済みを除く',()=>{
 const data={...fixture(),projects:[exhibit,stage,{...stage,id:'draft',status:'draft'},{...stage,id:'deleted',deletedAt:'2026-10-01'}]};
 const favorites=new Set(['stage','exhibit','draft','deleted']);const day=favoriteSlots(data,favorites,'2027-07-11');
 assert.deepEqual(day.map(item=>item.project.id),['exhibit','stage']);assert.equal(favoriteSlots(data,favorites).length,3);
});
test('重なる公演を検出し、展示・別日・中止・隣接時刻は除外する',()=>{
 const slots=[{...event,scheduled:true},{...event,id:'overlap',start:'13:15',end:'13:45',scheduled:true},{...event,id:'next',start:'13:45',end:'14:00',scheduled:true},{...event,id:'cancelled',cancelled:true,scheduled:true},{...event,id:'tomorrow',date:'2027-07-12',scheduled:true},{...event,id:'exhibit',start:'09:00',end:'16:00',scheduled:false}];
 assert.deepEqual([...overlappingSlots(slots)].sort(),['event','overlap']);
});
test('検索は全角・大文字・複数語・余白を正規化する',()=>{
 assert.ok(matchesSearch(['2年3組','深海からの脱出'],' ２年３組　深海 '));assert.ok(matchesSearch(['SUMMER LIVE','軽音楽部'],'summer live'));assert.ok(!matchesSearch(['2年3組','深海'],'２年３組 喫茶'));
});
test('企画・お知らせ・時刻表・場所の下書きは名前だけで保存できる',()=>{
 for(const collection of ['projects','news','schedule','locations'])assert.doesNotThrow(()=>validateRecord(collection,{status:'draft',[collection==='locations'?'name':'title']:'準備中'},seed));
});
test('公開企画には運営に必要な情報を要求する',()=>{
 assert.throws(()=>validateRecord('projects',{title:'未完成',status:'published'},seed));assert.throws(()=>validateRecord('news',{title:'見出し',body:'本文',status:'published'},seed));
});
test('入力された不正時刻・架空の日付は下書きでも拒否する',()=>{
 assert.throws(()=>validateRecord('schedule',{title:'準備中',status:'draft',start:'25:00'},seed));assert.throws(()=>validateRecord('schedule',{title:'準備中',status:'draft',date:'2027-02-30'},seed));
 assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2027-02-29'),false);
});
test('公開中の場所・企画を下書きにして参照を壊す操作を拒否する',()=>{
 const location=seed.locations.find(place=>seed.projects.some(project=>project.locationId===place.id&&project.status==='published'));
 assert.throws(()=>validateRecord('locations',{...location,status:'draft'},seed),/使用しています/);
 const project=seed.projects.find(project=>seed.schedule.some(event=>event.projectId===project.id&&event.status==='published'));
 assert.throws(()=>validateRecord('projects',{...project,status:'draft'},seed),/使用しています/);
});
test('日付リストの余白と重複を取り除く',()=>{
 const draft=validateRecord('projects',{title:'準備中',status:'draft',dates:'2027-07-10, 2027-07-10,2027-07-11'},seed);assert.equal(draft.dates,'2027-07-10,2027-07-11');
 const settings=validateSettings({...seed.settings,eventDates:'2027-07-10, 2027-07-10'});assert.equal(settings.eventDates,'2027-07-10');
});
test('開催中の判定は日本時間の開始を含み終了を含まない',()=>{
 assert.deepEqual(japanNow(new Date('2027-07-10T00:00:00Z')),{date:'2027-07-10',time:'09:00'});
 assert.equal(eventState(exhibit,{date:'2027-07-10',time:'09:00'}),'live');assert.equal(eventState(exhibit,{date:'2027-07-10',time:'16:00'}),'ended');
});
test('危険なHTMLを文字として表示する',()=>{assert.equal(escapeHTML('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');});
