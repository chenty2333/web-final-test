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
  $("#aiContext").innerHTML = `
    <div class="profile-line"><span>收入</span><strong>${money(summary.income)}</strong></div>
    <div class="profile-line"><span>支出</span><strong>${money(summary.expense)}</strong></div>
    <div class="profile-line"><span>结余</span><strong>${money(summary.balance)}</strong></div>
    <div class="mini-list">
      ${categories.slice(0, 4).map((item) => `<span>${html(item.name)} · ${money(item.amount)}</span>`).join("") || "<span>暂无分类支出</span>"}
    </div>
  `;
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
