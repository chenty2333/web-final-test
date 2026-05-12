"""REST routes for the Starry Campus Ledger Flask backend."""

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask import Blueprint, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from . import db
from .ai_client import CampusAiClient
from .models import Category, LedgerEntry, SavingGoal, User
from .seed import TIPS

api_bp = Blueprint("api", __name__)
MONEY_QUANT = Decimal("0.01")


def api_response(code=200, msg="success", data=None, http_status=200):
    """Return the course-required three-part JSON response."""
    return {"code": code, "msg": msg, "data": data or {}}, http_status


def register_jwt_handlers(jwt):
    @jwt.unauthorized_loader
    def missing_token(reason):
        return api_response(401, f"缺少 Token：{reason}", {}, 401)

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return api_response(401, f"无效 Token：{reason}", {}, 401)

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return api_response(401, "Token 已过期，请重新登录", {}, 401)


def current_user():
    return User.query.get(int(get_jwt_identity()))


def parse_money(value, field_name="金额"):
    if value is None or str(value).strip() == "":
        return None, f"{field_name}不能为空"
    try:
        amount = Decimal(str(value).strip()).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None, f"{field_name}必须是有效数字"
    if amount < 0:
        return None, f"{field_name}不能小于 0"
    if amount > Decimal("99999999.99"):
        return None, f"{field_name}不能超过 99999999.99"
    return amount, None


def parse_date(value):
    if not value:
        return datetime.now().replace(hour=12, minute=0, second=0, microsecond=0), None
    try:
        return datetime.strptime(value, "%Y-%m-%d"), None
    except ValueError:
        return None, "日期格式必须为 YYYY-MM-DD"


def build_summary(user_id):
    entries = LedgerEntry.query.filter_by(user_id=user_id).all()
    expense = sum((e.amount for e in entries if e.kind == "expense"), Decimal("0"))
    income = sum((e.amount for e in entries if e.kind == "income"), Decimal("0"))
    by_category = {}
    for entry in entries:
        if entry.kind != "expense":
            continue
        name = entry.category.name if entry.category else "未分类"
        by_category[name] = by_category.get(name, Decimal("0")) + entry.amount
    top_category = max(by_category, key=by_category.get) if by_category else ""
    return {
        "income": float(income),
        "expense": float(expense),
        "balance": float(income - expense),
        "entry_count": len(entries),
        "top_category": top_category,
        "category_totals": [
            {"name": name, "amount": float(amount)}
            for name, amount in sorted(by_category.items(), key=lambda item: item[1], reverse=True)
        ],
    }


@api_bp.get("/public/overview")
def public_overview():
    categories = Category.query.order_by(Category.sort_order).all()
    entries_count = LedgerEntry.query.count()
    return api_response(
        data={
            "app_name": "星芒账本",
            "topic": "创意型大学生生活记账本",
            "stats": {
                "seed_users": User.query.count(),
                "seed_categories": len(categories),
                "seed_entries": entries_count,
            },
            "tips": TIPS,
            "sample_categories": [item.to_dict() for item in categories[:6]],
        }
    )


@api_bp.get("/public/categories")
def public_categories():
    rows = Category.query.filter_by(is_public=True).order_by(Category.sort_order).all()
    return api_response(data={"categories": [row.to_dict() for row in rows]})


@api_bp.post("/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    nickname = str(data.get("nickname", "")).strip() or username
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    if len(username) < 3:
        return api_response(400, "用户名至少 3 个字符", {}, 400)
    if "@" not in email:
        return api_response(400, "邮箱格式不正确", {}, 400)
    if len(password) < 6:
        return api_response(400, "密码至少 6 位", {}, 400)
    if User.query.filter_by(username=username).first():
        return api_response(409, "用户名已存在", {}, 409)
    if User.query.filter_by(email=email).first():
        return api_response(409, "邮箱已存在", {}, 409)
    user = User(username=username, nickname=nickname, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return api_response(201, "success", {"user": user.to_dict()}, 201)


@api_bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    user = User.query.filter_by(username=username).first()
    if user is None or not user.check_password(password):
        return api_response(401, "用户名或密码错误", {}, 401)
    token = create_access_token(identity=str(user.id), additional_claims={"username": user.username})
    return api_response(data={"access_token": token, "token_type": "Bearer", "user": user.to_dict()})


@api_bp.get("/auth/me")
@jwt_required()
def me():
    return api_response(data={"user": current_user().to_dict()})


@api_bp.get("/summary")
@jwt_required()
def summary():
    user = current_user()
    goals = SavingGoal.query.filter_by(user_id=user.id).order_by(SavingGoal.id).all()
    return api_response(data={"summary": build_summary(user.id), "goals": [goal.to_dict() for goal in goals]})


@api_bp.get("/entries")
@jwt_required()
def list_entries():
    user = current_user()
    query = LedgerEntry.query.filter_by(user_id=user.id)
    category_id = request.args.get("category_id")
    kind = request.args.get("kind")
    if category_id:
        query = query.filter_by(category_id=int(category_id))
    if kind in {"expense", "income"}:
        query = query.filter_by(kind=kind)
    rows = query.order_by(LedgerEntry.spent_at.desc(), LedgerEntry.id.desc()).all()
    return api_response(data={"entries": [row.to_dict() for row in rows]})


@api_bp.get("/entries/<int:entry_id>")
@jwt_required()
def get_entry(entry_id):
    row = LedgerEntry.query.filter_by(id=entry_id, user_id=current_user().id).first()
    if row is None:
        return api_response(404, "账目不存在", {}, 404)
    return api_response(data={"entry": row.to_dict()})


def normalize_entry_payload(data, partial=False):
    payload = {}
    if not isinstance(data, dict):
        return None, "请求体必须是 JSON 对象"
    required = [] if partial else ["title", "amount", "category_id", "kind", "spent_at"]
    for field in required:
        if data.get(field) in (None, ""):
            return None, f"{field} 不能为空"
    if "title" in data:
        title = str(data.get("title", "")).strip()
        if not title or len(title) > 120:
            return None, "账目标题不能为空且不能超过 120 个字符"
        payload["title"] = title
    if "amount" in data:
        amount, error = parse_money(data.get("amount"))
        if error or amount <= 0:
            return None, error or "金额必须大于 0"
        payload["amount"] = amount
    if "category_id" in data:
        category = Category.query.get(int(data.get("category_id") or 0))
        if category is None:
            return None, "分类不存在"
        payload["category_id"] = category.id
    if "kind" in data:
        kind = str(data.get("kind", "")).strip()
        if kind not in {"expense", "income"}:
            return None, "类型只能是 expense 或 income"
        payload["kind"] = kind
    if "spent_at" in data:
        spent_at, error = parse_date(data.get("spent_at"))
        if error:
            return None, error
        payload["spent_at"] = spent_at
    for field, limit in [("scene", 40), ("mood", 20), ("note", 240)]:
        if field in data:
            payload[field] = str(data.get(field, "")).strip()[:limit]
    if partial and not payload:
        return None, "没有可更新的数据"
    return payload, None


@api_bp.post("/entries")
@jwt_required()
def create_entry():
    payload, error = normalize_entry_payload(request.get_json(silent=True) or {})
    if error:
        return api_response(400, error, {}, 400)
    row = LedgerEntry(user_id=current_user().id, **payload)
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"entry": row.to_dict()}, 201)


@api_bp.put("/entries/<int:entry_id>")
@jwt_required()
def update_entry(entry_id):
    row = LedgerEntry.query.filter_by(id=entry_id, user_id=current_user().id).first()
    if row is None:
        return api_response(404, "账目不存在", {}, 404)
    payload, error = normalize_entry_payload(request.get_json(silent=True) or {}, partial=True)
    if error:
        return api_response(400, error, {}, 400)
    for key, value in payload.items():
        setattr(row, key, value)
    db.session.commit()
    return api_response(data={"entry": row.to_dict()})


@api_bp.delete("/entries/<int:entry_id>")
@jwt_required()
def delete_entry(entry_id):
    row = LedgerEntry.query.filter_by(id=entry_id, user_id=current_user().id).first()
    if row is None:
        return api_response(404, "账目不存在", {}, 404)
    deleted_id = row.id
    db.session.delete(row)
    db.session.commit()
    return api_response(data={"deleted_id": deleted_id})


@api_bp.get("/goals")
@jwt_required()
def list_goals():
    rows = SavingGoal.query.filter_by(user_id=current_user().id).order_by(SavingGoal.id).all()
    return api_response(data={"goals": [row.to_dict() for row in rows]})


@api_bp.post("/ai/coach")
@jwt_required()
def ai_coach():
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()
    if not question:
        return api_response(400, "问题不能为空", {}, 400)
    user = current_user()
    context = build_summary(user.id)
    answer = CampusAiClient().chat(question, context)
    return api_response(data={"answer": answer, "context": context})
