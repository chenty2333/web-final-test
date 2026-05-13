import { apiFetch } from "../core/api.js";
import { $, setMessage } from "../core/dom.js";
import { html, money, queryString, todayISO } from "../core/format.js";
import state from "../core/state.js";
import { renderCategoryOptions } from "./catalog.js";

export async function loadLedgerSettings() {
  const [categoryData, optionData] = await Promise.all([
    apiFetch("/api/categories"),
    apiFetch("/api/entry-options"),
  ]);
  state.categories = categoryData.categories || [];
  state.entryOptions = optionData.options || [];
  state.ledgerSettingsLoaded = true;
  renderCategoryOptions();
  renderEntryDatalists();
  renderCategoryManager();
  renderOptionManager();
}

export async function loadEntries(page = state.entryPage || 1) {
  if (!state.ledgerSettingsLoaded) {
    await loadLedgerSettings();
  }
  const kind = $("#kindFilter").value;
  const categoryId = $("#categoryFilter").value;
  const month = $("#entryMonthFilter").value;
  state.entryPage = page;
  const data = await apiFetch(`/api/entries${queryString({
    kind,
    category_id: categoryId,
    month,
    page,
    page_size: 6,
  })}`);
  state.entries = data.entries || [];
  state.entriesPagination = data.pagination || null;
  renderEntryList();
}

export function resetEntryForm() {
  const form = $("#entryForm");
  form.reset();
  form.elements.entry_id.value = "";
  form.elements.spent_at.value = todayISO();
  $("#entryFormTitle").textContent = "新增账目";
  setMessage("#entryMessage", "");
}

export async function saveEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const entryId = payload.entry_id;
  delete payload.entry_id;
  try {
    await apiFetch(entryId ? `/api/entries/${entryId}` : "/api/entries", {
      method: entryId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    resetEntryForm();
    await loadEntries(entryId ? state.entryPage : 1);
    setMessage("#entryMessage", "");
  } catch (error) {
    setMessage("#entryMessage", error.message);
  }
}

export function editEntry(entryId) {
  const entry = state.entries.find((item) => item.id === Number(entryId));
  if (!entry) return;
  const form = $("#entryForm");
  form.elements.entry_id.value = entry.id;
  form.elements.title.value = entry.title;
  form.elements.amount.value = entry.amount;
  form.elements.category_id.value = entry.category_id;
  form.elements.kind.value = entry.kind;
  form.elements.spent_at.value = entry.spent_at;
  form.elements.scene.value = entry.scene;
  form.elements.mood.value = entry.mood;
  form.elements.note.value = entry.note;
  $("#entryFormTitle").textContent = "修改账目";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export async function deleteEntry(entryId) {
  if (!confirm("确定删除这条账目吗？")) return;
  await apiFetch(`/api/entries/${entryId}`, { method: "DELETE" });
  await loadEntries(state.entryPage);
}

export async function changePage(direction) {
  const pager = state.entriesPagination || { page: 1 };
  const nextPage = direction === "next" ? pager.page + 1 : pager.page - 1;
  await loadEntries(nextPage);
}

function renderEntryList() {
  $("#entryList").innerHTML = state.entries
    .map((entry) => {
      const cls = entry.kind === "income" ? "amount-income" : "amount-expense";
      const sign = entry.kind === "income" ? "+" : "-";
      const meta = [entry.category.name, entry.scene, entry.mood, entry.spent_at].filter(Boolean).map(html).join(" · ");
      return `
        <article class="entry-card">
          <div class="entry-main">
            <strong>${html(entry.title)} <span class="${cls}">${sign}${money(entry.amount)}</span></strong>
            <p>${meta}</p>
            <p>${html(entry.note || "无备注")}</p>
          </div>
          <div class="entry-actions">
            <button class="ghost-btn" data-edit-entry="${entry.id}">修改</button>
            <button class="danger-btn" data-delete-entry="${entry.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("") || `<p>暂无账目，先新增一笔。</p>`;
  renderEntryPager();
}

function renderEntryPager() {
  const pager = state.entriesPagination;
  if (!pager) {
    $("#entryPager").innerHTML = "";
    return;
  }
  $("#entryPager").innerHTML = `
    <button type="button" data-page="prev" ${pager.has_prev ? "" : "disabled"}>上一页</button>
    <span>第 ${pager.page} / ${pager.pages} 页，共 ${pager.total} 条</span>
    <button type="button" data-page="next" ${pager.has_next ? "" : "disabled"}>下一页</button>
  `;
}

function renderEntryDatalists() {
  const scenes = state.entryOptions.filter((item) => item.kind === "scene");
  const moods = state.entryOptions.filter((item) => item.kind === "mood");
  $("#sceneOptions").innerHTML = scenes.map((item) => `<option value="${html(item.name)}"></option>`).join("");
  $("#moodOptions").innerHTML = moods.map((item) => `<option value="${html(item.name)}"></option>`).join("");
}

function renderCategoryManager() {
  const custom = state.categories.filter((item) => item.user_owned);
  $("#categoryManager").innerHTML = state.categories
    .map((cat) => `
      <div class="chip-row">
        <span class="color-dot" style="background:${html(cat.color)}"></span>
        <strong>${html(cat.icon)} ${html(cat.name)}</strong>
        <small>月预算 ${money(cat.monthly_limit)}${cat.user_owned ? "" : " · 公共"}</small>
        ${cat.user_owned ? `
          <button class="ghost-btn" type="button" data-edit-category="${cat.id}">编辑</button>
          <button class="danger-btn" type="button" data-delete-category="${cat.id}">删除</button>
        ` : ""}
      </div>
    `)
    .join("");
  if (!custom.length) {
    $("#categoryMessage").classList.add("hidden");
  }
}

function renderOptionManager() {
  const groups = {
    scene: state.entryOptions.filter((item) => item.kind === "scene"),
    mood: state.entryOptions.filter((item) => item.kind === "mood"),
  };
  $("#optionManager").innerHTML = [
    ["常用场景", groups.scene],
    ["常用心情", groups.mood],
  ]
    .map(([label, rows]) => `
      <div class="option-group">
        <strong>${label}</strong>
        <div class="chips">
          ${rows.map((item) => `<button class="chip" type="button" data-delete-option="${item.id}">${html(item.name)} ×</button>`).join("") || "<small>暂无</small>"}
        </div>
      </div>
    `)
    .join("");
}

export function editCategory(categoryId) {
  const category = state.categories.find((item) => item.id === Number(categoryId));
  if (!category || !category.user_owned) return;
  const form = $("#categoryForm");
  form.elements.category_id.value = category.id;
  form.elements.name.value = category.name;
  form.elements.icon.value = category.icon;
  form.elements.color.value = category.color;
  form.elements.monthly_limit.value = category.monthly_limit;
}

export async function saveCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const categoryId = payload.category_id;
  delete payload.category_id;
  try {
    await apiFetch(categoryId ? `/api/categories/${categoryId}` : "/api/categories", {
      method: categoryId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    form.elements.color.value = "#1d4ed8";
    await loadLedgerSettings();
    await loadEntries(state.entryPage);
    setMessage("#categoryMessage", "分类已保存。");
  } catch (error) {
    setMessage("#categoryMessage", error.message);
  }
}

export async function deleteCategory(categoryId) {
  if (!confirm("确定删除这个分类吗？已有账目的分类不能删除。")) return;
  try {
    await apiFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
    await loadLedgerSettings();
    await loadEntries(state.entryPage);
    setMessage("#categoryMessage", "分类已删除。");
  } catch (error) {
    setMessage("#categoryMessage", error.message);
  }
}

export async function saveOption(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await apiFetch("/api/entry-options", { method: "POST", body: JSON.stringify(payload) });
    form.elements.name.value = "";
    await loadLedgerSettings();
    setMessage("#optionMessage", "选项已添加。");
  } catch (error) {
    setMessage("#optionMessage", error.message);
  }
}

export async function deleteOption(optionId) {
  await apiFetch(`/api/entry-options/${optionId}`, { method: "DELETE" });
  await loadLedgerSettings();
}
