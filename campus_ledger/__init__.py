"""Application factory for Starry Campus Ledger."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS
from sqlalchemy import text

from .config import resolve_config
from .errors import register_error_handlers
from .extensions import bcrypt, db, jwt


def create_app(config_overrides=None):
    project_root = Path(__file__).resolve().parents[1]
    instance_dir = project_root / "instance"
    instance_dir.mkdir(exist_ok=True)

    app = Flask(
        __name__,
        instance_path=str(instance_dir),
        static_folder=str(project_root / "static"),
        static_url_path="/static",
    )
    config_class = resolve_config()
    app.config.from_object(config_class)
    config_class.init_app(app)
    app.config["PROJECT_ROOT"] = str(project_root)
    if config_overrides:
        app.config.update(config_overrides)

    configure_logging(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    from .routes import api_bp, register_jwt_handlers
    from .seed import seed_demo_data

    app.register_blueprint(api_bp, url_prefix="/api")
    register_jwt_handlers(jwt)
    register_error_handlers(app)
    register_shell(app)
    register_cli(app)

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        return response

    @app.route("/")
    @app.route("/index.html")
    def index():
        return send_from_directory(project_root, "index.html")

    with app.app_context():
        db.create_all()
        ensure_schema_compatibility()
        if app.config.get("SEED_DATABASE", True):
            seed_demo_data()

    return app


def ensure_schema_compatibility():
    if db.engine.dialect.name != "sqlite":
        return
    with db.engine.begin() as connection:
        category_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(categories)")).fetchall()}
        if "user_id" not in category_columns:
            connection.execute(text("ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id)"))


def configure_logging(app):
    level = getattr(logging, str(app.config.get("API_LOG_LEVEL", "INFO")).upper(), logging.INFO)
    app.logger.setLevel(level)
    if app.testing:
        return
    log_path = Path(app.instance_path) / "campus_ledger.log"
    handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))
    app.logger.addHandler(handler)


def register_shell(app):
    @app.shell_context_processor
    def shell_context():
        from .models import Category, LedgerEntry, SavingGoal, User

        return {
            "db": db,
            "User": User,
            "Category": Category,
            "LedgerEntry": LedgerEntry,
            "SavingGoal": SavingGoal,
        }


def register_cli(app):
    @app.cli.command("init-db")
    def init_db_command():
        from .seed import seed_demo_data

        db.create_all()
        seed_demo_data()
        print("Database initialized and seeded.")
