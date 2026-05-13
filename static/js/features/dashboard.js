import { apiFetch } from "../core/api.js";
import { $ } from "../core/dom.js";
import { currentMonth, html, money, queryString } from "../core/format.js";
import state from "../core/state.js";

export async function loadDashboard() {
  if (!state.user) {
    renderPublicDashboard();
    return;
  }
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

function renderPublicDashboard() {
  const info = state.publicInfo || { stats: {}, tips: [], sample_categories: [] };
  $("#dashboardEyebrow").textContent = "0 身份浏览";
  $("#dashboardTitle").textContent = "仪表盘";
  $("#publicSummaryCards").innerHTML = [
    ["公开分类", info.stats.seed_categories || 0, "先理解校园常见消费结构"],
    ["社区经验", "可浏览", "未登录也能查看帖子和评论"],
    ["个人账本", "登录后开启", "收支、预算、心愿和 AI 复盘会绑定账号"],
  ]
    .map(([label, value, note]) => `<article class="guest-card"><span>${label}</span><strong>${html(value)}</strong><small>${html(note)}</small></article>`)
    .join("");
  $("#publicCategoryPreview").innerHTML = (info.sample_categories || [])
    .slice(0, 8)
    .map((item) => `
      <div class="category-pill">
        <span class="color-dot" style="background:${html(item.color)}"></span>
        <strong>${html(item.icon)} ${html(item.name)}</strong>
        <small>月限 ${money(item.monthly_limit)}</small>
      </div>
    `)
    .join("") || "<p>暂无公开分类。</p>";
  $("#publicTipList").innerHTML = (info.tips || [])
    .slice(0, 4)
    .map((tip, index) => `<div class="method-item"><strong>${index + 1}</strong><span>${html(tip)}</span></div>`)
    .join("") || "<p>暂无公开方法。</p>";
}

function renderDashboard() {
  const s = state.summary || {};
  $("#dashboardEyebrow").textContent = "我的账本";
  $("#dashboardTitle").textContent = "生活仪表盘";
  renderDashboardDecision(s);
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

function renderDashboardDecision(summary) {
  const overBudget = (summary.budget_usage || []).filter((item) => item.rate >= 85);
  const watchBudget = (summary.budget_usage || []).filter((item) => item.rate >= 60 && item.rate < 85);
  const topCategory = summary.top_category || "暂无明显集中分类";
  const balance = Number(summary.balance || 0);
  const decisions = [
    {
      label: "今天重点",
      text: overBudget.length
        ? `${overBudget[0].name} 已接近或超过预算，今天先暂停非必要支出。`
        : `优先复盘 ${topCategory}，确认它是不是本月主动选择。`,
    },
    {
      label: "现金流",
      text: balance >= 0 ? `本月结余 ${money(balance)} 元，可以安排一笔心愿基金存入。` : `本月已透支 ${money(Math.abs(balance))} 元，先降低可选消费。`,
    },
    {
      label: "预算观察",
      text: watchBudget.length ? `${watchBudget.map((item) => item.name).slice(0, 3).join("、")} 需要继续观察。` : "暂时没有明显预算压力。",
    },
  ];
  $("#dashboardDecision").innerHTML = decisions
    .map((item) => `<div class="decision-item"><span>${html(item.label)}</span><strong>${html(item.text)}</strong></div>`)
    .join("");
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
