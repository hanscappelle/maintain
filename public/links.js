function splitLinks(text) {
  const parts = [];
  const pattern = /https?:\/\/[^\s<>"']+/gi;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    let url = match[0];
    while (url) {
      const last = url.at(-1);
      if (/[.,;:!?]/.test(last)) {
        url = url.slice(0, -1);
      } else if (last === ')' && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) {
        url = url.slice(0, -1);
      } else if (last === ']' && (url.match(/\]/g) || []).length > (url.match(/\[/g) || []).length) {
        url = url.slice(0, -1);
      } else {
        break;
      }
    }
    let valid = false;
    try {
      const parsed = new URL(url);
      valid = (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    if (!valid) continue;
    if (match.index > position) parts.push({ text: text.slice(position, match.index) });
    parts.push({ text: url, url });
    position = match.index + url.length;
  }
  if (position < text.length) parts.push({ text: text.slice(position) });
  return parts;
}

if (typeof module !== 'undefined') module.exports = { splitLinks };
