const paths = {
  wind:'M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h6',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  map:'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Zm0 0v15m6-12v15',
  star:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9L12 3Z',
  pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  menu:'M4 6h16M4 12h16M4 18h16', close:'m6 6 12 12M18 6 6 18',
  alert:'m12 3 10 18H2L12 3Zm0 6v5m0 3v.2',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  news:'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4',
  image:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M17 7h.1',
  settings:'M4 7h16M4 17h16M8 3v8M16 13v8',
  history:'M3 4v5h5M3 9a9 9 0 1 1-.5 6M12 7v5l3 2',
  plus:'M12 4v16M4 12h16', check:'m5 12 4 4L19 6',
  edit:'m15 4 5 5M4 16 16 4a2 2 0 0 1 4 4L8 20H4v-4Z',
  logout:'M9 3H3v18h6M9 12h12m-4-4 4 4-4 4',
};
export function icon(name, extra = '') {
  return `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.wind}"/></svg>`;
}
