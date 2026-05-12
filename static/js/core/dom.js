export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function setMessage(selector, text) {
  const el = $(selector);
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}
