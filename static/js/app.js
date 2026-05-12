import { clearAuth, bindAuthTabs, handleLogin, handleRegister, loadMe, updateAuthUi } from "./features/auth.js";
import { askAi } from "./features/ai.js";
import { changePage, deleteEntry, editEntry, loadEntries, resetEntryForm, saveEntry } from "./features/entries.js";
import { currentMonth } from "./core/format.js";
import { $, $$ } from "./core/dom.js";
import { loadDashboard } from "./features/dashboard.js";
import { loadGoals } from "./features/goals.js";
import { loadPublicInfo, showBootError } from "./features/catalog.js";
import { onUnauthorized } from "./core/api.js";
import state from "./core/state.js";

const views = {
  home: $("#homeView"),
  auth: $("#authView"),
  dashboard: $("#dashboardView"),
  entries: $("#entriesView"),
  goals: $("#goalsView"),
  ai: $("#aiView"),
};

function showRoute(route) {
  if (!views[route]) {
    route = "home";
  }
  if (!state.user && ["dashboard", "entries", "goals", "ai"].includes(route)) {
    route = "auth";
  }
  Object.entries(views).forEach(([name, el]) => el.classList.toggle("hidden", name !== route));
  $$("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  if (route === "dashboard") loadDashboard();
  if (route === "entries") loadEntries();
  if (route === "goals") loadGoals();
  location.hash = route;
}

function bindNavigation() {
  document.addEventListener("click", async (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      event.preventDefault();
      showRoute(routeButton.dataset.route);
    }
    const scrollButton = event.target.closest("[data-scroll]");
    if (scrollButton) {
      $(scrollButton.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    }
    const editButton = event.target.closest("[data-edit-entry]");
    if (editButton) {
      editEntry(editButton.dataset.editEntry);
    }
    const deleteButton = event.target.closest("[data-delete-entry]");
    if (deleteButton) {
      await deleteEntry(deleteButton.dataset.deleteEntry);
    }
    const pageButton = event.target.closest("[data-page]");
    if (pageButton && !pageButton.disabled) {
      await changePage(pageButton.dataset.page);
    }
  });
}

function bindForms() {
  $("#logoutButton").addEventListener("click", () => {
    clearAuth();
    showRoute("home");
  });
  $("#loginForm").addEventListener("submit", (event) => handleLogin(event, showRoute));
  $("#registerForm").addEventListener("submit", handleRegister);
  $("#entryForm").addEventListener("submit", saveEntry);
  $("#resetEntryForm").addEventListener("click", resetEntryForm);
  $("#dashboardMonth").addEventListener("change", loadDashboard);
  $("#kindFilter").addEventListener("change", () => loadEntries(1));
  $("#categoryFilter").addEventListener("change", () => loadEntries(1));
  $("#entryMonthFilter").addEventListener("change", () => loadEntries(1));
  $("#aiForm").addEventListener("submit", askAi);
  bindAuthTabs();
}

async function boot() {
  onUnauthorized(() => {
    clearAuth();
    showRoute("auth");
  });
  bindNavigation();
  bindForms();
  await loadPublicInfo();
  $("#dashboardMonth").value = currentMonth();
  $("#entryMonthFilter").value = currentMonth();
  state.selectedMonth = currentMonth();
  resetEntryForm();
  await loadMe();
  updateAuthUi();
  showRoute(location.hash.replace("#", "") || "home");
}

boot().catch(showBootError);
