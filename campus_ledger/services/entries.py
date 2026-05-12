"""Ledger entry business logic."""

from datetime import timedelta
from decimal import Decimal

from ..errors import ApiError
from ..extensions import db
from ..models import Category, LedgerEntry
from ..validators import month_add, parse_date, parse_int, parse_money


def apply_month_filter(query, start, end):
    if start and end:
        return query.filter(LedgerEntry.spent_at >= start, LedgerEntry.spent_at < end)
    return query


def build_summary(user_id, month_label, start, end):
    entries = apply_month_filter(LedgerEntry.query.filter_by(user_id=user_id), start, end).all()
    expense = sum((e.amount for e in entries if e.kind == "expense"), Decimal("0"))
    income = sum((e.amount for e in entries if e.kind == "income"), Decimal("0"))

    by_category = {}
    for entry in entries:
        if entry.kind != "expense":
            continue
        name = entry.category.name if entry.category else "未分类"
        by_category[name] = by_category.get(name, Decimal("0")) + entry.amount

    budget_usage = []
    for category in Category.query.order_by(Category.sort_order).all():
        limit = category.monthly_limit or Decimal("0")
        if limit <= 0:
            continue
        amount = by_category.get(category.name, Decimal("0"))
        budget_usage.append(
            {
                "name": category.name,
                "amount": float(amount),
                "limit": float(limit),
                "rate": 0 if limit == 0 else min(100, round(float(amount / limit * 100), 1)),
            }
        )

    trend_start = month_add(start, -5)
    trend_end = month_add(start, 1)
    trend_entries = (
        LedgerEntry.query.filter_by(user_id=user_id)
        .filter(LedgerEntry.spent_at >= trend_start, LedgerEntry.spent_at < trend_end)
        .all()
    )
    trend = {}
    for offset in range(6):
        label = month_add(start, offset - 5).strftime("%Y-%m")
        trend[label] = {"month": label, "income": 0.0, "expense": 0.0}
    for entry in trend_entries:
        label = entry.spent_at.strftime("%Y-%m")
        if label in trend:
            trend[label][entry.kind] += float(entry.amount)

    top_category = max(by_category, key=by_category.get) if by_category else ""
    return {
        "month": month_label,
        "date_range": {
            "start": start.strftime("%Y-%m-%d"),
            "end": (end - timedelta(days=1)).strftime("%Y-%m-%d"),
        },
        "income": float(income),
        "expense": float(expense),
        "balance": float(income - expense),
        "entry_count": len(entries),
        "top_category": top_category,
        "category_totals": [
            {"name": name, "amount": float(amount)}
            for name, amount in sorted(by_category.items(), key=lambda item: item[1], reverse=True)
        ],
        "budget_usage": budget_usage,
        "monthly_trend": [trend[key] for key in sorted(trend)],
    }


def list_entries(user_id, filters):
    query = LedgerEntry.query.filter_by(user_id=user_id)
    category_id = filters.get("category_id")
    if category_id:
        category_id = parse_int(category_id, "分类")
        query = query.filter_by(category_id=category_id)

    kind = filters.get("kind") or ""
    if kind:
        if kind not in {"expense", "income"}:
            raise ApiError("类型只能是 expense 或 income")
        query = query.filter_by(kind=kind)

    query = apply_month_filter(query, filters.get("month_start"), filters.get("month_end"))
    page = parse_int(filters.get("page"), "页码", default=1, minimum=1)
    page_size = parse_int(filters.get("page_size"), "每页数量", default=6, minimum=1, maximum=50)
    total = query.count()
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)
    rows = (
        query.order_by(LedgerEntry.spent_at.desc(), LedgerEntry.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "entries": [row.to_dict() for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": pages,
            "has_prev": page > 1,
            "has_next": page < pages,
        },
        "filters": {
            "kind": kind,
            "category_id": category_id or "",
            "month": filters.get("month_label") or "",
        },
    }


def get_entry(user_id, entry_id):
    row = LedgerEntry.query.filter_by(id=entry_id, user_id=user_id).first()
    if row is None:
        raise ApiError("账目不存在", 404, 404)
    return row


def normalize_entry_payload(data, partial=False):
    if not isinstance(data, dict):
        raise ApiError("请求体必须是 JSON 对象")
    payload = {}
    required = [] if partial else ["title", "amount", "category_id", "kind", "spent_at"]
    for field in required:
        if data.get(field) in (None, ""):
            raise ApiError(f"{field} 不能为空")

    if "title" in data:
        title = str(data.get("title", "")).strip()
        if not title or len(title) > 120:
            raise ApiError("账目标题不能为空且不能超过 120 个字符")
        payload["title"] = title
    if "amount" in data:
        payload["amount"] = parse_money(data.get("amount"), positive=True)
    if "category_id" in data:
        category_id = parse_int(data.get("category_id"), "分类")
        category = db.session.get(Category, category_id)
        if category is None:
            raise ApiError("分类不存在")
        payload["category_id"] = category.id
    if "kind" in data:
        kind = str(data.get("kind", "")).strip()
        if kind not in {"expense", "income"}:
            raise ApiError("类型只能是 expense 或 income")
        payload["kind"] = kind
    if "spent_at" in data:
        payload["spent_at"] = parse_date(data.get("spent_at"))
    for field, limit in [("scene", 40), ("mood", 20), ("note", 240)]:
        if field in data:
            payload[field] = str(data.get(field, "")).strip()[:limit]
    if partial and not payload:
        raise ApiError("没有可更新的数据")
    return payload


def create_entry(user_id, data):
    row = LedgerEntry(user_id=user_id, **normalize_entry_payload(data))
    db.session.add(row)
    db.session.commit()
    return row


def update_entry(user_id, entry_id, data):
    row = get_entry(user_id, entry_id)
    for key, value in normalize_entry_payload(data, partial=True).items():
        setattr(row, key, value)
    db.session.commit()
    return row


def delete_entry(user_id, entry_id):
    row = get_entry(user_id, entry_id)
    deleted_id = row.id
    db.session.delete(row)
    db.session.commit()
    return deleted_id
