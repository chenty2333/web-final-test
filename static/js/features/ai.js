import { apiFetch } from "../core/api.js";
import { $ } from "../core/dom.js";
import { currentMonth, queryString } from "../core/format.js";
import state from "../core/state.js";

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
    pending.textContent = data.answer;
  } catch (error) {
    pending.textContent = error.message;
  }
}

function appendChat(role, text) {
  const node = document.createElement("div");
  node.className = `chat-msg ${role}`;
  node.textContent = text;
  $("#chatLog").append(node);
  node.scrollIntoView({ block: "end", behavior: "smooth" });
}
