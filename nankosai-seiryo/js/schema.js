const text=(value,max=4000)=>{if(typeof value!=='string'||value.length>max)throw new Error('入力内容が長すぎるか不正です。');return value.trim();};
export function validateRecord(collection,record,data) {
 const value={...record};value.status=value.status||'draft';if(!['draft','published'].includes(value.status))throw new Error('公開状態が不正です。');
 const required=collection==='locations'?['name','floor']:collection==='news'?['title','body']:collection==='schedule'?['title','date','start','end','locationId']:['title','organization','group','category','locationId','dates','start','end','description'];
 for(const field of required)if(!String(value[field]||'').trim())throw new Error('必須項目をすべて入力してください。');
 for(const field of ['title','organization','group','category','name'])if(field in value)value[field]=text(value[field],120);
 for(const field of ['description','body'])if(field in value)value[field]=text(value[field],4000);
 if(value.start){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.end)||value.end<=value.start)throw new Error('終了時刻は開始時刻より後にしてください。同日内の時刻を指定します。');}
 const dates=value.dates?value.dates.split(',').map(item=>item.trim()):value.date?[value.date]:[];
 if(dates.length>30||dates.some(date=>!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))throw new Error('日付をYYYY-MM-DDで入力してください。複数日はカンマで区切ります。');
 if(value.dates)value.dates=[...new Set(dates)].join(',');
 if(value.locationId&&!data.locations.some(item=>item.id===value.locationId&&!item.deletedAt&&(value.status!=='published'||item.status==='published')))throw new Error('公開中の場所を選択してください。');
 if(collection==='projects'&&!['quiet','normal','busy'].includes(value.crowd))throw new Error('混雑状況を選択してください。');
 if(value.mediaId&&!data.media.some(item=>item.id===value.mediaId&&!item.deletedAt))throw new Error('画像を選び直してください。');
 if(value.projectId&&!data.projects.some(item=>item.id===value.projectId&&!item.deletedAt&&(value.status!=='published'||item.status==='published')))throw new Error('関連する公開中の企画を選択してください。');
 if(collection==='locations'&&!['1F','2F','3F'].includes(value.floor))throw new Error('フロアが不正です。');
 if(value.publishAt&&Number.isNaN(Date.parse(value.publishAt)))throw new Error('公開日時が不正です。');
 return value;
}

export function validateSettings(settings) {
 const dates=String(settings.eventDates||'').split(',').map(value=>value.trim());
 if(!dates.length||dates.length>30||dates.some(value=>!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value))throw new Error('開催日をYYYY-MM-DDで入力してください。');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.openTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.closeTime)||settings.openTime>=settings.closeTime)throw new Error('開場・閉場時刻を確認してください。');
 const emergencyText=text(String(settings.emergencyText||''),300),admissionText=text(String(settings.admissionText||''),4000);
 if(settings.emergencyEnabled&&!emergencyText)throw new Error('緊急バナーの文面を入力してください。');
 return {...settings,eventDates:[...new Set(dates)].join(','),emergencyText,admissionText};
}
