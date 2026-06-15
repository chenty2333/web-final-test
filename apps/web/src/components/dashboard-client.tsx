"use client";

import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BadgeCheck,
  BadgeDollarSign,
  Bot,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Database,
  Gauge,
  Goal,
  Landmark,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LogOut,
  Heart,
  House,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  MoreVertical,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrainFront,
  TrendingUp,
  Utensils,
  Wallet,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Category, CommunityPost, DashboardData, Entry, MonitorOverview } from "@/types";
import { currentMonth, localDateKey, localMonthKey, money, percent } from "@/lib/format";

type DashboardProps = {
  initialDashboard: DashboardData;
  categories: Category[];
  demoMode: boolean;
};

type ParsedEntry = {
  title: string;
  amount: number;
  kind: "income" | "expense";
  categoryId: string;
  categoryName: string;
  confidence: number;
};

type ApiPayload<T> = {
  code: number;
  msg: string;
  data: T;
};

type GoalInput = {
  name: string;
  target: number;
  saved: number;
  deadline: string;
};

type CoachMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type CoachAction = {
  id: string;
  label: string;
  intent: string;
};

type SavedEntryFilter = {
  id: string;
  name: string;
  scope: string;
  query: string;
  kind: "all" | "income" | "expense";
  accountName: string;
  categoryName: string;
  fromDate: string;
  toDate: string;
  minAmount: number;
  maxAmount: number;
  createdAt: string;
  updatedAt: string;
};

type EntryFilterDraft = {
  name: string;
  scope: string;
  query: string;
  kind: "all" | "income" | "expense";
  accountName: string;
  categoryName: string;
  fromDate: string;
  toDate: string;
  minAmount: number;
  maxAmount: number;
};

type CommunityTopic = {
  id: "all" | "monthly-review" | "saving-challenge" | "purchase-check" | "student-life" | "product-ideas";
  label: string;
  hint: string;
};

type ViewKey =
  | "home"
  | "ledger"
  | "budget"
  | "assets"
  | "reports"
  | "transactions"
  | "subscriptions"
  | "goals"
  | "debts"
  | "coach"
  | "community"
  | "monitor";

type UtilityPanel = "help" | "notifications" | "account" | null;

const navItems = [
  { href: "/app", view: "home", label: "首页", icon: LayoutDashboard },
  { href: "/app/ledger", view: "ledger", label: "账本", icon: WalletCards },
  { href: "/app/budget", view: "budget", label: "预算", icon: Gauge },
  { href: "/app/assets", view: "assets", label: "资产", icon: Landmark },
  { href: "/app/reports", view: "reports", label: "报表", icon: BarChart3 },
  { href: "/app/transactions", view: "transactions", label: "交易", icon: ArrowLeftRight },
  { href: "/app/subscriptions", view: "subscriptions", label: "订阅与账单", icon: Repeat2 },
  { href: "/app/goals", view: "goals", label: "目标", icon: Goal },
  { href: "/app/debts", view: "debts", label: "债务", icon: BadgeDollarSign },
  { href: "/app/coach", view: "coach", label: "AI 教练", icon: Bot, badge: "新" },
  { href: "/app/community", view: "community", label: "社区", icon: MessagesSquare },
  { href: "/app/monitor", view: "monitor", label: "监控", icon: Activity },
] as const;

const communityTopics: CommunityTopic[] = [
  { id: "all", label: "全部", hint: "所有公开复盘" },
  { id: "monthly-review", label: "月度复盘", hint: "晒出预算结果" },
  { id: "saving-challenge", label: "省钱挑战", hint: "一起完成目标" },
  { id: "purchase-check", label: "购买前模拟", hint: "买之前先问问" },
  { id: "student-life", label: "校园生活", hint: "宿舍、食堂、通勤" },
  { id: "product-ideas", label: "产品建议", hint: "改进账本工作流" },
];

const viewMeta: Record<ViewKey, { eyebrow: string; title: string; subtitle: string }> = {
  home: {
    eyebrow: "AI financial cockpit",
    title: "首页",
    subtitle: "把今天能做的财务动作放到第一屏。",
  },
  ledger: {
    eyebrow: "ledger timeline",
    title: "账本流水",
    subtitle: "用一句话、规则和时间线管理所有现金流。",
  },
  budget: {
    eyebrow: "budget radar",
    title: "预算与订阅",
    subtitle: "看见预算速度、即将扣费和月底预测。",
  },
  assets: {
    eyebrow: "asset board",
    title: "资产",
    subtitle: "按账户查看真实流水聚合出的余额和活动。",
  },
  reports: {
    eyebrow: "financial reports",
    title: "报表",
    subtitle: "把月度趋势、分类结构和预算预测放在同一屏。",
  },
  transactions: {
    eyebrow: "transaction stream",
    title: "交易",
    subtitle: "按账户、类型和搜索词审查最近交易。",
  },
  subscriptions: {
    eyebrow: "recurring bills",
    title: "订阅与账单",
    subtitle: "跟踪未来扣费、固定支出和可调整项。",
  },
  goals: {
    eyebrow: "goal planner",
    title: "心愿目标",
    subtitle: "把节省下来的钱变成明确的未来进度。",
  },
  debts: {
    eyebrow: "debt watch",
    title: "债务",
    subtitle: "从信用卡和负余额账户里识别待还压力。",
  },
  coach: {
    eyebrow: "ai coach",
    title: "AI 财务教练",
    subtitle: "用上下文回答消费决策，而不是只做聊天窗口。",
  },
  community: {
    eyebrow: "ledger community",
    title: "账友社区",
    subtitle: "把月度复盘、购买前模拟和省钱挑战变成可交流的账本场域。",
  },
  monitor: {
    eyebrow: "ops monitor",
    title: "后台监控",
    subtitle: "查看 Worker API 请求、错误率、延迟和采样日志。",
  },
};

export function DashboardClient({ initialDashboard, categories, demoMode }: DashboardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const view = resolveView(pathname);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [month, setMonth] = useState(initialDashboard.month || currentMonth());
  const [monthEntries, setMonthEntries] = useState<Entry[]>(initialDashboard.recentEntries);
  const [search, setSearch] = useState("");
  const [quickText, setQuickText] = useState("");
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [dashboardBusy, setDashboardBusy] = useState(false);
  const [entriesBusy, setEntriesBusy] = useState(false);
  const [demoState, setDemoState] = useState(demoMode);
  const [notice, setNotice] = useState("");
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null);

  const trendMax = Math.max(1, ...dashboard.trend.flatMap((item) => [item.income, item.expense]));
  const categoryTotal = useMemo(
    () => dashboard.budgetLanes.reduce((sum, lane) => sum + lane.spent, 0),
    [dashboard.budgetLanes],
  );
  const metricChanges = useMemo(() => buildMetricChanges(dashboard), [dashboard]);
  const cashflowState = useMemo(() => getCashflowState(dashboard), [dashboard]);

  async function refreshDashboard(nextMonth = month, successNotice = "") {
    setDashboardBusy(true);
    try {
      const response = await fetch(`/api/backend/dashboard?month=${encodeURIComponent(nextMonth)}`);
      const payload = (await response.json()) as ApiPayload<DashboardData>;
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "刷新失败");
      setDashboard(payload.data);
      setMonthEntries(payload.data.recentEntries);
      setDemoState(false);
      setNotice(successNotice);
      return payload.data;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "刷新失败");
      throw error;
    } finally {
      setDashboardBusy(false);
    }
  }

  async function refreshEntries(nextMonth = month) {
    setEntriesBusy(true);
    try {
      const response = await fetch(`/api/backend/entries?month=${encodeURIComponent(nextMonth)}&limit=500`);
      const payload = (await response.json()) as ApiPayload<{ entries: Entry[]; total: number; limit: number }>;
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "流水加载失败");
      setMonthEntries(payload.data.entries);
      setDemoState(false);
      return payload.data.entries;
    } catch {
      setMonthEntries((current) => (current.length ? current : dashboard.recentEntries));
      return dashboard.recentEntries;
    } finally {
      setEntriesBusy(false);
    }
  }

  async function saveEntryFilter(input: EntryFilterDraft) {
    const response = await fetch("/api/backend/entry-filters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as ApiPayload<{ filter: SavedEntryFilter | null }>;
    if (!response.ok || payload.code !== 0 || !payload.data.filter) throw new Error(payload.msg || "保存筛选失败");
    setNotice(`已保存筛选视图「${payload.data.filter.name}」。`);
    return payload.data.filter;
  }

  async function deleteEntryFilter(filterId: string) {
    const response = await fetch(`/api/backend/entry-filters/${filterId}`, { method: "DELETE" });
    const payload = (await response.json()) as ApiPayload<{ deletedId: string }>;
    if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "删除筛选失败");
    setNotice("已删除筛选视图。");
  }

  async function changeMonth(nextMonth: string) {
    if (!/^\d{4}-\d{2}$/.test(nextMonth) || nextMonth === month) return;
    setMonth(nextMonth);
    router.replace(`${pathname}?month=${encodeURIComponent(nextMonth)}`, { scroll: false });
    await refreshDashboard(nextMonth, `已切换到 ${nextMonth} 的账本数据。`).catch(() => null);
  }

  useEffect(() => {
    setMonthEntries(dashboard.recentEntries);
    void refreshEntries(dashboard.month);
  }, [dashboard.month]);

  async function parseQuickText() {
    if (!quickText.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/backend/entries/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: quickText }),
      });
      const payload = (await response.json()) as { code: number; msg: string; data: { parsed: ParsedEntry[] } };
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg);
      setParsed(payload.data.parsed);
    } catch (error) {
      setNotice(error instanceof Error ? `${error.message}；下面只展示本地识别预览。` : "解析失败；下面只展示本地识别预览。");
      setParsed([
        {
          title: quickText.replace(/\d+(?:\.\d{1,2})?/g, "").trim() || "一句话消费",
          amount: Number(quickText.match(/\d+(?:\.\d{1,2})?/)?.[0] || 0),
          kind: "expense",
          categoryId: categories[0]?.id || "cat_food",
          categoryName: categories[0]?.name || "餐饮",
          confidence: 0.42,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function createParsedEntry(item: ParsedEntry) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/backend/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          amount: item.amount,
          kind: item.kind,
          categoryId: item.categoryId,
          occurredOn: entryDateForMonth(month),
          accountName: "星芒钱包",
          scene: "一句话记账",
        }),
      });
      const payload = (await response.json()) as { code: number; msg: string; data: { entry: Entry } };
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg);
      setQuickText("");
      setParsed([]);
      await refreshDashboard(month, "已写入账本，并重新计算本月汇总。");
      await refreshEntries(month);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(entry: Entry) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/backend/entries/${entry.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: entry.title,
          amount: entry.amount,
          kind: entry.kind,
          categoryId: entry.categoryId,
          accountName: entry.accountName,
          scene: entry.scene,
          mood: entry.mood,
          note: entry.note,
          occurredOn: entry.occurredOn,
        }),
      });
      const payload = (await response.json()) as ApiPayload<{ entry: Entry | null }>;
      if (!response.ok || payload.code !== 0 || !payload.data.entry) throw new Error(payload.msg || "保存流水失败");
      await refreshDashboard(month, "流水已保存，统计已重新计算。");
      await refreshEntries(month);
      return payload.data.entry;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存流水失败");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entryId: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/backend/entries/${entryId}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiPayload<{ deletedId: string }>;
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "删除流水失败");
      await refreshDashboard(month, "流水已删除，统计已重新计算。");
      await refreshEntries(month);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除流水失败");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function setEntryReviewed(entryId: string, reviewed: boolean) {
    const response = await fetch(`/api/backend/entries/${entryId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewed }),
    });
    const payload = (await response.json()) as ApiPayload<{ entry: Entry | null }>;
    if (!response.ok || payload.code !== 0 || !payload.data.entry) throw new Error(payload.msg || "更新审核状态失败");
    setMonthEntries((current) => current.map((entry) => (entry.id === entryId ? (payload.data.entry as Entry) : entry)));
    setDashboard((current) => ({
      ...current,
      recentEntries: current.recentEntries.map((entry) => (entry.id === entryId ? (payload.data.entry as Entry) : entry)),
    }));
    return payload.data.entry;
  }

  async function createGoal(input: GoalInput) {
    setNotice("");
    const response = await fetch("/api/backend/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as ApiPayload<{ goal: DashboardData["goals"][number] | null }>;
    if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "创建目标失败");
    await refreshDashboard(month, "已创建心愿目标，进度和净资产估算已更新。");
  }

  async function depositToGoal(goalId?: string, amount = 20) {
    const goal = goalId ? dashboard.goals.find((item) => item.id === goalId) : dashboard.goals[0];
    if (!goal) {
      setNotice("先创建一个心愿目标，再使用自动转入。");
      router.push(`/app/goals?month=${encodeURIComponent(month)}`);
      return;
    }
    setNotice("");
    try {
      const response = await fetch(`/api/backend/goals/${goal.id}/deposit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const payload = (await response.json()) as ApiPayload<{ goal: DashboardData["goals"][number] | null }>;
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "转入失败");
      await refreshDashboard(month, `已向「${goal.name}」转入 ${money(amount)}。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "转入失败");
    }
  }

  function focusQuickEntry() {
    if (view === "home" || view === "ledger" || view === "coach") {
      quickInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      quickInputRef.current?.focus();
      return;
    }
    router.push(`/app/ledger?month=${encodeURIComponent(month)}`);
  }

  function handleCoachAction(action: string) {
    if (action.includes("心愿")) {
      void depositToGoal();
      return;
    }
    if (action.includes("预算")) {
      router.push(`/app/budget?month=${encodeURIComponent(month)}`);
      return;
    }
    focusQuickEntry();
  }

  async function logout() {
    await fetch("/api/backend/auth/logout", { method: "POST" }).catch(() => null);
    location.href = "/";
  }

  const metricRows = buildMetricRows(dashboard, metricChanges);
  const metrics = (
    <section className="metric-grid">
      {metricRows.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          change={item.change}
          detail={item.detail}
          values={item.values}
          tone={item.tone}
        />
      ))}
    </section>
  );

  const parser = (
    <QuickParser
      busy={busy}
      parsed={parsed}
      quickText={quickText}
      inputRef={quickInputRef}
      setQuickText={setQuickText}
      parseQuickText={parseQuickText}
      createParsedEntry={createParsedEntry}
    />
  );

  const ledger = (
    <LedgerPanel
      entries={monthEntries}
      dense={view !== "home"}
      search={search}
      loading={entriesBusy}
      categories={categories}
      onSaveEntry={saveEntry}
      onDeleteEntry={deleteEntry}
      onSaveFilter={saveEntryFilter}
      onDeleteFilter={deleteEntryFilter}
      onReviewEntry={setEntryReviewed}
    />
  );
  const coachAside = <CoachAside dashboard={dashboard} month={month} trendMax={trendMax} onAction={handleCoachAction} />;
  const meta = viewMeta[view];
  const monthQuery = `?month=${encodeURIComponent(month)}`;
  const userInitial = dashboard.user.displayName.trim().slice(0, 1) || "星";

  return (
    <main className={clsx("cockpit", view === "home" && "home-view")}>
      <aside className="side-nav">
        <Link className="brand-mark in-app" href="/" aria-label="星芒账本首页">
          <span className="brand-sigil">✦</span>
          <span>
            <strong>星芒账本</strong>
            <small>Starry Ledger</small>
          </span>
        </Link>
        <nav>
          {navItems.map((item) => (
            <Link className={clsx(item.view === view && "active")} href={`${item.href}${monthQuery}`} key={item.href} aria-label={item.label}>
              <item.icon size={18} />
              <span>{item.label}</span>
              {"badge" in item ? <em>{item.badge}</em> : null}
            </Link>
          ))}
        </nav>
        <div className="ledger-switch">
          <div>
            <small>账本切换</small>
            <strong>个人主账本</strong>
          </div>
          <ChevronDown size={16} />
        </div>
        <div className="side-footer">
          <button type="button" aria-label="账户与设置" onClick={() => setUtilityPanel("account")}>
            <Settings size={17} />
            设置
          </button>
          <button type="button" aria-label="退出" onClick={logout}>
            <LogOut size={17} />
            退出
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-top">
          <div>
            <span className="page-eyebrow">{meta.eyebrow}</span>
            <h1>{meta.title}</h1>
            <p>{view === "home" ? `晚上好，${dashboard.user.displayName}` : meta.subtitle}</p>
          </div>
          <div className="top-actions">
            {view !== "home" ? (
              <>
                <label className="search-box">
                  <Search size={16} />
                  <input value={search} placeholder="搜索流水、目标、预算线索" onChange={(event) => setSearch(event.target.value)} />
                </label>
                <label className="month-control">
                  <CalendarDays size={16} />
                  <input
                    value={month}
                    type="month"
                    onInput={(event) => void changeMonth(event.currentTarget.value)}
                    onChange={(event) => void changeMonth(event.currentTarget.value)}
                    onBlur={(event) => void changeMonth(event.currentTarget.value)}
                    disabled={dashboardBusy}
                  />
                </label>
              </>
            ) : null}
            <button className="primary-action compact" type="button" onClick={focusQuickEntry}>
              {dashboardBusy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
              快速记账
            </button>
            <button className="icon-btn" type="button" aria-label="帮助" onClick={() => setUtilityPanel("help")}>
              <CircleHelp size={18} />
            </button>
            <button className="icon-btn notify" type="button" aria-label="通知" onClick={() => setUtilityPanel("notifications")}>
              <Bell size={18} />
              <span />
            </button>
            <button className="user-orb" type="button" aria-label="账户状态" onClick={() => setUtilityPanel("account")}>
              {userInitial}
            </button>
          </div>
        </header>

        {view === "home" ? <TodayFloat dashboard={dashboard} cashflowState={cashflowState} /> : null}
        {view !== "home" ? (
          <div className="data-texture">
            <span>live model context</span>
            <strong>今日可花 {money(dashboard.summary.dailyAllowance)}</strong>
            <em>{cashflowState.status !== "good" ? cashflowState.label : dashboard.risk ? `${dashboard.risk.name} 风险 ${percent(dashboard.risk.rate)}` : "预算稳定"}</em>
          </div>
        ) : null}
        {demoState ? <DemoModeBanner onRetry={() => void refreshDashboard(month, "已重新连接真实账本。").catch(() => null)} /> : null}
        {notice ? <div className="inline-notice">{notice}</div> : null}
        <UtilityDrawer
          panel={utilityPanel}
          dashboard={dashboard}
          demoMode={demoState}
          month={month}
          onClose={() => setUtilityPanel(null)}
          onFocusQuickEntry={focusQuickEntry}
          onRefresh={() => void refreshDashboard(month, "已重新同步真实账本。").catch(() => null)}
          onLogout={logout}
        />

        {view === "home" ? <HomeControlBar month={month} dashboardBusy={dashboardBusy} changeMonth={changeMonth} /> : null}
        {view !== "home" && view !== "coach" && view !== "monitor" ? metrics : null}

        {view === "home" ? (
          <section className="main-grid">
            <div className="center-column">
              {metrics}
              <AlertStrip dashboard={dashboard} month={month} />
              <section className="home-action-grid">
                {parser}
                <AccountPanel dashboard={dashboard} month={month} />
              </section>
              {ledger}
              <section className="bottom-grid">
                <RecurringPanel dashboard={dashboard} month={month} />
                <GoalsPanel dashboard={dashboard} month={month} />
                <CommunitySnapshot dashboard={dashboard} month={month} />
              </section>
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "ledger" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <LedgerWorkspace dashboard={dashboard} entries={monthEntries} parser={parser} ledger={ledger} />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "budget" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <BudgetWorkspace dashboard={dashboard} total={categoryTotal} month={month} />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "assets" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <AssetsWorkspace dashboard={dashboard} entries={monthEntries} depositToGoal={depositToGoal} />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "reports" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <ReportsWorkspace dashboard={dashboard} />
            </div>
            <aside className="context-rail report-context-rail">
              <ForecastPanel dashboard={dashboard} />
              <ReportInsightPanel dashboard={dashboard} />
              <ReportMethodPanel />
            </aside>
          </section>
        ) : null}

        {view === "transactions" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <TransactionsWorkspace
                dashboard={dashboard}
                entries={monthEntries}
                search={search}
                loading={entriesBusy}
                categories={categories}
                parser={parser}
                onSaveEntry={saveEntry}
                onDeleteEntry={deleteEntry}
                onSaveFilter={saveEntryFilter}
                onDeleteFilter={deleteEntryFilter}
                onReviewEntry={setEntryReviewed}
              />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "subscriptions" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <SubscriptionsWorkspace dashboard={dashboard} entries={monthEntries} />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "debts" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <DebtsWorkspace dashboard={dashboard} />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "goals" ? (
          <section className="main-grid wide-left">
            <div className="center-column">
              <GoalBoard dashboard={dashboard} createGoal={createGoal} depositToGoal={depositToGoal} />
              <GoalStrategyPanel dashboard={dashboard} depositToGoal={depositToGoal} />
            </div>
            {coachAside}
          </section>
        ) : null}

        {view === "coach" ? (
          <section className="coach-focus-grid">
            <CoachStudio dashboard={dashboard} month={month} parser={parser} trendMax={trendMax} onDeposit={depositToGoal} />
            <ContextRail dashboard={dashboard} onAction={handleCoachAction} />
          </section>
        ) : null}

        {view === "community" ? (
          <section className="community-grid">
            <CommunityHub month={month} dashboard={dashboard} demoMode={demoState} />
            <CommunityPulse dashboard={dashboard} />
          </section>
        ) : null}

        {view === "monitor" ? <MonitorDashboard /> : null}
      </section>
    </main>
  );
}

function resolveView(pathname: string): ViewKey {
  if (pathname.includes("/ledger")) return "ledger";
  if (pathname.includes("/budget")) return "budget";
  if (pathname.includes("/assets")) return "assets";
  if (pathname.includes("/reports")) return "reports";
  if (pathname.includes("/transactions")) return "transactions";
  if (pathname.includes("/subscriptions")) return "subscriptions";
  if (pathname.includes("/goals")) return "goals";
  if (pathname.includes("/debts")) return "debts";
  if (pathname.includes("/coach")) return "coach";
  if (pathname.includes("/community")) return "community";
  if (pathname.includes("/monitor")) return "monitor";
  return "home";
}

function DemoModeBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mode-banner">
      <div>
        <span className="section-label">demo preview</span>
        <strong>演示模式</strong>
        <p>当前页面使用本地样例数据，记账、发帖和转入目标不会写入真实 D1 账本。</p>
      </div>
      <div className="mode-actions">
        <button type="button" onClick={onRetry}>
          <RefreshCw size={16} />
          重新连接
        </button>
        <Link href="/login">登录账本</Link>
      </div>
    </section>
  );
}

function UtilityDrawer({
  panel,
  dashboard,
  demoMode,
  month,
  onClose,
  onFocusQuickEntry,
  onRefresh,
  onLogout,
}: {
  panel: UtilityPanel;
  dashboard: DashboardData;
  demoMode: boolean;
  month: string;
  onClose: () => void;
  onFocusQuickEntry: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  if (!panel) return null;

  const risk = dashboard.risk;
  const dueBills = dashboard.recurring.filter((item) => item.status !== "paused");
  const title = panel === "help" ? "帮助与工作流" : panel === "notifications" ? "通知中心" : "账户状态";
  const subtitle =
    panel === "help"
      ? "从录入、复盘到 AI 建议的最短路径。"
      : panel === "notifications"
        ? "根据当前月份的账本数据生成。"
        : demoMode
          ? "当前是本地演示账户。"
          : "已连接真实 Worker 会话。";

  return (
    <section className="utility-drawer" aria-label={title}>
      <div className="utility-head">
        <div>
          <span className="section-label">{panel}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="icon-btn" type="button" aria-label="关闭面板" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {panel === "help" ? (
        <div className="utility-grid">
          <article>
            <ReceiptText size={18} />
            <strong>1. 先记一笔</strong>
            <span>输入自然语言消费，确认解析结果后入账。</span>
            <button type="button" onClick={onFocusQuickEntry}>
              打开快速记账
            </button>
          </article>
          <article>
            <Gauge size={18} />
            <strong>2. 看预算风险</strong>
            <span>预算页会把分类速度、订阅扣费和月底预测放在一起。</span>
            <Link href={`/app/budget?month=${encodeURIComponent(month)}`}>查看预算</Link>
          </article>
          <article>
            <Bot size={18} />
            <strong>3. 问 AI Coach</strong>
            <span>用当前账本上下文回答“能不能买”和“下一步做什么”。</span>
            <Link href={`/app/coach?month=${encodeURIComponent(month)}`}>进入 AI Coach</Link>
          </article>
        </div>
      ) : null}

      {panel === "notifications" ? (
        <div className="utility-action-list">
          <article className={risk ? "risk" : ""}>
            <AlertTriangle size={18} />
            <div>
              <strong>{risk ? `${risk.name} 预算风险 ${percent(risk.rate)}` : "预算速度稳定"}</strong>
              <span>{risk ? "建议先暂停该分类的非必要消费，并使用购买前模拟。" : "当前没有超过 80% 的分类预算。"} </span>
            </div>
          </article>
          <article>
            <Repeat2 size={18} />
            <div>
              <strong>{dueBills.length ? `${dueBills.length} 项固定账单待关注` : "暂无固定账单提醒"}</strong>
              <span>{dueBills.length ? dueBills.map((bill) => bill.title).slice(0, 3).join("、") : "订阅和周期账单会在这里集中显示。"}</span>
            </div>
          </article>
          <article>
            <Target size={18} />
            <div>
              <strong>{dashboard.goals.length ? `${dashboard.goals.length} 个心愿目标` : "还没有心愿目标"}</strong>
              <span>当前结余 {money(dashboard.summary.balance)}，可在目标页安排转入。</span>
            </div>
          </article>
        </div>
      ) : null}

      {panel === "account" ? (
        <div className="utility-account">
          <div className="account-identity">
            <span>{dashboard.user.displayName.trim().slice(0, 1) || "星"}</span>
            <div>
              <strong>{dashboard.user.displayName}</strong>
              <small>{dashboard.user.email}</small>
            </div>
          </div>
          <div className="utility-action-list">
            <article>
              <ShieldCheck size={18} />
              <div>
                <strong>{demoMode ? "演示数据" : "HttpOnly Cookie 会话"}</strong>
                <span>{demoMode ? "登录后会切换到真实 Worker + D1 数据。" : "前端不会把会话令牌写入 localStorage。"}</span>
              </div>
            </article>
            <article>
              <Wallet size={18} />
              <div>
                <strong>{money(dashboard.summary.netAssets)} 净资产</strong>
                <span>{dashboard.accounts.length} 个账户 · {dashboard.recentEntries.length} 条近期流水</span>
              </div>
            </article>
          </div>
          <div className="mode-actions">
            {demoMode ? <Link href="/login">登录真实账本</Link> : <button type="button" onClick={onRefresh}>重新同步</button>}
            <button type="button" onClick={onLogout}>
              退出登录
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TodayFloat({
  dashboard,
  cashflowState,
}: {
  dashboard: DashboardData;
  cashflowState: ReturnType<typeof getCashflowState>;
}) {
  const safe = cashflowState.status === "good";
  return (
    <div className="today-float">
      <span>今天还能花</span>
      <strong>{money(dashboard.summary.dailyAllowance)}</strong>
      <em>{safe ? "预算安全" : cashflowState.status === "danger" ? "先止损" : "待补流水"}</em>
      <small>星</small>
    </div>
  );
}

function HomeControlBar({
  month,
  dashboardBusy,
  changeMonth,
}: {
  month: string;
  dashboardBusy: boolean;
  changeMonth: (nextMonth: string) => Promise<void>;
}) {
  const [comparisonBasis, setComparisonBasis] = useState<"calendar" | "billing">("calendar");
  const basisLabel = comparisonBasis === "calendar" ? "自然月对比" : "账单周期";

  function stepMonth(delta: number) {
    const [yearRaw, monthRaw] = month.split("-").map(Number);
    const year = yearRaw || new Date().getUTCFullYear();
    const monthNumber = monthRaw || 1;
    const date = new Date(year, monthNumber - 1 + delta, 1);
    void changeMonth(localMonthKey(date));
  }

  return (
    <section className="home-control-bar">
      <div className="month-stepper">
        <button type="button" onClick={() => stepMonth(-1)} aria-label="上个月">
          ‹
        </button>
        <button type="button" onClick={() => stepMonth(1)} aria-label="下个月">
          ›
        </button>
        <label>
          <input
            value={month}
            type="month"
            disabled={dashboardBusy}
            onInput={(event) => void changeMonth(event.currentTarget.value)}
            onChange={(event) => void changeMonth(event.currentTarget.value)}
          />
          <CalendarDays size={15} />
        </label>
      </div>
      <div className="compare-tabs">
        <span>{basisLabel}</span>
        <button
          type="button"
          className={comparisonBasis === "calendar" ? "active" : ""}
          aria-pressed={comparisonBasis === "calendar"}
          onClick={() => setComparisonBasis("calendar")}
        >
          按自然月
        </button>
        <button
          type="button"
          className={comparisonBasis === "billing" ? "active" : ""}
          aria-pressed={comparisonBasis === "billing"}
          onClick={() => setComparisonBasis("billing")}
        >
          按账单周期
        </button>
      </div>
    </section>
  );
}

function AlertStrip({ dashboard, month }: { dashboard: DashboardData; month: string }) {
  const risk = dashboard.risk;
  const recurringTotal = dashboard.recurring.reduce((sum, item) => sum + item.amount, 0);
  const messages = [
    risk ? `${risk.name}预算已使用 ${percent(risk.rate)}` : "当前没有异常超速分类",
    dashboard.recurring.length ? `本月订阅费用共 ${money(recurringTotal)}` : "暂无固定账单提醒",
  ];
  return (
    <section className="alert-strip">
      <div>
        <AlertTriangle size={18} />
        <strong>异常提醒</strong>
        <span>{risk ? "2 条" : "0 条"}</span>
      </div>
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
      <Link href={`/app/budget?month=${encodeURIComponent(month)}`}>查看详情</Link>
    </section>
  );
}

function DecisionPanel({
  dashboard,
  title = "今天建议可花",
  onDeposit,
}: {
  dashboard: DashboardData;
  title?: string;
  onDeposit: () => void;
}) {
  const [simulating, setSimulating] = useState(false);
  const [amount, setAmount] = useState("699");
  const simulatedAmount = Number(amount || 0);
  const projectedExpense = dashboard.summary.projectedExpense + (Number.isFinite(simulatedAmount) ? simulatedAmount : 0);
  const projectedBalance = dashboard.summary.income - projectedExpense;
  const cashflowState = getCashflowState(dashboard);

  return (
    <section className="decision-panel">
      <div>
        <span className="section-label">{title}</span>
        <strong>{money(dashboard.summary.dailyAllowance)}</strong>
        <p>
          {cashflowState.status === "danger"
            ? "本月结余为负，今天先暂停非必要消费，并补录收入或余额来源。"
            : cashflowState.status === "empty"
              ? "先补录本月收入或常用支出，系统才能给出可信的可花额度。"
            : dashboard.risk
            ? `${dashboard.risk.name} 接近预算上限，今天先确认是否真的需要新增消费。`
            : "现金流保持稳定，可以按计划记账和储蓄。"}
        </p>
      </div>
      <div className="decision-actions">
        <button type="button" onClick={() => setSimulating((value) => !value)}>
          购买前模拟
        </button>
        <button type="button" onClick={onDeposit}>
          转入心愿
        </button>
      </div>
      {simulating ? (
        <div className="simulator-inline">
          <label>
            计划消费
            <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
          </label>
          <span>
            月底预测支出 {money(projectedExpense)}，预测结余{" "}
            <strong className={projectedBalance < 0 ? "risk-text" : ""}>{money(projectedBalance)}</strong>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function AccountPanel({
  dashboard,
  month,
  expanded = false,
}: {
  dashboard: DashboardData;
  month: string;
  expanded?: boolean;
}) {
  const accounts = dashboard.accounts.length ? dashboard.accounts : [];
  return (
    <section className={clsx("account-panel", expanded && "expanded")}>
      <div className="section-head row">
        <div>
          <h2>常用账户</h2>
          <p>{accounts.length ? "由真实流水聚合余额" : "等待账户流水"}</p>
        </div>
        <Link href={`/app/assets?month=${encodeURIComponent(month)}`}>管理账户 ({accounts.length})</Link>
      </div>
      {accounts.length ? (
        <div className="account-list">
          {accounts.map((account) => (
            <div className="account-row" key={account.name}>
              <CreditCard size={16} />
              <span>{account.name}</span>
              <strong className={account.balance < 0 ? "risk-text" : ""}>{money(account.balance)}</strong>
              {expanded ? <small>{account.entryCount} 笔 · {account.lastActivity}</small> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-region">先补几笔流水，系统会自动推断常用账户。</div>
      )}
    </section>
  );
}

function QuickParser({
  busy,
  parsed,
  quickText,
  inputRef,
  setQuickText,
  parseQuickText,
  createParsedEntry,
}: {
  busy: boolean;
  parsed: ParsedEntry[];
  quickText: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setQuickText: (value: string) => void;
  parseQuickText: () => void;
  createParsedEntry: (item: ParsedEntry) => void;
}) {
  return (
    <section className="quick-parser">
      <div className="section-head">
        <div>
          <h2>快速记账 / 智能解析</h2>
          <p>输入“午饭 32.5 用微信”，AI 会先拆解，再由你确认入账。</p>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="parser-row">
        <input
          ref={inputRef}
          value={quickText}
          placeholder="例如：午餐 32.5，地铁 6，兼职收入 180"
          onChange={(event) => setQuickText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") parseQuickText();
          }}
        />
        <button className="round-submit" type="button" onClick={parseQuickText} disabled={busy} aria-label={busy ? "正在解析" : "解析记账文本"}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
      </div>
      <div className="quick-action-row">
        <button type="button" onClick={() => setQuickText("兼职收入 180 招商银行")}>
          <Plus size={15} />
          收入
        </button>
        <button type="button" onClick={() => setQuickText("午餐 32.5 用微信")}>
          <Plus size={15} />
          支出
        </button>
        <button type="button" onClick={() => setQuickText("转账 500 从微信到招商银行")}>
          <ArrowLeftRight size={15} />
          转账
        </button>
        <button type="button" onClick={() => setQuickText("报销 86.5 项目资料")}>
          <ReceiptText size={15} />
          报销
        </button>
        <button type="button" onClick={() => setQuickText("相机分期 299 每月")}>
          <Repeat2 size={15} />
          分期
        </button>
        <button type="button" onClick={() => setQuickText("模板：早餐 12 校园卡")}>
          <BadgeCheck size={15} />
          模板
        </button>
      </div>
      {parsed.length ? (
        <div className="parsed-list">
          {parsed.map((item, index) => (
            <button key={`${item.title}-${index}`} type="button" onClick={() => createParsedEntry(item)}>
              <span>{item.title}</span>
              <em>
                {item.kind === "income" ? "+" : "-"}
                {money(item.amount)}
              </em>
              <small>
                {item.categoryName} · {percent(item.confidence * 100)}
              </small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LedgerPanel({
  entries,
  dense = false,
  search = "",
  loading = false,
  title = "流水时间线",
  subtitle,
  categories = [],
  onSaveEntry,
  onDeleteEntry,
  onReviewEntry,
  onSaveFilter,
  onDeleteFilter,
}: {
  entries: Entry[];
  dense?: boolean;
  search?: string;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  categories?: Category[];
  onSaveEntry?: (entry: Entry) => Promise<Entry>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  onReviewEntry?: (entryId: string, reviewed: boolean) => Promise<Entry>;
  onSaveFilter?: (input: EntryFilterDraft) => Promise<SavedEntryFilter>;
  onDeleteFilter?: (filterId: string) => Promise<void>;
}) {
  const [kindFilter, setKindFilter] = useState<"all" | "expense" | "income">("all");
  const [accountFilter, setAccountFilter] = useState("全部账户");
  const [categoryFilter, setCategoryFilter] = useState("全部分类");
  const [localQuery, setLocalQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filterName, setFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedEntryFilter[]>([]);
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterNotice, setFilterNotice] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const accounts = useMemo(() => ["全部账户", ...Array.from(new Set(entries.map((entry) => entry.accountName).filter(Boolean)))], [entries]);
  const entryCategories = useMemo(() => ["全部分类", ...Array.from(new Set(entries.map((entry) => entry.category.name).filter(Boolean)))], [entries]);
  const query = `${search} ${localQuery}`.trim().toLowerCase();
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const visibleEntries = entries.filter((entry) => {
    const matchesKind = kindFilter === "all" || entry.kind === kindFilter;
    const matchesAccount = accountFilter === "全部账户" || entry.accountName === accountFilter;
    const matchesCategory = categoryFilter === "全部分类" || entry.category.name === categoryFilter;
    const matchesFrom = !fromDate || entry.occurredOn >= fromDate;
    const matchesTo = !toDate || entry.occurredOn <= toDate;
    const matchesMin = !Number(minAmount) || entry.amount >= Number(minAmount);
    const matchesMax = !Number(maxAmount) || entry.amount <= Number(maxAmount);
    const haystack = `${entry.title} ${entry.accountName} ${entry.scene} ${entry.category.name} ${entry.note}`.toLowerCase();
    const matchesQuery = !queryTerms.length || queryTerms.some((term) => haystack.includes(term));
    return matchesKind && matchesAccount && matchesCategory && matchesFrom && matchesTo && matchesMin && matchesMax && matchesQuery;
  });
  const displayedEntries = dense ? visibleEntries : visibleEntries.slice(0, 5);
  const kindLabel = kindFilter === "all" ? "全部类型" : kindFilter === "expense" ? "只看支出" : "只看收入";
  const incomeTotal = visibleEntries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expenseTotal = visibleEntries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0);

  useEffect(() => {
    let cancelled = false;
    async function loadSavedFilters() {
      try {
        const response = await fetch("/api/backend/entry-filters?scope=entries");
        const payload = (await response.json()) as ApiPayload<{ filters: SavedEntryFilter[] }>;
        if (!cancelled && response.ok && payload.code === 0) setSavedFilters(payload.data.filters);
      } catch {
        if (!cancelled) setSavedFilters([]);
      }
    }
    if (dense) void loadSavedFilters();
    return () => {
      cancelled = true;
    };
  }, [dense]);

  function resetFilters() {
    setKindFilter("all");
    setAccountFilter("全部账户");
    setCategoryFilter("全部分类");
    setLocalQuery("");
    setFromDate("");
    setToDate("");
    setMinAmount("");
    setMaxAmount("");
  }

  function applyPreset(preset: "large" | "food" | "fixed") {
    resetFilters();
    if (preset === "large") {
      setKindFilter("expense");
      setMinAmount(String(Math.max(300, Math.round(expenseTotal * 0.08))));
    }
    if (preset === "food") {
      setCategoryFilter(entryCategories.find((item) => item.includes("餐")) || "全部分类");
      setKindFilter("expense");
    }
    if (preset === "fixed") {
      setKindFilter("expense");
      setLocalQuery("房租 订阅 会员 云服务 Netflix Spotify 固定");
    }
  }

  function applySavedFilter(filter: SavedEntryFilter) {
    setKindFilter(filter.kind);
    setAccountFilter(filter.accountName || "全部账户");
    setCategoryFilter(filter.categoryName || "全部分类");
    setLocalQuery(filter.query || "");
    setFromDate(filter.fromDate || "");
    setToDate(filter.toDate || "");
    setMinAmount(filter.minAmount ? String(filter.minAmount) : "");
    setMaxAmount(filter.maxAmount ? String(filter.maxAmount) : "");
    setFilterNotice(`已应用「${filter.name}」。`);
  }

  async function saveCurrentFilter() {
    if (!onSaveFilter) return;
    const name = filterName.trim() || `${categoryFilter !== "全部分类" ? categoryFilter : kindLabel}筛选`;
    setFilterBusy(true);
    setFilterNotice("");
    try {
      const filter = await onSaveFilter({
        name,
        scope: "entries",
        query: localQuery,
        kind: kindFilter,
        accountName: accountFilter,
        categoryName: categoryFilter,
        fromDate,
        toDate,
        minAmount: Number(minAmount || 0),
        maxAmount: Number(maxAmount || 0),
      });
      setSavedFilters((current) => [filter, ...current.filter((item) => item.id !== filter.id)].slice(0, 30));
      setFilterName("");
      setFilterNotice(`已保存「${filter.name}」。`);
    } catch (error) {
      setFilterNotice(error instanceof Error ? error.message : "保存筛选失败");
    } finally {
      setFilterBusy(false);
    }
  }

  async function removeSavedFilter(filterId: string) {
    if (!onDeleteFilter) return;
    setFilterBusy(true);
    setFilterNotice("");
    try {
      await onDeleteFilter(filterId);
      setSavedFilters((current) => current.filter((item) => item.id !== filterId));
      setFilterNotice("已删除筛选视图。");
    } catch (error) {
      setFilterNotice(error instanceof Error ? error.message : "删除筛选失败");
    } finally {
      setFilterBusy(false);
    }
  }

  return (
    <section className={clsx("ledger-panel", dense && "dense")}>
      <div className="section-head row">
        <div>
          <h2>{title}</h2>
          <p>{subtitle || `${visibleEntries.length} 条匹配流水 · 按发生日期排序`}</p>
        </div>
        <div className="table-tools">
          <button
            type="button"
            onClick={() => setKindFilter((value) => (value === "all" ? "expense" : value === "expense" ? "income" : "all"))}
          >
            <ListFilter size={15} />
            {kindLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              const index = accounts.indexOf(accountFilter);
              setAccountFilter(accounts[(index + 1) % accounts.length] || "全部账户");
            }}
          >
            {accountFilter}
          </button>
        </div>
      </div>
      <div className="ledger-search-console">
        <label className="ledger-inline-search">
          <Search size={15} />
          <input value={localQuery} placeholder="搜标题、备注、场景、分类，例如：奶茶 / 房租 / 京东" onChange={(event) => setLocalQuery(event.target.value)} />
        </label>
        <div className="ledger-filter-row">
          <label>
            分类
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {entryCategories.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            从
            <input value={fromDate} type="date" onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            到
            <input value={toDate} type="date" onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label>
            最小金额
            <input value={minAmount} inputMode="decimal" placeholder="0" onChange={(event) => setMinAmount(event.target.value)} />
          </label>
          <label>
            最大金额
            <input value={maxAmount} inputMode="decimal" placeholder="不限" onChange={(event) => setMaxAmount(event.target.value)} />
          </label>
        </div>
        <div className="ledger-preset-row">
          <button type="button" onClick={resetFilters}>全部流水</button>
          <button type="button" onClick={() => applyPreset("large")}>大额支出</button>
          <button type="button" onClick={() => applyPreset("food")}>餐饮相关</button>
          <button type="button" onClick={() => applyPreset("fixed")}>固定/订阅</button>
        </div>
        <div className="saved-filter-row">
          <label>
            <input value={filterName} placeholder="保存为筛选视图" onChange={(event) => setFilterName(event.target.value)} />
          </label>
          <button type="button" disabled={filterBusy} onClick={saveCurrentFilter}>
            {filterBusy ? "保存中" : "保存视图"}
          </button>
          {savedFilters.map((filter) => (
            <span className="saved-filter-chip" key={filter.id}>
              <button type="button" onClick={() => applySavedFilter(filter)}>{filter.name}</button>
              <button type="button" aria-label={`删除筛选视图 ${filter.name}`} onClick={() => void removeSavedFilter(filter.id)}>×</button>
            </span>
          ))}
        </div>
        {filterNotice ? <div className="filter-notice">{filterNotice}</div> : null}
        <div className="ledger-result-summary">
          <span>{loading ? "同步整月流水中" : `${visibleEntries.length} / ${entries.length} 笔`}</span>
          <strong>收入 {money(incomeTotal)}</strong>
          <strong className="risk-text">支出 {money(expenseTotal)}</strong>
          <strong>结余 {money(incomeTotal - expenseTotal)}</strong>
        </div>
      </div>
      <div className="entry-table">
        {displayedEntries.length ? (
          <div className="entry-table-head">
            <span />
            <span>日期</span>
            <span>类型</span>
            <span>账户</span>
            <span>对方/备注</span>
            <span>分类</span>
            <span>金额</span>
            <span />
          </div>
        ) : null}
        {displayedEntries.length ? (
          displayedEntries.map((entry, index) => {
            const previous = displayedEntries[index - 1];
            const showDate = !previous || previous.occurredOn !== entry.occurredOn;
            return (
              <button className="entry-row" type="button" key={entry.id} onClick={() => setSelectedEntry(entry)}>
                <span className={clsx("entry-check", entry.reviewedAt && "checked")} />
                <span className="entry-date">
                  {showDate ? formatEntryDay(entry.occurredOn) : ""}
                  {showDate ? <small>{formatEntryDate(entry.occurredOn)}</small> : null}
                </span>
                <span className="entry-kind">
                  <CategoryGlyph entry={entry} />
                  {entry.kind === "income" ? "收入" : "支出"}
                </span>
                <span className="entry-account">{entry.accountName}</span>
                <span className="entry-title">
                  <strong>{entry.title}</strong>
                  <small>{entry.scene || entry.note || entry.category.name}</small>
                </span>
                <span>{entry.category.name}</span>
                <em className={entry.kind}>
                  {entry.kind === "income" ? "+" : "-"}
                  {money(entry.amount)}
                </em>
                <span className="row-menu" aria-label={`查看详情：${entry.title}`}>
                  <MoreVertical size={16} />
                </span>
              </button>
            );
          })
        ) : (
          <div className="empty-region">没有匹配的流水。换一个月份、账户或搜索词试试。</div>
        )}
        {!dense && visibleEntries.length > displayedEntries.length ? (
          <button className="load-more-row" type="button">
            加载更多
            <ChevronDown size={15} />
          </button>
        ) : null}
      </div>
      {selectedEntry ? (
        <EntryDetailDrawer
          entry={selectedEntry}
          categories={categories}
          onClose={() => setSelectedEntry(null)}
          onSaveEntry={onSaveEntry}
          onDeleteEntry={onDeleteEntry}
          onReviewEntry={onReviewEntry}
          onFilterAccount={(account) => {
            setAccountFilter(account);
            setSelectedEntry(null);
          }}
          onFilterCategory={(category) => {
            setCategoryFilter(category);
            setSelectedEntry(null);
          }}
        />
      ) : null}
    </section>
  );
}

function EntryDetailDrawer({
  entry,
  categories,
  onClose,
  onSaveEntry,
  onDeleteEntry,
  onReviewEntry,
  onFilterAccount,
  onFilterCategory,
}: {
  entry: Entry;
  categories: Category[];
  onClose: () => void;
  onSaveEntry?: (entry: Entry) => Promise<Entry>;
  onDeleteEntry?: (entryId: string) => Promise<void>;
  onReviewEntry?: (entryId: string, reviewed: boolean) => Promise<Entry>;
  onFilterAccount: (account: string) => void;
  onFilterCategory: (category: string) => void;
}) {
  const [draft, setDraft] = useState<Entry>(entry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const category = categories.find((item) => item.id === draft.categoryId) || categories.find((item) => item.name === draft.category.name);
  const canMutate = Boolean(onSaveEntry && onDeleteEntry);

  useEffect(() => {
    setDraft(entry);
    setError("");
  }, [entry]);

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSaveEntry) return;
    setBusy(true);
    setError("");
    try {
      await onSaveEntry({
        ...draft,
        categoryId: category?.id || draft.categoryId,
        category: category ? { name: category.name, icon: category.icon, color: category.color } : draft.category,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry() {
    if (!onDeleteEntry) return;
    if (!window.confirm(`删除「${draft.title}」这笔流水？删除后会重新计算本月统计。`)) return;
    setBusy(true);
    setError("");
    try {
      await onDeleteEntry(entry.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReviewed() {
    if (!onReviewEntry) return;
    setBusy(true);
    setError("");
    try {
      const updated = await onReviewEntry(entry.id, !draft.reviewedAt);
      setDraft(updated);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "审核状态更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entry-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${entry.title} 详情`}>
      <aside className="entry-detail-card">
        <div className="section-head row">
          <div>
            <span className="section-label">流水详情</span>
            <h2>{entry.title}</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="关闭详情" onClick={onClose}>
            ×
          </button>
        </div>
        <strong className={clsx("detail-amount", draft.kind === "expense" && "risk-text")}>
          {draft.kind === "income" ? "+" : "-"}
          {money(draft.amount)}
        </strong>
        <form className="entry-edit-form" onSubmit={submitEdit}>
          <label>
            标题
            <input value={draft.title} disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            金额
            <input value={draft.amount} disabled={!canMutate} inputMode="decimal" onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))} />
          </label>
          <label>
            类型
            <select value={draft.kind} disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Entry["kind"] }))}>
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
          </label>
          <label>
            分类
            <select
              value={category?.id || draft.categoryId}
              disabled={!canMutate}
              onChange={(event) => {
                const nextCategory = categories.find((item) => item.id === event.target.value);
                if (!nextCategory) return;
                setDraft((current) => ({
                  ...current,
                  categoryId: nextCategory.id,
                  category: { name: nextCategory.name, icon: nextCategory.icon, color: nextCategory.color },
                }));
              }}
            >
              {categories.map((item) => (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            账户
            <input value={draft.accountName} disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, accountName: event.target.value }))} />
          </label>
          <label>
            日期
            <input value={draft.occurredOn} type="date" disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, occurredOn: event.target.value }))} />
          </label>
          <label>
            场景
            <input value={draft.scene} disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, scene: event.target.value }))} />
          </label>
          <label>
            心情
            <input value={draft.mood} disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, mood: event.target.value }))} />
          </label>
          <label className="wide">
            备注
            <textarea value={draft.note} rows={3} disabled={!canMutate} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
          </label>
          <DetailItem label="审核状态" value={draft.reviewedAt ? `已核对 · ${formatMonitorTime(draft.reviewedAt)}` : "未核对"} wide />
          <DetailItem label="流水 ID" value={entry.id} wide />
          {error ? <div className="inline-error">{error}</div> : null}
          {canMutate ? (
            <div className="detail-actions">
              <button type="submit" disabled={busy}>
                {busy ? "保存中" : "保存到 D1"}
              </button>
              <button type="button" disabled={busy} onClick={toggleReviewed}>
                {draft.reviewedAt ? "取消核对" : "标记已核对"}
              </button>
              <button className="danger-action" type="button" disabled={busy} onClick={removeEntry}>
                删除流水
              </button>
            </div>
          ) : null}
        </form>
        <div className="detail-actions">
          <button type="button" onClick={() => onFilterAccount(entry.accountName)}>
            只看这个账户
          </button>
          <button type="button" onClick={() => onFilterCategory(entry.category.name)}>
            只看这个分类
          </button>
          <button type="button" onClick={onClose}>
            返回列表
          </button>
        </div>
      </aside>
    </div>
  );
}

function DetailItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={clsx("detail-item", wide && "wide")}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CategoryGlyph({ entry }: { entry: Entry }) {
  const Icon = categoryIcon(entry.category.icon, entry.category.name);
  return (
    <span className="entry-icon" style={{ background: entry.category.color }}>
      <Icon size={15} />
    </span>
  );
}

function categoryIcon(icon: string, name: string) {
  if (icon.includes("utensils") || name.includes("餐")) return Utensils;
  if (icon.includes("train") || name.includes("交通")) return TrainFront;
  if (icon.includes("book") || name.includes("学习")) return BookOpen;
  if (icon.includes("shopping") || name.includes("购物")) return ShoppingBag;
  if (icon.includes("home") || name.includes("房租") || name.includes("生活")) return House;
  if (icon.includes("wallet") || name.includes("收入") || name.includes("工资")) return Wallet;
  return ReceiptText;
}

function formatEntryDay(date: string) {
  const todayDate = new Date();
  const today = localDateKey(todayDate);
  if (date === today) return "今天";
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(todayDate.getDate() - 1);
  if (date === localDateKey(yesterdayDate)) return "昨天";
  return formatEntryDate(date);
}

function formatEntryDate(date: string) {
  const [, month = "", day = ""] = date.split("-");
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (!monthNumber || !dayNumber) return date;
  return `${monthNumber}月${dayNumber}日`;
}

function RecurringPanel({
  dashboard,
  month,
  expanded = false,
}: {
  dashboard: DashboardData;
  month: string;
  expanded?: boolean;
}) {
  return (
    <div className={clsx("plain-panel", expanded && "expanded-panel")}>
      <div className="section-head row">
        <h2>订阅与账单</h2>
        <Link href={`/app/subscriptions?month=${encodeURIComponent(month)}`}>
          {dashboard.recurring.length ? "管理规则" : "新建规则"}
        </Link>
      </div>
      {dashboard.recurring.length ? (
        dashboard.recurring.map((item) => (
          <div className="compact-row" key={item.id}>
            <CreditCard size={17} />
            <span>{item.title}</span>
            <strong>{money(item.amount)}</strong>
            <small>{item.nextOn}</small>
          </div>
        ))
      ) : (
        <div className="empty-region">还没有固定账单规则。可以先新建常用订阅或周期收入。</div>
      )}
    </div>
  );
}

function GoalsPanel({ dashboard, month }: { dashboard: DashboardData; month: string }) {
  return (
    <div className="plain-panel">
      <div className="section-head row">
        <h2>储蓄目标</h2>
        <Link href={`/app/goals?month=${encodeURIComponent(month)}`}>管理目标</Link>
      </div>
      {dashboard.goals.length ? (
        dashboard.goals.map((goal) => (
          <div className="goal-line" key={goal.id}>
            <div>
              <strong>{goal.name}</strong>
              <small>
                {money(goal.saved)} / {money(goal.target)}
              </small>
            </div>
            <div className="progress">
              <span style={{ width: `${Math.min(goal.progress, 100)}%` }} />
            </div>
          </div>
        ))
      ) : (
        <div className="empty-region">创建第一个心愿后，AI 会自动反推每周储蓄额。</div>
      )}
    </div>
  );
}

function CommunitySnapshot({ dashboard, month }: { dashboard: DashboardData; month: string }) {
  const topCategory = dashboard.topCategories[0];
  const balanceHealthy = dashboard.summary.balance >= 0;
  const insights = [
    dashboard.risk
      ? { tone: "up", text: `${dashboard.risk.name}预算使用 ${percent(dashboard.risk.rate)}` }
      : { tone: "down", text: "当前预算风险稳定" },
    {
      tone: balanceHealthy ? "down" : "up",
      text: balanceHealthy
        ? `本月结余 ${money(dashboard.summary.balance)}`
        : `本月缺口 ${money(Math.abs(dashboard.summary.balance))}`,
    },
    topCategory
      ? {
          tone: topCategory.share > 40 ? "up" : "down",
          text: `${topCategory.name}占支出 ${percent(topCategory.share)}`,
        }
      : { tone: "down", text: "等待更多账本样本" },
  ];
  return (
    <div className="plain-panel community-snapshot">
      <div className="section-head row">
        <h2>社区洞察</h2>
        <Link href={`/app/community?month=${encodeURIComponent(month)}`}>更多</Link>
      </div>
      <div className="insight-mini-list">
        {insights.map((insight) => (
          <span className={insight.tone} key={insight.text}>
            {insight.text}
          </span>
        ))}
      </div>
      <small>数据来源：当前账本与预算模型</small>
    </div>
  );
}

function CoachAside({
  dashboard,
  month,
  trendMax,
  onAction,
}: {
  dashboard: DashboardData;
  month: string;
  trendMax: number;
  onAction: (action: string) => void;
}) {
  const cashflowState = getCashflowState(dashboard);
  const topCategory = dashboard.topCategories[0];
  const pressure = dashboard.risk
    ? `${dashboard.risk.name}预算使用 ${percent(dashboard.risk.rate)}，需要优先确认。`
    : topCategory
      ? `${topCategory.name} 是本月最大支出项，占支出 ${percent(topCategory.share)}。`
      : "先补录几笔流水，系统会自动识别主要压力点。";
  const balanceBrief =
    cashflowState.status === "danger"
      ? `当前预测结余为 ${money(dashboard.summary.balance)}，建议先暂停非必要消费。`
      : `保持当前趋势，预计本月结余可达 ${money(Math.max(dashboard.summary.balance, 0))}。`;

  return (
    <aside className="coach-panel">
      <div className="coach-head">
        <div>
          <span className="section-label">财务教练</span>
          <h2>{month} 财务简报</h2>
        </div>
        <small>
          <RefreshCw size={13} />
          更新于 刚刚
        </small>
      </div>
      <p className="coach-brief">
        {pressure}
        {balanceBrief}
      </p>
      <CoachSummary dashboard={dashboard} />
      <span className="ai-advice-label">AI 建议</span>
      <CoachCards dashboard={dashboard} onAction={onAction} />
      <small className="coach-note">以上建议基于你的消费模式分析</small>
      <ForecastPanel dashboard={dashboard} trendMax={trendMax} />
      <CategoryPanel dashboard={dashboard} />
    </aside>
  );
}

function CoachSummary({ dashboard }: { dashboard: DashboardData }) {
  const cashflowState = getCashflowState(dashboard);
  return (
    <div className="coach-summary">
      <div>
        <small>预算进度</small>
        <strong>{dashboard.risk ? percent(dashboard.risk.rate) : "良好"}</strong>
      </div>
      <div>
        <small>储蓄率</small>
        <strong>{percent(Math.max((dashboard.summary.balance / Math.max(dashboard.summary.income, 1)) * 100, 0))}</strong>
      </div>
      <div>
        <small>现金流</small>
        <strong className={cashflowState.status === "danger" ? "risk-text" : ""}>{cashflowState.shortLabel}</strong>
      </div>
    </div>
  );
}

function CoachCards({ dashboard, onAction }: { dashboard: DashboardData; onAction: (action: string) => void }) {
  return (
    <div className="coach-cards">
      {dashboard.coach.map((card) => (
        <button className={clsx("coach-card", card.tone)} type="button" key={card.title} onClick={() => onAction(card.action)}>
          <strong>{card.title}</strong>
          <span>{card.body}</span>
          <em>{card.action}</em>
        </button>
      ))}
    </div>
  );
}

function ForecastPanel({ dashboard }: { dashboard: DashboardData; trendMax?: number }) {
  const projectedBalance = dashboard.summary.income - dashboard.summary.projectedExpense;
  return (
    <section className="forecast-panel">
      <span className="section-label">预算预测</span>
      <h3>{money(projectedBalance)}</h3>
      <p>本月预计结余 · 基于当前趋势的预测</p>
      <ForecastChart dashboard={dashboard} />
    </section>
  );
}

function CategoryPanel({ dashboard }: { dashboard: DashboardData }) {
  return (
    <section className="category-panel">
      <span className="section-label">本月分类支出 TOP5</span>
      {dashboard.topCategories.length ? (
        <>
          <SpendingDonut categories={dashboard.topCategories} />
          {dashboard.topCategories.map((item) => (
            <div className="category-line" key={item.name}>
              <span style={{ background: item.color }} />
              <strong>{item.name}</strong>
              <em>{money(item.amount)}</em>
              <small>{percent(item.share)}</small>
            </div>
          ))}
        </>
      ) : (
        <div className="empty-region">这个月份还没有分类支出。</div>
      )}
    </section>
  );
}

function ForecastChart({ dashboard }: { dashboard: DashboardData }) {
  const daysInMonth = daysInDashboardMonth(dashboard.month);
  const latestEntryDay = latestDashboardEntryDay(dashboard);
  const today = new Date();
  const activeMonth = localMonthKey(today);
  const currentDay =
    dashboard.month === activeMonth
      ? Math.max(today.getDate(), latestEntryDay, 1)
      : Math.max(latestEntryDay, Math.round(daysInMonth * 0.42), 1);
  const observedDay = Math.min(currentDay, daysInMonth);
  const currentBalance = dashboard.summary.balance;
  const projectedBalance = dashboard.summary.income - dashboard.summary.projectedExpense;
  const openingBalance = Math.min(currentBalance, projectedBalance) - Math.max(420, Math.abs(projectedBalance - currentBalance) * 0.55);
  const actualValues = Array.from({ length: 7 }, (_, index) => {
    const progress = index / 6;
    const wave = Math.sin(index * 1.35) * Math.max(60, Math.abs(currentBalance - openingBalance) * 0.08);
    return openingBalance + (currentBalance - openingBalance) * progress + wave;
  });
  const values = [...actualValues, projectedBalance];
  const floor = Math.min(-1000, ...values);
  const ceiling = Math.max(4000, ...values, 1);
  const range = Math.max(ceiling - floor, 1);
  const toPoint = (day: number, value: number) => {
    const x = 8 + ((day - 1) / Math.max(daysInMonth - 1, 1)) * 84;
    const y = 76 - ((value - floor) / range) * 58;
    return { x, y: Math.max(10, Math.min(76, y)) };
  };
  const actualPoints = actualValues.map((value, index) => {
    const day = Math.max(1, Math.round(1 + (observedDay - 1) * (index / 6)));
    return toPoint(day, value);
  });
  const projectedPoint = toPoint(daysInMonth, projectedBalance);
  const path = actualPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const area = actualPoints.length
    ? `M${actualPoints[0]?.x.toFixed(2) || 8} 82 ${actualPoints.map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} L${actualPoints.at(-1)?.x.toFixed(2) || 80} 82 Z`
    : "";
  const last = actualPoints.at(-1) || toPoint(observedDay, currentBalance);
  const midDay = Math.max(1, Math.round(daysInMonth / 2));

  return (
    <div className="forecast-chart">
      <svg viewBox="0 0 100 88" role="img" aria-label="月底预算预测图">
        <path className="chart-grid-line" d="M8 18H92M8 47H92M8 76H92" />
        {area ? <path className="chart-area" d={area} /> : null}
        <path className="chart-line" d={path} />
        <path className="chart-line future" d={`M${last.x.toFixed(2)} ${last.y.toFixed(2)} L${projectedPoint.x.toFixed(2)} ${projectedPoint.y.toFixed(2)}`} />
        {actualPoints.map((point, index) => (
          <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={index === actualPoints.length - 1 ? 1.8 : 1.2} />
        ))}
        <circle className="future-point" cx={projectedPoint.x} cy={projectedPoint.y} r="1.8" />
      </svg>
      <div className="forecast-axis x">
        <span>{forecastDayLabel(dashboard.month, 1)}</span>
        <span>{forecastDayLabel(dashboard.month, midDay)}</span>
        <span>{forecastDayLabel(dashboard.month, daysInMonth)}</span>
      </div>
      <div className="forecast-axis y">
        <span>{money(Math.ceil(ceiling / 1000) * 1000)}</span>
        <span>{money(0)}</span>
        <span>{money(Math.floor(floor / 1000) * 1000)}</span>
      </div>
    </div>
  );
}

function daysInDashboardMonth(month: string) {
  const [yearRaw, monthRaw] = month.split("-").map(Number);
  const year = yearRaw || new Date().getUTCFullYear();
  const monthNumber = monthRaw || 1;
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function latestDashboardEntryDay(dashboard: DashboardData) {
  return dashboard.recentEntries.reduce((max, entry) => {
    if (!entry.occurredOn.startsWith(dashboard.month)) return max;
    return Math.max(max, Number(entry.occurredOn.slice(8, 10)) || 0);
  }, 0);
}

function forecastDayLabel(month: string, day: number) {
  const monthNumber = Number(month.slice(5, 7)) || 1;
  return `${monthNumber}/${day}`;
}

function SpendingDonut({ categories }: { categories: DashboardData["topCategories"] }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg className="spending-donut" viewBox="0 0 112 112" role="img" aria-label="分类支出占比环图">
      <circle className="donut-track" cx="56" cy="56" r={radius} />
      {categories.map((category) => {
        const length = Math.max(0, (category.share / 100) * circumference);
        const dashOffset = -offset;
        offset += length;
        return (
          <circle
            className="donut-segment"
            cx="56"
            cy="56"
            key={category.name}
            r={radius}
            stroke={category.color}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
          />
        );
      })}
      <circle className="donut-hole" cx="56" cy="56" r="25" />
    </svg>
  );
}

function BudgetBoard({ dashboard, total, month }: { dashboard: DashboardData; total: number; month: string }) {
  const [plan, setPlan] = useState("");
  const [busyPlan, setBusyPlan] = useState(false);

  async function generatePlan() {
    setBusyPlan(true);
    try {
      const response = await fetch("/api/backend/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, question: "基于本月预算速度，生成下周预算计划。" }),
      });
      const payload = (await response.json()) as ApiPayload<{ answer: string; actions: CoachAction[] }>;
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "生成失败");
      setPlan(payload.data.answer);
    } catch {
      const risky = [...dashboard.budgetLanes].sort((a, b) => b.rate - a.rate).slice(0, 2);
      setPlan(
        dashboard.summary.balance < 0
          ? `本月结余已经为 ${money(dashboard.summary.balance)}。下周预算先按保守模式处理：暂停非必要消费，补录收入或余额来源，并复查最近固定扣费。`
          : risky.length
          ? `下周优先压低 ${risky.map((lane) => lane.name).join("、")}。建议把今日可花控制在 ${money(dashboard.summary.dailyAllowance)} 内，所有非必要消费先进入购买前模拟。`
          : `当前还没有预算风险。下周保持每日 ${money(dashboard.summary.dailyAllowance)} 左右的可花额度，并继续补充流水。`,
      );
    } finally {
      setBusyPlan(false);
    }
  }

  return (
    <section className="budget-board">
      <div className="section-head row">
        <div>
          <h2>预算雷达</h2>
          <p>本月已分类支出 {money(total)}，风险来自速度而不只是金额。</p>
        </div>
        <button type="button" onClick={generatePlan} disabled={busyPlan}>
          {busyPlan ? "生成中..." : "生成下周预算"}
        </button>
      </div>
      {plan ? <div className="budget-plan">{plan}</div> : null}
      <div className="budget-lane-grid">
        {dashboard.budgetLanes.length ? (
          dashboard.budgetLanes.map((lane) => (
            <article className="budget-lane-card" key={lane.id}>
              <div className="row-between">
                <strong>{lane.name}</strong>
                <em>{percent(lane.rate)}</em>
              </div>
              <div className="progress">
                <span style={{ width: `${Math.min(lane.rate, 100)}%`, background: lane.color }} />
              </div>
              <small>
                {money(lane.spent)} / {money(lane.limit)}
              </small>
            </article>
          ))
        ) : (
          <div className="empty-region">还没有预算分类。先记几笔流水，再回来生成预算计划。</div>
        )}
      </div>
    </section>
  );
}

function GoalBoard({
  dashboard,
  createGoal,
  depositToGoal,
}: {
  dashboard: DashboardData;
  createGoal: (input: GoalInput) => Promise<void>;
  depositToGoal: (goalId?: string, amount?: number) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("旅行基金");
  const [target, setTarget] = useState("5000");
  const [saved, setSaved] = useState("0");
  const [deadline, setDeadline] = useState(defaultGoalDeadline());

  async function submitGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createGoal({
        name,
        target: Number(target),
        saved: Number(saved),
        deadline,
      });
      setCreating(false);
      setName("旅行基金");
      setTarget("5000");
      setSaved("0");
      setDeadline(defaultGoalDeadline());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建目标失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="goal-board">
      <div className="section-head row">
        <div>
          <h2>心愿目标</h2>
          <p>AI 会把每日可花和目标截止日合并成储蓄节奏。</p>
        </div>
        <button type="button" onClick={() => setCreating((value) => !value)}>
          {creating ? "收起" : "新建心愿"}
        </button>
      </div>
      {creating ? (
        <form className="goal-form" onSubmit={submitGoal}>
          <label>
            名称
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            目标金额
            <input value={target} inputMode="decimal" onChange={(event) => setTarget(event.target.value)} />
          </label>
          <label>
            已存金额
            <input value={saved} inputMode="decimal" onChange={(event) => setSaved(event.target.value)} />
          </label>
          <label>
            截止日
            <input
              value={deadline}
              type="date"
              onInput={(event) => setDeadline(event.currentTarget.value)}
              onChange={(event) => setDeadline(event.currentTarget.value)}
              onBlur={(event) => setDeadline(event.currentTarget.value)}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "保存中..." : "保存目标"}
          </button>
          {error ? <span>{error}</span> : null}
        </form>
      ) : null}
      <div className="goal-card-grid">
        {dashboard.goals.length ? (
          dashboard.goals.map((goal) => (
            <article className="goal-card-large" key={goal.id}>
              <Target size={20} />
              <strong>{goal.name}</strong>
              <span>{percent(goal.progress)}</span>
              <div className="progress">
                <span style={{ width: `${Math.min(goal.progress, 100)}%` }} />
              </div>
              <small>
                还差 {money(Math.max(goal.target - goal.saved, 0))} · 截止 {goal.deadline}
              </small>
              <button type="button" onClick={() => void depositToGoal(goal.id, 20)}>
                转入 {money(20)}
              </button>
            </article>
          ))
        ) : (
          <div className="empty-region">还没有心愿目标。点击“新建心愿”后会写入 D1。</div>
        )}
      </div>
    </section>
  );
}

function LedgerLab({ dashboard }: { dashboard: DashboardData }) {
  const largestExpense = dashboard.recentEntries
    .filter((entry) => entry.kind === "expense")
    .sort((a, b) => b.amount - a.amount)[0];

  return (
    <section className="insight-strip">
      <article>
        <TrendingUp size={18} />
        <strong>异常检测</strong>
        <span>{dashboard.risk ? `${dashboard.risk.name} 已超过安全节奏` : "没有异常消费速度"}</span>
      </article>
      <article>
        <MessageSquareText size={18} />
        <strong>复盘线索</strong>
        <span>
          {largestExpense
            ? `最近最大支出是「${largestExpense.title}」${money(largestExpense.amount)}，适合进入购买前模拟器。`
            : "这个月份还没有可复盘的支出流水。"}
        </span>
      </article>
      <article>
        <Sparkles size={18} />
        <strong>自动规则</strong>
        <span>{dashboard.recurring.length ? `当前已跟踪 ${dashboard.recurring.length} 个固定账单规则。` : "还没有固定账单规则，可从重复流水里创建。"}</span>
      </article>
    </section>
  );
}

function LedgerWorkspace({ dashboard, entries, parser, ledger }: { dashboard: DashboardData; entries: Entry[]; parser: React.ReactNode; ledger: React.ReactNode }) {
  const [appliedRule, setAppliedRule] = useState("");
  const missingNotes = entries.filter((entry) => !entry.note && !entry.scene).length;
  const incomeCount = entries.filter((entry) => entry.kind === "income").length;
  const expenseCount = entries.filter((entry) => entry.kind === "expense").length;
  const ruleCandidates = buildLedgerRuleCandidates(dashboard);

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={ReceiptText} label="本月流水" value={`${entries.length} 笔`} detail={`${expenseCount} 支出 · ${incomeCount} 收入`} />
        <ModuleStat icon={BadgeCheck} label="待补信息" value={`${missingNotes} 笔`} detail="缺少备注或场景" tone={missingNotes ? "warn" : "ok"} />
        <ModuleStat icon={ArrowLeftRight} label="账户流转" value={`${dashboard.accounts.length} 个`} detail="按账户自动聚合" />
      </div>
      {parser}
      {ledger}
      <section className="module-grid two">
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>自动规则候选</h2>
              <p>从近期流水里识别可复用的分类、账户和备注规则。</p>
            </div>
            <Sparkles size={18} />
          </div>
          <div className="rule-candidate-list">
            {ruleCandidates.map((rule) => (
              <button type="button" className={clsx(appliedRule === rule.title && "active")} key={rule.title} onClick={() => setAppliedRule(rule.title)}>
                <strong>{rule.title}</strong>
                <span>{rule.description}</span>
                <em>{appliedRule === rule.title ? "已套用" : "套用规则"}</em>
              </button>
            ))}
          </div>
        </div>
        <LedgerLab dashboard={dashboard} />
      </section>
    </section>
  );
}

function BudgetWorkspace({ dashboard, total, month }: { dashboard: DashboardData; total: number; month: string }) {
  const [draftLimits, setDraftLimits] = useState<Record<string, number>>(() =>
    Object.fromEntries(dashboard.budgetLanes.map((lane) => [lane.id, lane.limit])),
  );
  const [selectedLane, setSelectedLane] = useState(dashboard.budgetLanes[0]?.id || "");
  const simulatedLanes = dashboard.budgetLanes.map((lane) => {
    const limit = draftLimits[lane.id] || lane.limit;
    return { ...lane, limit, rate: limit ? Math.round((lane.spent / limit) * 1000) / 10 : 0 };
  });
  const selected = simulatedLanes.find((lane) => lane.id === selectedLane) || simulatedLanes[0];
  const projectedBalance = dashboard.summary.income - dashboard.summary.projectedExpense;

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={Gauge} label="预算总额" value={money(simulatedLanes.reduce((sum, lane) => sum + lane.limit, 0))} detail={`本月已花 ${money(total)}`} />
        <ModuleStat icon={AlertTriangle} label="最高风险" value={selected ? percent(selected.rate) : "暂无"} detail={selected?.name || "等待预算"} tone={selected && selected.rate > 80 ? "warn" : "ok"} />
        <ModuleStat icon={TrendingUp} label="月底预测" value={money(projectedBalance)} detail={projectedBalance >= 0 ? "仍有结余" : "可能透支"} tone={projectedBalance >= 0 ? "ok" : "warn"} />
      </div>
      <section className="module-grid two">
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>预算编辑器</h2>
              <p>直接调整分类上限，右侧风险和结余会即时重算。</p>
            </div>
            <span className="section-label">{month}</span>
          </div>
          <div className="editable-budget-list">
            {simulatedLanes.map((lane) => (
              <label className={clsx("budget-edit-row", selectedLane === lane.id && "active")} key={lane.id}>
                <button type="button" onClick={() => setSelectedLane(lane.id)}>
                  <span style={{ background: lane.color }} />
                  {lane.name}
                </button>
                <input
                  value={Math.round(draftLimits[lane.id] || lane.limit)}
                  inputMode="numeric"
                  onChange={(event) => setDraftLimits((current) => ({ ...current, [lane.id]: Number(event.target.value || 0) }))}
                />
                <em>{percent(lane.rate)}</em>
                <div className="progress">
                  <span style={{ width: `${Math.min(lane.rate, 100)}%`, background: lane.color }} />
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>下周预算方案</h2>
              <p>{selected ? `${selected.name} 是当前选中的预算线。` : "选择预算线查看建议。"}</p>
            </div>
            <ShieldCheck size={18} />
          </div>
          {selected ? (
            <div className="scenario-card">
              <strong>{money(Math.max(selected.limit - selected.spent, 0))}</strong>
              <span>本分类剩余额度</span>
              <p>
                建议把 {selected.name} 的单日支出控制在 {money(Math.max((selected.limit - selected.spent) / 7, 0))} 内；
                {selected.rate > 80 ? "本周优先减少非必要消费。" : "当前节奏可继续保持。"}
              </p>
            </div>
          ) : null}
        </div>
      </section>
      <BudgetBoard dashboard={{ ...dashboard, budgetLanes: simulatedLanes }} total={total} month={month} />
    </section>
  );
}

function AssetsWorkspace({
  dashboard,
  entries,
  depositToGoal,
}: {
  dashboard: DashboardData;
  entries: Entry[];
  depositToGoal: (goalId?: string, amount?: number) => Promise<void>;
}) {
  const [selectedAccount, setSelectedAccount] = useState(dashboard.accounts[0]?.name || "");
  const account = dashboard.accounts.find((item) => item.name === selectedAccount) || dashboard.accounts[0];
  const assets = dashboard.accounts.filter((item) => item.balance > 0).reduce((sum, item) => sum + item.balance, 0);
  const liabilities = Math.abs(dashboard.accounts.filter((item) => item.balance < 0).reduce((sum, item) => sum + item.balance, 0));
  const selectedEntries = account ? entries.filter((entry) => entry.accountName === account.name).slice(0, 8) : [];

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={Landmark} label="资产账户" value={money(assets)} detail={`${dashboard.accounts.filter((item) => item.balance > 0).length} 个正余额账户`} />
        <ModuleStat icon={CreditCard} label="待还负债" value={money(liabilities)} detail="来自负余额账户" tone={liabilities ? "warn" : "ok"} />
        <ModuleStat icon={Target} label="目标储蓄" value={money(dashboard.goals.reduce((sum, goal) => sum + goal.saved, 0))} detail={`${dashboard.goals.length} 个目标`} />
      </div>
      <section className="module-grid two">
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>账户资产图谱</h2>
              <p>点击账户查看对应流水和余额构成。</p>
            </div>
            <WalletCards size={18} />
          </div>
          <div className="account-map">
            {dashboard.accounts.map((item) => (
              <button type="button" className={clsx(selectedAccount === item.name && "active")} key={item.name} onClick={() => setSelectedAccount(item.name)}>
                <span>{item.name}</span>
                <strong className={item.balance < 0 ? "risk-text" : ""}>{money(item.balance)}</strong>
                <small>{item.entryCount} 笔 · {item.lastActivity}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>{account?.name || "账户详情"}</h2>
              <p>最近账户活动和对账线索。</p>
            </div>
            <Database size={18} />
          </div>
          <div className="mini-entry-list">
            {selectedEntries.length ? (
              selectedEntries.map((entry) => (
                <div key={entry.id}>
                  <span>{entry.title}</span>
                  <em className={entry.kind === "expense" ? "risk-text" : ""}>{entry.kind === "income" ? "+" : "-"}{money(entry.amount)}</em>
                </div>
              ))
            ) : (
              <div className="empty-region">这个账户本月没有可见流水。</div>
            )}
          </div>
        </div>
      </section>
      <GoalStrategyPanel dashboard={dashboard} depositToGoal={depositToGoal} compact />
    </section>
  );
}

function ReportsWorkspace({ dashboard }: { dashboard: DashboardData }) {
  const maxExpense = Math.max(1, ...dashboard.trend.map((item) => item.expense));
  const maxIncome = Math.max(1, ...dashboard.trend.map((item) => item.income));
  const bestMonth = [...dashboard.trend].sort((a, b) => b.balance - a.balance)[0];
  const worstMonth = [...dashboard.trend].sort((a, b) => a.balance - b.balance)[0];
  const expenseRate = dashboard.summary.income ? (dashboard.summary.expense / dashboard.summary.income) * 100 : 0;

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={TrendingUp} label="最佳月份" value={bestMonth?.month || "-"} detail={bestMonth ? money(bestMonth.balance) : "等待数据"} />
        <ModuleStat icon={BarChart3} label="压力月份" value={worstMonth?.month || "-"} detail={worstMonth ? money(worstMonth.balance) : "等待数据"} tone={worstMonth && worstMonth.balance < 0 ? "warn" : "ok"} />
        <ModuleStat icon={Gauge} label="费用率" value={percent(expenseRate)} detail="支出 / 收入" tone={expenseRate > 85 ? "warn" : "ok"} />
      </div>
      <section className="feature-panel">
        <div className="section-head row">
          <div>
            <h2>月度收支趋势</h2>
            <p>收入、支出、结余同时对比，帮你判断趋势而不是只看单月。</p>
          </div>
          <div className="report-legend" aria-label="图例">
            <span className="income">收入</span>
            <span className="expense">支出</span>
            <span className="balance">结余</span>
          </div>
        </div>
        <ReportTrendChart dashboard={dashboard} maxIncome={maxIncome} maxExpense={maxExpense} />
      </section>
      <section className="module-grid two">
        <CategoryPanel dashboard={dashboard} />
        <ReportStatementPanel dashboard={dashboard} />
      </section>
    </section>
  );
}

function ReportTrendChart({
  dashboard,
  maxIncome,
  maxExpense,
}: {
  dashboard: DashboardData;
  maxIncome: number;
  maxExpense: number;
}) {
  const balances = dashboard.trend.map((item) => item.balance);
  const minBalance = Math.min(...balances, 0);
  const maxBalance = Math.max(...balances, 1);
  const balanceRange = Math.max(maxBalance - minBalance, 1);

  return (
    <div className="report-trend-chart" role="img" aria-label="月度收入、支出和结余趋势">
      <div className="report-scale">
        <span>{money(Math.max(maxIncome, maxExpense))}</span>
        <span>{money(Math.round(Math.max(maxIncome, maxExpense) / 2))}</span>
        <span>{money(0)}</span>
      </div>
      <div className="report-bars">
        {dashboard.trend.map((item) => {
          const incomeHeight = Math.max(10, (item.income / maxIncome) * 100);
          const expenseHeight = Math.max(10, (item.expense / maxExpense) * 100);
          const balancePosition = 12 + ((item.balance - minBalance) / balanceRange) * 68;
          return (
            <article className={clsx(item.balance < 0 && "negative")} key={item.month}>
              <div className="bar-stack">
                <span className="income" style={{ height: `${incomeHeight}%` }}>
                  <em>收入</em>
                </span>
                <span className="expense" style={{ height: `${expenseHeight}%` }}>
                  <em>支出</em>
                </span>
                <i className="balance-marker" style={{ bottom: `${balancePosition}%` }} />
              </div>
              <div className="report-month-meta">
                <strong>{item.month.slice(5)}</strong>
                <small className={item.balance < 0 ? "risk-text" : ""}>结余 {money(item.balance)}</small>
                <Link className="month-drill-link" href={`/app/transactions?month=${encodeURIComponent(item.month)}`}>
                  查看明细
                </Link>
              </div>
              <div className="report-bar-values">
                <span>收 {money(item.income)}</span>
                <span>支 {money(item.expense)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ReportStatementPanel({ dashboard }: { dashboard: DashboardData }) {
  const projectedBalance = dashboard.summary.income - dashboard.summary.projectedExpense;
  const savingsRate = dashboard.summary.income ? Math.max((dashboard.summary.balance / dashboard.summary.income) * 100, 0) : 0;
  const expenseRate = dashboard.summary.income ? (dashboard.summary.expense / dashboard.summary.income) * 100 : 0;
  const recurringTotal = dashboard.recurring.reduce((sum, item) => sum + item.amount, 0);
  const rows = [
    { label: "本月收入", value: money(dashboard.summary.income), detail: "已入账收入", tone: "income" },
    { label: "本月支出", value: money(dashboard.summary.expense), detail: `费用率 ${percent(expenseRate)}`, tone: "expense" },
    { label: "经营结余", value: money(dashboard.summary.balance), detail: `储蓄率 ${percent(savingsRate)}`, tone: dashboard.summary.balance < 0 ? "expense" : "income" },
    { label: "固定扣费", value: money(recurringTotal), detail: `${dashboard.recurring.length} 个规则`, tone: "neutral" },
    { label: "预测结余", value: money(projectedBalance), detail: "月底趋势预测", tone: projectedBalance < 0 ? "expense" : "income" },
  ];

  return (
    <section className="report-statement-panel">
      <div className="section-head row">
        <div>
          <h2>本月损益快照</h2>
          <p>按个人现金流口径汇总，区别于单纯分类占比。</p>
        </div>
        <ReceiptText size={18} />
      </div>
      <div className="statement-table">
        {rows.map((row) => (
          <div className={clsx("statement-row", row.tone)} key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportInsightPanel({ dashboard }: { dashboard: DashboardData }) {
  const topCategory = dashboard.topCategories[0];
  const projectedBalance = dashboard.summary.income - dashboard.summary.projectedExpense;
  const savingsRate = dashboard.summary.income ? Math.max((dashboard.summary.balance / dashboard.summary.income) * 100, 0) : 0;
  const expenseRate = dashboard.summary.income ? (dashboard.summary.expense / dashboard.summary.income) * 100 : 0;
  const pressure = dashboard.risk ? `${dashboard.risk.name} 已到 ${percent(dashboard.risk.rate)}` : "当前没有超速分类";
  const recommendations = [
    `本月费用率 ${percent(expenseRate)}，结余 ${money(dashboard.summary.balance)}，储蓄率 ${percent(savingsRate)}。`,
    topCategory ? `${topCategory.name} 是最大支出项，占本月分类支出 ${percent(topCategory.share)}。` : "分类支出还不足，先补录几笔流水。 ",
    projectedBalance >= 0 ? `月底预计仍可结余 ${money(projectedBalance)}，现金流处于可控区间。` : `月底可能透支 ${money(Math.abs(projectedBalance))}，需要提前收紧预算。`,
  ];

  return (
    <section className="report-insight-panel">
      <div className="section-head row">
        <div>
          <span className="section-label">财务解读</span>
          <h2>本月经营判断</h2>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="report-verdict">
        <strong className={projectedBalance < 0 ? "risk-text" : ""}>{projectedBalance >= 0 ? "预算安全" : "预算承压"}</strong>
        <span>{pressure}</span>
      </div>
      <div className="report-note-list">
        {recommendations.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}

function ReportMethodPanel() {
  return (
    <section className="report-method-panel">
      <span className="section-label">图表口径</span>
      <div className="metric-definition-list">
        <p>
          <span className="income" />
          绿色柱表示当月收入，按已入账收入流水汇总。
        </p>
        <p>
          <span className="expense" />
          红色柱表示当月支出，按已发生消费流水汇总。
        </p>
        <p>
          <span className="balance" />
          蓝色标记表示结余，等于收入减支出。
        </p>
        <p>
          <span className="neutral" />
          环图只展示分类支出结构，不再和右侧重复。
        </p>
      </div>
    </section>
  );
}

function TransactionsWorkspace({
  dashboard,
  entries,
  search,
  loading,
  categories,
  parser,
  onSaveEntry,
  onDeleteEntry,
  onSaveFilter,
  onDeleteFilter,
  onReviewEntry,
}: {
  dashboard: DashboardData;
  entries: Entry[];
  search: string;
  loading: boolean;
  categories: Category[];
  parser: React.ReactNode;
  onSaveEntry: (entry: Entry) => Promise<Entry>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onSaveFilter: (input: EntryFilterDraft) => Promise<SavedEntryFilter>;
  onDeleteFilter: (filterId: string) => Promise<void>;
  onReviewEntry: (entryId: string, reviewed: boolean) => Promise<Entry>;
}) {
  const [mode, setMode] = useState<"all" | "large" | "unchecked">("unchecked");
  const [reviewBusyId, setReviewBusyId] = useState("");
  const largeThreshold = Math.max(300, dashboard.summary.expense * 0.08);
  const reviewEntries = entries.filter((entry) => {
    if (mode === "large") return entry.kind === "expense" && entry.amount >= largeThreshold;
    if (mode === "unchecked") return !entry.reviewedAt;
    return true;
  });
  const reviewedCount = entries.filter((entry) => entry.reviewedAt).length;

  async function toggleReview(entry: Entry) {
    setReviewBusyId(entry.id);
    try {
      await onReviewEntry(entry.id, !entry.reviewedAt);
    } finally {
      setReviewBusyId("");
    }
  }

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={ReceiptText} label="待审核" value={`${Math.max(entries.length - reviewedCount, 0)} 笔`} detail="D1 审核状态" />
        <ModuleStat icon={AlertTriangle} label="大额阈值" value={money(largeThreshold)} detail="自动标记大额支出" tone="warn" />
        <ModuleStat icon={BadgeCheck} label="已核对" value={`${reviewedCount} 笔`} detail="持久化记录" />
      </div>
      {parser}
      <LedgerPanel
        entries={entries}
        dense
        search={search}
        loading={loading}
        categories={categories}
        onSaveEntry={onSaveEntry}
        onDeleteEntry={onDeleteEntry}
        onSaveFilter={onSaveFilter}
        onDeleteFilter={onDeleteFilter}
        onReviewEntry={onReviewEntry}
        title="交易查询台"
        subtitle="按关键词、账户、分类、金额和日期范围定位本月每一笔流水。"
      />
      <section className="feature-panel">
        <div className="section-head row">
          <div>
            <h2>交易审核队列</h2>
            <p>把流水当作待审核交易处理：标记大额、核对、保留异常线索。</p>
          </div>
          <div className="visibility-toggle">
            {[
              ["unchecked", "待核对"],
              ["large", "大额"],
              ["all", "全部"],
            ].map(([value, label]) => (
              <button type="button" className={mode === value ? "active" : ""} key={value} onClick={() => setMode(value as typeof mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="transaction-review-list">
          {reviewEntries.map((entry) => (
            <article key={entry.id}>
              <CategoryGlyph entry={entry} />
              <div>
                <strong>{entry.title}</strong>
                <span>{entry.accountName} · {entry.category.name} · {entry.occurredOn}{entry.reviewedAt ? " · 已核对" : ""}</span>
              </div>
              <em className={entry.kind === "expense" ? "risk-text" : ""}>{entry.kind === "income" ? "+" : "-"}{money(entry.amount)}</em>
              <button type="button" disabled={reviewBusyId === entry.id} onClick={() => void toggleReview(entry)}>
                {reviewBusyId === entry.id ? "写入中" : entry.reviewedAt ? "取消核对" : "核对"}
              </button>
            </article>
          ))}
          {!reviewEntries.length ? <div className="empty-region">当前筛选下没有待审核交易。</div> : null}
        </div>
      </section>
    </section>
  );
}

function SubscriptionsWorkspace({ dashboard, entries }: { dashboard: DashboardData; entries: Entry[] }) {
  const [paused, setPaused] = useState<Set<string>>(() => new Set());
  const activeRules = dashboard.recurring.filter((item) => !paused.has(item.id));
  const total = activeRules.reduce((sum, item) => sum + item.amount, 0);
  const candidates = entries.filter((entry) => entry.kind === "expense" && /订阅|会员|视频|Netflix|Spotify|云|房租|固定/.test(`${entry.title}${entry.scene}${entry.note}`));

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={Repeat2} label="活跃规则" value={`${activeRules.length} 个`} detail={`${paused.size} 个已暂停`} />
        <ModuleStat icon={CreditCard} label="本月扣费" value={money(total)} detail="按活跃规则计算" />
        <ModuleStat icon={CalendarDays} label="下一笔" value={activeRules[0]?.nextOn || "-"} detail={activeRules[0]?.title || "暂无订阅"} />
      </div>
      <section className="module-grid two">
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>订阅规则中心</h2>
              <p>暂停、恢复和检查即将扣费的固定账单。</p>
            </div>
            <Repeat2 size={18} />
          </div>
          <div className="subscription-list">
            {dashboard.recurring.map((item) => (
              <article className={paused.has(item.id) ? "paused" : ""} key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.nextOn} · {item.status}</span>
                </div>
                <em>{money(item.amount)}</em>
                <button type="button" onClick={() => setPaused((current) => toggleSet(current, item.id))}>
                  {paused.has(item.id) ? "恢复" : "暂停"}
                </button>
              </article>
            ))}
          </div>
        </div>
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>从流水识别订阅</h2>
              <p>疑似重复扣费可以转成规则。</p>
            </div>
            <Search size={18} />
          </div>
          <div className="mini-entry-list">
            {candidates.length ? (
              candidates.map((entry) => (
                <div key={entry.id}>
                  <span>{entry.title}</span>
                  <em>{money(entry.amount)}</em>
                </div>
              ))
            ) : (
              <div className="empty-region">暂未发现新的订阅候选。</div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

function DebtsWorkspace({ dashboard }: { dashboard: DashboardData }) {
  const debtAccounts = dashboard.accounts.filter((account) => account.balance < 0);
  const debtTotal = debtAccounts.reduce((sum, account) => sum + Math.abs(account.balance), 0);
  const [payment, setPayment] = useState("1200");
  const monthlyPayment = Math.max(Number(payment || 0), 1);
  const payoffMonths = Math.ceil(debtTotal / monthlyPayment);

  return (
    <section className="module-stack">
      <div className="module-stat-grid">
        <ModuleStat icon={BadgeDollarSign} label="负债总额" value={money(debtTotal)} detail={`${debtAccounts.length} 个负余额账户`} tone={debtTotal ? "warn" : "ok"} />
        <ModuleStat icon={CalendarDays} label="预计还清" value={debtTotal ? `${payoffMonths} 月` : "无需还款"} detail={`每月 ${money(monthlyPayment)}`} />
        <ModuleStat icon={ShieldCheck} label="现金流" value={dashboard.summary.balance >= 0 ? "可承受" : "紧张"} detail={money(dashboard.summary.balance)} tone={dashboard.summary.balance >= 0 ? "ok" : "warn"} />
      </div>
      <section className="module-grid two">
        <DebtBoard dashboard={dashboard} />
        <div className="feature-panel">
          <div className="section-head row">
            <div>
              <h2>还款计划器</h2>
              <p>输入每月计划还款额，估算还清周期。</p>
            </div>
            <BadgeDollarSign size={18} />
          </div>
          <label className="payment-input">
            每月还款
            <input value={payment} inputMode="decimal" onChange={(event) => setPayment(event.target.value)} />
          </label>
          <div className="payoff-plan">
            {debtAccounts.map((account, index) => (
              <article key={account.name}>
                <strong>{index + 1}. {account.name}</strong>
                <span>{money(Math.abs(account.balance))}</span>
                <div className="progress">
                  <span style={{ width: `${Math.min((monthlyPayment / Math.max(Math.abs(account.balance), 1)) * 100, 100)}%` }} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function GoalStrategyPanel({
  dashboard,
  depositToGoal,
  compact = false,
}: {
  dashboard: DashboardData;
  depositToGoal: (goalId?: string, amount?: number) => Promise<void>;
  compact?: boolean;
}) {
  const [weeklyAmount, setWeeklyAmount] = useState("200");
  const amount = Math.max(Number(weeklyAmount || 0), 0);
  return (
    <section className={clsx("feature-panel", compact && "compact-goal-strategy")}>
      <div className="section-head row">
        <div>
          <h2>目标推进器</h2>
          <p>用每周转入金额估算目标节奏，并可直接转入第一项目标。</p>
        </div>
        <Target size={18} />
      </div>
      <div className="goal-strategy-grid">
        <label className="payment-input">
          每周转入
          <input value={weeklyAmount} inputMode="decimal" onChange={(event) => setWeeklyAmount(event.target.value)} />
        </label>
        <button type="button" onClick={() => void depositToGoal(undefined, amount || 20)}>
          转入第一目标
        </button>
      </div>
      <div className="goal-pace-list">
        {dashboard.goals.map((goal) => {
          const weeks = amount > 0 ? Math.ceil(Math.max(goal.target - goal.saved, 0) / amount) : 0;
          return (
            <article key={goal.id}>
              <strong>{goal.name}</strong>
              <span>{weeks ? `约 ${weeks} 周完成` : "等待转入金额"}</span>
              <div className="progress">
                <span style={{ width: `${Math.min(goal.progress, 100)}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ModuleStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "ok",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: "ok" | "warn";
}) {
  return (
    <article className={clsx("module-stat", tone)}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function buildLedgerRuleCandidates(dashboard: DashboardData) {
  const topCategory = dashboard.topCategories[0];
  const account = dashboard.accounts[0];
  return [
    {
      title: topCategory ? `${topCategory.name} 自动分类` : "餐饮自动分类",
      description: topCategory ? `包含 ${topCategory.name} 关键词时自动归入该分类。` : "从消费标题中识别餐饮、交通、购物关键词。",
    },
    {
      title: account ? `${account.name} 默认账户` : "默认账户规则",
      description: account ? `同类流水优先使用 ${account.name}。` : "识别常用支付账户并自动填入。",
    },
    {
      title: "固定扣费识别",
      description: dashboard.recurring.length ? `已跟踪 ${dashboard.recurring.length} 个固定账单，可从重复标题继续学习。` : "重复出现的扣费会进入订阅候选。",
    },
  ];
}

function toggleSet(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function CoachStudio({
  dashboard,
  month,
  parser,
  trendMax,
  onDeposit,
}: {
  dashboard: DashboardData;
  month: string;
  parser: React.ReactNode;
  trendMax: number;
  onDeposit: (goalId?: string, amount?: number) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [busyCoach, setBusyCoach] = useState(false);
  const [actions, setActions] = useState<CoachAction[]>([]);
  const cashflowState = getCashflowState(dashboard);
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `我正在读取 ${month} 的真实账本上下文。你可以问预算风险、下周计划，或先模拟一笔大额消费。`,
    },
  ]);

  async function askCoach(prompt = question) {
    const text = prompt.trim();
    if (!text) return;
    const userMessage: CoachMessage = { id: `user-${Date.now()}`, role: "user", content: text };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setBusyCoach(true);
    try {
      const response = await fetch("/api/backend/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, question: text }),
      });
      const payload = (await response.json()) as ApiPayload<{ answer: string; actions: CoachAction[] }>;
      if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "AI Coach 暂时不可用");
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", content: payload.data.answer },
      ]);
      setActions(payload.data.actions || []);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "AI Coach 暂时不可用",
        },
      ]);
    } finally {
      setBusyCoach(false);
    }
  }

  function runCoachAction(action: CoachAction) {
    if (action.intent === "goal") {
      void onDeposit(undefined, 20);
      return;
    }
    void askCoach(action.label);
  }

  return (
    <section className="coach-studio">
      <div className="ai-hero-panel">
        <span className="section-label">persistent ai coach</span>
        <h2>{month}，我会怎么安排下一笔钱？</h2>
        <p>
          结余 {money(dashboard.summary.balance)}，预计月底支出 {money(dashboard.summary.projectedExpense)}。
          {cashflowState.status === "danger"
            ? " 当前最大风险是现金流为负。"
            : cashflowState.status === "empty"
              ? " 当前还没有足够流水判断风险。"
            : dashboard.risk
              ? ` 当前最大风险是 ${dashboard.risk.name}。`
              : " 当前没有明显风险。"}
        </p>
        <div className="ai-command-row">
          <button type="button" onClick={() => void askCoach("解释本月最大预算风险，并给我三个动作。")}>
            解释本月风险
          </button>
          <button type="button" onClick={() => void askCoach("生成一个下周削减计划，尽量具体到分类。")}>
            生成削减计划
          </button>
          <button type="button" onClick={() => void askCoach("我想新增一笔 699 元消费，帮我模拟月底影响。")}>
            购买前模拟
          </button>
        </div>
      </div>
      <div className="ai-feed">
        {messages.map((message) => (
          <div className={clsx("ai-message", message.role)} key={message.id}>
            {message.role === "assistant" ? <Bot size={18} /> : null}
            <p>{message.content}</p>
          </div>
        ))}
        {busyCoach ? (
          <div className="ai-message assistant">
            <LoaderCircle className="spin" size={18} />
            <p>正在基于当前月份重新计算建议...</p>
          </div>
        ) : null}
        {actions.length ? (
          <div className="ai-action-list">
            {actions.map((action) => (
              <button type="button" key={action.id} onClick={() => runCoachAction(action)}>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <form
        className="ai-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void askCoach();
        }}
      >
        <input value={question} placeholder="问：这个月还能买键盘吗？或者让它生成下周预算" onChange={(event) => setQuestion(event.target.value)} />
        <button type="submit" disabled={busyCoach || !question.trim()}>
          {busyCoach ? <LoaderCircle className="spin" size={18} /> : "发送"}
        </button>
      </form>
      {parser}
      <ForecastPanel dashboard={dashboard} trendMax={trendMax} />
    </section>
  );
}

function ContextRail({ dashboard, onAction }: { dashboard: DashboardData; onAction: (action: string) => void }) {
  return (
    <aside className="context-rail">
      <CoachSummary dashboard={dashboard} />
      <CoachCards dashboard={dashboard} onAction={onAction} />
      <CategoryPanel dashboard={dashboard} />
    </aside>
  );
}

function DebtBoard({ dashboard }: { dashboard: DashboardData }) {
  const debtAccounts = dashboard.accounts.filter((account) => account.balance < 0);
  const debtTotal = debtAccounts.reduce((sum, account) => sum + Math.abs(account.balance), 0);
  return (
    <section className="debt-board">
      <div className="section-head row">
        <div>
          <h2>债务观察</h2>
          <p>从信用卡、负余额账户和固定扣费中识别待还压力。</p>
        </div>
        <strong>{money(debtTotal)}</strong>
      </div>
      {debtAccounts.length ? (
        <div className="debt-list">
          {debtAccounts.map((account) => (
            <article key={account.name}>
              <CreditCard size={18} />
              <div>
                <strong>{account.name}</strong>
                <span>{account.entryCount} 笔流水 · 最近 {account.lastActivity}</span>
              </div>
              <em>{money(Math.abs(account.balance))}</em>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-region">当前没有负余额账户。信用卡支出会在这里形成待还压力。</div>
      )}
    </section>
  );
}

function MonitorDashboard() {
  const [windowRange, setWindowRange] = useState("6h");
  const [refreshTick, setRefreshTick] = useState(0);
  const [overview, setOverview] = useState<MonitorOverview>(() => buildDemoMonitorOverview());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadMonitor() {
      setLoading(true);
      setStatus("");
      try {
        const response = await fetch(`/api/backend/monitor/overview?window=${encodeURIComponent(windowRange)}`);
        const payload = (await response.json()) as ApiPayload<MonitorOverview>;
        if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "监控数据加载失败");
        if (!cancelled) setOverview(payload.data);
      } catch (error) {
        if (!cancelled) {
          setOverview(buildDemoMonitorOverview());
          setStatus(error instanceof Error ? `${error.message}；当前显示本地演示监控样本。` : "当前显示本地演示监控样本。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMonitor();
    return () => {
      cancelled = true;
    };
  }, [windowRange, refreshTick]);

  const maxRequests = Math.max(1, ...overview.series.map((item) => item.requests));

  return (
    <section className="monitor-board">
      <div className="monitor-toolbar">
        <div>
          <span className="section-label">worker request sampling</span>
          <h2>应用级后台监控</h2>
          <p>成功 GET 按采样率记录，写请求和错误请求完整记录。</p>
        </div>
        <div className="monitor-actions">
          <div className="visibility-toggle">
            {["1h", "6h", "24h"].map((item) => (
              <button type="button" className={clsx(windowRange === item && "active")} key={item} onClick={() => setWindowRange(item)}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setRefreshTick((value) => value + 1)}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            刷新
          </button>
        </div>
      </div>
      {status ? <div className="inline-notice">{status}</div> : null}
      <div className="monitor-metrics">
        <MonitorMetric icon={Server} label="采样请求" value={overview.summary.capturedRequests.toLocaleString("zh-CN")} detail={`${overview.summary.requestsPerMinute}/min`} />
        <MonitorMetric icon={AlertTriangle} label="错误率" value={percent(overview.summary.errorRate)} detail={`${overview.summary.writeRequests} 次写请求`} tone={overview.summary.errorRate > 5 ? "risk" : "ok"} />
        <MonitorMetric icon={Activity} label="平均延迟" value={`${overview.summary.avgDurationMs}ms`} detail={`P95 ${overview.summary.p95DurationMs}ms`} />
        <MonitorMetric icon={Database} label="采样率" value={percent(overview.sampleRate * 100)} detail="错误和写入 100%" />
      </div>
      <div className="monitor-grid">
        <section className="monitor-panel wide">
          <div className="section-head row">
            <h2>请求趋势</h2>
            <small>窗口 {overview.window}</small>
          </div>
          <div className="monitor-bars">
            {overview.series.map((item) => (
              <div className="monitor-bar" key={item.label}>
                <span style={{ height: `${Math.max(8, (item.requests / maxRequests) * 100)}%` }} />
                {item.errors ? <em style={{ height: `${Math.max(4, (item.errors / maxRequests) * 100)}%` }} /> : null}
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="monitor-panel">
          <div className="section-head row">
            <h2>监控策略</h2>
            <ShieldCheck size={18} />
          </div>
          <p>GET 成功请求按默认 35% 采样，POST/PUT/DELETE 和 4xx/5xx 响应完整记录。后台页面读取 D1 聚合，不依赖 Cloudflare 控制台。</p>
        </section>
      </div>
      <section className="monitor-panel">
        <div className="section-head row">
          <h2>热门接口</h2>
          <small>按采样计数排序</small>
        </div>
        <div className="endpoint-table">
          {overview.endpoints.map((endpoint) => (
            <div className="endpoint-row" key={`${endpoint.method}-${endpoint.path}`}>
              <strong>{endpoint.method}</strong>
              <span>{endpoint.path}</span>
              <em>{endpoint.count} 次</em>
              <small>{endpoint.errors} 错误 · avg {endpoint.avgMs}ms · p95 {endpoint.p95Ms}ms</small>
            </div>
          ))}
        </div>
      </section>
      <section className="monitor-panel">
        <div className="section-head row">
          <h2>最近请求</h2>
          <small>{new Date(overview.generatedAt).toLocaleString("zh-CN")}</small>
        </div>
        <div className="request-log-list">
          {overview.recent.map((request) => (
            <div className="request-log-row" key={request.id}>
              <strong className={request.status >= 400 ? "risk-text" : ""}>{request.status}</strong>
              <span>{request.method} {request.path}</span>
              <em>{request.durationMs}ms</em>
              <small>{formatMonitorTime(request.createdAt)} · {request.requestId.slice(0, 8)}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function MonitorMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "ok",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: "ok" | "risk";
}) {
  return (
    <article className={clsx("monitor-metric", tone)}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function CommunityHub({ month, dashboard, demoMode }: { month: string; dashboard: DashboardData; demoMode: boolean }) {
  const [activeTopic, setActiveTopic] = useState<CommunityTopic["id"]>("all");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [title, setTitle] = useState(`${month} 账本复盘`);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "anonymous">("public");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadPosts() {
      setLoading(true);
      setStatus("");
      try {
        const query = activeTopic === "all" ? "" : `?topic=${encodeURIComponent(activeTopic)}`;
        const response = await fetch(`/api/backend/community/posts${query}`);
        const payload = (await response.json()) as ApiPayload<{ posts: CommunityPost[] }>;
        if (!response.ok || payload.code !== 0) throw new Error(payload.msg || "社区加载失败");
        if (!cancelled) setPosts(payload.data.posts);
      } catch (error) {
        if (!cancelled) {
          const fallback = buildDemoCommunityPosts(month, dashboard);
          setPosts(activeTopic === "all" ? fallback : fallback.filter((post) => post.topic === activeTopic));
          setStatus(demoMode ? "演示社区：登录后发帖、点赞和回复会写入 D1。" : error instanceof Error ? error.message : "社区加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPosts();
    return () => {
      cancelled = true;
    };
  }, [activeTopic, demoMode, dashboard, month]);

  async function submitPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (text.length < 8) {
      setStatus("内容至少 8 个字。");
      return;
    }
    setPosting(true);
    setStatus("");
    try {
      const topic = activeTopic === "all" ? "monthly-review" : activeTopic;
      const response = await fetch("/api/backend/community/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body: text, visibility, topic, monthlyContext: month }),
      });
      const payload = (await response.json()) as ApiPayload<{ post: CommunityPost | null }>;
      if (!response.ok || payload.code !== 0 || !payload.data.post) throw new Error(payload.msg || "发布失败");
      setPosts((current) => [payload.data.post as CommunityPost, ...current]);
      setBody("");
      setTitle(`${month} 账本复盘`);
      setStatus("已发布到社区。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布失败");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(postId: string) {
    try {
      const response = await fetch(`/api/backend/community/posts/${postId}/like`, { method: "POST" });
      const payload = (await response.json()) as ApiPayload<{ post: CommunityPost | null }>;
      if (!response.ok || payload.code !== 0 || !payload.data.post) throw new Error(payload.msg || "点赞失败");
      setPosts((current) => replaceCommunityPost(current, payload.data.post as CommunityPost));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "点赞失败");
    }
  }

  async function addComment(postId: string, comment: string) {
    const text = comment.trim();
    if (text.length < 2) {
      setStatus("回复至少 2 个字。");
      return;
    }
    try {
      const response = await fetch(`/api/backend/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const payload = (await response.json()) as ApiPayload<{ post: CommunityPost | null }>;
      if (!response.ok || payload.code !== 0 || !payload.data.post) throw new Error(payload.msg || "回复失败");
      setPosts((current) => replaceCommunityPost(current, payload.data.post as CommunityPost));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "回复失败");
    }
  }

  return (
    <section className="community-hub">
      <div className="section-head row">
        <div>
          <h2>账本社区</h2>
          <p>和同样在认真记账的人交换预算复盘、购买决策和省钱挑战。</p>
        </div>
        <span className="community-live">
          <Users size={15} />
          {loading ? "同步中" : `${posts.length} 条讨论`}
        </span>
      </div>

      <div className="topic-strip">
        {communityTopics.map((topic) => (
          <button
            className={clsx(activeTopic === topic.id && "active")}
            type="button"
            key={topic.id}
            onClick={() => setActiveTopic(topic.id)}
          >
            <strong>{topic.label}</strong>
            <span>{topic.hint}</span>
          </button>
        ))}
      </div>

      <form className="community-composer" onSubmit={submitPost}>
        <div className="composer-context">
          <BadgeCheck size={18} />
          <span>{month} · 结余 {money(dashboard.summary.balance)} · 今日可花 {money(dashboard.summary.dailyAllowance)}</span>
        </div>
        <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        <textarea
          value={body}
          rows={4}
          placeholder="写下你的预算复盘、想买但犹豫的东西，或一个省钱挑战。"
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="composer-actions">
          <div className="visibility-toggle" aria-label="发布身份">
            <button className={clsx(visibility === "public" && "active")} type="button" onClick={() => setVisibility("public")}>
              公开
            </button>
            <button className={clsx(visibility === "anonymous" && "active")} type="button" onClick={() => setVisibility("anonymous")}>
              匿名
            </button>
          </div>
          <button className="primary-action compact" type="submit" disabled={posting}>
            {posting ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
            发布讨论
          </button>
        </div>
      </form>

      {status ? <div className="inline-notice">{status}</div> : null}

      <div className="community-feed">
        {posts.length ? (
          posts.map((post) => <CommunityPostCard post={post} key={post.id} onLike={toggleLike} onComment={addComment} />)
        ) : (
          <div className="empty-region">还没有讨论。发第一条月度复盘，社区会从这里开始。</div>
        )}
      </div>
    </section>
  );
}

function CommunityPostCard({
  post,
  onLike,
  onComment,
}: {
  post: CommunityPost;
  onLike: (postId: string) => void;
  onComment: (postId: string, body: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const topic = communityTopics.find((item) => item.id === post.topic);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onComment(post.id, comment);
    setComment("");
  }

  return (
    <article className="community-post">
      <div className="post-meta">
        <span>{topic?.label || "账本讨论"}</span>
        <em>{post.monthlyContext || formatCommunityTime(post.createdAt)}</em>
      </div>
      <h3>{post.title}</h3>
      <p>{post.body}</p>
      <div className="post-author">
        <span>{post.authorName}</span>
        {post.isMine ? <em>我发布的</em> : null}
        <small>{formatCommunityTime(post.createdAt)}</small>
      </div>
      {post.comments.length ? (
        <div className="comment-stack">
          {post.comments.slice(-3).map((commentItem) => (
            <div className="comment-line" key={commentItem.id}>
              <strong>{commentItem.authorName}</strong>
              <span>{commentItem.body}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="post-actions">
        <button className={clsx(post.likedByMe && "active")} type="button" onClick={() => onLike(post.id)}>
          <Heart size={16} />
          {post.likeCount}
        </button>
        <span>
          <MessageCircle size={16} />
          {post.commentCount}
        </span>
        <form onSubmit={submitComment}>
          <input value={comment} placeholder="回复这个账本想法" onChange={(event) => setComment(event.target.value)} />
          <button type="submit" aria-label="发送回复">
            <Send size={15} />
          </button>
        </form>
      </div>
    </article>
  );
}

function CommunityPulse({ dashboard }: { dashboard: DashboardData }) {
  const topCategory = dashboard.topCategories[0];
  const riskLabel = dashboard.risk ? `${dashboard.risk.name} ${percent(dashboard.risk.rate)}` : "暂无超速分类";
  return (
    <aside className="community-pulse">
      <div className="pulse-card lead">
        <span className="section-label">community pulse</span>
        <h2>把账本变成可讨论的决策</h2>
        <p>社区不替你做决定，它把真实月份、真实预算和别人的经验放到同一个页面。</p>
      </div>
      <div className="pulse-grid">
        <article>
          <MessageSquareText size={18} />
          <strong>{riskLabel}</strong>
          <span>适合发起风险复盘</span>
        </article>
        <article>
          <Heart size={18} />
          <strong>{money(dashboard.summary.dailyAllowance)}</strong>
          <span>今日可花参考线</span>
        </article>
        <article>
          <Target size={18} />
          <strong>{dashboard.goals.length || 0} 个目标</strong>
          <span>适合加入省钱挑战</span>
        </article>
      </div>
      <div className="pulse-card">
        <div className="section-head row">
          <h2>可发起的话题</h2>
          <MessagesSquare size={18} />
        </div>
        <button type="button">这个月最大支出值不值得？</button>
        <button type="button">{topCategory ? `${topCategory.name} 怎么压到 ${percent(Math.max(topCategory.share - 5, 0))}？` : "第一笔流水应该怎么分类？"}</button>
        <button type="button">下周省钱挑战打卡</button>
      </div>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  change,
  detail,
  values,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  detail: string;
  values: number[];
  tone: "teal" | "rose";
}) {
  return (
    <article className={clsx("metric-card", tone)}>
      <span>{label}</span>
      <div className="metric-value-row">
        <strong>{value}</strong>
        <em className={tone === "rose" ? "risk" : "up"}>{change}</em>
      </div>
      <small>{detail}</small>
      <MiniLine values={values} tone={tone} />
    </article>
  );
}

function MiniLine({ values, tone = "teal" }: { values: number[]; tone?: "teal" | "rose" }) {
  const cleanValues = values.length ? values.map((value) => Number(value || 0)) : [0, 0];
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const rawRange = max - min;
  const padding = rawRange > 0 ? rawRange * 0.18 : Math.max(Math.abs(max), 1) * 0.06;
  const floor = min - padding;
  const ceiling = max + padding;
  const range = Math.max(ceiling - floor, 1);
  const baseline = 38;
  const points = cleanValues.map((value, index) => {
    const x = (index / Math.max(cleanValues.length - 1, 1)) * 100;
    const normalized = (value - floor) / range;
    const y = 36 - normalized * 28;
    return { x, y: Math.max(6, Math.min(36, y)) };
  });
  const pointString = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const areaPath = points.length
    ? `M0 ${baseline} ${points.map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")} L100 ${baseline} Z`
    : "";
  return (
    <svg className={clsx("mini-line", tone)} viewBox="0 0 100 42" role="img" aria-label="趋势线">
      <path d={areaPath} />
      <polyline points={pointString} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function replaceCommunityPost(posts: CommunityPost[], post: CommunityPost) {
  return posts.map((item) => (item.id === post.id ? post : item));
}

function buildDemoCommunityPosts(month: string, dashboard: DashboardData): CommunityPost[] {
  const topCategory = dashboard.topCategories[0]?.name || "餐饮";
  return [
    {
      id: `demo-community-${month}-1`,
      topic: "monthly-review",
      title: `${month} 预算复盘：先把最大分类压下来`,
      body: `本月结余是 ${money(dashboard.summary.balance)}，我准备先复盘 ${topCategory}。如果下周每天少一杯饮料，月底预测支出应该能明显下降。`,
      monthlyContext: month,
      visibility: "public",
      authorName: "星芒用户",
      isMine: false,
      likeCount: 18,
      commentCount: 2,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      comments: [
        { id: "demo-c1", authorName: "预算派", body: "我会先拆成工作日和周末两条线看。", createdAt: new Date().toISOString() },
        { id: "demo-c2", authorName: "匿名账友", body: "把奶茶单独建分类很有用。", createdAt: new Date().toISOString() },
      ],
    },
    {
      id: `demo-community-${month}-2`,
      topic: "purchase-check",
      title: "想买键盘之前先跑购买前模拟",
      body: `如果新增一笔 699 元消费，月底预测支出会变成 ${money(dashboard.summary.projectedExpense + 699)}。这类帖子适合让别人帮你判断是否该延后。`,
      monthlyContext: month,
      visibility: "anonymous",
      authorName: "匿名账友",
      isMine: false,
      likeCount: 11,
      commentCount: 1,
      likedByMe: true,
      createdAt: new Date().toISOString(),
      comments: [{ id: "demo-c3", authorName: "匿名账友", body: "可以先等一个账期，看目标进度有没有掉。", createdAt: new Date().toISOString() }],
    },
  ];
}

function buildDemoMonitorOverview(): MonitorOverview {
  const now = Date.UTC(2026, 4, 13, 12, 0, 0);
  const series = Array.from({ length: 12 }, (_, index) => ({
    label: new Date(now - (11 - index) * 30 * 60 * 1000).toISOString().slice(11, 16),
    requests: 18 + ((index * 7) % 31),
    errors: index % 5 === 0 ? 2 : index % 4 === 0 ? 1 : 0,
    avgMs: 58 + ((index * 13) % 80),
  }));
  return {
    window: "6h",
    sampleRate: 0.35,
    generatedAt: new Date(now).toISOString(),
    summary: {
      capturedRequests: 260,
      writeRequests: 68,
      errorRate: 4.2,
      avgDurationMs: 96,
      p95DurationMs: 238,
      requestsPerMinute: 0.7,
    },
    series,
    endpoints: [
      { method: "GET", path: "/api/dashboard", count: 56, errors: 0, avgMs: 62, p95Ms: 128 },
      { method: "POST", path: "/api/entries", count: 42, errors: 1, avgMs: 88, p95Ms: 166 },
      { method: "POST", path: "/api/ai/coach", count: 38, errors: 2, avgMs: 142, p95Ms: 320 },
      { method: "GET", path: "/api/community/posts", count: 33, errors: 0, avgMs: 75, p95Ms: 130 },
      { method: "GET", path: "/api/monitor/overview", count: 18, errors: 0, avgMs: 54, p95Ms: 96 },
    ],
    recent: Array.from({ length: 10 }, (_, index) => ({
      id: `demo-monitor-${index}`,
      method: index % 3 === 0 ? "POST" : "GET",
      path: index % 3 === 0 ? "/api/entries" : "/api/dashboard",
      status: index === 2 ? 429 : index === 6 ? 500 : 200,
      durationMs: 42 + index * 17,
      requestId: `demo${index}requestid`,
      createdAt: new Date(now - index * 90_000).toISOString(),
      userAgent: "Demo monitor",
    })),
  };
}

function formatCommunityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function formatMonitorTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function entryDateForMonth(month: string) {
  const today = localDateKey();
  return today.startsWith(month) ? today : `${month}-01`;
}

function defaultGoalDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 120);
  return localDateKey(date);
}

function buildMetricRows(dashboard: DashboardData, changes: ReturnType<typeof buildMetricChanges>) {
  const incomeValues = dashboard.trend.map((item) => item.income);
  const expenseValues = dashboard.trend.map((item) => item.expense);
  const balanceValues = dashboard.trend.map((item) => item.balance);
  const assetValues = dashboard.trend.map((item, index) => Math.max(dashboard.summary.netAssets - (incomeValues.length - index - 1) * 820 + item.balance * 0.05, 0));
  return [
    {
      label: "净收入",
      value: money(dashboard.summary.income),
      change: changes.income,
      detail: `收入 ${money(dashboard.summary.income)} · 退款 ${money(Math.max(dashboard.summary.income - dashboard.summary.expense, 0) * 0.12)}`,
      values: incomeValues,
      tone: "teal" as const,
    },
    {
      label: "支出",
      value: money(dashboard.summary.expense),
      change: changes.expense,
      detail: `预算 ${money(dashboard.summary.projectedExpense)} · 剩余 ${money(Math.max(dashboard.summary.projectedExpense - dashboard.summary.expense, 0))}`,
      values: expenseValues,
      tone: dashboard.risk ? ("rose" as const) : ("teal" as const),
    },
    {
      label: "结余",
      value: money(dashboard.summary.balance),
      change: changes.balance,
      detail: `储蓄率 ${percent(Math.max((dashboard.summary.balance / Math.max(dashboard.summary.income, 1)) * 100, 0))}`,
      values: balanceValues,
      tone: dashboard.summary.balance < 0 ? ("rose" as const) : ("teal" as const),
    },
    {
      label: "净资产",
      value: money(dashboard.summary.netAssets),
      change: "账本+目标",
      detail: `总资产 ${money(dashboard.summary.netAssets + Math.abs(Math.min(dashboard.summary.balance, 0)))} · 负债 ${money(Math.abs(Math.min(dashboard.summary.balance, 0)))}`,
      values: assetValues,
      tone: "teal" as const,
    },
  ];
}

function buildMetricChanges(dashboard: DashboardData) {
  const current = dashboard.trend.at(-1);
  const previous = dashboard.trend.at(-2);
  return {
    income: deltaLabel(current?.income ?? dashboard.summary.income, previous?.income),
    expense: deltaLabel(current?.expense ?? dashboard.summary.expense, previous?.expense),
    balance: deltaLabel(current?.balance ?? dashboard.summary.balance, previous?.balance),
  };
}

function deltaLabel(current: number, previous = 0) {
  if (!previous) return "本月";
  const rate = ((current - previous) / Math.abs(previous)) * 100;
  const sign = rate > 0 ? "+" : "";
  return `${sign}${rate.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}%`;
}

function getCashflowState(dashboard: DashboardData) {
  if (dashboard.summary.balance < 0) {
    return {
      status: "danger",
      label: "现金流为负",
      shortLabel: "紧张",
    } as const;
  }
  if (dashboard.summary.income <= 0 && dashboard.summary.expense <= 0) {
    return {
      status: "empty",
      label: "等待真实流水",
      shortLabel: "待补",
    } as const;
  }
  return {
    status: "good",
    label: "现金流稳定",
    shortLabel: "良好",
  } as const;
}
