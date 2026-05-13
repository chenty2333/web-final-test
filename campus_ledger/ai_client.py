"""AI money-coach client.

The real API branch uses Alibaba Cloud DashScope's OpenAI-compatible endpoint
when DASHSCOPE_API_KEY is configured. A local fallback keeps demos runnable
without exposing any secret key in source code.
"""

import json
import os
import urllib.error
import urllib.request


class CampusAiClient:
    """Encapsulate all AI-model calls behind one safe utility class."""

    def __init__(self):
        self.api_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
        self.model = os.environ.get("DASHSCOPE_MODEL", "qwen3.6-plus")
        self.endpoint = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

    def chat(self, question, context):
        if self.api_key:
            try:
                return self._call_dashscope(question, context)
            except Exception as exc:  # Keep the course demo stable when network/API fails.
                return self._fallback(question, context, f"AI 接口暂不可用：{exc}")
        return self._fallback(question, context, "当前未配置 DASHSCOPE_API_KEY，已使用本地演示建议。")

    def _call_dashscope(self, question, context):
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是大学生生活记账本里的理性但有创意的消费教练。"
                        "回答要具体、简短、可执行，只围绕校园预算、记账复盘和储蓄建议。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"账本上下文：{context}\n用户问题：{question}",
                },
            ],
            "temperature": 0.6,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.endpoint,
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=18) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result["choices"][0]["message"]["content"].strip()

    def _fallback(self, question, context, prefix):
        expense = float(context.get("expense", 0))
        income = float(context.get("income", 0))
        balance = income - expense
        top_category = context.get("top_category") or "暂无明显高频分类"
        advice = [
            prefix,
            f"本月收入 {income:.2f} 元，支出 {expense:.2f} 元，结余 {balance:.2f} 元。",
            f"优先复盘“{top_category}”，给它单独设置一条周预算线。",
            "建议今天只补记 3 条最有代表性的消费，并写一句消费心情，月底更容易看出模式。",
        ]
        if "省" in question or "预算" in question:
            advice.append("可执行动作：未来 7 天把奶茶/咖啡换成隔天一次，预计能省 40-70 元。")
        return "\n".join(advice)
