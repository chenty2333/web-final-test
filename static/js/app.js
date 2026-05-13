import { clearAuth, bindAuthTabs, handleLogin, handleRegister, loadMe, updateAuthUi } from "./features/auth.js";
import { applyQuickPrompt, askAi, loadAiView } from "./features/ai.js";
import { changeCommunityPage, likePost, loadCommunity, loadPostDetail, saveComment, savePost } from "./features/community.js";
import {
  changePage,
  deleteCategory,
  deleteEntry,
  deleteOption,
  editCategory,
  editEntry,
  loadEntries,
  loadLedgerSettings,
  resetEntryForm,
  saveCategory,
  saveEntry,
  saveOption,
} from "./features/entries.js";
import { currentMonth } from "./core/format.js";
import { $, $$ } from "./core/dom.js";
import { loadDashboard } from "./features/dashboard.js";
import { deleteGoal, deleteGoalDeposit, initGoalForms, loadGoalDetail, loadGoals, saveGoal, saveGoalDeposit } from "./features/goals.js";
import { renderProfile, saveProfile } from "./features/profile.js";
import { loadPublicInfo, showBootError } from "./features/catalog.js";
import { onUnauthorized } from "./core/api.js";
import state from "./core/state.js";

const views = {
  home: $("#homeView"),
  auth: $("#authView"),
  profile: $("#profileView"),
  dashboard: $("#dashboardView"),
  entries: $("#entriesView"),
  goals: $("#goalsView"),
  community: $("#communityView"),
  ai: $("#aiView"),
};

function showRoute(route) {
  if (!views[route]) {
    route = "home";
  }
  if (!state.user && ["profile", "dashboard", "entries", "goals", "community", "ai"].includes(route)) {
    route = "auth";
  }
  Object.entries(views).forEach(([name, el]) => el.classList.toggle("hidden", name !== route));
  $$("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  if (route === "profile") renderProfile();
  if (route === "dashboard") loadDashboard();
  if (route === "entries") loadEntries();
  if (route === "goals") loadGoals();
  if (route === "community") loadCommunity();
  if (route === "ai") loadAiView();
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
    const editCategoryButton = event.target.closest("[data-edit-category]");
    if (editCategoryButton) {
      editCategory(editCategoryButton.dataset.editCategory);
    }
    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    if (deleteCategoryButton) {
      await deleteCategory(deleteCategoryButton.dataset.deleteCategory);
    }
    const deleteOptionButton = event.target.closest("[data-delete-option]");
    if (deleteOptionButton) {
      await deleteOption(deleteOptionButton.dataset.deleteOption);
    }
    const openGoal = event.target.closest("[data-open-goal]");
    if (openGoal) {
      await loadGoalDetail(openGoal.dataset.openGoal);
    }
    const deleteDeposit = event.target.closest("[data-delete-deposit]");
    if (deleteDeposit) {
      await deleteGoalDeposit(deleteDeposit.dataset.deleteDeposit);
    }
    const deleteGoalButton = event.target.closest("[data-delete-goal]");
    if (deleteGoalButton) {
      await deleteGoal(deleteGoalButton.dataset.deleteGoal);
    }
    const openPost = event.target.closest("[data-open-post]");
    if (openPost && !event.target.closest("[data-like-post]")) {
      await loadPostDetail(openPost.dataset.openPost);
    }
    const likeButton = event.target.closest("[data-like-post]");
    if (likeButton) {
      await likePost(likeButton.dataset.likePost);
    }
    const communityPageButton = event.target.closest("[data-community-page]");
    if (communityPageButton && !communityPageButton.disabled) {
      await changeCommunityPage(communityPageButton.dataset.communityPage);
    }
    const promptButton = event.target.closest("[data-ai-prompt]");
    if (promptButton) {
      applyQuickPrompt(promptButton.dataset.aiPrompt);
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
  $("#profileForm").addEventListener("submit", saveProfile);
  $("#entryForm").addEventListener("submit", saveEntry);
  $("#categoryForm").addEventListener("submit", saveCategory);
  $("#optionForm").addEventListener("submit", saveOption);
  $("#resetEntryForm").addEventListener("click", resetEntryForm);
  $("#goalForm").addEventListener("submit", saveGoal);
  $("#goalDepositForm").addEventListener("submit", saveGoalDeposit);
  $("#postForm").addEventListener("submit", savePost);
  $("#commentForm").addEventListener("submit", saveComment);
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
  initGoalForms();
  await loadMe();
  if (state.user) {
    await loadLedgerSettings();
  }
  updateAuthUi();
  showRoute(location.hash.replace("#", "") || "home");
}

boot().catch(showBootError);
