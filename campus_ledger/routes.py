"""REST routes for the Starry Campus Ledger Flask backend."""

from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from .ai_client import CampusAiClient
from .errors import ApiError
from .extensions import db
from .models import Category, CommunityComment, CommunityPost, EntryOption, LedgerEntry, SavingGoal, SavingGoalDeposit, User
from .responses import api_response
from .seed import TIPS
from .services.entries import build_summary, create_entry, delete_entry, get_entry, list_entries, update_entry
from .validators import parse_date, parse_int, parse_month, parse_money

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
    categories = Category.query.filter_by(is_public=True).order_by(Category.sort_order).all()
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


@api_bp.put("/auth/me")
@jwt_required()
def update_me():
    user = current_user()
    data = request.get_json(silent=True) or {}
    nickname = str(data.get("nickname", user.nickname)).strip()
    email = str(data.get("email", user.email)).strip()
    if not nickname:
        raise ApiError("昵称不能为空")
    if "@" not in email:
        raise ApiError("邮箱格式不正确")
    if User.query.filter(User.id != user.id, User.email == email).first():
        raise ApiError("邮箱已被使用", 409, 409)
    user.nickname = nickname[:80]
    user.email = email[:120]
    current_password = str(data.get("current_password", ""))
    new_password = str(data.get("new_password", ""))
    if new_password:
        if len(new_password) < 6:
            raise ApiError("新密码至少 6 位")
        if not user.check_password(current_password):
            raise ApiError("当前密码不正确", 401, 401)
        user.set_password(new_password)
    db.session.commit()
    return api_response(data={"user": user.to_dict()})


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


def category_query_for(user_id):
    return Category.query.filter((Category.user_id.is_(None)) | (Category.user_id == user_id))


def normalize_category_payload(data, partial=False):
    payload = {}
    required = [] if partial else ["name", "icon", "color"]
    for field in required:
        if data.get(field) in (None, ""):
            raise ApiError(f"{field} 不能为空")
    if "name" in data:
        name = str(data.get("name", "")).strip()
        if not name or len(name) > 40:
            raise ApiError("分类名称不能为空且不能超过 40 个字符")
        payload["name"] = name
    if "icon" in data:
        icon = str(data.get("icon", "")).strip()[:4]
        if not icon:
            raise ApiError("分类图标不能为空")
        payload["icon"] = icon
    if "color" in data:
        color = str(data.get("color", "")).strip()
        if not color.startswith("#") or len(color) not in {4, 7}:
            raise ApiError("颜色必须是十六进制色值")
        payload["color"] = color
    if "monthly_limit" in data:
        payload["monthly_limit"] = parse_money(data.get("monthly_limit"), "月预算")
    return payload


@api_bp.get("/categories")
@jwt_required()
def categories_list():
    rows = category_query_for(current_user().id).order_by(Category.sort_order, Category.id).all()
    return api_response(data={"categories": [row.to_dict() for row in rows]})


@api_bp.post("/categories")
@jwt_required()
def category_create():
    user = current_user()
    payload = normalize_category_payload(request.get_json(silent=True) or {})
    duplicate = Category.query.filter_by(user_id=user.id, name=payload["name"]).first()
    if duplicate:
        raise ApiError("已经有同名分类", 409, 409)
    max_order = db.session.query(db.func.max(Category.sort_order)).scalar() or 0
    row = Category(user_id=user.id, is_public=False, sort_order=max_order + 1, **payload)
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"category": row.to_dict()}, 201)


@api_bp.put("/categories/<int:category_id>")
@jwt_required()
def category_update(category_id):
    user = current_user()
    row = Category.query.filter_by(id=category_id, user_id=user.id).first()
    if row is None:
        raise ApiError("只能修改自己创建的分类", 404, 404)
    for key, value in normalize_category_payload(request.get_json(silent=True) or {}, partial=True).items():
        setattr(row, key, value)
    db.session.commit()
    return api_response(data={"category": row.to_dict()})


@api_bp.delete("/categories/<int:category_id>")
@jwt_required()
def category_delete(category_id):
    user = current_user()
    row = Category.query.filter_by(id=category_id, user_id=user.id).first()
    if row is None:
        raise ApiError("只能删除自己创建的分类", 404, 404)
    if LedgerEntry.query.filter_by(category_id=row.id).first():
        raise ApiError("该分类已有账目，不能删除", 409, 409)
    deleted_id = row.id
    db.session.delete(row)
    db.session.commit()
    return api_response(data={"deleted_id": deleted_id})


def normalize_option_payload(data, partial=False):
    payload = {}
    if not partial or "kind" in data:
        kind = str(data.get("kind", "")).strip()
        if kind not in {"scene", "mood"}:
            raise ApiError("选项类型必须是 scene 或 mood")
        payload["kind"] = kind
    if not partial or "name" in data:
        name = str(data.get("name", "")).strip()
        if not name or len(name) > 40:
            raise ApiError("选项名称不能为空且不能超过 40 个字符")
        payload["name"] = name
    return payload


@api_bp.get("/entry-options")
@jwt_required()
def entry_options_list():
    rows = EntryOption.query.filter_by(user_id=current_user().id).order_by(EntryOption.kind, EntryOption.sort_order, EntryOption.id).all()
    return api_response(data={"options": [row.to_dict() for row in rows]})


@api_bp.post("/entry-options")
@jwt_required()
def entry_option_create():
    user = current_user()
    payload = normalize_option_payload(request.get_json(silent=True) or {})
    duplicate = EntryOption.query.filter_by(user_id=user.id, kind=payload["kind"], name=payload["name"]).first()
    if duplicate:
        raise ApiError("已经有同名选项", 409, 409)
    max_order = (
        db.session.query(db.func.max(EntryOption.sort_order))
        .filter(EntryOption.user_id == user.id, EntryOption.kind == payload["kind"])
        .scalar()
        or 0
    )
    row = EntryOption(user_id=user.id, sort_order=max_order + 1, **payload)
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"option": row.to_dict()}, 201)


@api_bp.delete("/entry-options/<int:option_id>")
@jwt_required()
def entry_option_delete(option_id):
    row = EntryOption.query.filter_by(id=option_id, user_id=current_user().id).first()
    if row is None:
        raise ApiError("选项不存在", 404, 404)
    deleted_id = row.id
    db.session.delete(row)
    db.session.commit()
    return api_response(data={"deleted_id": deleted_id})


@api_bp.get("/goals")
@jwt_required()
def list_goals():
    rows = SavingGoal.query.filter_by(user_id=current_user().id).order_by(SavingGoal.id).all()
    return api_response(data={"goals": [row.to_dict() for row in rows]})


def get_goal(user_id, goal_id):
    goal = SavingGoal.query.filter_by(id=goal_id, user_id=user_id).first()
    if goal is None:
        raise ApiError("心愿基金不存在", 404, 404)
    return goal


def normalize_goal_payload(data, partial=False):
    payload = {}
    required = [] if partial else ["name", "target_amount", "deadline"]
    for field in required:
        if data.get(field) in (None, ""):
            raise ApiError(f"{field} 不能为空")
    if "name" in data:
        name = str(data.get("name", "")).strip()
        if not name or len(name) > 100:
            raise ApiError("目标名称不能为空且不能超过 100 个字符")
        payload["name"] = name
    if "target_amount" in data:
        payload["target_amount"] = parse_money(data.get("target_amount"), "目标金额", positive=True)
    if "saved_amount" in data:
        payload["saved_amount"] = parse_money(data.get("saved_amount"), "已存金额")
    if "deadline" in data:
        payload["deadline"] = parse_date(data.get("deadline")).strftime("%Y-%m-%d")
    if "status" in data:
        payload["status"] = str(data.get("status", "")).strip()[:20] or "进行中"
    return payload


@api_bp.post("/goals")
@jwt_required()
def create_goal():
    payload = normalize_goal_payload(request.get_json(silent=True) or {})
    row = SavingGoal(user_id=current_user().id, **payload)
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"goal": row.to_dict()}, 201)


@api_bp.get("/goals/<int:goal_id>")
@jwt_required()
def goal_detail(goal_id):
    goal = get_goal(current_user().id, goal_id)
    deposits = SavingGoalDeposit.query.filter_by(goal_id=goal.id, user_id=goal.user_id).order_by(SavingGoalDeposit.deposited_at.desc(), SavingGoalDeposit.id.desc()).all()
    return api_response(data={"goal": goal.to_dict(), "deposits": [row.to_dict() for row in deposits]})


@api_bp.put("/goals/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    goal = get_goal(current_user().id, goal_id)
    for key, value in normalize_goal_payload(request.get_json(silent=True) or {}, partial=True).items():
        setattr(goal, key, value)
    db.session.commit()
    return api_response(data={"goal": goal.to_dict()})


@api_bp.delete("/goals/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    goal = get_goal(current_user().id, goal_id)
    deleted_id = goal.id
    db.session.delete(goal)
    db.session.commit()
    return api_response(data={"deleted_id": deleted_id})


@api_bp.post("/goals/<int:goal_id>/deposits")
@jwt_required()
def create_goal_deposit(goal_id):
    user = current_user()
    goal = get_goal(user.id, goal_id)
    data = request.get_json(silent=True) or {}
    amount = parse_money(data.get("amount"), "存入金额", positive=True)
    row = SavingGoalDeposit(
        goal_id=goal.id,
        user_id=user.id,
        amount=amount,
        deposited_at=parse_date(data.get("deposited_at")),
        note=str(data.get("note", "")).strip()[:160],
    )
    goal.saved_amount += amount
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"goal": goal.to_dict(), "deposit": row.to_dict()}, 201)


@api_bp.delete("/goals/<int:goal_id>/deposits/<int:deposit_id>")
@jwt_required()
def delete_goal_deposit(goal_id, deposit_id):
    user = current_user()
    goal = get_goal(user.id, goal_id)
    row = SavingGoalDeposit.query.filter_by(id=deposit_id, goal_id=goal.id, user_id=user.id).first()
    if row is None:
        raise ApiError("存入记录不存在", 404, 404)
    goal.saved_amount = max(goal.saved_amount - row.amount, 0)
    deleted_id = row.id
    db.session.delete(row)
    db.session.commit()
    return api_response(data={"goal": goal.to_dict(), "deleted_id": deleted_id})


@api_bp.get("/community/posts")
def community_posts():
    page = parse_int(request.args.get("page"), "页码", default=1, minimum=1)
    page_size = parse_int(request.args.get("page_size"), "每页数量", default=8, minimum=1, maximum=30)
    query = CommunityPost.query.order_by(CommunityPost.created_at.desc(), CommunityPost.id.desc())
    total = query.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return api_response(
        data={
            "posts": [row.to_dict() for row in rows],
            "pagination": {"page": page, "page_size": page_size, "total": total, "pages": pages, "has_prev": page > 1, "has_next": page < pages},
        }
    )


@api_bp.post("/community/posts")
@jwt_required()
def community_post_create():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    content = str(data.get("content", "")).strip()
    topic = str(data.get("topic", "校园记账")).strip() or "校园记账"
    if not title or len(title) > 120:
        raise ApiError("帖子标题不能为空且不能超过 120 个字符")
    if len(content) < 5 or len(content) > 1200:
        raise ApiError("帖子内容需要 5-1200 个字符")
    row = CommunityPost(user_id=current_user().id, title=title, content=content, topic=topic[:40])
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"post": row.to_dict(include_comments=True)}, 201)


@api_bp.get("/community/posts/<int:post_id>")
def community_post_detail(post_id):
    row = db.session.get(CommunityPost, post_id)
    if row is None:
        raise ApiError("帖子不存在", 404, 404)
    return api_response(data={"post": row.to_dict(include_comments=True)})


@api_bp.post("/community/posts/<int:post_id>/comments")
@jwt_required()
def community_comment_create(post_id):
    post = db.session.get(CommunityPost, post_id)
    if post is None:
        raise ApiError("帖子不存在", 404, 404)
    content = str((request.get_json(silent=True) or {}).get("content", "")).strip()
    if len(content) < 2 or len(content) > 500:
        raise ApiError("评论需要 2-500 个字符")
    row = CommunityComment(post_id=post.id, user_id=current_user().id, content=content)
    db.session.add(row)
    db.session.commit()
    return api_response(201, "success", {"comment": row.to_dict(), "post": post.to_dict(include_comments=True)}, 201)


@api_bp.post("/community/posts/<int:post_id>/like")
@jwt_required()
def community_post_like(post_id):
    post = db.session.get(CommunityPost, post_id)
    if post is None:
        raise ApiError("帖子不存在", 404, 404)
    post.likes_count += 1
    db.session.commit()
    return api_response(data={"post": post.to_dict()})


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
