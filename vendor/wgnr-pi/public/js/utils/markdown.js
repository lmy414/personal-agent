export function md(text) {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text, { async: false }));
}

export function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
