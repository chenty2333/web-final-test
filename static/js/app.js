/*
 * Copyright scope: original frontend interaction code for the Web course
 * design project. It uses native JavaScript and fetch for no-refresh rendering.
 */
const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:5000" : "";
const TOKEN_KEY = "starry_ledger_token";

const views = {
  home: document.querySelector("#homeView"),
  auth: document.querySelector("#authView"),
  dashboard: document.querySelector("#dashboardView"),
  entries: document.querySelector("#entriesView"),
  goals: document.querySelector("#goalsView"),
  ai: document.querySelector("#aiView"),
};

const state = {
  user: null,
  categories: [],
  entries: [],
  summary: null,
  goals: [],
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error("服务器返回了无效数据");
  }
  if (!response.ok || payload.code >= 400) {
    if (response.status === 401) {
      clearToken();
      state.user = null;
      updateAuthUi();
      showRoute("auth");
    }
    throw new Error(payload.msg || "请求失败");
  }
  return payload.data;
}

function setMessage(id, text) {
  const el = document.querySelector(id);
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}

function updateAuthUi() {
  const authed = Boolean(state.user);
  document.querySelector("#userBadge").classList.toggle("hidden", !authed);
  document.querySelector("#userBadge").textContent = authed ? `你好，${state.user.nickname}` : "";
  document.querySelector("#logoutButton").classList.toggle("hidden", !authed);
  document.querySelector("#authNavButton").classList.toggle("hidden", authed);
  document.querySelectorAll("[data-auth-only]").forEach((button) => {
    button.disabled = !authed;
    button.classList.toggle("hidden", !authed);
  });
}

function showRoute(route) {
  if (!state.user && ["dashboard", "entries", "goals", "ai"].includes(route)) {
    route = "auth";
  }
  Object.entries(views).forEach(([name, el]) => el.classList.toggle("hidden", name !== route));
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  if (route === "dashboard") loadDashboard();
  if (route === "entries") loadEntries();
  if (route === "goals") loadGoals();
  location.hash = route;
}

async function loadPublicInfo() {
  const data = await apiFetch("/api/public/overview");
  document.querySelector("#guestSeedCount").textContent = `${data.stats.seed_entries} 条样例`;
  document.querySelector("#guestCards").innerHTML = [
    `<article class="guest-card"><span>预置用户</span><strong>${data.stats.seed_users}</strong><small>满足每表 10 条以上数据要求</small></article>`,
    `<article class="guest-card"><span>公共分类</span><strong>${data.stats.seed_categories}</strong><small>${data.sample_categories.map((c) => c.name).slice(0, 3).join("、")} 等</small></article>`,
    `<article class="guest-card"><span>记账建议</span><strong>${data.tips.length}</strong><small>${html(data.tips[0])}</small></article>`,
  ].join("");
  const categories = await apiFetch("/api/public/categories");
  state.categories = categories.categories || [];
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const select = document.querySelector('select[name="category_id"]');
  if (!select) return;
  select.innerHTML = state.categories
    .map((cat) => `<option value="${cat.id}">${html(cat.name)} · 月限 ${money(cat.monthly_limit)}</option>`)
    .join("");
}

async function loadMe() {
  if (!getToken()) return;
  try {
    const data = await apiFetch("/api/auth/me");
    state.user = data.user;
  } catch (error) {
    clearToken();
    state.user = null;
  }
  updateAuthUi();
}

async function loadDashboard() {
  const [summaryData, entryData] = await Promise.all([
    apiFetch("/api/summary"),
    apiFetch("/api/entries"),
  ]);
  state.summary = summaryData.summary;
  state.goals = summaryData.goals || [];
  state.entries = entryData.entries || [];
  renderDashboard();
}

function renderDashboard() {
  const s = state.summary || {};
  document.querySelector("#summaryCards").innerHTML = [
    ["本月收入", `+${money(s.income)}`, "奖学金、兼职等现金流"],
    ["本月支出", `-${money(s.expense)}`, `${s.entry_count || 0} 条账目`],
    ["当前结余", money(s.balance), `最高支出分类：${s.top_category || "暂无"}`],
  ]
    .map(([label, value, note]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${html(note)}</small></article>`)
    .join("");

  const max = Math.max(...(s.category_totals || []).map((item) => item.amount), 1);
  document.querySelector("#categoryBars").innerHTML = (s.category_totals || [])
    .slice(0, 6)
    .map((item) => `
      <div class="bar-item">
        <div class="bar-meta"><span>${html(item.name)}</span><strong>${money(item.amount)}</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, item.amount / max * 100)}%"></div></div>
      </div>
    `)
    .join("") || `<p>暂无支出排行。</p>`;

  document.querySelector("#recentEntries").innerHTML = state.entries
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

async function loadEntries() {
  const kind = document.querySelector("#kindFilter").value;
  const query = kind ? `?kind=${kind}` : "";
  const data = await apiFetch(`/api/entries${query}`);
  state.entries = data.entries || [];
  renderEntryList();
}

function renderEntryList() {
  document.querySelector("#entryList").innerHTML = state.entries
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
}

function resetEntryForm() {
  const form = document.querySelector("#entryForm");
  form.reset();
  form.elements.entry_id.value = "";
  form.elements.spent_at.value = todayISO();
  document.querySelector("#entryFormTitle").textContent = "新增账目";
  setMessage("#entryMessage", "");
}

async function saveEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const entryId = payload.entry_id;
  delete payload.entry_id;
  const method = entryId ? "PUT" : "POST";
  const path = entryId ? `/api/entries/${entryId}` : "/api/entries";
  try {
    await apiFetch(path, { method, body: JSON.stringify(payload) });
    resetEntryForm();
    await loadEntries();
    setMessage("#entryMessage", "");
  } catch (error) {
    setMessage("#entryMessage", error.message);
  }
}

function editEntry(entryId) {
  const entry = state.entries.find((item) => item.id === Number(entryId));
  if (!entry) return;
  const form = document.querySelector("#entryForm");
  form.elements.entry_id.value = entry.id;
  form.elements.title.value = entry.title;
  form.elements.amount.value = entry.amount;
  form.elements.category_id.value = entry.category_id;
  form.elements.kind.value = entry.kind;
  form.elements.spent_at.value = entry.spent_at;
  form.elements.scene.value = entry.scene;
  form.elements.mood.value = entry.mood;
  form.elements.note.value = entry.note;
  document.querySelector("#entryFormTitle").textContent = "修改账目";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteEntry(entryId) {
  if (!confirm("确定删除这条账目吗？")) return;
  await apiFetch(`/api/entries/${entryId}`, { method: "DELETE" });
  await loadEntries();
}

async function loadGoals() {
  const data = await apiFetch("/api/goals");
  state.goals = data.goals || [];
  document.querySelector("#goalList").innerHTML = state.goals
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

async function askAi(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const question = form.elements.question.value.trim();
  if (!question) return;
  appendChat("user", question);
  form.reset();
  appendChat("assistant", "正在结合你的账本数据生成建议...");
  const pending = document.querySelector("#chatLog .chat-msg.assistant:last-child");
  try {
    const data = await apiFetch("/api/ai/coach", {
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
  document.querySelector("#chatLog").append(node);
  node.scrollIntoView({ block: "end", behavior: "smooth" });
}

document.addEventListener("click", async (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    event.preventDefault();
    showRoute(routeButton.dataset.route);
  }
  const scrollButton = event.target.closest("[data-scroll]");
  if (scrollButton) {
    document.querySelector(scrollButton.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
  }
  const editButton = event.target.closest("[data-edit-entry]");
  if (editButton) {
    editEntry(editButton.dataset.editEntry);
  }
  const deleteButton = event.target.closest("[data-delete-entry]");
  if (deleteButton) {
    await deleteEntry(deleteButton.dataset.deleteEntry);
  }
});

document.querySelector("#logoutButton").addEventListener("click", () => {
  clearToken();
  state.user = null;
  updateAuthUi();
  showRoute("home");
});

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-auth-tab]").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    document.querySelector("#loginForm").classList.toggle("hidden", button.dataset.authTab !== "login");
    document.querySelector("#registerForm").classList.toggle("hidden", button.dataset.authTab !== "register");
    setMessage("#authMessage", "");
  });
});

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const data = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    setToken(data.access_token);
    state.user = data.user;
    updateAuthUi();
    showRoute("dashboard");
  } catch (error) {
    setMessage("#authMessage", error.message);
  }
});

document.querySelector("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
    setMessage("#authMessage", "注册成功，请切换到登录页登录。");
    event.currentTarget.reset();
  } catch (error) {
    setMessage("#authMessage", error.message);
  }
});

document.querySelector("#entryForm").addEventListener("submit", saveEntry);
document.querySelector("#resetEntryForm").addEventListener("click", resetEntryForm);
document.querySelector("#kindFilter").addEventListener("change", loadEntries);
document.querySelector("#aiForm").addEventListener("submit", askAi);

async function boot() {
  await loadPublicInfo();
  resetEntryForm();
  await loadMe();
  const initial = location.hash.replace("#", "") || "home";
  updateAuthUi();
  showRoute(initial);
}

boot().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML("beforeend", `<div class="message">${html(error.message)}</div>`);
});
