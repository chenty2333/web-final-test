import { apiFetch } from "../core/api.js";
import { $, setMessage } from "../core/dom.js";
import { html, richText } from "../core/format.js";
import state from "../core/state.js";

export async function loadCommunity(page = state.communityPage || 1) {
  state.communityPage = page;
  const data = await apiFetch(`/api/community/posts?page=${page}&page_size=8`);
  state.communityPosts = data.posts || [];
  state.communityPagination = data.pagination || null;
  if (state.selectedPost && !state.communityPosts.some((post) => post.id === state.selectedPost.id)) {
    state.selectedPost = null;
  }
  renderCommunity();
  if (!state.selectedPost && state.communityPosts.length) {
    await loadPostDetail(state.communityPosts[0].id);
  }
}

function renderCommunityAccess() {
  const authed = Boolean(state.user);
  $("#communityComposerGate").classList.toggle("hidden", authed);
  $("#postForm").classList.toggle("hidden", !authed);
  $("#commentGate").classList.toggle("hidden", authed || !state.selectedPost);
  $("#commentForm").classList.toggle("hidden", !authed || !state.selectedPost);
}

function renderCommunity() {
  renderCommunityAccess();
  $("#postList").innerHTML = state.communityPosts
    .map((post) => `
      <article class="post-card ${state.selectedPost?.id === post.id ? "active" : ""}" data-open-post="${post.id}">
        <div>
          <span class="topic">${html(post.topic)}</span>
          <h3>${html(post.title)}</h3>
          <p>${html(post.content).slice(0, 140)}${post.content.length > 140 ? "..." : ""}</p>
          <small>${html(post.author.nickname)} · ${html(post.created_at)}</small>
        </div>
        <div class="post-actions">
          <button class="ghost-btn" type="button" data-like-post="${post.id}" ${state.user ? "" : "disabled"}>赞 ${post.likes_count}</button>
          <span>${post.comment_count} 条评论</span>
        </div>
      </article>
    `)
    .join("") || `<p>还没有社区动态，先分享一条经验。</p>`;
  renderCommunityPager();
}

function renderCommunityPager() {
  const pager = state.communityPagination;
  if (!pager) {
    $("#communityPager").innerHTML = "";
    return;
  }
  $("#communityPager").innerHTML = `
    <button type="button" data-community-page="prev" ${pager.has_prev ? "" : "disabled"}>上一页</button>
    <span>${pager.page}/${pager.pages}</span>
    <button type="button" data-community-page="next" ${pager.has_next ? "" : "disabled"}>下一页</button>
  `;
}

export async function changeCommunityPage(direction) {
  const pager = state.communityPagination || { page: 1 };
  const next = direction === "next" ? pager.page + 1 : pager.page - 1;
  await loadCommunity(next);
}

export async function savePost(event) {
  event.preventDefault();
  if (!state.user) {
    setMessage("#postMessage", "登录后才能发布内容。");
    return;
  }
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const data = await apiFetch("/api/community/posts", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    state.selectedPost = data.post;
    await loadCommunity(1);
    await loadPostDetail(data.post.id);
    setMessage("#postMessage", "分享已发布。");
  } catch (error) {
    setMessage("#postMessage", error.message);
  }
}

export async function loadPostDetail(postId) {
  const data = await apiFetch(`/api/community/posts/${postId}`);
  state.selectedPost = data.post;
  renderPostDetail();
  renderCommunity();
}

function renderPostDetail() {
  const post = state.selectedPost;
  if (!post) {
    $("#postDetailTitle").textContent = "帖子详情";
    $("#postDetail").innerHTML = "选择一条帖子查看评论。";
    renderCommunityAccess();
    return;
  }
  $("#postDetailTitle").textContent = post.title;
  renderCommunityAccess();
  $("#postDetail").innerHTML = `
    <article class="post-detail">
      <span class="topic">${html(post.topic)}</span>
      <div class="rich-text">${richText(post.content)}</div>
      <small>${html(post.author.nickname)} · ${html(post.created_at)} · ${post.likes_count} 赞</small>
    </article>
    <div class="comment-list">
      ${(post.comments || []).map((comment) => `
        <div class="comment-row">
          <strong>${html(comment.author.nickname)}</strong>
          <p>${html(comment.content)}</p>
          <small>${html(comment.created_at)}</small>
        </div>
      `).join("") || "<p>暂无评论。</p>"}
    </div>
  `;
}

export async function saveComment(event) {
  event.preventDefault();
  if (!state.user) {
    setMessage("#commentMessage", "登录后才能评论。");
    return;
  }
  if (!state.selectedPost) return;
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await apiFetch(`/api/community/posts/${state.selectedPost.id}/comments`, { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadPostDetail(state.selectedPost.id);
    setMessage("#commentMessage", "");
  } catch (error) {
    setMessage("#commentMessage", error.message);
  }
}

export async function likePost(postId) {
  if (!state.user) {
    setMessage("#commentMessage", "登录后才能点赞。");
    return;
  }
  await apiFetch(`/api/community/posts/${postId}/like`, { method: "POST" });
  await loadCommunity(state.communityPage);
  if (state.selectedPost?.id === Number(postId)) {
    await loadPostDetail(postId);
  }
}
