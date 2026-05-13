import { apiFetch } from "../core/api.js";
import { $, setMessage } from "../core/dom.js";
import { html } from "../core/format.js";
import state from "../core/state.js";

export function renderProfile() {
  if (!state.user) return;
  const form = $("#profileForm");
  form.elements.nickname.value = state.user.nickname || "";
  form.elements.email.value = state.user.email || "";
  form.elements.current_password.value = "";
  form.elements.new_password.value = "";
  $("#profileSummary").innerHTML = `
    <div class="profile-line"><span>用户名</span><strong>${html(state.user.username)}</strong></div>
    <div class="profile-line"><span>昵称</span><strong>${html(state.user.nickname)}</strong></div>
    <div class="profile-line"><span>邮箱</span><strong>${html(state.user.email)}</strong></div>
  `;
}

export async function saveProfile(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await apiFetch("/api/auth/me", { method: "PUT", body: JSON.stringify(payload) });
    state.user = data.user;
    renderProfile();
    $("#userBadge").textContent = `你好，${state.user.nickname}`;
    setMessage("#profileMessage", "资料已保存。");
  } catch (error) {
    setMessage("#profileMessage", error.message);
  }
}
