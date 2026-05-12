# 星芒账本

创意型大学生生活记账本课程设计项目。前端使用 HTML5、CSS3、原生 JavaScript 和 Fetch，后端使用 Flask、Flask-CORS、Flask-SQLAlchemy、Flask-JWT-Extended、Flask-Bcrypt 和 SQLite。

## 运行

```powershell
uv venv
uv pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

访问 `http://127.0.0.1:5000`。

测试账号：`test / 123456`。

## AI 配置

项目默认可在没有密钥时使用本地演示建议。需要真实调用国内 AI 接口时，设置：

```powershell
$env:DASHSCOPE_API_KEY="你的密钥"
$env:DASHSCOPE_MODEL="qwen-plus"
```

## 交付材料

- `星芒账本_课程设计书.docx`
- `星芒账本_开发总结.docx`
- `database/schema.sql`
- `screenshots/` 页面截图
