"use client";

import {
  Activity,
  ArrowUpRight,
  Database,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminOverview, AdminUser } from "@/types";

type ApiPayload<T> = {
  code: number;
  msg: string;
  data: T;
};

type RequestError = Error & {
  status?: number;
};

async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({ code: response.status, msg: "请求失败", data: {} }))) as ApiPayload<T>;
  if (!response.ok || payload.code !== 0) {
    const error = new Error(payload.msg || "请求失败") as RequestError;
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export function AdminConsole() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthenticated" | "forbidden" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [bootstrapping, setBootstrapping] = useState(false);

  const loadOverview = useCallback(async () => {
    setMessage("");
    setStatus("loading");
    try {
      const data = await adminRequest<AdminOverview>("/admin/overview");
      setOverview(data);
      setStatus("ready");
    } catch (error) {
      const typed = error as RequestError;
      setOverview(null);
      if (typed.status === 401) {
        setStatus("unauthenticated");
      } else if (typed.status === 403) {
        setStatus("forbidden");
      } else {
        setStatus("error");
        setMessage(typed.message || "管理数据加载失败");
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function bootstrapAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBootstrapping(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const setupToken = String(form.get("setupToken") || "");
    const payload = {
      setupToken,
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      displayName: String(form.get("displayName") || ""),
    };
    try {
      await adminRequest<{ user: unknown }>("/admin/bootstrap", {
        method: "POST",
        headers: { "x-admin-setup-token": setupToken },
        body: JSON.stringify(payload),
      });
      setMessage("管理员已创建，并已登录当前浏览器。");
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "管理员初始化失败");
    } finally {
      setBootstrapping(false);
    }
  }

  async function changeRole(user: AdminUser) {
    const nextRole = user.role === "admin" ? "user" : "admin";
    setBusyUserId(user.id);
    setMessage("");
    try {
      await adminRequest(`/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "角色更新失败");
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <main className="admin-screen">
      <header className="admin-nav">
        <Link className="brand-mark" href="/">
          <span className="brand-sigil">✦</span>
          <span>
            <strong>星芒账本</strong>
            <small>Admin Console</small>
          </span>
        </Link>
        <nav>
          <Link href="/app">回到账本</Link>
          <Link href="/login">登录</Link>
        </nav>
      </header>

      <section className="admin-hero">
        <span>ADMIN CONTROL PLANE</span>
        <h1>管理用户、权限和运行状态。</h1>
        <p>管理员权限由 Worker 校验，前端只负责展示和操作，不承担权限判断。</p>
      </section>

      {message ? <div className="admin-message">{message}</div> : null}
      {status === "loading" ? (
        <div className="admin-state">
          <LoaderCircle className="spin" size={22} />
          <strong>正在读取管理数据</strong>
          <p>请稍等。</p>
        </div>
      ) : null}
      {status === "unauthenticated" ? (
        <>
          <div className="admin-state">
            <KeyRound size={24} />
            <strong>已有管理员请先登录</strong>
            <p>如果这是第一次部署，也可以在下面用初始化口令创建第一个管理员账号。</p>
            <Link className="primary-action compact" href="/login">去登录</Link>
          </div>
          <BootstrapPanel busy={bootstrapping} onSubmit={bootstrapAdmin} />
        </>
      ) : null}
      {status === "forbidden" ? <BootstrapPanel busy={bootstrapping} onSubmit={bootstrapAdmin} /> : null}
      {status === "error" ? (
        <div className="admin-state">
          <Activity size={24} />
          <strong>管理面板暂时不可用</strong>
          <p>检查 Worker、D1 迁移和当前登录态后重试。</p>
          <button className="secondary-action" type="button" onClick={() => void loadOverview()}>重新加载</button>
        </div>
      ) : null}
      {overview && status === "ready" ? (
        <AdminDashboard overview={overview} busyUserId={busyUserId} onRoleChange={changeRole} onRefresh={loadOverview} />
      ) : null}
    </main>
  );
}

function BootstrapPanel({ busy, onSubmit }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="admin-bootstrap">
      <div>
        <span>FIRST ADMIN</span>
        <h2>初始化第一个管理员</h2>
        <p>只有设置了正确的初始化口令，且系统里还没有管理员时，才能创建第一个管理员账号。</p>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          初始化口令
          <input name="setupToken" type="password" autoComplete="off" required placeholder="ADMIN_SETUP_TOKEN" />
        </label>
        <label>
          管理员邮箱
          <input name="email" type="email" autoComplete="username" required placeholder="admin@example.com" />
        </label>
        <label>
          显示名称
          <input name="displayName" maxLength={40} placeholder="星芒管理员" />
        </label>
        <label>
          管理员密码
          <input name="password" type="password" autoComplete="new-password" minLength={12} required placeholder="至少 12 位" />
        </label>
        <button className="primary-action full" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
          创建管理员
        </button>
      </form>
    </section>
  );
}

function AdminDashboard({
  overview,
  busyUserId,
  onRoleChange,
  onRefresh,
}: {
  overview: AdminOverview;
  busyUserId: string;
  onRoleChange: (user: AdminUser) => void;
  onRefresh: () => void;
}) {
  const summary = [
    { label: "用户", value: overview.summary.users, icon: Users },
    { label: "管理员", value: overview.summary.admins, icon: ShieldCheck },
    { label: "流水", value: overview.summary.entries, icon: Database },
    { label: "24h 请求", value: overview.summary.requests24h, icon: Activity },
  ];
  return (
    <section className="admin-dashboard">
      <div className="admin-toolbar">
        <div>
          <strong>{overview.currentUser.displayName}</strong>
          <span>{overview.currentUser.email}</span>
        </div>
        <button className="secondary-action" type="button" onClick={onRefresh}>刷新</button>
      </div>

      <div className="admin-metrics">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label}>
              <Icon size={19} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          );
        })}
        <article>
          <ArrowUpRight size={19} />
          <span>错误率</span>
          <strong>{overview.summary.errorRate24h}%</strong>
        </article>
      </div>

      <div className="admin-grid">
        <section className="admin-card wide">
          <div className="admin-card-head">
            <h2>用户与权限</h2>
            <span>{overview.summary.activeSessions} 个有效会话</span>
          </div>
          <div className="admin-table">
            {overview.users.map((user) => (
              <div className="admin-user-row" key={user.id}>
                <div>
                  <strong>{user.displayName}</strong>
                  <span>{user.email}</span>
                </div>
                <span className={user.role === "admin" ? "role-pill admin" : "role-pill"}>{user.role === "admin" ? "管理员" : "普通用户"}</span>
                <span>{user.entryCount} 笔流水</span>
                <button type="button" disabled={busyUserId === user.id} onClick={() => onRoleChange(user)}>
                  {busyUserId === user.id ? "处理中" : user.role === "admin" ? "降为普通" : "设为管理员"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h2>接口热度</h2>
            <span>最近 24 小时</span>
          </div>
          <div className="admin-endpoints">
            {overview.topEndpoints.map((endpoint) => (
              <div key={`${endpoint.method}-${endpoint.path}`}>
                <strong>{endpoint.method}</strong>
                <span>{endpoint.path}</span>
                <em>{endpoint.count} 次 / {endpoint.avgMs}ms</em>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card wide">
          <div className="admin-card-head">
            <h2>最近请求</h2>
            <span>{new Date(overview.generatedAt).toLocaleString()}</span>
          </div>
          <div className="admin-request-list">
            {overview.recentRequests.map((request) => (
              <div className="admin-request-row" key={request.id}>
                <strong>{request.status}</strong>
                <span>{request.method} {request.path}</span>
                <span>{request.userEmail || "匿名"}</span>
                <em>{request.durationMs}ms</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
