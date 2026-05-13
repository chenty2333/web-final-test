import { apiFetch } from "../core/api.js";
import { $, setMessage } from "../core/dom.js";
import { html, money } from "../core/format.js";
import state from "../core/state.js";

export async function loadPublicInfo() {
  const data = await apiFetch("/api/public/overview");
  $("#guestSeedCount").textContent = `${data.stats.seed_entries} 条样例`;
  $("#guestCards").innerHTML = [
    `<article class="guest-card"><span>校园角色</span><strong>${data.stats.seed_users}</strong><small>覆盖宿舍、社团、学习和兼职等生活场景</small></article>`,
    `<article class="guest-card"><span>公共分类</span><strong>${data.stats.seed_categories}</strong><small>${data.sample_categories.map((c) => c.name).slice(0, 3).join("、")} 等</small></article>`,
    `<article class="guest-card"><span>记账建议</span><strong>${data.tips.length}</strong><small>${html(data.tips[0])}</small></article>`,
  ].join("");

  const categories = await apiFetch("/api/public/categories");
  state.categories = categories.categories || [];
  renderCategoryOptions();
}

export function renderCategoryOptions() {
  const select = $('select[name="category_id"]');
  if (select) {
    select.innerHTML = state.categories
      .map((cat) => `<option value="${cat.id}">${html(cat.name)} · 月限 ${money(cat.monthly_limit)}</option>`)
      .join("");
  }
  const filter = $("#categoryFilter");
  if (filter) {
    const current = filter.value;
    filter.innerHTML = `<option value="">全部分类</option>${state.categories
      .map((cat) => `<option value="${cat.id}">${html(cat.name)}</option>`)
      .join("")}`;
    filter.value = current;
  }
}

export function showBootError(error) {
  console.error(error);
  document.body.insertAdjacentHTML("beforeend", `<div class="message">${html(error.message)}</div>`);
  setMessage("#authMessage", error.message);
}
