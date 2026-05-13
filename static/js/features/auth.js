import { apiFetch, clearToken, getToken, setToken } from "../core/api.js";
import { $, $$, setMessage } from "../core/dom.js";
import state from "../core/state.js";

export function updateAuthUi() {
  const authed = Boolean(state.user);
  $("#userBadge").classList.toggle("hidden", !authed);
  $("#userBadge").textContent = authed ? `你好，${state.user.nickname}` : "";
  $("#logoutButton").classList.toggle("hidden", !authed);
  $("#profileButton").classList.toggle("hidden", !authed);
  $("#authNavButton").classList.toggle("hidden", authed);
  $$("[data-guest-only]").forEach((node) => {
    node.classList.toggle("hidden", authed);
  });
  $$("[data-member-only]").forEach((node) => {
    node.classList.toggle("hidden", !authed);
  });
}

export async function loadMe() {
  if (!getToken()) return;
  try {
    const data = await apiFetch("/api/auth/me");
    state.user = data.user;
  } catch (error) {
    clearAuth();
  }
  updateAuthUi();
}

export function clearAuth() {
  clearToken();
  state.user = null;
  state.ledgerSettingsLoaded = false;
  state.selectedGoal = null;
  state.goalDeposits = [];
  updateAuthUi();
}

export async function handleLogin(event, showRoute) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    setToken(data.access_token);
    state.user = data.user;
    updateAuthUi();
    await loadMe();
    showRoute("dashboard");
  } catch (error) {
    setMessage("#authMessage", error.message);
  }
}

export async function handleRegister(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
    setMessage("#authMessage", "注册成功，请切换到登录页登录。");
    event.currentTarget.reset();
  } catch (error) {
    setMessage("#authMessage", error.message);
  }
}

export function bindAuthTabs() {
  $$("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-auth-tab]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      $("#loginForm").classList.toggle("hidden", button.dataset.authTab !== "login");
      $("#registerForm").classList.toggle("hidden", button.dataset.authTab !== "register");
      setMessage("#authMessage", "");
    });
  });
}
