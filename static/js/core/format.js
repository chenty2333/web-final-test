export function money(value) {
  return Number(value || 0).toFixed(2);
}

export function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

function inlineRichText(value) {
  return html(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\\\((.+?)\\\)/g, '<span class="math">$1</span>')
    .replace(/\$([^$\n]+)\$/g, '<span class="math">$1</span>');
}

export function richText(value) {
  const lines = String(value ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let list = null;
  const closeList = () => {
    if (list) {
      blocks.push(`</${list}>`);
      list = null;
    }
  };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      return;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 2, 5);
      blocks.push(`<h${level}>${inlineRichText(heading[2])}</h${level}>`);
      return;
    }
    const ordered = trimmed.match(/^\d+[.、]\s+(.+)$/);
    if (ordered) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        blocks.push("<ol>");
      }
      blocks.push(`<li>${inlineRichText(ordered[1])}</li>`);
      return;
    }
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        blocks.push("<ul>");
      }
      blocks.push(`<li>${inlineRichText(unordered[1])}</li>`);
      return;
    }
    closeList();
    blocks.push(`<p>${inlineRichText(trimmed)}</p>`);
  });
  closeList();
  return blocks.join("");
}
