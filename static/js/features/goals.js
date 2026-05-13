import { apiFetch } from "../core/api.js";
import { $, setMessage } from "../core/dom.js";
import { html, money, todayISO } from "../core/format.js";
import state from "../core/state.js";

export async function loadGoals() {
  const data = await apiFetch("/api/goals");
  state.goals = data.goals || [];
  if (!state.selectedGoal && state.goals.length) {
    state.selectedGoal = state.goals[0];
    await loadGoalDetail(state.selectedGoal.id);
  } else if (state.selectedGoal) {
    const stillExists = state.goals.find((goal) => goal.id === state.selectedGoal.id);
    if (stillExists) {
      await loadGoalDetail(stillExists.id);
    } else {
      state.selectedGoal = null;
      state.goalDeposits = [];
      renderGoalDetail();
    }
  }
  renderGoals();
}

function progressClass(progress) {
  if (progress >= 85) return "danger";
  if (progress >= 60) return "warn";
  return "good";
}

function renderGoals() {
  $("#goalList").innerHTML = state.goals
    .map((goal) => `
      <article class="goal-card ${state.selectedGoal?.id === goal.id ? "active" : ""}" data-open-goal="${goal.id}">
        <div>
          <strong>${html(goal.name)}</strong><br>
          <small>截止 ${html(goal.deadline)} · ${html(goal.status)} · ${goal.deposit_count} 笔存入</small>
        </div>
        <div class="progress ${progressClass(goal.progress)}"><span style="width:${goal.progress}%"></span></div>
        <small>已存 ${money(goal.saved_amount)} / 目标 ${money(goal.target_amount)}，完成 ${goal.progress}%</small>
      </article>
    `)
    .join("") || `<p>还没有心愿基金，先创建一个目标。</p>`;
}

export function initGoalForms() {
  $("#goalDepositForm").elements.deposited_at.value = todayISO();
}

export async function saveGoal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const data = await apiFetch("/api/goals", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    state.selectedGoal = data.goal;
    setMessage("#goalMessage", "心愿基金已创建。");
    await loadGoals();
  } catch (error) {
    setMessage("#goalMessage", error.message);
  }
}

export async function loadGoalDetail(goalId) {
  const data = await apiFetch(`/api/goals/${goalId}`);
  state.selectedGoal = data.goal;
  state.goalDeposits = data.deposits || [];
  renderGoalDetail();
  renderGoals();
}

function renderGoalDetail() {
  const goal = state.selectedGoal;
  if (!goal) {
    $("#goalDetailTitle").textContent = "选择一个心愿";
    $("#goalDetail").innerHTML = "点击左侧卡片查看每一笔存入记录。";
    $("#goalDepositForm").classList.add("hidden");
    return;
  }
  $("#goalDetailTitle").textContent = goal.name;
  $("#goalDepositForm").classList.remove("hidden");
  $("#goalDepositForm").elements.deposited_at.value = todayISO();
  $("#goalDetail").innerHTML = `
    <div class="goal-detail-head">
      <strong>${money(goal.saved_amount)} / ${money(goal.target_amount)}</strong>
      <div class="entry-actions">
        <small>完成 ${goal.progress}%</small>
        <button class="danger-btn" type="button" data-delete-goal="${goal.id}">删除心愿</button>
      </div>
    </div>
    <div class="progress ${progressClass(goal.progress)}"><span style="width:${goal.progress}%"></span></div>
    <div class="deposit-list">
      ${state.goalDeposits.map((item) => `
        <div class="deposit-row">
          <div><strong>+${money(item.amount)}</strong><small>${html(item.deposited_at)} · ${html(item.note || "无备注")}</small></div>
          <button class="danger-btn" type="button" data-delete-deposit="${item.id}">删除</button>
        </div>
      `).join("") || "<p>暂无存入记录。</p>"}
    </div>
  `;
}

export async function saveGoalDeposit(event) {
  event.preventDefault();
  if (!state.selectedGoal) return;
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await apiFetch(`/api/goals/${state.selectedGoal.id}/deposits`, { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    form.elements.deposited_at.value = todayISO();
    await loadGoals();
    setMessage("#goalDepositMessage", "存入记录已保存。");
  } catch (error) {
    setMessage("#goalDepositMessage", error.message);
  }
}

export async function deleteGoalDeposit(depositId) {
  if (!state.selectedGoal) return;
  await apiFetch(`/api/goals/${state.selectedGoal.id}/deposits/${depositId}`, { method: "DELETE" });
  await loadGoals();
}

export async function deleteGoal(goalId) {
  if (!confirm("确定删除这个心愿基金和所有存入记录吗？")) return;
  await apiFetch(`/api/goals/${goalId}`, { method: "DELETE" });
  state.selectedGoal = null;
  state.goalDeposits = [];
  await loadGoals();
}
