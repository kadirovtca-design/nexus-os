"""Users must never read or modify another user's records."""


def test_cross_user_access_is_404(client, other):
    task = client.post("/api/tasks", json={"title": "secret"}).json()
    project = client.post("/api/projects", json={"name": "P"}).json()
    goal = client.post("/api/goals", json={"title": "G", "milestones": [{"title": "m"}]}).json()
    habit = client.post("/api/habits", json={"name": "H"}).json()
    tx = client.post("/api/finance/transactions",
                     json={"type": "expense", "amount": "10", "category": "Food", "date": "2026-11-01"}).json()
    ev = client.post("/api/events", json={"title": "E", "start_at": "2026-11-25T10:00:00Z",
                                          "end_at": "2026-11-25T11:00:00Z"}).json()

    checks = [
        ("GET", f"/api/tasks/{task['id']}"), ("PATCH", f"/api/tasks/{task['id']}"),
        ("DELETE", f"/api/tasks/{task['id']}"), ("GET", f"/api/projects/{project['id']}"),
        ("DELETE", f"/api/projects/{project['id']}"), ("GET", f"/api/goals/{goal['id']}"),
        ("PATCH", f"/api/goals/{goal['id']}/milestones/{goal['milestones'][0]['id']}"),
        ("PATCH", f"/api/habits/{habit['id']}"), ("PATCH", f"/api/finance/transactions/{tx['id']}"),
        ("DELETE", f"/api/finance/transactions/{tx['id']}"), ("GET", f"/api/events/{ev['id']}"),
        ("DELETE", f"/api/events/{ev['id']}"),
    ]
    for method, path in checks:
        r = other.request(method, path, json={} if method == "PATCH" else None)
        assert r.status_code == 404, (method, path, r.status_code)
    assert other.post(f"/api/habits/{habit['id']}/check-in", json={"date": "2026-11-20"}).status_code == 404

    # lists are scoped
    assert other.get("/api/tasks").json() == []
    assert other.get("/api/projects").json() == []
    assert other.get("/api/finance/transactions").json() == []
    assert other.get("/api/finance/summary").json()["balance"] == 0
    assert all("secret" not in a["message"] for a in other.get("/api/activity").json())

    # cannot attach own records to someone else's project/task
    assert other.post("/api/tasks", json={"title": "x", "project_id": project["id"]}).status_code == 422
    assert other.post("/api/events", json={"title": "x", "start_at": "2026-11-25T10:00:00Z",
                                           "end_at": "2026-11-25T11:00:00Z", "task_id": task["id"]}).status_code == 422
    # original data untouched
    assert client.get(f"/api/tasks/{task['id']}").json()["title"] == "secret"


def test_other_user_sessions_cannot_be_revoked(client, other):
    sid = client.get("/api/users/me/sessions").json()[0]["id"]
    assert other.delete(f"/api/users/me/sessions/{sid}").status_code == 404
