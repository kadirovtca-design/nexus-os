from datetime import date, timedelta


def test_task_lifecycle_and_filters(client):
    p = client.post("/api/projects", json={"name": "Launch", "color": "#22C55E"}).json()
    t1 = client.post("/api/tasks", json={"title": "Write spec", "priority": "high", "category": "Work",
                                         "project_id": p["id"], "due_date": "2026-11-20"}).json()
    client.post("/api/tasks", json={"title": "Buy milk", "priority": "low", "category": "Home"})
    assert t1["project"]["name"] == "Launch"

    r = client.patch(f"/api/tasks/{t1['id']}", json={"status": "done"}).json()
    assert r["completed_at"] is not None
    assert client.patch(f"/api/tasks/{t1['id']}", json={"status": "todo"}).json()["completed_at"] is None

    assert [t["title"] for t in client.get("/api/tasks", params={"q": "milk"}).json()] == ["Buy milk"]
    assert len(client.get("/api/tasks", params={"priority": "high"}).json()) == 1
    assert len(client.get("/api/tasks", params={"category": "Home"}).json()) == 1
    by_prio = client.get("/api/tasks", params={"sort": "priority"}).json()
    assert by_prio[0]["priority"] == "high"
    assert set(client.get("/api/tasks/categories").json()) == {"Home", "Work"}

    proj = client.get(f"/api/projects/{p['id']}").json()
    assert proj["task_count"] == 1 and proj["progress"] == 0
    client.patch(f"/api/tasks/{t1['id']}", json={"status": "done"})
    assert client.get(f"/api/projects/{p['id']}").json()["progress"] == 100

    assert client.delete(f"/api/projects/{p['id']}").status_code == 204
    assert client.get(f"/api/tasks/{t1['id']}").json()["project_id"] is None
    assert client.delete(f"/api/tasks/{t1['id']}").status_code == 204
    assert client.get(f"/api/tasks/{t1['id']}").status_code == 404


def test_validation_errors(client):
    assert client.post("/api/tasks", json={"title": ""}).status_code == 422
    assert client.post("/api/tasks", json={"title": "x", "priority": "mega"}).status_code == 422
    assert client.post("/api/projects", json={"name": "x", "color": "red"}).status_code == 422
    assert client.post("/api/finance/transactions", json={"type": "expense", "amount": "-5",
                                                          "category": "x", "date": "2026-11-01"}).status_code == 422
    assert client.post("/api/events", json={"title": "x", "start_at": "2026-11-25T11:00:00Z",
                                            "end_at": "2026-11-25T10:00:00Z"}).status_code == 422


def test_finance_calculations(client):
    today = date.today()
    m = today.replace(day=1)
    for tx in [
        {"type": "income", "amount": "3000.00", "category": "Salary", "date": m.isoformat()},
        {"type": "expense", "amount": "1200.50", "category": "Rent", "date": m.isoformat()},
        {"type": "expense", "amount": "99.50", "category": "Food", "date": m.isoformat()},
        {"type": "expense", "amount": "50", "category": "Food", "date": (m - timedelta(days=1)).isoformat()},
    ]:
        assert client.post("/api/finance/transactions", json=tx).status_code == 201
    client.put("/api/finance/budgets", json={"amount": "2000"})
    client.put("/api/finance/budgets", json={"category": "Food", "amount": "100"})
    client.put("/api/finance/budgets", json={"amount": "2500"})  # upsert, not duplicate

    s = client.get("/api/finance/summary", params={"month": m.strftime("%Y-%m")}).json()
    assert s["income"] == 3000 and s["expense"] == 1300 and s["net"] == 1700
    assert s["balance"] == 1650
    assert s["prev_expense"] == 50
    assert s["budget"]["amount"] == 2500 and s["budget"]["spent"] == 1300
    assert s["expense_by_category"][0] == {"category": "Rent", "total": 1200.5}
    assert round(s["savings_rate"], 4) == round(1700 / 3000, 4)
    budgets = client.get("/api/finance/budgets").json()
    assert len(budgets) == 2
    food = next(b for b in budgets if b["category"] == "Food")
    assert food["percent"] == 99


def test_goals_and_milestones(client):
    g = client.post("/api/goals", json={"title": "Run a marathon", "category": "Health",
                                        "milestones": [{"title": "5k"}, {"title": "21k"}]}).json()
    assert g["progress"] == 0
    m1, m2 = g["milestones"]
    client.patch(f"/api/goals/{g['id']}/milestones/{m1['id']}", json={"done": True})
    assert client.get(f"/api/goals/{g['id']}").json()["progress"] == 50
    client.patch(f"/api/goals/{g['id']}/milestones/{m2['id']}", json={"done": True})
    g2 = client.get(f"/api/goals/{g['id']}").json()
    assert g2["status"] == "completed" and g2["progress"] == 100
    client.patch(f"/api/goals/{g['id']}/milestones/{m2['id']}", json={"done": False})
    assert client.get(f"/api/goals/{g['id']}").json()["status"] == "active"
    manual = client.post("/api/goals", json={"title": "Read", "manual_progress": 40}).json()
    assert manual["progress"] == 40


def test_habit_streaks(client):
    h = client.post("/api/habits", json={"name": "Meditate"}).json()
    me = client.get("/api/auth/me").json()
    from datetime import datetime
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo(me["preferences"]["timezone"])).date()
    for k in (1, 2, 3):
        client.post(f"/api/habits/{h['id']}/check-in", json={"date": (today - timedelta(days=k)).isoformat()})
    r = client.post(f"/api/habits/{h['id']}/check-in", json={"date": (today - timedelta(days=1)).isoformat()})
    assert r.json()["total_completions"] == 3  # idempotent
    assert r.json()["current_streak"] == 3 and not r.json()["completed_today"]
    r = client.post(f"/api/habits/{h['id']}/check-in", json={"date": today.isoformat()}).json()
    assert r["current_streak"] == 4 and r["completed_today"]
    r = client.post(f"/api/habits/{h['id']}/check-in",
                    json={"date": (today - timedelta(days=2)).isoformat(), "done": False}).json()
    assert r["current_streak"] == 2 and r["best_streak"] == 2
    assert client.post(f"/api/habits/{h['id']}/check-in",
                       json={"date": (today + timedelta(days=1)).isoformat()}).status_code == 422


def test_calendar_range_and_task_link(client):
    t = client.post("/api/tasks", json={"title": "Prep deck"}).json()
    e = client.post("/api/events", json={"title": "Review", "start_at": "2026-11-25T10:00:00+00:00",
                                         "end_at": "2026-11-25T11:00:00+00:00", "task_id": t["id"]}).json()
    assert e["task"]["title"] == "Prep deck"
    inside = client.get("/api/events", params={"start": "2026-11-25T00:00:00Z", "end": "2026-11-26T00:00:00Z"})
    assert len(inside.json()) == 1
    outside = client.get("/api/events", params={"start": "2026-11-26T00:00:00Z", "end": "2026-11-27T00:00:00Z"})
    assert outside.json() == []
    client.patch(f"/api/events/{e['id']}", json={"title": "Review v2"})
    client.delete(f"/api/tasks/{t['id']}")
    assert client.get(f"/api/events/{e['id']}").json()["task_id"] is None


def test_dashboard_and_analytics_reflect_data(client):
    proj = client.post("/api/projects", json={"name": "P"}).json()
    client.post("/api/tasks", json={"title": "Due soon", "project_id": proj["id"], "due_date": date.today().isoformat()})
    t = client.post("/api/tasks", json={"title": "Ship"}).json()
    client.patch(f"/api/tasks/{t['id']}", json={"status": "done"})
    h = client.post("/api/habits", json={"name": "Read"}).json()
    me = client.get("/api/auth/me").json()
    from datetime import datetime
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo(me["preferences"]["timezone"])).date()
    client.post(f"/api/habits/{h['id']}/check-in", json={"date": today.isoformat()})

    d = client.get("/api/dashboard").json()
    assert d["productivity"]["completed_today"] == 1
    assert d["focus_tasks"][0]["project"]["name"] == "P"
    assert d["habits"] == {"done": 1, "active": 1}
    assert len(d["week"]) == 7
    assert any("Ship" in a["message"] for a in d["recent_activity"])

    a = client.get("/api/analytics", params={"days": 30}).json()
    assert a["productivity"]["completed"] == 1
    assert a["tasks"]["completion_rate"] == 0.5
    assert len(a["monthly"]) == 6 and len(a["weekday"]) == 7


def test_assistant_without_key(client):
    s = client.get("/api/assistant/status").json()
    assert s["configured"] is False and s["setup"]["env_var"] == "ANTHROPIC_API_KEY"
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "ai_not_configured"
    ins = client.get("/api/assistant/insights").json()
    assert ins["source"] == "local-rules" and ins["items"]
