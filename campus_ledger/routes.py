"""REST routes for the Starry Campus Ledger Flask backend."""

from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from .ai_client import CampusAiClient
from .errors import ApiError
from .extensions import db
from .models import Category, LedgerEntry, SavingGoal, User
from .responses import api_response
from .seed import TIPS
from .services.entries import build_summary, create_entry, delete_entry, get_entry, list_entries, update_entry
from .validators import parse_month

api_bp = Blueprint("api", __name__)


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
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        raise ApiError("用户不存在，请重新登录", 401, 401)
    return user


@api_bp.get("/health")
def health():
    return api_response(data={"app": current_app.config["APP_NAME"], "status": "ok"})


@api_bp.get("/public/overview")
def public_overview():
    categories = Category.query.order_by(Category.sort_order).all()
    return api_response(
        data={
            "app_name": "星芒账本",
            "topic": "创意型大学生生活记账本",
            "stats": {
                "seed_users": User.query.count(),
                "seed_categories": len(categories),
                "seed_entries": LedgerEntry.query.count(),
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
        raise ApiError("用户名至少 3 个字符")
    if "@" not in email:
        raise ApiError("邮箱格式不正确")
    if len(password) < 6:
        raise ApiError("密码至少 6 位")
    if User.query.filter_by(username=username).first():
        raise ApiError("用户名已存在", 409, 409)
    if User.query.filter_by(email=email).first():
        raise ApiError("邮箱已存在", 409, 409)
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
        raise ApiError("用户名或密码错误", 401, 401)
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
    month_label, start, end = parse_month(request.args.get("month"), default_current=True)
    goals = SavingGoal.query.filter_by(user_id=user.id).order_by(SavingGoal.id).all()
    return api_response(data={"summary": build_summary(user.id, month_label, start, end), "goals": [goal.to_dict() for goal in goals]})


@api_bp.get("/entries")
@jwt_required()
def entries_list():
    user = current_user()
    month_label, start, end = parse_month(request.args.get("month"), default_current=False)
    data = list_entries(
        user.id,
        {
            "category_id": request.args.get("category_id"),
            "kind": request.args.get("kind"),
            "month_label": month_label,
            "month_start": start,
            "month_end": end,
            "page": request.args.get("page"),
            "page_size": request.args.get("page_size"),
        },
    )
    return api_response(data=data)


@api_bp.get("/entries/<int:entry_id>")
@jwt_required()
def entry_detail(entry_id):
    return api_response(data={"entry": get_entry(current_user().id, entry_id).to_dict()})


@api_bp.post("/entries")
@jwt_required()
def entry_create():
    row = create_entry(current_user().id, request.get_json(silent=True) or {})
    return api_response(201, "success", {"entry": row.to_dict()}, 201)


@api_bp.put("/entries/<int:entry_id>")
@jwt_required()
def entry_update(entry_id):
    row = update_entry(current_user().id, entry_id, request.get_json(silent=True) or {})
    return api_response(data={"entry": row.to_dict()})


@api_bp.delete("/entries/<int:entry_id>")
@jwt_required()
def entry_delete(entry_id):
    return api_response(data={"deleted_id": delete_entry(current_user().id, entry_id)})


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
        raise ApiError("问题不能为空")
    user = current_user()
    month_label, start, end = parse_month(request.args.get("month"), default_current=True)
    context = build_summary(user.id, month_label, start, end)
    answer = CampusAiClient().chat(question, context)
    return api_response(data={"answer": answer, "context": context})
