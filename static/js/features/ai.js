import { apiFetch } from "../core/api.js";
import { $ } from "../core/dom.js";
import { currentMonth, html, money, queryString, richText } from "../core/format.js";
import state from "../core/state.js";

export async function loadAiView() {
  const month = state.selectedMonth || $("#dashboardMonth").value || currentMonth();
  const data = await apiFetch(`/api/summary${queryString({ month })}`);
  state.summary = data.summary;
  renderAiContext();
}

export async function askAi(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const question = form.elements.question.value.trim();
  if (!question) return;
  appendChat("user", question);
  form.reset();
  appendChat("assistant", "正在结合你的账本数据生成建议...");
  const pending = $("#chatLog .chat-msg.assistant:last-child");
  try {
    const data = await apiFetch(`/api/ai/coach${queryString({ month: state.selectedMonth || currentMonth() })}`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    pending.innerHTML = richText(data.answer);
    pending.classList.add("rich-text");
  } catch (error) {
    pending.textContent = error.message;
  }
}

export function applyQuickPrompt(prompt) {
  const input = $("#aiForm").elements.question;
  input.value = prompt;
  input.focus();
}

function renderAiContext() {
  const summary = state.summary || {};
  const categories = summary.category_totals || [];
  const riskRows = (summary.budget_usage || [])
    .slice()
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4);
  $("#aiContext").innerHTML = `
    <div class="profile-line"><span>收入</span><strong>${money(summary.income)}</strong></div>
    <div class="profile-line"><span>支出</span><strong>${money(summary.expense)}</strong></div>
    <div class="profile-line"><span>结余</span><strong>${money(summary.balance)}</strong></div>
    <div class="mini-list">
      ${categories.slice(0, 4).map((item) => `<span>${html(item.name)} · ${money(item.amount)}</span>`).join("") || "<span>暂无分类支出</span>"}
    </div>
  `;
  $("#aiRiskList").innerHTML = riskRows
    .map((item) => {
      const cls = item.rate >= 85 ? "danger" : item.rate >= 60 ? "warn" : "good";
      return `<div class="budget-item compact-risk">
        <div class="budget-meta"><span>${html(item.name)}</span><strong>${item.rate}%</strong></div>
        <div class="progress ${cls}"><span style="width:${Math.max(4, item.rate)}%"></span></div>
      </div>`;
    })
    .join("") || "<span>暂无预算风险</span>";
}

function appendChat(role, text) {
  const node = document.createElement("div");
  node.className = `chat-msg ${role}`;
  if (role === "assistant") {
    node.innerHTML = richText(text);
    node.classList.add("rich-text");
  } else {
    node.textContent = text;
  }
  $("#chatLog").append(node);
  node.scrollIntoView({ block: "end", behavior: "smooth" });
}
