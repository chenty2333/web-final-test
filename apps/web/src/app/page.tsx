import {
  ArrowRight,
  Brain,
  ChartNoAxesCombined,
  CircleDollarSign,
  Command,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { compactMoney, money } from "@/lib/format";
import { demoDashboard } from "@/lib/demo-data";

export default function HomePage() {
  const daily = demoDashboard.summary.dailyAllowance;
  return (
    <main className="site-shell">
      <nav className="site-nav">
        <Link className="brand-mark" href="/">
          <span className="brand-sigil">✦</span>
          <span>
            <strong>星芒账本</strong>
            <small>Starry Ledger</small>
          </span>
        </Link>
        <div className="site-nav-links">
          <a href="#product">产品</a>
          <a href="#workflow">工作流</a>
          <a href="#security">安全</a>
          <Link href="/login">登录</Link>
          <Link className="nav-cta" href="/app">
            查看驾驶舱
          </Link>
        </div>
      </nav>

      <section className="launch-hero" id="product">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Sparkles size={16} />
            AI-first cashflow cockpit
          </div>
          <h1>星芒账本</h1>
          <p>
            不只是记录每一笔钱，而是每天告诉你还能花多少、哪里开始失控、下一笔钱应该去哪。
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/login">
              开始记账 <ArrowRight size={18} />
            </Link>
            <Link className="secondary-action" href="/app">
              查看演示
            </Link>
          </div>
          <div className="trust-strip">
            <span>
              <LockKeyhole size={15} />
              HttpOnly 会话
            </span>
            <span>
              <Command size={15} />
              一句话记账
            </span>
            <span>
              <Brain size={15} />
              AI 月度复盘
            </span>
          </div>
        </div>

        <div className="hero-product" aria-label="星芒账本产品预览">
          <div className="product-topline">
            <span>今天还能花</span>
            <strong>{money(daily)}</strong>
            <em>预算安全</em>
          </div>
          <img src="/visuals/ai-cockpit-concept.png" alt="星芒账本 AI 财务驾驶舱界面预览" />
        </div>
      </section>

      <section className="feature-band" id="workflow">
        <article>
          <CircleDollarSign size={22} />
          <strong>{compactMoney(demoDashboard.summary.balance)}</strong>
          <span>本月结余会直接转化为今日行动，而不是只躺在报表里。</span>
        </article>
        <article>
          <ChartNoAxesCombined size={22} />
          <strong>89.3%</strong>
          <span>预算风险按分类、趋势和订阅扣费一起判断。</span>
        </article>
        <article>
          <Brain size={22} />
          <strong>AI Coach</strong>
          <span>用上下文回答“我还能不能买”，并给出下一步动作。</span>
        </article>
      </section>
    </main>
  );
}
