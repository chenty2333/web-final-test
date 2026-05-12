from campus_ledger.models import Category, LedgerEntry, SavingGoal, User


def expect_json(response, status_code=200, code=None):
    assert response.status_code == status_code
    payload = response.get_json()
    assert set(payload) == {"code", "msg", "data"}
    if code is not None:
        assert payload["code"] == code
    return payload


def test_seed_data_counts(app):
    with app.app_context():
        assert User.query.count() >= 10
        assert Category.query.count() >= 10
        assert LedgerEntry.query.count() >= 10
        assert SavingGoal.query.count() >= 10


def test_public_and_auth_flow(client):
    overview = expect_json(client.get("/api/public/overview"))
    assert overview["data"]["stats"]["seed_categories"] >= 10
    login = expect_json(client.post("/api/auth/login", json={"username": "test", "password": "123456"}))
    assert login["data"]["access_token"]


def test_monthly_summary_and_pagination(client, auth_headers):
    summary = expect_json(client.get("/api/summary?month=2026-05", headers=auth_headers))["data"]["summary"]
    assert summary["month"] == "2026-05"
    assert len(summary["monthly_trend"]) == 6
    assert "budget_usage" in summary

    page = expect_json(client.get("/api/entries?month=2026-05&page=1&page_size=3", headers=auth_headers))["data"]
    assert page["pagination"]["page_size"] == 3
    assert len(page["entries"]) <= 3


def test_entry_crud_and_validation(client, auth_headers):
    categories = expect_json(client.get("/api/public/categories"))["data"]["categories"]
    created = expect_json(
        client.post(
            "/api/entries",
            headers=auth_headers,
            json={
                "title": "pytest coffee",
                "amount": "16.00",
                "category_id": categories[1]["id"],
                "kind": "expense",
                "spent_at": "2026-05-12",
                "scene": "Library",
                "mood": "Focused",
                "note": "created by tests",
            },
        ),
        201,
        201,
    )["data"]["entry"]
    updated = expect_json(client.put(f"/api/entries/{created['id']}", headers=auth_headers, json={"amount": "18.00"}))["data"]["entry"]
    assert updated["amount"] == 18.0
    expect_json(client.delete(f"/api/entries/{created['id']}", headers=auth_headers))

    expect_json(client.get("/api/entries?category_id=abc", headers=auth_headers), 400, 400)
    expect_json(client.get("/api/summary?month=2026/05", headers=auth_headers), 400, 400)


def test_ai_fallback(client, auth_headers):
    result = expect_json(client.post("/api/ai/coach?month=2026-05", headers=auth_headers, json={"question": "How can I spend less?"}))
    assert result["data"]["answer"]
    assert result["data"]["context"]["month"] == "2026-05"
