import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";

export default function LoginPage() {
  return (
    <main className="auth-screen">
      <Link className="brand-mark auth-brand" href="/">
        <span className="brand-sigil">✦</span>
        <span>
          <strong>星芒账本</strong>
          <small>Starry Ledger</small>
        </span>
      </Link>
      <section className="auth-grid">
        <div className="auth-pitch">
          <span className="hero-kicker">Secure cockpit</span>
          <h1>把登录做轻，把钱的判断做重。</h1>
          <p>当前版本使用邮箱密码、HttpOnly Cookie 会话、服务端限流和可选 Turnstile 防刷。</p>
          <div className="auth-proof">
            <span>无短信成本</span>
            <span>可接邮箱验证</span>
            <span>Worker 权威会话</span>
          </div>
        </div>
        <AuthPanel />
      </section>
    </main>
  );
}
