import { apiFetch } from "../core/api.js";
import { $ } from "../core/dom.js";
import { html, money } from "../core/format.js";
import state from "../core/state.js";

export async function loadGoals() {
  const data = await apiFetch("/api/goals");
  state.goals = data.goals || [];
  $("#goalList").innerHTML = state.goals
    .map((goal) => `
      <article class="goal-card">
        <div>
          <strong>${html(goal.name)}</strong><br>
          <small>截止 ${html(goal.deadline)} · ${html(goal.status)}</small>
        </div>
        <div class="progress"><span style="width:${goal.progress}%"></span></div>
        <small>已存 ${money(goal.saved_amount)} / 目标 ${money(goal.target_amount)}，完成 ${goal.progress}%</small>
      </article>
    `)
    .join("");
}
