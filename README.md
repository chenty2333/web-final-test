# 星芒账本

创意型大学生生活记账本。项目保留课程要求的 Flask + SQLite + HTML/CSS/原生 JavaScript 技术栈，但已按可交付工程重构：应用工厂、环境配置、服务层、统一 API 响应、错误日志、自动化测试、模块化前端和生产入口。

## 功能

- 游客浏览公开分类、样例统计和记账建议
- 注册、登录、JWT 鉴权和用户数据隔离
- 账目 CRUD，支持月份、分类、类型筛选和分页
- 按月仪表盘、六个月收支趋势、预算使用率、分类排行
- 心愿基金进度展示
- DashScope 国内 AI 账本教练，密钥走环境变量，未配置时本地兜底

## 本地运行

```powershell
uv venv
uv pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe app.py
```

访问 `http://127.0.0.1:5000`。

测试账号：`test / 123456`。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## 生产启动

Windows 或通用演示环境可用 Waitress：

```powershell
$env:APP_ENV="production"
$env:JWT_SECRET_KEY="换成长随机密钥"
$env:SECRET_KEY="换成另一个长随机密钥"
.\scripts\run_waitress.ps1
```

生产配置优先读取环境变量，参考 `.env.example`。真实 AI 调用需要设置 `DASHSCOPE_API_KEY`，模型默认 `qwen-plus`。

## 结构

```text
campus_ledger/
  config.py          环境配置
  extensions.py      Flask 扩展实例
  errors.py          统一错误处理
  validators.py      参数校验
  services/          业务服务层
  routes.py          REST API 路由
  models.py          SQLAlchemy 模型
  seed.py            演示数据种子
static/js/
  core/              API、状态、格式化、DOM 工具
  features/          各页面功能模块
tests/               Pytest 接口测试
```

## 交付材料

- `星芒账本_课程设计书.docx`
- `星芒账本_开发总结.docx`
- `database/schema.sql`
- `screenshots/` 页面截图
