import { Hono } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Next } from "hono";

type AppEnv = {
  Bindings: Env;
  Variables: {
    user: UserRow;
    sessionId: string;
  };
};

type AppContext = Context<AppEnv>;

type UserRole = "user" | "admin";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  monthly_limit_cents: number;
  sort_order: number;
};

type EntryRow = {
  id: string;
  category_id: string;
  title: string;
  amount_cents: number;
  kind: "income" | "expense";
  account_name: string;
  scene: string;
  mood: string;
  note: string;
  occurred_on: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  reviewed_at?: string | null;
};

type SavedEntryFilterRow = {
  id: string;
  user_id: string;
  name: string;
  scope: string;
  query: string;
  kind: "all" | "income" | "expense";
  account_name: string;
  category_name: string;
  from_date: string;
  to_date: string;
  min_amount_cents: number;
  max_amount_cents: number;
  created_at: string;
  updated_at: string;
};

type CommunityPostRow = {
  id: string;
  user_id: string;
  topic: string;
  title: string;
  body: string;
  monthly_context: string;
  visibility: "public" | "anonymous";
  created_at: string;
  updated_at: string;
  author_name?: string;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: number;
};

type CommunityCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  visibility?: "public" | "anonymous";
};

type RequestLogRow = {
  id: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  user_id: string | null;
  request_id: string;
  user_agent: string;
  created_at: string;
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const configured = splitOrigins(c.env.APP_ORIGIN);
      if (!origin || configured.includes(origin)) return origin || configured[0] || "*";
      return configured[0] || origin;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Turnstile-Token"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use("*", async (c, next) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  c.header("x-request-id", requestId);
  await next();
  const status = c.res.status || 200;
  const durationMs = Date.now() - startedAt;
  if (!shouldRecordRequest(c, status)) return;
  const write = writeRequestLog(c, requestId, status, durationMs);
  c.executionCtx.waitUntil(write.catch((error) => console.error("monitoring log failed", error)));
});

app.get("/api/health", (c) =>
  c.json({
    code: 0,
    msg: "ok",
    data: {
      app: "Starry Ledger API",
      runtime: "cloudflare-workers",
      time: new Date().toISOString(),
    },
  }),
);

app.get("/api/public/overview", async (c) => {
  const categories = await listCategories(c.env.DB, null);
  return ok(c, {
    appName: "星芒账本",
    tagline: "AI-first personal cashflow cockpit",
    chips: ["30 秒记账", "AI 月度复盘", "今日可花", "心愿反推"],
    categories,
  });
});

app.post("/api/auth/register", async (c) => {
  const body = await readJson(c);
  const ip = getRequestIp(c.req.raw);
  await enforceRateLimit(c.env, `register:${ip}`, 5, 15 * 60);
  await verifyTurnstile(c.env, String(body.turnstileToken || ""), ip);

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const displayName = String(body.displayName || body.name || email.split("@")[0] || "星芒用户").trim().slice(0, 40);
  if (!email) return fail(c, "邮箱格式不正确", 400);
  if (password.length < 8) return fail(c, "密码至少 8 位", 400);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (existing) return fail(c, "这个邮箱已经注册", 409);

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    "INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(userId, email, displayName, passwordHash, now, now)
    .run();

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  if (!user) return fail(c, "注册失败，请稍后重试", 500);
  await createSession(c, user);
  return ok(c, { user: publicUser(user) }, 201);
});

app.post("/api/auth/login", async (c) => {
  const body = await readJson(c);
  const ip = getRequestIp(c.req.raw);
  const email = normalizeEmail(body.email);
  await enforceRateLimit(c.env, `login:${ip}`, 15, 10 * 60);
  if (email) await enforceRateLimit(c.env, `login-email:${email}`, 8, 10 * 60);
  await verifyTurnstile(c.env, String(body.turnstileToken || ""), ip);

  const user = email ? await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>() : null;
  const valid = user ? await verifyPassword(String(body.password || ""), user.password_hash) : false;
  if (!user || !valid) return fail(c, "邮箱或密码不正确", 401);

  await createSession(c, user);
  return ok(c, { user: publicUser(user) });
});

app.post("/api/auth/logout", async (c) => {
  const sessionId = await getSignedSessionId(c);
  if (sessionId) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  deleteCookie(c, cookieName(c.env), { path: "/" });
  return ok(c, { loggedOut: true });
});

app.get("/api/auth/me", requireUser, (c) => ok(c, { user: publicUser(c.get("user")) }));

app.post("/api/admin/bootstrap", async (c) => {
  const body = await readJson(c);
  const ip = getRequestIp(c.req.raw);
  await enforceRateLimit(c.env, `admin-bootstrap:${ip}`, 5, 15 * 60);
  const setupToken = c.req.header("x-admin-setup-token") || String(body.setupToken || "");
  if (!c.env.ADMIN_SETUP_TOKEN || !constantTimeEqual(setupToken, c.env.ADMIN_SETUP_TOKEN)) {
    return fail(c, "管理员初始化口令不正确", 403);
  }
  const existingAdmin = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").first<{ id: string }>();
  if (existingAdmin) return fail(c, "管理员已存在，请使用管理员账号登录", 409);

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const displayName = String(body.displayName || body.name || "星芒管理员").trim().slice(0, 40);
  if (!email) return fail(c, "邮箱格式不正确", 400);
  if (password.length < 12) return fail(c, "管理员密码至少 12 位", 400);

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  const userId = existingUser?.id || crypto.randomUUID();
  if (existingUser) {
    await c.env.DB.prepare("UPDATE users SET display_name = ?, password_hash = ?, role = 'admin', updated_at = ? WHERE id = ?")
      .bind(displayName, passwordHash, now, userId)
      .run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)",
    )
      .bind(userId, email, displayName, passwordHash, now, now)
      .run();
  }

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  if (!user) return fail(c, "管理员初始化失败，请稍后重试", 500);
  await createSession(c, user);
  return ok(c, { user: publicUser(user) }, 201);
});

app.get("/api/admin/overview", requireAdmin, async (c) => {
  return ok(c, await buildAdminOverview(c.env.DB, c.get("user")));
});

app.get("/api/admin/users", requireAdmin, async (c) => {
  return ok(c, { users: await listAdminUsers(c.env.DB) });
});

app.patch("/api/admin/users/:id/role", requireAdmin, async (c) => {
  const currentUser = c.get("user");
  const targetId = c.req.param("id") || "";
  const body = await readJson(c);
  const role = normalizeRole(body.role);
  if (!role) return fail(c, "角色不正确", 400);
  const target = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(targetId).first<UserRow>();
  if (!target) return fail(c, "用户不存在", 404);
  if (target.id === currentUser.id && role !== "admin") return fail(c, "不能取消自己的管理员权限", 400);
  if (target.role === "admin" && role !== "admin") {
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").first<{ count: number }>();
    if (Number(count?.count || 0) <= 1) return fail(c, "至少保留一个管理员", 400);
  }
  await c.env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(role, new Date().toISOString(), targetId).run();
  const updated = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(targetId).first<UserRow>();
  return ok(c, { user: updated ? adminUserDto(updated) : null });
});

app.get("/api/categories", requireUser, async (c) => {
  const user = c.get("user");
  return ok(c, { categories: await listCategories(c.env.DB, user.id) });
});

app.get("/api/dashboard", requireUser, async (c) => {
  const month = normalizeMonth(c.req.query("month"));
  return ok(c, await buildDashboard(c.env.DB, c.get("user"), month));
});

app.get("/api/entries", requireUser, async (c) => {
  const month = normalizeMonth(c.req.query("month"));
  const user = c.get("user");
  const { start, end } = monthWindow(month);
  const query = String(c.req.query("q") || "").trim().toLowerCase().slice(0, 80);
  const kind = c.req.query("kind") === "income" || c.req.query("kind") === "expense" ? c.req.query("kind") : "";
  const account = String(c.req.query("account") || "").trim().slice(0, 40);
  const categoryId = String(c.req.query("categoryId") || "").trim().slice(0, 80);
  const from = normalizeDate(c.req.query("from"));
  const to = normalizeDate(c.req.query("to"));
  const minAmount = toCents(c.req.query("minAmount"));
  const maxAmount = toCents(c.req.query("maxAmount"));
  const limit = clampEntryLimit(c.req.query("limit"));
  const clauses = ["e.user_id = ?", "e.occurred_on >= ?", "e.occurred_on < ?"];
  const binds: Array<string | number> = [user.id, start, end];
  if (kind) {
    clauses.push("e.kind = ?");
    binds.push(kind);
  }
  if (account) {
    clauses.push("e.account_name = ?");
    binds.push(account);
  }
  if (categoryId) {
    clauses.push("e.category_id = ?");
    binds.push(categoryId);
  }
  if (query) {
    clauses.push("(LOWER(e.title) LIKE ? OR LOWER(e.account_name) LIKE ? OR LOWER(e.scene) LIKE ? OR LOWER(e.note) LIKE ? OR LOWER(c.name) LIKE ?)");
    const like = `%${query}%`;
    binds.push(like, like, like, like, like);
  }
  if (from) {
    clauses.push("e.occurred_on >= ?");
    binds.push(from);
  }
  if (to) {
    clauses.push("e.occurred_on <= ?");
    binds.push(to);
  }
  if (minAmount > 0) {
    clauses.push("e.amount_cents >= ?");
    binds.push(minAmount);
  }
  if (maxAmount > 0) {
    clauses.push("e.amount_cents <= ?");
    binds.push(maxAmount);
  }
  const where = clauses.join(" AND ");
  const rows = await c.env.DB.prepare(
    `SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color, r.reviewed_at AS reviewed_at
     FROM ledger_entries e
     JOIN categories c ON c.id = e.category_id
     LEFT JOIN entry_review_states r ON r.entry_id = e.id AND r.user_id = e.user_id
     WHERE ${where}
     ORDER BY e.occurred_on DESC, e.created_at DESC
     LIMIT ?`,
  )
    .bind(...binds, limit)
    .all<EntryRow>();
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM ledger_entries e
     JOIN categories c ON c.id = e.category_id
     WHERE ${where}`,
  )
    .bind(...binds)
    .first<{ count: number }>();
  return ok(c, { entries: (rows.results || []).map(entryDto), total: Number(total?.count || 0), limit });
});

app.post("/api/entries", requireUser, async (c) => {
  const user = c.get("user");
  const ip = getRequestIp(c.req.raw);
  await enforceRateLimit(c.env, `write-entry:${user.id}:${ip}`, 60, 60);
  const body = await readJson(c);
  const payload = normalizeEntryPayload(body);
  const category = await findVisibleCategory(c.env.DB, user.id, payload.categoryId);
  if (!category) return fail(c, "分类不存在", 404);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO ledger_entries
      (id, user_id, category_id, title, amount_cents, kind, account_name, scene, mood, note, occurred_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.id,
      category.id,
      payload.title,
      payload.amountCents,
      payload.kind,
      payload.accountName,
      payload.scene,
      payload.mood,
      payload.note,
      payload.occurredOn,
      now,
      now,
    )
    .run();

  const row = await getEntry(c.env.DB, user.id, id);
  return ok(c, { entry: row ? entryDto(row) : null }, 201);
});

app.put("/api/entries/:id", requireUser, async (c) => {
  const user = c.get("user");
  const entryId = c.req.param("id") || "";
  const existing = await getEntry(c.env.DB, user.id, entryId);
  if (!existing) return fail(c, "流水不存在", 404);
  const body = await readJson(c);
  const payload = normalizeEntryPayload(body);
  const category = await findVisibleCategory(c.env.DB, user.id, payload.categoryId);
  if (!category) return fail(c, "分类不存在", 404);
  await c.env.DB.prepare(
    `UPDATE ledger_entries
     SET category_id = ?, title = ?, amount_cents = ?, kind = ?, account_name = ?, scene = ?, mood = ?, note = ?, occurred_on = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(
      category.id,
      payload.title,
      payload.amountCents,
      payload.kind,
      payload.accountName,
      payload.scene,
      payload.mood,
      payload.note,
      payload.occurredOn,
      new Date().toISOString(),
      entryId,
      user.id,
    )
    .run();
  const row = await getEntry(c.env.DB, user.id, entryId);
  return ok(c, { entry: row ? entryDto(row) : null });
});

app.post("/api/entries/:id/review", requireUser, async (c) => {
  const user = c.get("user");
  const entryId = c.req.param("id") || "";
  const body = await readJson(c);
  const reviewed = body.reviewed !== false;
  const existing = await getEntry(c.env.DB, user.id, entryId);
  if (!existing) return fail(c, "流水不存在", 404);
  if (!reviewed) {
    await c.env.DB.prepare("DELETE FROM entry_review_states WHERE user_id = ? AND entry_id = ?").bind(user.id, entryId).run();
  } else {
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO entry_review_states (user_id, entry_id, status, note, reviewed_at, updated_at)
       VALUES (?, ?, 'reviewed', ?, ?, ?)
       ON CONFLICT(user_id, entry_id) DO UPDATE SET
        status = 'reviewed',
        note = excluded.note,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at`,
    )
      .bind(user.id, entryId, String(body.note || "").trim().slice(0, 180), now, now)
      .run();
  }
  const row = await getEntry(c.env.DB, user.id, entryId);
  return ok(c, { entry: row ? entryDto(row) : null });
});

app.delete("/api/entries/:id", requireUser, async (c) => {
  const user = c.get("user");
  const entryId = c.req.param("id") || "";
  const existing = await getEntry(c.env.DB, user.id, entryId);
  if (!existing) return fail(c, "流水不存在", 404);
  await c.env.DB.prepare("DELETE FROM ledger_entries WHERE id = ? AND user_id = ?").bind(entryId, user.id).run();
  return ok(c, { deletedId: entryId });
});

app.get("/api/entry-filters", requireUser, async (c) => {
  const user = c.get("user");
  const scope = normalizeFilterScope(c.req.query("scope"));
  const rows = await c.env.DB.prepare("SELECT * FROM saved_entry_filters WHERE user_id = ? AND scope = ? ORDER BY updated_at DESC LIMIT 30")
    .bind(user.id, scope)
    .all<SavedEntryFilterRow>();
  return ok(c, { filters: (rows.results || []).map(savedEntryFilterDto) });
});

app.post("/api/entry-filters", requireUser, async (c) => {
  const user = c.get("user");
  const body = await readJson(c);
  const payload = normalizeSavedEntryFilterPayload(body);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO saved_entry_filters
      (id, user_id, name, scope, query, kind, account_name, category_name, from_date, to_date, min_amount_cents, max_amount_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.id,
      payload.name,
      payload.scope,
      payload.query,
      payload.kind,
      payload.accountName,
      payload.categoryName,
      payload.fromDate,
      payload.toDate,
      payload.minAmountCents,
      payload.maxAmountCents,
      now,
      now,
    )
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM saved_entry_filters WHERE id = ? AND user_id = ?").bind(id, user.id).first<SavedEntryFilterRow>();
  return ok(c, { filter: row ? savedEntryFilterDto(row) : null }, 201);
});

app.delete("/api/entry-filters/:id", requireUser, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id") || "";
  const existing = await c.env.DB.prepare("SELECT id FROM saved_entry_filters WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first<{ id: string }>();
  if (!existing) return fail(c, "筛选视图不存在", 404);
  await c.env.DB.prepare("DELETE FROM saved_entry_filters WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  return ok(c, { deletedId: id });
});

app.post("/api/entries/parse", requireUser, async (c) => {
  const body = await readJson(c);
  const text = String(body.text || "").trim();
  if (!text) return fail(c, "请输入要解析的账本线索", 400);
  const categories = await listCategories(c.env.DB, c.get("user").id);
  return ok(c, { parsed: parseLedgerText(text, categories) });
});

app.get("/api/goals", requireUser, async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM saving_goals WHERE user_id = ? ORDER BY created_at DESC")
    .bind(c.get("user").id)
    .all<Record<string, unknown>>();
  return ok(c, { goals: (rows.results || []).map(goalDto) });
});

app.post("/api/goals", requireUser, async (c) => {
  const user = c.get("user");
  const body = await readJson(c);
  const name = String(body.name || "").trim().slice(0, 80);
  const targetCents = toCents(body.target);
  const savedCents = toCents(body.saved || 0);
  const deadline = normalizeDate(body.deadline) || addDays(120);
  if (!name) return fail(c, "目标名称不能为空", 400);
  if (targetCents <= 0) return fail(c, "目标金额必须大于 0", 400);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO saving_goals (id, user_id, name, target_cents, saved_cents, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)",
  )
    .bind(id, user.id, name, targetCents, savedCents, deadline, now, now)
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM saving_goals WHERE id = ? AND user_id = ?").bind(id, user.id).first<Record<string, unknown>>();
  return ok(c, { goal: row ? goalDto(row) : null }, 201);
});

app.post("/api/goals/:id/deposit", requireUser, async (c) => {
  const user = c.get("user");
  const goalId = c.req.param("id") || "";
  const body = await readJson(c);
  const amountCents = toCents(body.amount || 20);
  if (amountCents <= 0) return fail(c, "转入金额必须大于 0", 400);

  const existing = await c.env.DB.prepare("SELECT * FROM saving_goals WHERE id = ? AND user_id = ?").bind(goalId, user.id).first<Record<string, unknown>>();
  if (!existing) return fail(c, "目标不存在", 404);

  await c.env.DB.prepare(
    `UPDATE saving_goals
     SET saved_cents = CASE
        WHEN saved_cents + ? >= target_cents THEN target_cents
        ELSE saved_cents + ?
      END,
      status = CASE WHEN saved_cents + ? >= target_cents THEN 'completed' ELSE status END,
      updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(amountCents, amountCents, amountCents, new Date().toISOString(), goalId, user.id)
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM saving_goals WHERE id = ? AND user_id = ?").bind(goalId, user.id).first<Record<string, unknown>>();
  return ok(c, { goal: row ? goalDto(row) : null });
});

app.post("/api/ai/coach", requireUser, async (c) => {
  const body = await readJson(c);
  const month = normalizeMonth(String(body.month || ""));
  const dashboard = await buildDashboard(c.env.DB, c.get("user"), month);
  const question = String(body.question || "").trim();
  const fallbackAnswer = buildCoachAnswer(question, dashboard);
  let answer = fallbackAnswer;
  let source = "rules";
  if (c.env.MIMO_API_KEY) {
    try {
      answer = await buildMimoCoachAnswer(c.env, question, dashboard);
      source = "mimo";
    } catch (error) {
      console.error("mimo coach failed", error);
    }
  }
  return ok(c, {
    answer,
    actions: buildCoachActions(dashboard),
    source,
  });
});

app.get("/api/community/posts", requireUser, async (c) => {
  const user = c.get("user");
  const topic = normalizeCommunityTopic(c.req.query("topic") || "all");
  return ok(c, { posts: await listCommunityPosts(c.env.DB, user.id, topic) });
});

app.post("/api/community/posts", requireUser, async (c) => {
  const user = c.get("user");
  const ip = getRequestIp(c.req.raw);
  await enforceRateLimit(c.env, `community-post:${user.id}:${ip}`, 12, 60 * 60);
  const body = await readJson(c);
  const payload = normalizeCommunityPostPayload(body);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO community_posts
      (id, user_id, topic, title, body, monthly_context, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, user.id, payload.topic, payload.title, payload.body, payload.monthlyContext, payload.visibility, now, now)
    .run();
  const post = await getCommunityPost(c.env.DB, user.id, id);
  return ok(c, { post }, 201);
});

app.post("/api/community/posts/:id/like", requireUser, async (c) => {
  const user = c.get("user");
  const postId = c.req.param("id") || "";
  const existingPost = await c.env.DB.prepare("SELECT id FROM community_posts WHERE id = ?").bind(postId).first<{ id: string }>();
  if (!existingPost) return fail(c, "帖子不存在", 404);
  const existingLike = await c.env.DB.prepare("SELECT post_id FROM community_post_reactions WHERE post_id = ? AND user_id = ?")
    .bind(postId, user.id)
    .first<{ post_id: string }>();
  if (existingLike) {
    await c.env.DB.prepare("DELETE FROM community_post_reactions WHERE post_id = ? AND user_id = ?").bind(postId, user.id).run();
  } else {
    await c.env.DB.prepare("INSERT INTO community_post_reactions (post_id, user_id, created_at) VALUES (?, ?, ?)")
      .bind(postId, user.id, new Date().toISOString())
      .run();
  }
  return ok(c, { post: await getCommunityPost(c.env.DB, user.id, postId) });
});

app.post("/api/community/posts/:id/comments", requireUser, async (c) => {
  const user = c.get("user");
  const ip = getRequestIp(c.req.raw);
  await enforceRateLimit(c.env, `community-comment:${user.id}:${ip}`, 30, 60 * 60);
  const postId = c.req.param("id") || "";
  const existingPost = await c.env.DB.prepare("SELECT id FROM community_posts WHERE id = ?").bind(postId).first<{ id: string }>();
  if (!existingPost) return fail(c, "帖子不存在", 404);
  const body = await readJson(c);
  const commentBody = String(body.body || "").trim().slice(0, 360);
  if (commentBody.length < 2) return fail(c, "回复至少 2 个字", 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO community_comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, postId, user.id, commentBody, new Date().toISOString())
    .run();
  return ok(c, { post: await getCommunityPost(c.env.DB, user.id, postId) }, 201);
});

app.get("/api/monitor/overview", requireUser, async (c) => {
  return ok(c, await buildMonitorOverview(c.env.DB, c.req.query("window") || "6h", monitoringSampleRate(c.env)));
});

app.post("/api/dev/seed-test-account", async (c) => {
  if (!canSeedTestAccount(c)) return fail(c, "当前环境不允许生成测试账户", 403);
  const result = await seedTestAccount(c.env.DB);
  return ok(c, result, 201);
});

app.notFound((c) => fail(c, "接口不存在", 404));

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return fail(c, error.message, error.status);
  }
  console.error(error);
  return fail(c, "服务暂时不可用", 500);
});

export default app;

async function requireUser(c: AppContext, next: Next) {
  const sessionId = await getSignedSessionId(c);
  if (!sessionId) return fail(c, "请先登录", 401);
  const now = new Date().toISOString();
  const row = await c.env.DB.prepare(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sessionId, now)
    .first<UserRow>();
  if (!row) {
    deleteCookie(c, cookieName(c.env), { path: "/" });
    return fail(c, "登录已失效，请重新登录", 401);
  }
  c.set("user", row);
  c.set("sessionId", sessionId);
  await next();
}

async function requireAdmin(c: AppContext, next: Next) {
  const blocked = await requireUser(c, async () => undefined);
  if (blocked) return blocked;
  const user = c.get("user");
  if (normalizeRole(user.role) !== "admin") return fail(c, "需要管理员权限", 403);
  await next();
}

async function readJson(c: AppContext): Promise<Record<string, unknown>> {
  const body = await c.req.json().catch(() => ({}));
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

function ok(c: AppContext, data: unknown = {}, status = 200) {
  return c.json({ code: 0, msg: "success", data }, status as 200);
}

function fail(c: AppContext, msg: string, status = 400) {
  return c.json({ code: status, msg, data: {} }, status as 400);
}

function splitOrigins(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeMonth(value: unknown) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function monthWindow(month: string) {
  const [yearRaw, monthRaw] = month.split("-").map(Number);
  const year = yearRaw || new Date().getUTCFullYear();
  const monthIndex = Math.max(0, Math.min(11, (monthRaw || 1) - 1));
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    daysInMonth: new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(),
  };
}

function addDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toCents(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

function clampEntryLimit(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 200;
  return Math.max(1, Math.min(Math.round(number), 500));
}

function fromCents(value: unknown) {
  return Math.round(Number(value || 0)) / 100;
}

function getRequestIp(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

async function enforceRateLimit(env: Env, key: string, max: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const bucketKey = `${key}:${bucket}`;
  const expiresAt = (bucket + 1) * windowSeconds;
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run();
  }
  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket_key, count, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at`,
  )
    .bind(bucketKey, expiresAt)
    .run();
  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE bucket_key = ?").bind(bucketKey).first<{ count: number }>();
  if ((row?.count || 0) > max) {
    throw new ApiError("请求过于频繁，请稍后再试", 429);
  }
}

async function verifyTurnstile(env: Env, token: string, ip: string) {
  if (!env.TURNSTILE_SECRET) return;
  if (!token) {
    throw new ApiError("缺少防刷验证", 400);
  }
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  form.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const result = (await response.json().catch(() => ({}))) as { success?: boolean };
  if (!result.success) {
    throw new ApiError("防刷验证失败，请刷新后重试", 400);
  }
}

function cookieName(env: Env) {
  return env.SESSION_COOKIE_NAME || "starry_session";
}

async function createSession(c: AppContext, user: UserRow) {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  const ipHash = await sha256(getRequestIp(c.req.raw));
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(sessionId, user.id, now.toISOString(), expires.toISOString(), c.req.header("user-agent") || "", ipHash)
    .run();
  const token = await signSessionId(c.env, sessionId);
  setCookie(c, cookieName(c.env), token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== "development",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function getSignedSessionId(c: AppContext) {
  const token = getCookie(c, cookieName(c.env));
  if (!token) return "";
  const [sessionId, signature] = token.split(".");
  if (!sessionId || !signature) return "";
  const expected = await signValue(sessionId, sessionSecret(c.env));
  return constantTimeEqual(signature, expected) ? sessionId : "";
}

async function signSessionId(env: Env, sessionId: string) {
  return `${sessionId}.${await signValue(sessionId, sessionSecret(env))}`;
}

function sessionSecret(env: Env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.ENVIRONMENT === "production") throw new Error("SESSION_SECRET is required in production");
  return "dev-only-starry-ledger-session-secret-change-me";
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100_000;
  const bits = await pbkdf2(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string) {
  const [method, iterationsRaw, saltRaw, hashRaw] = stored.split("$");
  if (method !== "pbkdf2-sha256" || !iterationsRaw || !saltRaw || !hashRaw) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 100_000) return false;
  const salt = base64urlDecode(saltRaw);
  const bits = await pbkdf2(password, salt, iterations);
  return constantTimeEqual(base64url(new Uint8Array(bits)), hashRaw);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt: arrayBuffer(salt), iterations, hash: "SHA-256" }, key, 256);
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, utf8(value));
  return base64url(new Uint8Array(signature));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", utf8(value));
  return base64url(new Uint8Array(digest));
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function arrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: normalizeRole(user.role) || "user",
  };
}

function adminUserDto(user: UserRow & { entry_count?: number; last_session_at?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: normalizeRole(user.role) || "user",
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    entryCount: Number(user.entry_count || 0),
    lastSessionAt: user.last_session_at || "",
  };
}

function normalizeRole(value: unknown): UserRole | "" {
  return value === "admin" || value === "user" ? value : "";
}

async function listCategories(db: D1Database, userId: string | null) {
  const rows = userId
    ? await db
        .prepare("SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY sort_order, name")
        .bind(userId)
        .all<CategoryRow>()
    : await db.prepare("SELECT * FROM categories WHERE user_id IS NULL ORDER BY sort_order, name").all<CategoryRow>();
  return (rows.results || []).map(categoryDto);
}

function categoryDto(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    monthlyLimit: fromCents(row.monthly_limit_cents),
    userOwned: Boolean(row.user_id),
  };
}

async function findVisibleCategory(db: D1Database, userId: string, categoryId: string) {
  return db
    .prepare("SELECT * FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)")
    .bind(categoryId, userId)
    .first<CategoryRow>();
}

function normalizeEntryPayload(body: Record<string, unknown>) {
  const title = String(body.title || "").trim().slice(0, 80);
  const categoryId = String(body.categoryId || body.category_id || "").trim();
  const kind = String(body.kind || "expense") === "income" ? "income" : "expense";
  const amountCents = toCents(body.amount);
  const occurredOn = normalizeDate(body.occurredOn || body.occurred_on) || new Date().toISOString().slice(0, 10);
  if (!title) throw new ApiError("标题不能为空", 400);
  if (!categoryId) throw new ApiError("分类不能为空", 400);
  if (amountCents <= 0) throw new ApiError("金额必须大于 0", 400);
  return {
    title,
    categoryId,
    kind,
    amountCents,
    occurredOn,
    accountName: String(body.accountName || body.account_name || "星芒钱包").trim().slice(0, 40),
    scene: String(body.scene || "").trim().slice(0, 40),
    mood: String(body.mood || "").trim().slice(0, 20),
    note: String(body.note || "").trim().slice(0, 180),
  };
}

function normalizeFilterScope(value: unknown) {
  const raw = String(value || "entries").trim().slice(0, 30);
  return raw || "entries";
}

function normalizeSavedEntryFilterPayload(body: Record<string, unknown>) {
  const name = String(body.name || "").trim().slice(0, 40);
  if (!name) throw new ApiError("筛选视图名称不能为空", 400);
  const kindRaw = String(body.kind || "all");
  const kind = kindRaw === "income" || kindRaw === "expense" ? kindRaw : "all";
  return {
    name,
    scope: normalizeFilterScope(body.scope),
    query: String(body.query || "").trim().slice(0, 120),
    kind,
    accountName: String(body.accountName || body.account_name || "全部账户").trim().slice(0, 40) || "全部账户",
    categoryName: String(body.categoryName || body.category_name || "全部分类").trim().slice(0, 40) || "全部分类",
    fromDate: normalizeDate(body.fromDate || body.from_date),
    toDate: normalizeDate(body.toDate || body.to_date),
    minAmountCents: Math.max(toCents(body.minAmount || body.min_amount), 0),
    maxAmountCents: Math.max(toCents(body.maxAmount || body.max_amount), 0),
  };
}

function savedEntryFilterDto(row: SavedEntryFilterRow) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    query: row.query,
    kind: row.kind,
    accountName: row.account_name,
    categoryName: row.category_name,
    fromDate: row.from_date,
    toDate: row.to_date,
    minAmount: fromCents(row.min_amount_cents),
    maxAmount: fromCents(row.max_amount_cents),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getEntry(db: D1Database, userId: string, entryId: string) {
  return db
    .prepare(
      `SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color, r.reviewed_at AS reviewed_at
       FROM ledger_entries e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN entry_review_states r ON r.entry_id = e.id AND r.user_id = e.user_id
       WHERE e.id = ? AND e.user_id = ?`,
    )
    .bind(entryId, userId)
    .first<EntryRow>();
}

function entryDto(row: EntryRow) {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    amount: fromCents(row.amount_cents),
    kind: row.kind,
    accountName: row.account_name,
    scene: row.scene,
    mood: row.mood,
    note: row.note,
    occurredOn: row.occurred_on,
    reviewedAt: row.reviewed_at || "",
    category: {
      name: row.category_name || "未分类",
      icon: row.category_icon || "circle",
      color: row.category_color || "#10a99a",
    },
  };
}

const communityTopics = new Set(["monthly-review", "saving-challenge", "purchase-check", "student-life", "product-ideas"]);

function normalizeCommunityTopic(value: unknown) {
  const topic = String(value || "all").trim();
  if (topic === "all") return "all";
  return communityTopics.has(topic) ? topic : "monthly-review";
}

function normalizeCommunityPostPayload(body: Record<string, unknown>) {
  const topic = normalizeCommunityTopic(body.topic);
  const bodyText = String(body.body || "").trim().slice(0, 1200);
  const title = String(body.title || bodyText.slice(0, 32) || "账本复盘")
    .trim()
    .slice(0, 80);
  const visibility = String(body.visibility || "public") === "anonymous" ? "anonymous" : "public";
  const monthlyContext = String(body.monthlyContext || body.month || "").trim().slice(0, 24);
  if (topic === "all") throw new ApiError("请选择一个社区话题", 400);
  if (title.length < 2) throw new ApiError("标题至少 2 个字", 400);
  if (bodyText.length < 8) throw new ApiError("内容至少 8 个字", 400);
  return { topic, title, body: bodyText, visibility, monthlyContext };
}

async function listCommunityPosts(db: D1Database, viewerId: string, topic: string) {
  const rows =
    topic === "all"
      ? await db
          .prepare(
            `SELECT p.*, u.display_name AS author_name,
              (SELECT COUNT(*) FROM community_post_reactions r WHERE r.post_id = p.id) AS like_count,
              (SELECT COUNT(*) FROM community_comments cm WHERE cm.post_id = p.id) AS comment_count,
              EXISTS(SELECT 1 FROM community_post_reactions mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me
             FROM community_posts p
             JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC
             LIMIT 50`,
          )
          .bind(viewerId)
          .all<CommunityPostRow>()
      : await db
          .prepare(
            `SELECT p.*, u.display_name AS author_name,
              (SELECT COUNT(*) FROM community_post_reactions r WHERE r.post_id = p.id) AS like_count,
              (SELECT COUNT(*) FROM community_comments cm WHERE cm.post_id = p.id) AS comment_count,
              EXISTS(SELECT 1 FROM community_post_reactions mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me
             FROM community_posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.topic = ?
             ORDER BY p.created_at DESC
             LIMIT 50`,
          )
          .bind(viewerId, topic)
          .all<CommunityPostRow>();
  return attachCommunityComments(db, viewerId, rows.results || []);
}

async function getCommunityPost(db: D1Database, viewerId: string, postId: string) {
  const row = await db
    .prepare(
      `SELECT p.*, u.display_name AS author_name,
        (SELECT COUNT(*) FROM community_post_reactions r WHERE r.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM community_comments cm WHERE cm.post_id = p.id) AS comment_count,
        EXISTS(SELECT 1 FROM community_post_reactions mine WHERE mine.post_id = p.id AND mine.user_id = ?) AS liked_by_me
       FROM community_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
    )
    .bind(viewerId, postId)
    .first<CommunityPostRow>();
  if (!row) return null;
  const [post] = await attachCommunityComments(db, viewerId, [row]);
  return post;
}

async function attachCommunityComments(db: D1Database, viewerId: string, posts: CommunityPostRow[]) {
  if (!posts.length) return [];
  const placeholders = posts.map(() => "?").join(",");
  const commentRows = await db
    .prepare(
      `SELECT cm.*, u.display_name AS author_name, p.visibility
       FROM community_comments cm
       JOIN users u ON u.id = cm.user_id
       JOIN community_posts p ON p.id = cm.post_id
       WHERE cm.post_id IN (${placeholders})
       ORDER BY cm.created_at ASC`,
    )
    .bind(...posts.map((post) => post.id))
    .all<CommunityCommentRow>();
  const commentsByPost = new Map<string, CommunityCommentRow[]>();
  for (const comment of commentRows.results || []) {
    commentsByPost.set(comment.post_id, [...(commentsByPost.get(comment.post_id) || []), comment]);
  }
  return posts.map((post) => communityPostDto(post, viewerId, commentsByPost.get(post.id) || []));
}

function communityPostDto(row: CommunityPostRow, viewerId: string, comments: CommunityCommentRow[] = []) {
  const anonymous = row.visibility === "anonymous";
  return {
    id: row.id,
    topic: row.topic,
    title: row.title,
    body: row.body,
    monthlyContext: row.monthly_context,
    visibility: row.visibility,
    authorName: anonymous ? "匿名账友" : row.author_name || "星芒用户",
    isMine: row.user_id === viewerId,
    likeCount: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || comments.length || 0),
    likedByMe: Boolean(row.liked_by_me),
    createdAt: row.created_at,
    comments: comments.map((comment) => communityCommentDto(comment, row.visibility)),
  };
}

function communityCommentDto(row: CommunityCommentRow, postVisibility: string) {
  return {
    id: row.id,
    body: row.body,
    authorName: postVisibility === "anonymous" ? "匿名账友" : row.author_name || "星芒用户",
    createdAt: row.created_at,
  };
}

function monitoringSampleRate(env: Env) {
  const configured = Number(env.MONITOR_SAMPLE_RATE || 0.35);
  if (!Number.isFinite(configured)) return 0.35;
  return Math.max(0.05, Math.min(configured, 1));
}

function shouldRecordRequest(c: AppContext, status: number) {
  const path = c.req.path;
  if (path.includes("/api/health")) return Math.random() < 0.1;
  if (path.includes("/api/monitor/overview")) return Math.random() < 0.25;
  if (status >= 400) return true;
  if (c.req.method !== "GET") return true;
  return Math.random() < monitoringSampleRate(c.env);
}

async function writeRequestLog(c: AppContext, requestId: string, status: number, durationMs: number) {
  let userId = "";
  try {
    userId = c.get("user")?.id || "";
  } catch {
    userId = "";
  }
  await c.env.DB.prepare(
    `INSERT INTO api_request_logs
      (id, sampled, method, path, status, duration_ms, user_id, request_id, ip_hash, user_agent, created_at)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      c.req.method,
      normalizeRequestPath(c.req.path),
      status,
      Math.max(0, Math.round(durationMs)),
      userId || null,
      requestId,
      await sha256(getRequestIp(c.req.raw)),
      (c.req.header("user-agent") || "").slice(0, 160),
      new Date().toISOString(),
    )
    .run();
}

function normalizeRequestPath(path: string) {
  return path
    .replace(/\/api\/entries\/[^/]+$/, "/api/entries/:id")
    .replace(/\/api\/goals\/[^/]+\/deposit$/, "/api/goals/:id/deposit")
    .replace(/\/api\/community\/posts\/[^/]+\/like$/, "/api/community/posts/:id/like")
    .replace(/\/api\/community\/posts\/[^/]+\/comments$/, "/api/community/posts/:id/comments");
}

async function buildAdminOverview(db: D1Database, currentUser: UserRow) {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [userCount, adminCount, entryCount, postCount, commentCount, requestCount, errorCount, activeSessionCount, users] =
    await Promise.all([
      countSql(db, "SELECT COUNT(*) AS count FROM users"),
      countSql(db, "SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"),
      countSql(db, "SELECT COUNT(*) AS count FROM ledger_entries"),
      countSql(db, "SELECT COUNT(*) AS count FROM community_posts"),
      countSql(db, "SELECT COUNT(*) AS count FROM community_comments"),
      countSql(db, "SELECT COUNT(*) AS count FROM api_request_logs WHERE created_at >= ?", [since24h]),
      countSql(db, "SELECT COUNT(*) AS count FROM api_request_logs WHERE created_at >= ? AND status >= 400", [since24h]),
      countSql(db, "SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?", [new Date(now).toISOString()]),
      listAdminUsers(db),
    ]);
  const recentRequests = await db
    .prepare(
      `SELECT l.id, l.method, l.path, l.status, l.duration_ms, l.user_id, l.request_id, l.user_agent, l.created_at, u.email AS user_email
       FROM api_request_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 30`,
    )
    .all<RequestLogRow & { user_email?: string }>();
  const endpointRows = await db
    .prepare(
      `SELECT method, path, COUNT(*) AS count,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors,
        ROUND(AVG(duration_ms)) AS avg_ms
       FROM api_request_logs
       WHERE created_at >= ?
       GROUP BY method, path
       ORDER BY count DESC
       LIMIT 10`,
    )
    .bind(since24h)
    .all<{ method: string; path: string; count: number; errors: number; avg_ms: number }>();

  return {
    currentUser: publicUser(currentUser),
    generatedAt: new Date(now).toISOString(),
    summary: {
      users: userCount,
      admins: adminCount,
      activeSessions: activeSessionCount,
      entries: entryCount,
      communityPosts: postCount,
      communityComments: commentCount,
      requests24h: requestCount,
      errorRate24h: requestCount ? Math.round((errorCount / requestCount) * 1000) / 10 : 0,
    },
    users,
    recentRequests: (recentRequests.results || []).map((row) => ({
      id: row.id,
      method: row.method,
      path: row.path,
      status: row.status,
      durationMs: row.duration_ms,
      requestId: row.request_id,
      userEmail: row.user_email || "",
      createdAt: row.created_at,
      userAgent: row.user_agent,
    })),
    topEndpoints: (endpointRows.results || []).map((row) => ({
      method: row.method,
      path: row.path,
      count: Number(row.count || 0),
      errors: Number(row.errors || 0),
      avgMs: Number(row.avg_ms || 0),
    })),
  };
}

async function listAdminUsers(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT u.*, COUNT(DISTINCT e.id) AS entry_count, MAX(s.created_at) AS last_session_at
       FROM users u
       LEFT JOIN ledger_entries e ON e.user_id = u.id
       LEFT JOIN sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.created_at DESC
       LIMIT 80`,
    )
    .all<UserRow & { entry_count: number; last_session_at: string | null }>();
  return (rows.results || []).map(adminUserDto);
}

async function countSql(db: D1Database, sql: string, binds: Array<string | number> = []) {
  const row = await db
    .prepare(sql)
    .bind(...binds)
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

async function buildMonitorOverview(db: D1Database, windowRaw: string, sampleRate: number) {
  const windowMs = monitorWindowMs(windowRaw);
  const now = Date.now();
  const since = new Date(now - windowMs).toISOString();
  const rows = await db
    .prepare(
      `SELECT id, method, path, status, duration_ms, user_id, request_id, user_agent, created_at
       FROM api_request_logs
       WHERE created_at >= ?
       ORDER BY created_at DESC
       LIMIT 1200`,
    )
    .bind(since)
    .all<RequestLogRow>();
  const requests = rows.results || [];
  const durations = requests.map((row) => row.duration_ms).sort((a, b) => a - b);
  const errors = requests.filter((row) => row.status >= 400);
  const writes = requests.filter((row) => row.method !== "GET");
  const p95 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : 0;
  const avg = durations.length ? Math.round(durations.reduce((sum, item) => sum + item, 0) / durations.length) : 0;
  return {
    window: `${Math.round(windowMs / 3600000)}h`,
    sampleRate,
    generatedAt: new Date(now).toISOString(),
    summary: {
      capturedRequests: requests.length,
      writeRequests: writes.length,
      errorRate: requests.length ? Math.round((errors.length / requests.length) * 1000) / 10 : 0,
      avgDurationMs: avg,
      p95DurationMs: p95 || 0,
      requestsPerMinute: requests.length ? Math.round((requests.length / (windowMs / 60000)) * 10) / 10 : 0,
    },
    series: buildMonitorSeries(requests, now, windowMs),
    endpoints: buildEndpointStats(requests),
    recent: requests.slice(0, 18).map((row) => ({
      id: row.id,
      method: row.method,
      path: row.path,
      status: row.status,
      durationMs: row.duration_ms,
      requestId: row.request_id,
      createdAt: row.created_at,
      userAgent: row.user_agent,
    })),
  };
}

function monitorWindowMs(value: string) {
  if (value === "24h") return 24 * 60 * 60 * 1000;
  if (value === "1h") return 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

function buildMonitorSeries(rows: RequestLogRow[], now: number, windowMs: number) {
  const bucketCount = 12;
  const bucketMs = windowMs / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = now - windowMs + bucketMs * index;
    return {
      label: new Date(bucketStart).toISOString().slice(11, 16),
      requests: 0,
      errors: 0,
      avgMs: 0,
      totalMs: 0,
    };
  });
  rows.forEach((row) => {
    const time = new Date(row.created_at).getTime();
    const index = Math.max(0, Math.min(bucketCount - 1, Math.floor((time - (now - windowMs)) / bucketMs)));
    const bucket = buckets[index];
    if (!bucket) return;
    bucket.requests += 1;
    bucket.errors += row.status >= 400 ? 1 : 0;
    bucket.totalMs += row.duration_ms;
  });
  return buckets.map((bucket) => ({
    label: bucket.label,
    requests: bucket.requests,
    errors: bucket.errors,
    avgMs: bucket.requests ? Math.round(bucket.totalMs / bucket.requests) : 0,
  }));
}

function buildEndpointStats(rows: RequestLogRow[]) {
  const stats = new Map<string, { method: string; path: string; count: number; errors: number; totalMs: number; p95Values: number[] }>();
  rows.forEach((row) => {
    const key = `${row.method} ${row.path}`;
    const item = stats.get(key) || { method: row.method, path: row.path, count: 0, errors: 0, totalMs: 0, p95Values: [] };
    item.count += 1;
    item.errors += row.status >= 400 ? 1 : 0;
    item.totalMs += row.duration_ms;
    item.p95Values.push(row.duration_ms);
    stats.set(key, item);
  });
  return [...stats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((item) => {
      const sorted = item.p95Values.sort((a, b) => a - b);
      return {
        method: item.method,
        path: item.path,
        count: item.count,
        errors: item.errors,
        avgMs: Math.round(item.totalMs / Math.max(item.count, 1)),
        p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
      };
    });
}

function canSeedTestAccount(c: AppContext) {
  if (c.env.ENVIRONMENT !== "production") return true;
  return Boolean(c.env.SEED_TOKEN && c.req.header("x-seed-token") === c.env.SEED_TOKEN);
}

async function seedTestAccount(db: D1Database) {
  const now = new Date().toISOString();
  const password = "StarryTest123!";
  const passwordHash = await hashPassword(password);
  const users = [
    { id: "test-user-starry-ledger", email: "test@starry.local", name: "星芒测试用户" },
    { id: "test-user-community-a", email: "mint@starry.local", name: "薄荷预算派" },
    { id: "test-user-community-b", email: "north@starry.local", name: "北区账友" },
  ];
  for (const user of users) {
    await db
      .prepare(
        `INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
      )
      .bind(user.id, user.email, user.name, passwordHash, now, now)
      .run();
  }
  const [owner] = users;
  if (!owner) throw new Error("Seed user is missing");
  const ownerId = owner.id;
  await clearSeedData(db, users.map((user) => user.id));
  await seedCustomCategories(db, ownerId, now);
  await seedLedgerEntries(db, ownerId, now);
  await seedGoalsAndRecurring(db, ownerId, now);
  await seedCommunity(db, users, now);
  await seedRequestLogs(db, ownerId);
  return {
    email: owner.email,
    password,
    displayName: owner.name,
    seeded: {
      ledgerMonths: 6,
      communityUsers: users.length,
      monitoringWindow: "6h",
    },
  };
}

async function clearSeedData(db: D1Database, userIds: string[]) {
  const placeholders = userIds.map(() => "?").join(",");
  const [ownerId] = userIds;
  if (!ownerId) throw new Error("Seed owner is missing");
  await db.prepare(`DELETE FROM community_comments WHERE user_id IN (${placeholders})`).bind(...userIds).run();
  await db.prepare(`DELETE FROM community_post_reactions WHERE user_id IN (${placeholders})`).bind(...userIds).run();
  await db.prepare(`DELETE FROM community_posts WHERE user_id IN (${placeholders})`).bind(...userIds).run();
  await db.prepare("DELETE FROM ledger_entries WHERE user_id = ?").bind(ownerId).run();
  await db.prepare("DELETE FROM saving_goals WHERE user_id = ?").bind(ownerId).run();
  await db.prepare("DELETE FROM recurring_rules WHERE user_id = ?").bind(ownerId).run();
  await db.prepare("DELETE FROM categories WHERE user_id = ?").bind(ownerId).run();
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(ownerId).run();
  await db.prepare("DELETE FROM api_request_logs WHERE user_id = ? OR ip_hash = 'seeded'").bind(ownerId).run();
}

async function seedCustomCategories(db: D1Database, userId: string, now: string) {
  const categories: Array<[string, string, string, string, number, number]> = [
    ["test_cat_rent", "房租", "home", "#8b95a7", 3500, 70],
    ["test_cat_exam", "考试报名", "book-open", "#7c8df0", 1500, 80],
    ["test_cat_planned", "大额计划", "shopping-bag", "#0f8b8d", 2600, 90],
  ];
  for (const category of categories) {
    await db
      .prepare(
        `INSERT INTO categories (id, user_id, name, icon, color, monthly_limit_cents, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(category[0], userId, category[1], category[2], category[3], toCents(category[4]), category[5], now)
      .run();
  }
}

async function seedLedgerEntries(db: D1Database, userId: string, now: string) {
  const baseEntries: Array<[string, string, string, number, "income" | "expense", string, string, string]> = [
    ["2025-12-31", "cat_income", "期初储蓄余额", 82000, "income", "招商银行储蓄卡", "期初余额", "稳定"],
    ["2025-12-31", "cat_income", "微信零钱期初余额", 1800, "income", "微信钱包", "期初余额", "稳定"],
    ["2025-12-31", "cat_income", "校园卡期初余额", 900, "income", "校园卡", "期初余额", "稳定"],
    ["2025-12-31", "cat_shopping", "信用卡期初待还", 15000, "expense", "星芒信用卡", "期初负债", "固定"],
    ["2026-06-05", "cat_income", "5 月工资", 9980, "income", "招商银行储蓄卡", "工资", "开心"],
    ["2026-06-01", "cat_food", "食堂早餐", 12.5, "expense", "微信钱包", "一食堂", "平静"],
    ["2026-06-01", "cat_commute", "地铁通勤", 6, "expense", "微信钱包", "通勤", "平静"],
    ["2026-06-02", "cat_food", "喜茶德冰饮", 32.5, "expense", "微信钱包", "中关村店", "放松"],
    ["2026-06-02", "cat_learning", "论文打印", 18.8, "expense", "校园卡", "图书馆", "赶稿"],
    ["2026-06-03", "test_cat_planned", "京东商城-数码产品", 799, "expense", "星芒信用卡", "购物", "犹豫"],
    ["2026-06-03", "cat_living", "宿舍洗衣液", 46.9, "expense", "微信钱包", "生活日用", "平静"],
    ["2026-06-04", "cat_food", "外卖晚餐", 58.6, "expense", "星芒信用卡", "外卖", "疲惫"],
    ["2026-06-04", "cat_commute", "滴滴出行", 18.8, "expense", "星芒信用卡", "晚归", "赶时间"],
    ["2026-06-05", "cat_food", "同学聚餐", 186, "expense", "星芒信用卡", "社交", "开心"],
    ["2026-06-06", "cat_learning", "在线课程", 268, "expense", "招商银行储蓄卡", "学习", "投入"],
    ["2026-06-06", "cat_living", "电费充值", 80, "expense", "微信钱包", "宿舍", "平静"],
    ["2026-06-07", "cat_shopping", "键盘配件", 329, "expense", "星芒信用卡", "京东", "犹豫"],
    ["2026-06-07", "cat_food", "咖啡", 28, "expense", "微信钱包", "自习", "提神"],
    ["2026-06-08", "cat_food", "早餐和午餐", 46.3, "expense", "校园卡", "食堂", "平静"],
    ["2026-06-08", "cat_commute", "公交", 2, "expense", "微信钱包", "通勤", "平静"],
    ["2026-06-08", "cat_shopping", "618 预售定金", 220, "expense", "星芒信用卡", "购物", "观望"],
    ["2026-06-08", "cat_living", "理发", 68, "expense", "微信钱包", "生活", "清爽"],
    ["2026-06-09", "cat_food", "便利店", 24.9, "expense", "微信钱包", "夜宵", "随手"],
    ["2026-06-09", "cat_learning", "专业书", 96, "expense", "招商银行储蓄卡", "书店", "投入"],
    ["2026-06-10", "cat_food", "火锅 AA", 142, "expense", "星芒信用卡", "社交", "开心"],
    ["2026-06-10", "cat_commute", "打车去高铁站", 72.5, "expense", "星芒信用卡", "出行", "赶时间"],
    ["2026-06-11", "cat_living", "超市日用品", 135.8, "expense", "微信钱包", "超市", "补货"],
    ["2026-06-12", "cat_shopping", "耳机替换线", 89, "expense", "星芒信用卡", "购物", "必要"],
    ["2026-06-12", "cat_food", "奶茶", 19, "expense", "微信钱包", "课间", "放松"],
    ["2026-06-12", "test_cat_rent", "房租分摊", 1800, "expense", "招商银行储蓄卡", "固定支出", "固定"],
    ["2026-06-12", "test_cat_planned", "夏季衣物", 520, "expense", "星芒信用卡", "购物", "计划内"],
    ["2026-06-12", "test_cat_exam", "考试报名费", 420, "expense", "招商银行储蓄卡", "学习", "必要"],
    ["2026-06-12", "cat_food", "周末餐饮预留", 360, "expense", "微信钱包", "餐饮", "复盘"],
  ];
  const monthlySeeds = [
    ["2026-01", 7200, 6120],
    ["2026-02", 7600, 5890],
    ["2026-03", 8120, 6440],
    ["2026-04", 8050, 5984],
    ["2026-05", 8742.6, 6318.47],
  ] as const;
  for (const [month, income, expense] of monthlySeeds) {
    baseEntries.push([`${month}-05`, "cat_income", `${Number(month.slice(5)) - 1} 月工资`, income, "income", "招商银行储蓄卡", "工资", "开心"]);
    baseEntries.push([`${month}-06`, "cat_food", "月度餐饮合计", Math.round(expense * 0.226 * 100) / 100, "expense", "微信钱包", "餐饮", "复盘"]);
    baseEntries.push([`${month}-10`, "cat_shopping", "月度购物合计", Math.round(expense * 0.192 * 100) / 100, "expense", "星芒信用卡", "购物", "复盘"]);
    baseEntries.push([`${month}-14`, "cat_commute", "月度交通合计", Math.round(expense * 0.124 * 100) / 100, "expense", "微信钱包", "交通", "复盘"]);
    baseEntries.push([`${month}-18`, "cat_living", "月度生活合计", Math.round(expense * 0.102 * 100) / 100, "expense", "招商银行储蓄卡", "生活", "复盘"]);
    baseEntries.push([`${month}-22`, "cat_learning", "月度学习合计", Math.round(expense * 0.081 * 100) / 100, "expense", "招商银行储蓄卡", "学习", "复盘"]);
    baseEntries.push([`${month}-26`, "test_cat_planned", "月度其他合计", Math.round(expense * 0.275 * 100) / 100, "expense", "星芒信用卡", "其他", "复盘"]);
  }
  for (const entry of baseEntries) {
    await db
      .prepare(
        `INSERT INTO ledger_entries
          (id, user_id, category_id, title, amount_cents, kind, account_name, scene, mood, note, occurred_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, entry[1], entry[2], toCents(entry[3]), entry[4], entry[5], entry[6], entry[7], "", entry[0], now, now)
      .run();
  }
}

async function seedGoalsAndRecurring(db: D1Database, userId: string, now: string) {
  const goals: Array<[string, number, number, string, string]> = [
    ["欧洲旅行基金", 20000, 8420, "2026-09-01", "active"],
    ["应急基金", 30000, 15600, "2026-12-31", "active"],
    ["新电脑基金", 12000, 4200, "2026-10-20", "active"],
  ];
  for (const goal of goals) {
    await db
      .prepare(
        "INSERT INTO saving_goals (id, user_id, name, target_cents, saved_cents, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), userId, goal[0], toCents(goal[1]), toCents(goal[2]), goal[3], goal[4], now, now)
      .run();
  }
  const recurring: Array<[string, number, "income" | "expense", string, string]> = [
    ["Netflix", 30, "expense", "monthly", "2026-06-15"],
    ["Spotify", 18, "expense", "monthly", "2026-06-16"],
    ["腾讯视频", 20, "expense", "monthly", "2026-06-20"],
    ["云服务订阅", 98, "expense", "monthly", "2026-06-21"],
  ];
  for (const rule of recurring) {
    await db
      .prepare("INSERT INTO recurring_rules (id, user_id, title, amount_cents, kind, cadence, next_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), userId, rule[0], toCents(rule[1]), rule[2], rule[3], rule[4], now)
      .run();
  }
}

async function seedCommunity(db: D1Database, users: Array<{ id: string; email: string; name: string }>, now: string) {
  const [owner, friendA, friendB] = users;
  if (!owner || !friendA || !friendB) throw new Error("Seed community users are missing");
  const posts: Array<[string, string, string, string, string, "public" | "anonymous"]> = [
    [friendA.id, "monthly-review", "餐饮预算怎么从 90% 压下来", "我把奶茶和外卖拆成两个标签后，发现周三和周五最容易超支。准备本周先用食堂替代两顿外卖。", "2026-06", "public"],
    [friendB.id, "purchase-check", "618 键盘要不要等到下个月", "模拟后发现本月买会让购物分类超过 80%，但如果推迟到 7 月，旅行基金不会受影响。", "2026-06", "anonymous"],
    [owner.id, "saving-challenge", "本周 150 元生活费挑战", "目标是工作日只在食堂吃饭，省下来的钱直接转入欧洲旅行基金。", "2026-06", "public"],
  ];
  const postIds: string[] = [];
  for (const post of posts) {
    const id = crypto.randomUUID();
    postIds.push(id);
    await db
      .prepare(
        "INSERT INTO community_posts (id, user_id, topic, title, body, monthly_context, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, post[0], post[1], post[2], post[3], post[4], post[5], now, now)
      .run();
  }
  const [firstPostId, secondPostId] = postIds;
  if (!firstPostId || !secondPostId) throw new Error("Seed community posts are missing");
  await db.prepare("INSERT INTO community_comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), firstPostId, owner.id, "可以把饮料单独设置预算上限，提醒会更早出现。", now).run();
  await db.prepare("INSERT INTO community_comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), secondPostId, friendA.id, "建议先把购买前模拟结果发出来，大家更容易判断。", now).run();
  for (const postId of postIds) {
    await db.prepare("INSERT OR IGNORE INTO community_post_reactions (post_id, user_id, created_at) VALUES (?, ?, ?)").bind(postId, owner.id, now).run();
  }
}

async function seedRequestLogs(db: D1Database, userId: string) {
  const paths = ["/api/dashboard", "/api/entries", "/api/entries/parse", "/api/goals", "/api/ai/coach", "/api/community/posts", "/api/monitor/overview"];
  const methods = ["GET", "GET", "POST", "POST", "POST", "GET", "GET"];
  const now = Date.now();
  for (let index = 0; index < 260; index += 1) {
    const routeIndex = index % paths.length;
    const method = methods[routeIndex] || "GET";
    const path = paths[routeIndex] || "/api/dashboard";
    const status = index % 37 === 0 ? 500 : index % 19 === 0 ? 429 : index % 13 === 0 ? 400 : 200;
    const duration = 24 + ((index * 17) % 180) + (status >= 500 ? 260 : 0);
    const created = new Date(now - (index * 83_000) % (6 * 60 * 60 * 1000)).toISOString();
    await db
      .prepare(
        `INSERT INTO api_request_logs
          (id, sampled, method, path, status, duration_ms, user_id, request_id, ip_hash, user_agent, created_at)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), method, path, status, duration, userId, crypto.randomUUID(), "seeded", "Seeded Chrome Monitor", created)
      .run();
  }
}

async function buildDashboard(db: D1Database, user: UserRow, month: string) {
  const { start, end, daysInMonth } = monthWindow(month);
  const totals = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
        COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
       FROM ledger_entries
       WHERE user_id = ? AND occurred_on >= ? AND occurred_on < ?`,
    )
    .bind(user.id, start, end)
    .first<{ income_cents: number; expense_cents: number }>();

  const trendRows = await db
    .prepare(
      `SELECT substr(occurred_on, 1, 7) AS month,
        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE 0 END), 0) AS income_cents,
        COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_cents ELSE 0 END), 0) AS expense_cents
       FROM ledger_entries
       WHERE user_id = ? AND occurred_on >= date(?, '-5 months') AND occurred_on < ?
       GROUP BY substr(occurred_on, 1, 7)
       ORDER BY month`,
    )
    .bind(user.id, `${start}`, end)
    .all<{ month: string; income_cents: number; expense_cents: number }>();

  const budgetRows = await db
    .prepare(
      `SELECT c.*,
        COALESCE(SUM(CASE WHEN e.kind = 'expense' THEN e.amount_cents ELSE 0 END), 0) AS spent_cents
       FROM categories c
       LEFT JOIN ledger_entries e
        ON e.category_id = c.id AND e.user_id = ? AND e.occurred_on >= ? AND e.occurred_on < ?
       WHERE c.user_id IS NULL OR c.user_id = ?
       GROUP BY c.id
       ORDER BY c.sort_order`,
    )
    .bind(user.id, start, end, user.id)
    .all<CategoryRow & { spent_cents: number }>();

  const recentRows = await db
    .prepare(
      `SELECT e.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color, r.reviewed_at AS reviewed_at
       FROM ledger_entries e
       JOIN categories c ON c.id = e.category_id
       LEFT JOIN entry_review_states r ON r.entry_id = e.id AND r.user_id = e.user_id
       WHERE e.user_id = ? AND e.occurred_on >= ? AND e.occurred_on < ?
       ORDER BY e.occurred_on DESC, e.created_at DESC
       LIMIT 12`,
    )
    .bind(user.id, start, end)
    .all<EntryRow>();

  const accountRows = await db
    .prepare(
      `SELECT
        account_name,
        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_cents ELSE -amount_cents END), 0) AS balance_cents,
        COUNT(*) AS entry_count,
        MAX(occurred_on) AS last_activity
       FROM ledger_entries
       WHERE user_id = ?
       GROUP BY account_name
       ORDER BY ABS(balance_cents) DESC, last_activity DESC
       LIMIT 6`,
    )
    .bind(user.id)
    .all<{ account_name: string; balance_cents: number; entry_count: number; last_activity: string }>();

  const topRows = await db
    .prepare(
      `SELECT c.name, c.color, COALESCE(SUM(e.amount_cents), 0) AS amount_cents
       FROM ledger_entries e
       JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = ? AND e.kind = 'expense' AND e.occurred_on >= ? AND e.occurred_on < ?
       GROUP BY c.id
       ORDER BY amount_cents DESC
       LIMIT 5`,
    )
    .bind(user.id, start, end)
    .all<{ name: string; color: string; amount_cents: number }>();

  const goals = await db.prepare("SELECT * FROM saving_goals WHERE user_id = ? ORDER BY created_at DESC LIMIT 4").bind(user.id).all<Record<string, unknown>>();
  const recurringRows = await db
    .prepare("SELECT * FROM recurring_rules WHERE user_id = ? ORDER BY next_on ASC LIMIT 8")
    .bind(user.id)
    .all<Record<string, unknown>>();
  const goalRows = goals.results || [];
  const income = totals?.income_cents || 0;
  const expense = totals?.expense_cents || 0;
  const balance = income - expense;
  const savedInGoals = goalRows.reduce((sum, row) => sum + Number(row.saved_cents || 0), 0);
  const accountBalance = (accountRows.results || []).reduce((sum, row) => sum + Number(row.balance_cents || 0), 0);
  const today = new Date();
  const isCurrentMonth = month === today.toISOString().slice(0, 7);
  const latestEntryDay = Number((recentRows.results || [])[0]?.occurred_on?.slice(8, 10) || 0);
  const allowanceDay = isCurrentMonth ? Math.max(today.getUTCDate(), 1) : daysInMonth;
  const projectionDay = isCurrentMonth ? Math.max(today.getUTCDate(), latestEntryDay, 1) : daysInMonth;
  const rawProjectedExpense = projectionDay > 0 ? Math.round((expense / projectionDay) * daysInMonth) : expense;
  const projectedExpense =
    income > 0
      ? Math.max(expense, Math.min(rawProjectedExpense, Math.round(expense + Math.max(balance, 0) * 0.35)))
      : rawProjectedExpense;
  const remainingDays = Math.max(daysInMonth - allowanceDay + 1, 1);
  const dailyAllowance = income > 0 ? Math.max((income - expense) / remainingDays, 0) : 0;
  const budgetLanes = (budgetRows.results || [])
    .filter((row) => Number(row.monthly_limit_cents || 0) > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      spent: fromCents(row.spent_cents),
      limit: fromCents(row.monthly_limit_cents),
      rate: row.monthly_limit_cents ? Math.round((Number(row.spent_cents || 0) / row.monthly_limit_cents) * 1000) / 10 : 0,
    }));
  const maxRisk = [...budgetLanes].sort((a, b) => b.rate - a.rate)[0];
  const risk = maxRisk && maxRisk.rate >= 70 ? maxRisk : null;

  return {
    month,
    user: publicUser(user),
    summary: {
      income: fromCents(income),
      expense: fromCents(expense),
      balance: fromCents(balance),
      netAssets: fromCents(accountBalance + savedInGoals),
      dailyAllowance: fromCents(dailyAllowance),
      projectedExpense: fromCents(projectedExpense),
    },
    trend: normalizeTrend(month, trendRows.results || []),
    budgetLanes,
    risk,
    recentEntries: (recentRows.results || []).map(entryDto),
    topCategories: (topRows.results || []).map((row) => ({
      name: row.name,
      color: row.color,
      amount: fromCents(row.amount_cents),
      share: expense ? Math.round((row.amount_cents / expense) * 1000) / 10 : 0,
    })),
    accounts: (accountRows.results || []).map((row) => ({
      name: row.account_name,
      balance: fromCents(row.balance_cents),
      entryCount: Number(row.entry_count || 0),
      lastActivity: row.last_activity || "",
    })),
    goals: goalRows.map(goalDto),
    recurring: (recurringRows.results || []).map(recurringDto),
    coach: buildCoachCards(fromCents(balance), risk),
    generatedAt: new Date().toISOString(),
  };
}

function normalizeTrend(month: string, rows: Array<{ month: string; income_cents: number; expense_cents: number }>) {
  const [yearRaw, monthRaw] = month.split("-").map(Number);
  const anchor = new Date(Date.UTC(yearRaw || 2026, (monthRaw || 1) - 1, 1));
  const map = new Map(rows.map((row) => [row.month, row]));
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 5 + index, 1));
    const key = date.toISOString().slice(0, 7);
    const row = map.get(key);
    return {
      month: key,
      income: fromCents(row?.income_cents || 0),
      expense: fromCents(row?.expense_cents || 0),
      balance: fromCents((row?.income_cents || 0) - (row?.expense_cents || 0)),
    };
  });
}

function goalDto(row: Record<string, unknown>) {
  const target = Number(row.target_cents || 0);
  const saved = Number(row.saved_cents || 0);
  return {
    id: String(row.id),
    name: String(row.name),
    target: fromCents(target),
    saved: fromCents(saved),
    deadline: String(row.deadline || ""),
    progress: target > 0 ? Math.min(100, Math.round((saved / target) * 1000) / 10) : 0,
    status: String(row.status || "active"),
  };
}

function recurringDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title || "固定账单"),
    amount: fromCents(row.amount_cents),
    nextOn: String(row.next_on || ""),
    status: String(row.status || row.cadence || "active"),
  };
}

function buildCoachCards(balance: number, risk?: { name: string; rate: number } | null) {
  const cards = [
    {
      tone: "teal",
      title: "现金流健康度",
      body: balance >= 0 ? "本月仍保持正结余，可以安排一笔心愿基金转入。" : "本月结余为负，建议暂停非必要购物并复查订阅。",
      action: balance >= 0 ? "转入心愿" : "生成削减计划",
    },
    {
      tone: risk && risk.rate > 70 ? "amber" : "cyan",
      title: "预算风险",
      body: risk ? `${risk.name} 已使用 ${risk.rate}%，需要关注后续节奏。` : "暂时没有明显预算风险。",
      action: "查看预算",
    },
    {
      tone: "rose",
      title: "AI 行动建议",
      body: "用一句话记账后，我会自动归类、检查异常，并把结果写入月度复盘。",
      action: "试试解析",
    },
  ];
  return cards;
}

function parseLedgerText(text: string, categories: ReturnType<typeof categoryDto>[]) {
  const matches = [...text.matchAll(/([\u4e00-\u9fa5A-Za-z0-9\s]{1,24}?)[^\d]{0,4}(\d+(?:\.\d{1,2})?)/g)];
  const candidates = matches.length ? matches : [[text, text, text.match(/\d+(?:\.\d{1,2})?/)?.[0] || "0"]] as unknown as RegExpMatchArray[];
  return candidates.slice(0, 5).map((match) => {
    const rawTitle = String(match[1] || text).trim();
    const amount = Number(match[2] || 0);
    const category = inferCategory(rawTitle, categories);
    return {
      title: rawTitle.replace(/\d+(?:\.\d{1,2})?/g, "").trim() || "未命名消费",
      amount,
      kind: rawTitle.includes("工资") || rawTitle.includes("收入") || rawTitle.includes("兼职") ? "income" : "expense",
      categoryId: category?.id || categories[0]?.id || "cat_food",
      categoryName: category?.name || categories[0]?.name || "餐饮",
      confidence: amount > 0 ? 0.82 : 0.38,
    };
  });
}

function inferCategory(text: string, categories: ReturnType<typeof categoryDto>[]) {
  const rules: Array<[string[], string]> = [
    [["饭", "餐", "奶茶", "咖啡", "食堂", "外卖"], "餐饮"],
    [["地铁", "公交", "滴滴", "打车", "车"], "交通"],
    [["书", "课", "资料", "论文", "打印"], "学习资料"],
    [["衣", "鞋", "键盘", "耳机", "淘宝", "京东"], "购物"],
    [["纸", "洗衣", "日用", "宿舍"], "生活日用"],
    [["工资", "兼职", "奖学金", "收入"], "收入"],
  ];
  const targetName = rules.find(([tokens]) => tokens.some((token) => text.includes(token)))?.[1];
  return categories.find((category) => category.name === targetName);
}

function buildCoachAnswer(question: string, dashboard: Awaited<ReturnType<typeof buildDashboard>>) {
  const hasRisk = Boolean(dashboard.risk);
  const hasNegativeCashflow = dashboard.summary.balance < 0;
  const isEmptyMonth = dashboard.summary.income <= 0 && dashboard.summary.expense <= 0;
  const risk = isEmptyMonth
    ? "当前还没有足够的本月流水来判断预算风险。"
    : dashboard.risk
      ? `当前最需要关注的是 ${dashboard.risk.name}，预算已使用 ${dashboard.risk.rate}%。`
      : "目前没有明显预算超速分类。";
  const intent = question || "我应该怎么安排本月消费？";
  const nextSteps = hasNegativeCashflow
    ? "下一步先做三件事：补录本月收入或余额来源、暂停非必要消费、复查最近一周的固定扣费。"
    : isEmptyMonth
      ? "下一步先做三件事：补录一笔收入、记录一笔最近支出、创建一个真实心愿目标。"
    : hasRisk
      ? "下一步可以做三件事：减少一个高风险分类、确认即将扣费的订阅、把正结余的一小部分转入心愿基金。"
      : "下一步可以做三件事：继续补齐流水、创建一个心愿目标、用购买前模拟器检查大额消费。";
  const allowanceAdvice = hasNegativeCashflow
    ? `本月结余已经为 ${dashboard.summary.balance.toFixed(2)}，今天建议先把可花额度视为 0，除刚性支出外暂停新增消费。`
    : isEmptyMonth
      ? "现在还没有本月流水，今日可花额度先按 0 处理；补录收入后我会重新计算。"
    : `建议今天把可花额度控制在 ${dashboard.summary.dailyAllowance.toFixed(2)} 以内；如果有大额购物，先用“购买前模拟器”检查它对月底结余的影响。`;
  return [
    `你问的是：“${intent}”`,
    `本月收入 ${dashboard.summary.income.toFixed(2)}，支出 ${dashboard.summary.expense.toFixed(2)}，预计月底支出 ${dashboard.summary.projectedExpense.toFixed(2)}。${risk}`,
    allowanceAdvice,
    nextSteps,
  ].join("\n\n");
}

async function buildMimoCoachAnswer(env: Env, question: string, dashboard: Awaited<ReturnType<typeof buildDashboard>>) {
  const endpoint = mimoEndpoint(env.MIMO_BASE_URL);
  const model = env.MIMO_MODEL || "mimo-v2.5";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "api-key": env.MIMO_API_KEY || "",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "你是星芒账本里的 AI 财务教练。只根据用户账本上下文回答，使用简洁中文，给出可执行建议。不要编造不存在的交易、余额或身份信息。",
          },
          {
            role: "user",
            content: buildMimoCoachPrompt(question, dashboard),
          },
        ],
        max_completion_tokens: 700,
        temperature: 0.35,
        top_p: 0.9,
        stream: false,
        thinking: { type: "disabled" },
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      error?: { message?: string };
      message?: string;
    };
    if (!response.ok) {
      const message = payload.error?.message || payload.message || `MiMo request failed with ${response.status}`;
      throw new Error(message);
    }
    const content = extractTextContent(payload.choices?.[0]?.message?.content).trim();
    if (!content) throw new Error("MiMo returned an empty answer");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function mimoEndpoint(baseUrl = "https://token-plan-sgp.xiaomimimo.com/v1") {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function buildMimoCoachPrompt(question: string, dashboard: Awaited<ReturnType<typeof buildDashboard>>) {
  const context = {
    userQuestion: question || "我应该怎么安排本月消费？",
    summary: dashboard.summary,
    risk: dashboard.risk || null,
    topCategories: dashboard.topCategories.slice(0, 6),
    recentEntries: dashboard.recentEntries.slice(0, 8).map((entry) => ({
      title: entry.title,
      kind: entry.kind,
      amount: entry.amount,
      categoryName: entry.category.name,
      accountName: entry.accountName,
      occurredOn: entry.occurredOn,
    })),
    goals: dashboard.goals.slice(0, 5),
    recurring: dashboard.recurring.slice(0, 5),
  };
  return [
    "请基于下面 JSON 账本上下文回答用户问题。",
    "回答格式：先用 1 句话总结现金流状态，再给 3 条具体动作。必要时指出需要补录哪些数据。",
    "不要输出 Markdown 表格，不要提及你是模型，不要建议高风险投资。",
    JSON.stringify(context),
  ].join("\n\n");
}

function extractTextContent(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) return String((item as { text?: unknown }).text || "");
        if (item && typeof item === "object" && "content" in item) return String((item as { content?: unknown }).content || "");
        return "";
      })
      .join("");
  }
  return "";
}

function buildCoachActions(dashboard: Awaited<ReturnType<typeof buildDashboard>>) {
  if (dashboard.summary.balance < 0) {
    return [
      { id: "record-income", label: "补录收入或余额来源", intent: "coach" },
      { id: "pause-spending", label: "生成暂停消费计划", intent: "coach" },
      { id: "review-recurring", label: "复查固定扣费", intent: "coach" },
    ];
  }
  if (dashboard.summary.income <= 0 && dashboard.summary.expense <= 0) {
    return [
      { id: "record-income", label: "补录一笔收入", intent: "coach" },
      { id: "record-expense", label: "记录最近支出", intent: "coach" },
      { id: "create-goal", label: "规划第一个心愿", intent: "coach" },
    ];
  }

  const actions = [
    dashboard.risk
      ? { id: "lower-risk-budget", label: `压低${dashboard.risk.name}预算速度`, intent: "budget" }
      : { id: "explain-stable", label: "解释当前稳定状态", intent: "coach" },
    { id: "purchase-simulation", label: "模拟一笔大额消费", intent: "coach" },
  ];

  if (dashboard.summary.balance > 0) {
    actions.splice(1, 0, { id: "move-savings", label: "转入心愿基金 ¥20", intent: "goal" });
  }

  return actions;
}
