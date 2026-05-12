"""Application factory for Starry Campus Ledger.

Copyright scope: this package is original course-design code for the
"创意型大学生生活记账本" project. It wires Flask, database models, routes,
seed data, and safe AI-client configuration together.
"""

from pathlib import Path

from flask import Flask, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()


def create_app():
    base_dir = Path(__file__).resolve().parents[1]
    instance_dir = base_dir / "instance"
    instance_dir.mkdir(exist_ok=True)

    app = Flask(
        __name__,
        static_folder=str(base_dir / "static"),
        static_url_path="/static",
    )
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{instance_dir / 'campus_ledger.db'}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY="starry-campus-ledger-course-design-dev-secret",
    )

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    from .routes import api_bp, register_jwt_handlers
    from .seed import seed_demo_data

    app.register_blueprint(api_bp, url_prefix="/api")
    register_jwt_handlers(jwt)

    @app.route("/")
    @app.route("/index.html")
    def index():
        return send_from_directory(base_dir, "index.html")

    @app.errorhandler(404)
    def page_fallback(error):
        if request.path.startswith("/api/"):
            return {"code": 404, "msg": "接口不存在", "data": {}}, 404
        return send_from_directory(base_dir, "index.html")

    with app.app_context():
        db.create_all()
        seed_demo_data()

    return app
