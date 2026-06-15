"use client";

import { LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Mode = "login" | "register";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileNode = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");
    if (turnstileWidgetId.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId.current);
    }
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!turnstileSiteKey || !turnstileNode.current || !window.turnstile) return;
    if (turnstileWidgetId.current) {
      resetTurnstile();
      return;
    }
    turnstileWidgetId.current = window.turnstile.render(turnstileNode.current, {
      sitekey: turnstileSiteKey,
      callback: setTurnstileToken,
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });
  }, [resetTurnstile]);

  useEffect(() => {
    renderTurnstile();
  }, [mode, renderTurnstile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    if (turnstileSiteKey && !turnstileToken) {
      setMessage("请先完成人机校验。");
      setLoading(false);
      return;
    }
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      displayName: String(form.get("displayName") || ""),
      turnstileToken,
    };
    try {
      const response = await fetch(`/api/backend/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { code: number; msg: string };
      if (!response.ok || data.code !== 0) throw new Error(data.msg || "登录失败");
      router.push("/app");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请求失败");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-panel">
      <div className="segmented">
        <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
          登录
        </button>
        <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
          注册
        </button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" ? (
          <label>
            昵称
            <input name="displayName" maxLength={40} placeholder="星芒用户" />
          </label>
        ) : null}
        <label>
          邮箱
          <span className="input-icon">
            <Mail size={17} />
            <input name="email" type="email" required placeholder="you@example.com" />
          </span>
        </label>
        <label>
          密码
          <input name="password" type="password" minLength={8} required placeholder="至少 8 位" />
        </label>
        {turnstileSiteKey ? (
          <>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              strategy="afterInteractive"
              onLoad={renderTurnstile}
            />
            <div className="turnstile-box" ref={turnstileNode} />
          </>
        ) : null}
        <div className="security-note">
          <ShieldCheck size={16} />
          {turnstileSiteKey
            ? "Turnstile 人机校验已启用。"
            : "Turnstile site key 未配置时，本地开发会跳过人机校验。"}
        </div>
        {message ? <div className="form-error">{message}</div> : null}
        <button className="primary-action full" type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={18} /> : null}
          {mode === "login" ? "进入驾驶舱" : "创建账本"}
        </button>
      </form>
    </div>
  );
}
