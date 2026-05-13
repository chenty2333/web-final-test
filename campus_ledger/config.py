"""Runtime configuration for local, test, and production deployments."""

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default):
    value = os.environ.get(name)
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


class BaseConfig:
    APP_NAME = "星芒账本"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "starry-campus-ledger-course-design-dev-secret")
    SECRET_KEY = os.environ.get("SECRET_KEY", JWT_SECRET_KEY)
    CORS_ORIGINS = env_list("CORS_ORIGINS", ["*"])
    SEED_DATABASE = env_bool("SEED_DATABASE", True)
    JSON_AS_ASCII = False
    API_LOG_LEVEL = os.environ.get("API_LOG_LEVEL", "INFO")

    @staticmethod
    def init_app(app):
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            database_path = Path(app.instance_path) / "campus_ledger.db"
            database_url = f"sqlite:///{database_path}"
        app.config.setdefault("SQLALCHEMY_DATABASE_URI", database_url)


class DevelopmentConfig(BaseConfig):
    DEBUG = env_bool("FLASK_DEBUG", False)


class TestingConfig(BaseConfig):
    TESTING = True
    SEED_DATABASE = True
    WTF_CSRF_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def resolve_config():
    env_name = os.environ.get("APP_ENV", "development").strip().lower()
    return CONFIG_BY_NAME.get(env_name, DevelopmentConfig)
