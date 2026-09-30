const text = (value, max = 4000) => {
  if (typeof value !== 'string' || value.length > max) throw new Error('入力内容が長すぎるか不正です。');
  return value.trim();
};
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}

export function validateRecord(collection, record, data) {
  if (!['projects','news','schedule','locations'].includes(collection)) throw new Error('操作対象が不正です。');
  const value = {...record}; value.status ||= 'draft';
  if (!['draft','published'].includes(value.status)) throw new Error('公開状態が不正です。');
  const titleField = collection === 'locations' ? 'name' : 'title';
  const required = value.status === 'draft' ? [titleField] :
    collection === 'locations' ? ['name','floor'] : collection === 'news' ? ['title','body','publishAt'] :
    collection === 'schedule' ? ['title','date','start','end','locationId','category'] :
    ['title','organization','group','category','locationId','dates','start','end','description'];
  for (const field of required) if (!String(value[field] || '').trim()) throw new Error(value.status === 'draft' ? '下書きの名前を入力してください。' : '公開するには必須項目をすべて入力してください。');
  for (const field of ['title','organization','group','category','name']) if (field in value) value[field] = text(value[field], 120);
  for (const field of ['description','body']) if (field in value) value[field] = text(value[field], 4000);
  for (const field of ['start','end']) if (value[field] && !validTime(value[field])) throw new Error('時刻をHH:mmで入力してください。');
  if (value.start && value.end && value.end <= value.start) throw new Error('終了時刻は開始時刻より後にしてください。');
  const dates = value.dates ? String(value.dates).split(',').map(item => item.trim()) : value.date ? [value.date] : [];
  if (dates.length > 30 || dates.some(date => !validDate(date))) throw new Error('日付をYYYY-MM-DDで入力してください。複数日はカンマで区切ります。');
  if (value.dates) value.dates = [...new Set(dates)].join(',');
  if (value.locationId && !data.locations.some(item => item.id === value.locationId && !item.deletedAt && (value.status !== 'published' || item.status === 'published'))) throw new Error('公開中の場所を選択してください。');
  if (collection === 'projects' && value.crowd && !['quiet','normal','busy'].includes(value.crowd)) throw new Error('混雑状況を選択してください。');
  if (collection === 'projects') value.crowd ||= 'normal';
  if (value.mediaId && !data.media.some(item => item.id === value.mediaId && !item.deletedAt)) throw new Error('画像を選び直してください。');
  if (value.projectId && !data.projects.some(item => item.id === value.projectId && !item.deletedAt && (value.status !== 'published' || item.status === 'published'))) throw new Error('関連する公開中の企画を選択してください。');
  if (collection === 'locations' && value.floor && !['1F','2F','3F'].includes(value.floor)) throw new Error('フロアが不正です。');
  if (value.publishAt) {
    if (Number.isNaN(Date.parse(value.publishAt))) throw new Error('公開日時が不正です。');
    value.publishAt = new Date(value.publishAt).toISOString();
  }
  if (value.id && value.status === 'draft') {
    const references = collection === 'locations' ? [...data.projects,...data.schedule].filter(item => item.locationId === value.id) :
      collection === 'projects' ? data.schedule.filter(item => item.projectId === value.id) : [];
    if (references.some(item => item.status === 'published' && !item.deletedAt)) throw new Error('公開中の企画・時刻表で使用しています。関連項目を先に下書きへ戻してください。');
  }
  return value;
}

export function validateSettings(settings) {
  const dates = String(settings.eventDates || '').split(',').map(value => value.trim());
  if (!dates.length || dates.length > 30 || dates.some(value => !validDate(value))) throw new Error('開催日をYYYY-MM-DDで入力してください。');
  if (!validTime(settings.openTime) || !validTime(settings.closeTime) || settings.openTime >= settings.closeTime) throw new Error('開場・閉場時刻を確認してください。');
  const emergencyText = text(String(settings.emergencyText || ''), 300), admissionText = text(String(settings.admissionText || ''), 4000);
  if (settings.emergencyEnabled && !emergencyText) throw new Error('緊急バナーの文面を入力してください。');
  return {...settings,eventDates:[...new Set(dates)].join(','),emergencyText,admissionText};
}
