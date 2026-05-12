import os
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from flask import Flask, jsonify, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_sqlalchemy import SQLAlchemy


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
BEIJING_TZ = timezone(timedelta(hours=8))
MONEY_QUANT = Decimal("0.01")


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'ledger.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get(
    "JWT_SECRET_KEY", "test2-2-development-secret-key"
)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

CORS(app, resources={r"/api/*": {"origins": "*"}})
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)

    records = db.relationship(
        "ConsumptionRecord",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class ConsumptionRecord(db.Model):
    __tablename__ = "consumption_records"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    item_name = db.Column(db.String(120), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


def api_response(code=200, message="success", data=None, http_status=200):
    return jsonify({"code": code, "message": message, "data": data or {}}), http_status


def beijing_time_text(dt):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")


def beijing_today_bounds_utc():
    today = datetime.now(BEIJING_TZ).date()
    start_bj = datetime.combine(today, time.min, tzinfo=BEIJING_TZ)
    end_bj = start_bj + timedelta(days=1)
    return (
        start_bj.astimezone(timezone.utc).replace(tzinfo=None),
        end_bj.astimezone(timezone.utc).replace(tzinfo=None),
    )


def money_text(value):
    return f"{Decimal(value).quantize(MONEY_QUANT):.2f}"


def record_to_dict(record):
    amount = Decimal(record.amount).quantize(MONEY_QUANT)
    return {
        "id": record.id,
        "item_name": record.item_name,
        "amount": float(amount),
        "amount_display": f"{amount:.2f}",
        "created_at": beijing_time_text(record.created_at),
        "updated_at": beijing_time_text(record.updated_at),
    }


def parse_amount(value):
    if value is None or str(value).strip() == "":
        return None, "金额不能为空"

    try:
        amount = Decimal(str(value).strip()).quantize(
            MONEY_QUANT, rounding=ROUND_HALF_UP
        )
    except (InvalidOperation, ValueError):
        return None, "金额必须是有效数字"

    if not amount.is_finite():
        return None, "金额必须是有效数字"
    if amount <= 0:
        return None, "金额必须大于 0"
    if amount > Decimal("99999999.99"):
        return None, "金额不能超过 99999999.99"
    return amount, None


def normalize_record_payload(data, require_all=True):
    if not isinstance(data, dict):
        return None, "请求体必须是 JSON 对象"

    payload = {}
    item_value = data.get("item_name", data.get("item"))
    amount_value = data.get("amount")

    if item_value is None:
        if require_all:
            return None, "消费项不能为空"
    else:
        item_name = str(item_value).strip()
        if not item_name:
            return None, "消费项不能为空"
        if len(item_name) > 120:
            return None, "消费项长度不能超过 120 个字符"
        payload["item_name"] = item_name

    if amount_value is None:
        if require_all:
            return None, "金额不能为空"
    else:
        amount, error = parse_amount(amount_value)
        if error:
            return None, error
        payload["amount"] = amount

    if not payload:
        return None, "没有可更新的数据"
    return payload, None


def current_user_id():
    return int(get_jwt_identity())


def get_owned_record(record_id, user_id):
    return ConsumptionRecord.query.filter_by(id=record_id, user_id=user_id).first()


def ensure_test_user():
    user = User.query.filter_by(username="test").first()
    if user is None:
        user = User(username="test")
        user.set_password("123456")
        db.session.add(user)
    elif not user.check_password("123456"):
        user.set_password("123456")
    db.session.commit()
    return user


@jwt.unauthorized_loader
def jwt_missing_callback(reason):
    return api_response(401, f"缺少 Token：{reason}", {}, 401)


@jwt.invalid_token_loader
def jwt_invalid_callback(reason):
    return api_response(401, f"无效 Token：{reason}", {}, 401)


@jwt.expired_token_loader
def jwt_expired_callback(jwt_header, jwt_payload):
    return api_response(401, "Token 已过期，请重新登录", {}, 401)


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/index.html")
def index_html():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/init-test-user", methods=["POST"])
def init_test_user():
    user = ensure_test_user()
    return api_response(
        data={"id": user.id, "username": user.username, "password": "123456"}
    )


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not username or not password:
        return api_response(400, "用户名和密码不能为空", {}, 400)

    user = User.query.filter_by(username=username).first()
    if user is None or not user.check_password(password):
        return api_response(401, "用户名或密码错误", {}, 401)

    access_token = create_access_token(
        identity=str(user.id), additional_claims={"username": user.username}
    )
    return api_response(
        data={
            "access_token": access_token,
            "token_type": "Bearer",
            "user": {"id": user.id, "username": user.username},
        }
    )


@app.route("/api/records", methods=["GET"])
@jwt_required()
def list_today_records():
    user_id = current_user_id()
    start_utc, end_utc = beijing_today_bounds_utc()
    records = (
        ConsumptionRecord.query.filter(
            ConsumptionRecord.user_id == user_id,
            ConsumptionRecord.created_at >= start_utc,
            ConsumptionRecord.created_at < end_utc,
        )
        .order_by(ConsumptionRecord.created_at.desc(), ConsumptionRecord.id.desc())
        .all()
    )
    total = sum((Decimal(record.amount) for record in records), Decimal("0"))
    today_text = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    return api_response(
        data={
            "date": today_text,
            "timezone": "UTC+8",
            "records": [record_to_dict(record) for record in records],
            "total_amount": float(total.quantize(MONEY_QUANT)),
            "total_amount_display": money_text(total),
        }
    )


@app.route("/api/records/<int:record_id>", methods=["GET"])
@jwt_required()
def get_record(record_id):
    record = get_owned_record(record_id, current_user_id())
    if record is None:
        return api_response(404, "记录不存在", {}, 404)
    return api_response(data=record_to_dict(record))


@app.route("/api/records", methods=["POST"])
@jwt_required()
def create_record():
    payload, error = normalize_record_payload(request.get_json(silent=True) or {})
    if error:
        return api_response(400, error, {}, 400)

    record = ConsumptionRecord(
        user_id=current_user_id(),
        item_name=payload["item_name"],
        amount=payload["amount"],
    )
    db.session.add(record)
    db.session.commit()
    return api_response(data=record_to_dict(record), http_status=201)


@app.route("/api/records/<int:record_id>", methods=["PUT"])
@jwt_required()
def update_record(record_id):
    record = get_owned_record(record_id, current_user_id())
    if record is None:
        return api_response(404, "记录不存在", {}, 404)

    payload, error = normalize_record_payload(
        request.get_json(silent=True) or {}, require_all=False
    )
    if error:
        return api_response(400, error, {}, 400)

    if "item_name" in payload:
        record.item_name = payload["item_name"]
    if "amount" in payload:
        record.amount = payload["amount"]

    db.session.commit()
    return api_response(data=record_to_dict(record))


@app.route("/api/records/<int:record_id>", methods=["DELETE"])
@jwt_required()
def delete_record(record_id):
    record = get_owned_record(record_id, current_user_id())
    if record is None:
        return api_response(404, "记录不存在", {}, 404)

    deleted_id = record.id
    db.session.delete(record)
    db.session.commit()
    return api_response(data={"deleted_id": deleted_id})


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return api_response(404, "接口不存在", {}, 404)
    return send_from_directory(BASE_DIR, "index.html")


def init_db():
    db.create_all()
    ensure_test_user()


with app.app_context():
    init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="127.0.0.1", port=port, debug=debug)
