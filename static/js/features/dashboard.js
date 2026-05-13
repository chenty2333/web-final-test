import { apiFetch } from "../core/api.js";
import { $ } from "../core/dom.js";
import { currentMonth, html, money, queryString } from "../core/format.js";
import state from "../core/state.js";

export async function loadDashboard() {
  const month = $("#dashboardMonth").value || currentMonth();
  state.selectedMonth = month;
  const [summaryData, entryData] = await Promise.all([
    apiFetch(`/api/summary${queryString({ month })}`),
    apiFetch(`/api/entries${queryString({ month, page_size: 5 })}`),
  ]);
  state.summary = summaryData.summary;
  state.goals = summaryData.goals || [];
  state.entries = entryData.entries || [];
  renderDashboard();
}

function renderDashboard() {
  const s = state.summary || {};
  $("#summaryCards").innerHTML = [
    [`${s.month || state.selectedMonth} 收入`, `+${money(s.income)}`, "奖学金、兼职等现金流"],
    [`${s.month || state.selectedMonth} 支出`, `-${money(s.expense)}`, `${s.entry_count || 0} 条账目`],
    ["当月结余", money(s.balance), `最高支出分类：${s.top_category || "暂无"}`],
  ]
    .map(([label, value, note]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${html(note)}</small></article>`)
    .join("");

  renderTrendChart(s.monthly_trend || []);
  renderBudgetChart(s.budget_usage || []);

  const max = Math.max(...(s.category_totals || []).map((item) => item.amount), 1);
  $("#categoryBars").innerHTML = (s.category_totals || [])
    .slice(0, 6)
    .map((item) => `
      <div class="bar-item">
        <div class="bar-meta"><span>${html(item.name)}</span><strong>${money(item.amount)}</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, item.amount / max * 100)}%"></div></div>
      </div>
    `)
    .join("") || `<p>暂无支出排行。</p>`;

  $("#recentEntries").innerHTML = state.entries
    .slice(0, 5)
    .map(renderCompactEntry)
    .join("") || `<p>暂无账目。</p>`;
}

function renderCompactEntry(entry) {
  const cls = entry.kind === "income" ? "amount-income" : "amount-expense";
  const sign = entry.kind === "income" ? "+" : "-";
  return `
    <div class="compact-item">
      <div><strong>${html(entry.title)}</strong><br><small>${html(entry.category.name)} · ${html(entry.spent_at)}</small></div>
      <strong class="${cls}">${sign}${money(entry.amount)}</strong>
    </div>
  `;
}

function renderTrendChart(rows) {
  const max = Math.max(...rows.flatMap((item) => [item.income, item.expense]), 1);
  $("#trendChart").innerHTML = rows
    .map((item) => `
      <div class="trend-month">
        <div class="trend-bars">
          <span class="trend-bar income" title="收入 ${money(item.income)}" style="height:${Math.max(4, item.income / max * 100)}%"></span>
          <span class="trend-bar expense" title="支出 ${money(item.expense)}" style="height:${Math.max(4, item.expense / max * 100)}%"></span>
        </div>
        <span class="trend-label">${html(item.month)}</span>
      </div>
    `)
    .join("") || `<p>暂无趋势数据。</p>`;
}

function renderBudgetChart(rows) {
  $("#budgetChart").innerHTML = rows
    .slice(0, 6)
    .map((item) => {
      const cls = item.rate >= 85 ? "danger" : item.rate >= 60 ? "warn" : "good";
      return `
      <div class="budget-item">
        <div class="budget-meta">
          <span>${html(item.name)}</span>
          <strong>${money(item.amount)} / ${money(item.limit)}</strong>
        </div>
        <div class="progress ${cls}"><span style="width:${Math.max(4, item.rate)}%"></span></div>
      </div>
    `;
    })
    .join("") || `<p>暂无预算数据。</p>`;
}
