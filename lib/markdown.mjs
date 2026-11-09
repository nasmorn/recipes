// Just enough Markdown for recipe prose: paragraphs, bullet and numbered
// lists, ### headings, **bold**, *italic*, [links](url). Everything is escaped.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function renderMarkdown(md) {
  const out = [];
  let para = [];
  let list = null; // { tag, items }
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };

  for (const line of md.split('\n')) {
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^#{3,6}\s+(.+)$/))) { flushPara(); flushList(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = line.match(/^\s*[*-]\s+(.+)$/)) || (m = line.match(/^\s*\d+\.\s+(.+)$/))) {
      const tag = /^\s*\d/.test(line) ? 'ol' : 'ul';
      flushPara();
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(m[1]);
      continue;
    }
    if (list) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join('\n');
}
