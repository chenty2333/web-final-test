# 星芒账本

创意型大学生生活记账本。项目采用 Flask + SQLite + HTML/CSS/原生 JavaScript 技术栈，实现账号体系、账目管理、月度统计、心愿基金、交流社区和智能账本建议。

## 功能

- 未登录状态可浏览公开分类、记账方法和社区内容
- 注册、登录、个人资料维护、JWT 鉴权和用户数据隔离
- 账目新增、查询、修改、删除，支持月份、分类、类型筛选和分页
- 个人分类、常用场景、常用心情管理
- 按月仪表盘、六个月收支趋势、预算使用率、分类排行
- 心愿基金创建、进度展示和存入流水
- 交流社区帖子、评论和点赞；未登录只能浏览
- 智能账本教练，结合月度数据给出消费复盘和储蓄建议，支持富文本展示

## 本地运行

```powershell
uv venv
uv pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe app.py
```

访问 `http://127.0.0.1:5000`。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## 生产启动

Windows 环境可用 Waitress：

```powershell
$env:APP_ENV="production"
$env:JWT_SECRET_KEY="换成长随机密钥"
$env:SECRET_KEY="换成另一个长随机密钥"
.\scripts\run_waitress.ps1
```

生产配置优先读取环境变量，参考 `.env.example`。

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
  seed.py            初始数据种子
static/js/
  core/              API、状态、格式化、DOM 工具
  features/          各页面功能模块
tests/               接口测试
```

## 交付材料

- `星芒账本_课程设计书.docx`
- `星芒账本_开发总结.docx`
- `database/schema.sql`
- `screenshots/` 页面截图
