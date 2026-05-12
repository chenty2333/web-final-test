"""Seed data for local demos and course-design acceptance checks."""

from datetime import datetime, timedelta
from decimal import Decimal

from .extensions import db
from .models import Category, LedgerEntry, SavingGoal, User


USERS = [
    ("test", "测试同学", "test@example.com", "123456"),
    ("linxi", "林溪", "linxi@example.com", "123456"),
    ("moyu", "莫雨", "moyu@example.com", "123456"),
    ("chenfan", "陈帆", "chenfan@example.com", "123456"),
    ("xiaolu", "小鹿", "xiaolu@example.com", "123456"),
    ("heyan", "何晏", "heyan@example.com", "123456"),
    ("suxin", "苏昕", "suxin@example.com", "123456"),
    ("nannan", "南南", "nannan@example.com", "123456"),
    ("yizhou", "一舟", "yizhou@example.com", "123456"),
    ("qinglan", "青岚", "qinglan@example.com", "123456"),
]

CATEGORIES = [
    ("食堂", "餐", "#2563eb", "900.00"),
    ("奶茶咖啡", "饮", "#db2777", "260.00"),
    ("学习资料", "书", "#7c3aed", "320.00"),
    ("宿舍日用", "宿", "#059669", "260.00"),
    ("交通出行", "行", "#ea580c", "220.00"),
    ("社交聚餐", "聚", "#dc2626", "480.00"),
    ("运动健康", "动", "#0891b2", "180.00"),
    ("数码装备", "数", "#4f46e5", "600.00"),
    ("奖学金/兼职", "入", "#16a34a", "0.00"),
    ("其他灵感", "其", "#64748b", "200.00"),
]

TIPS = [
    "把奶茶预算单独列出来，月底复盘会比混在餐饮里更直观。",
    "学习资料可以按课程记录，方便期末看哪门课投入最多。",
    "每周固定一次账本复盘，比每天纠结更适合大学生活节奏。",
    "社交聚餐建议设置月度上限，避免一次活动打乱整月预算。",
]


def seed_demo_data():
    """Create at least ten records in every table when the database is empty."""
    if User.query.count() == 0:
        for username, nickname, email, password in USERS:
            user = User(username=username, nickname=nickname, email=email)
            user.set_password(password)
            db.session.add(user)
        db.session.commit()

    if Category.query.count() == 0:
        for order, (name, icon, color, monthly_limit) in enumerate(CATEGORIES, start=1):
            db.session.add(
                Category(
                    name=name,
                    icon=icon,
                    color=color,
                    monthly_limit=Decimal(monthly_limit),
                    sort_order=order,
                )
            )
        db.session.commit()

    test_user = User.query.filter_by(username="test").first()
    categories = {item.name: item for item in Category.query.all()}
    if test_user and LedgerEntry.query.count() == 0:
        today = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)
        rows = [
            ("早餐豆浆饭团", "食堂", "expense", "食堂窗口", "满足", "8.50", 0, "早八前快速补能"),
            ("高数习题册", "学习资料", "expense", "自习室", "认真", "32.00", 1, "期末复习资料"),
            ("兼职家教收入", "奖学金/兼职", "income", "校外兼职", "开心", "180.00", 1, "周末两小时"),
            ("实验课打印", "学习资料", "expense", "打印店", "平稳", "6.00", 2, "实验报告"),
            ("室友火锅 AA", "社交聚餐", "expense", "校外聚餐", "开心", "58.00", 3, "宿舍团建"),
            ("地铁去图书馆", "交通出行", "expense", "城市出行", "平稳", "4.00", 4, ""),
            ("跑步水和毛巾", "运动健康", "expense", "操场", "轻松", "18.90", 5, "夜跑装备"),
            ("宿舍洗衣液", "宿舍日用", "expense", "宿舍", "务实", "29.90", 6, ""),
            ("美式咖啡", "奶茶咖啡", "expense", "咖啡店", "提神", "16.00", 7, "赶课程设计"),
            ("二手键盘", "数码装备", "expense", "跳蚤群", "惊喜", "99.00", 8, "写代码更舒服"),
            ("社团海报材料", "其他灵感", "expense", "社团活动", "有趣", "24.50", 9, ""),
            ("奖学金到账", "奖学金/兼职", "income", "校园账户", "开心", "800.00", 10, "继续存旅行基金"),
        ]
        for title, cat_name, kind, scene, mood, amount, offset, note in rows:
            db.session.add(
                LedgerEntry(
                    user_id=test_user.id,
                    category_id=categories[cat_name].id,
                    title=title,
                    kind=kind,
                    scene=scene,
                    mood=mood,
                    amount=Decimal(amount),
                    spent_at=today - timedelta(days=offset),
                    note=note,
                )
            )
        db.session.commit()

    if test_user and SavingGoal.query.count() == 0:
        goals = [
            ("毕业旅行基金", "3000.00", "680.00", "2026-07-01"),
            ("新耳机计划", "699.00", "220.00", "2026-06-10"),
            ("考证报名费", "480.00", "180.00", "2026-05-30"),
            ("宿舍投影仪", "1200.00", "350.00", "2026-08-01"),
            ("城市探索周末", "500.00", "120.00", "2026-05-25"),
            ("运动鞋基金", "599.00", "299.00", "2026-06-20"),
            ("课程资料预算", "300.00", "90.00", "2026-06-01"),
            ("生日礼物储备", "450.00", "160.00", "2026-09-01"),
            ("摄影社外拍", "360.00", "80.00", "2026-05-28"),
            ("备用金", "1000.00", "420.00", "2026-12-31"),
        ]
        for name, target, saved, deadline in goals:
            db.session.add(
                SavingGoal(
                    user_id=test_user.id,
                    name=name,
                    target_amount=Decimal(target),
                    saved_amount=Decimal(saved),
                    deadline=deadline,
                )
            )
        db.session.commit()
