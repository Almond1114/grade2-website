import {asBool, projectDates} from './utils.js?v=f4753749f056';

/** A timetable entry is the authority for a linked project's date, time and venue. */
export function projectSlots(project, data, date = '') {
  const linked = (data.schedule || []).filter(event => event.projectId === project.id && !event.deletedAt && event.status === 'published');
  const slots = linked.length ? linked.map(event => ({...event, project, scheduled: true})) :
    projectDates(project).map(day => ({...project, date: day, project, scheduled: false}));
  return slots.filter(slot => !date || slot.date === date).sort(compareSlots);
}

export function compareSlots(left, right) {
  return `${left.date || ''}${left.start || ''}`.localeCompare(`${right.date || ''}${right.start || ''}`) ||
    String(left.title || '').localeCompare(String(right.title || ''), 'ja');
}

export function projectSummary(project, data, date = '') {
  const slots = projectSlots(project, data, date);
  const first = slots.find(slot => !asBool(slot.cancelled)) || slots[0];
  return {
    slots,
    locationId: first?.locationId || project.locationId,
    start: first?.start || project.start,
    end: first?.end || project.end,
    cancelled: slots.length > 0 && slots.every(slot => asBool(slot.cancelled)),
    multiple: slots.length > 1 && new Set(slots.map(slot => `${slot.start}/${slot.end}/${slot.locationId}`)).size > 1,
  };
}

export function favoriteSlots(data, favorites, date = '') {
  return data.projects.filter(project => project.status === 'published' && !project.deletedAt && favorites.has(project.id))
    .flatMap(project => projectSlots(project, data, date)).sort(compareSlots);
}

/** Only timed stage entries conflict; an all-day exhibit can be visited at any time. */
export function overlappingSlots(slots) {
  const conflicts = new Set();
  const active = slots.filter(slot => slot.scheduled && !asBool(slot.cancelled));
  for (let index = 0; index < active.length; index++) {
    for (const other of active.slice(index + 1)) {
      const slot = active[index];
      if (slot.date === other.date && slot.start < other.end && other.start < slot.end) {
        conflicts.add(slot.id); conflicts.add(other.id);
      }
    }
  }
  return conflicts;
}

export function normalizedSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ja').trim();
}

export function matchesSearch(values, query) {
  const text = normalizedSearch(values.filter(Boolean).join(' '));
  return normalizedSearch(query).split(/\s+/).filter(Boolean).every(term => text.includes(term));
}
