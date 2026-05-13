from campus_ledger.models import Category, CommunityPost, EntryOption, LedgerEntry, SavingGoal, SavingGoalDeposit, User


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
        assert EntryOption.query.count() >= 10
        assert SavingGoalDeposit.query.count() >= 10
        assert CommunityPost.query.count() >= 5


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


def test_profile_category_and_options(client, auth_headers):
    profile = expect_json(
        client.put("/api/auth/me", headers=auth_headers, json={"nickname": "星芒用户新版", "email": "test@example.com"})
    )["data"]["user"]
    assert profile["nickname"] == "星芒用户新版"

    category = expect_json(
        client.post(
            "/api/categories",
            headers=auth_headers,
            json={"name": "宠物开销", "icon": "宠", "color": "#0f766e", "monthly_limit": "120.00"},
        ),
        201,
        201,
    )["data"]["category"]
    assert category["user_owned"] is True
    updated = expect_json(
        client.put(f"/api/categories/{category['id']}", headers=auth_headers, json={"monthly_limit": "150.00"})
    )["data"]["category"]
    assert updated["monthly_limit"] == 150.0

    option = expect_json(
        client.post("/api/entry-options", headers=auth_headers, json={"kind": "scene", "name": "图书馆"}),
        201,
        201,
    )["data"]["option"]
    assert option["name"] == "图书馆"
    expect_json(client.delete(f"/api/entry-options/{option['id']}", headers=auth_headers))
    expect_json(client.delete(f"/api/categories/{category['id']}", headers=auth_headers))


def test_goals_deposits_and_community(client, auth_headers):
    goal = expect_json(
        client.post(
            "/api/goals",
            headers=auth_headers,
            json={"name": "测试旅行", "target_amount": "1000.00", "saved_amount": "100.00", "deadline": "2026-07-01"},
        ),
        201,
        201,
    )["data"]["goal"]
    deposit = expect_json(
        client.post(
            f"/api/goals/{goal['id']}/deposits",
            headers=auth_headers,
            json={"amount": "50.00", "deposited_at": "2026-05-13", "note": "测试存入"},
        ),
        201,
        201,
    )["data"]["deposit"]
    detail = expect_json(client.get(f"/api/goals/{goal['id']}", headers=auth_headers))["data"]
    assert any(item["id"] == deposit["id"] for item in detail["deposits"])

    post = expect_json(
        client.post(
            "/api/community/posts",
            headers=auth_headers,
            json={"title": "测试省钱方法", "topic": "省钱技巧", "content": "把小额消费拆出来复盘，月底更清楚。"},
        ),
        201,
        201,
    )["data"]["post"]
    expect_json(
        client.post(f"/api/community/posts/{post['id']}/comments", headers=auth_headers, json={"content": "这个方法有用。"}),
        201,
        201,
    )
    liked = expect_json(client.post(f"/api/community/posts/{post['id']}/like", headers=auth_headers))["data"]["post"]
    assert liked["likes_count"] >= 1


def test_ai_fallback(client, auth_headers):
    result = expect_json(client.post("/api/ai/coach?month=2026-05", headers=auth_headers, json={"question": "How can I spend less?"}))
    assert result["data"]["answer"]
    assert result["data"]["context"]["month"] == "2026-05"
