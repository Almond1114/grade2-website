const rendered = new WeakMap();

/** Avoid replacing unchanged content and preserve the focused control on a live update. */
export function renderHTML(container, html) {
  if (rendered.get(container) === html) return false;
  const active = container.ownerDocument.activeElement;
  let selector = '';
  if (active && container.contains(active)) {
    if (active.id) selector = `#${CSS.escape(active.id)}`;
    else {
      for (const key of ['favorite', 'project', 'event', 'location', 'floor']) {
        if (active.dataset[key]) { selector = `[data-${key}="${CSS.escape(active.dataset[key])}"]`; break; }
      }
    }
  }
  container.innerHTML = html; rendered.set(container, html);
  if (selector) container.querySelector(selector)?.focus({preventScroll: true});
  return true;
}

export function scrollToSection(element, {focus = true} = {}) {
  element.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  if (focus) {
    const target = element.querySelector('h2, h3') || element;
    target.tabIndex = -1; target.focus({preventScroll: true});
  }
}
