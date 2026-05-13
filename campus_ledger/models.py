"""Database models for the Starry Campus Ledger course project."""

from datetime import datetime, timezone

from .extensions import bcrypt, db


def utc_now():
    """Return a naive UTC datetime for SQLite storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    """Registered student user."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    nickname = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    entries = db.relationship("LedgerEntry", backref="user", cascade="all, delete-orphan")
    goals = db.relationship("SavingGoal", backref="user", cascade="all, delete-orphan")
    categories = db.relationship("Category", backref="owner", cascade="all, delete-orphan")
    entry_options = db.relationship("EntryOption", backref="user", cascade="all, delete-orphan")
    posts = db.relationship("CommunityPost", backref="author", cascade="all, delete-orphan")
    comments = db.relationship("CommunityComment", backref="author", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "nickname": self.nickname,
            "email": self.email,
        }


class Category(db.Model):
    """Ledger category visible to visitors and registered users."""

    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    name = db.Column(db.String(40), nullable=False)
    icon = db.Column(db.String(8), nullable=False)
    color = db.Column(db.String(20), nullable=False)
    monthly_limit = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_public = db.Column(db.Boolean, nullable=False, default=True)

    entries = db.relationship("LedgerEntry", backref="category")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "color": self.color,
            "monthly_limit": float(self.monthly_limit),
            "sort_order": self.sort_order,
            "is_public": self.is_public,
            "user_owned": self.user_id is not None,
        }


class EntryOption(db.Model):
    """User-managed scene and mood options for ledger entries."""

    __tablename__ = "entry_options"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    kind = db.Column(db.String(16), nullable=False, index=True)
    name = db.Column(db.String(40), nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "sort_order": self.sort_order,
        }


class LedgerEntry(db.Model):
    """Income or expense entry managed through the ledger module."""

    __tablename__ = "ledger_entries"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    title = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    kind = db.Column(db.String(12), nullable=False, default="expense")
    scene = db.Column(db.String(40), nullable=False, default="")
    mood = db.Column(db.String(20), nullable=False, default="")
    spent_at = db.Column(db.DateTime, nullable=False, index=True)
    note = db.Column(db.String(240), nullable=False, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    def to_dict(self):
        category = self.category.to_dict() if self.category else {}
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category": category,
            "title": self.title,
            "amount": float(self.amount),
            "amount_display": f"{self.amount:.2f}",
            "kind": self.kind,
            "scene": self.scene,
            "mood": self.mood,
            "spent_at": self.spent_at.strftime("%Y-%m-%d"),
            "note": self.note,
        }


class SavingGoal(db.Model):
    """Small savings target for student life goals."""

    __tablename__ = "saving_goals"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Numeric(10, 2), nullable=False)
    saved_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    deadline = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="进行中")
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    deposits = db.relationship("SavingGoalDeposit", backref="goal", cascade="all, delete-orphan")

    def to_dict(self):
        target = float(self.target_amount)
        saved = float(self.saved_amount)
        progress = 0 if target <= 0 else min(100, round(saved / target * 100, 1))
        return {
            "id": self.id,
            "name": self.name,
            "target_amount": target,
            "saved_amount": saved,
            "deadline": self.deadline,
            "status": self.status,
            "progress": progress,
            "deposit_count": len(self.deposits),
        }


class SavingGoalDeposit(db.Model):
    """A single deposit record for a saving goal."""

    __tablename__ = "saving_goal_deposits"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    goal_id = db.Column(db.Integer, db.ForeignKey("saving_goals.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    deposited_at = db.Column(db.DateTime, nullable=False, index=True)
    note = db.Column(db.String(160), nullable=False, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "goal_id": self.goal_id,
            "amount": float(self.amount),
            "deposited_at": self.deposited_at.strftime("%Y-%m-%d"),
            "note": self.note,
        }


class CommunityPost(db.Model):
    """Public student ledger sharing post."""

    __tablename__ = "community_posts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False)
    content = db.Column(db.String(1200), nullable=False)
    topic = db.Column(db.String(40), nullable=False, default="校园记账")
    likes_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    comments = db.relationship("CommunityComment", backref="post", cascade="all, delete-orphan")

    def to_dict(self, include_comments=False):
        data = {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "topic": self.topic,
            "likes_count": self.likes_count,
            "comment_count": len(self.comments),
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
            "author": {
                "id": self.author.id,
                "nickname": self.author.nickname,
            },
        }
        if include_comments:
            data["comments"] = [comment.to_dict() for comment in sorted(self.comments, key=lambda item: item.created_at)]
        return data


class CommunityComment(db.Model):
    """Comment under a community post."""

    __tablename__ = "community_comments"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    post_id = db.Column(db.Integer, db.ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    content = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M"),
            "author": {
                "id": self.author.id,
                "nickname": self.author.nickname,
            },
        }
