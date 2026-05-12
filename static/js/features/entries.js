import { apiFetch } from "../core/api.js";
import { $, setMessage } from "../core/dom.js";
import { html, money, queryString, todayISO } from "../core/format.js";
import state from "../core/state.js";

export async function loadEntries(page = state.entryPage || 1) {
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
      return `
        <article class="entry-card">
          <div class="entry-main">
            <strong>${html(entry.title)} <span class="${cls}">${sign}${money(entry.amount)}</span></strong>
            <p>${html(entry.category.name)} · ${html(entry.scene)} · ${html(entry.mood)} · ${html(entry.spent_at)}</p>
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
