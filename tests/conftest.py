from pathlib import Path

import pytest

from campus_ledger import create_app


@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    db_path = tmp_path / "test_campus_ledger.db"
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            "JWT_SECRET_KEY": "test-secret-for-api-tests-with-enough-length",
            "SEED_DATABASE": True,
        }
    )
    return app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth_headers(client):
    response = client.post("/api/auth/login", json={"username": "test", "password": "123456"})
    token = response.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
