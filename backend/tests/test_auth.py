from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import HEADERS, make_client


def test_register_login_logout_flow():
    c = make_client()
    me = c.get("/api/auth/me").json()
    assert me["email"] == "ada@example.com"
    assert me["preferences"]["timezone"] == "Europe/London"
    # cookie is httpOnly
    assert c.cookies.get("nexus_session")

    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").status_code == 401

    r = c.post("/api/auth/login", json={"email": "ADA@example.com", "password": "analytical1"})
    assert r.status_code == 200
    assert c.get("/api/auth/me").status_code == 200


def test_password_is_hashed(client):
    from sqlalchemy import text

    from app.core.database import engine

    with engine.connect() as conn:
        h = conn.execute(text("select password_hash from users")).scalar()
    assert h.startswith("$argon2id$") and "analytical1" not in h


def test_duplicate_email_and_weak_password():
    make_client()
    c = TestClient(app, headers=HEADERS)
    assert c.post("/api/auth/register", json={"name": "X", "email": "ada@example.com",
                                              "password": "another12"}).status_code == 409
    assert c.post("/api/auth/register", json={"name": "X", "email": "x@example.com",
                                              "password": "short"}).status_code == 422
    assert c.post("/api/auth/register", json={"name": "X", "email": "x@example.com",
                                              "password": "onlyletters"}).status_code == 422


def test_wrong_password_and_unknown_user():
    make_client()
    c = TestClient(app, headers=HEADERS)
    assert c.post("/api/auth/login", json={"email": "ada@example.com", "password": "nope"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"}).status_code == 401


def test_protected_routes_require_auth():
    c = TestClient(app, headers=HEADERS)
    for path in ["/api/tasks", "/api/projects", "/api/dashboard", "/api/analytics", "/api/goals",
                 "/api/habits", "/api/finance/summary", "/api/activity"]:
        assert c.get(path).status_code == 401, path


def test_csrf_header_required(client):
    bare = TestClient(app, cookies=client.cookies)
    assert bare.post("/api/tasks", json={"title": "x"}).status_code == 403
    assert bare.get("/api/tasks").status_code == 200


def test_password_change_revokes_other_sessions():
    a = make_client()
    b = TestClient(app, headers=HEADERS)
    b.post("/api/auth/login", json={"email": "ada@example.com", "password": "analytical1"})
    assert len(a.get("/api/users/me/sessions").json()) == 2
    r = a.post("/api/users/me/password", json={"current_password": "analytical1", "new_password": "babbage123"})
    assert r.status_code == 204
    assert b.get("/api/auth/me").status_code == 401
    assert a.get("/api/auth/me").status_code == 200


def test_preferences_and_profile(client):
    r = client.patch("/api/users/me/preferences", json={"accent": "emerald", "currency": "EUR"})
    assert r.json()["preferences"]["accent"] == "emerald"
    assert client.patch("/api/users/me/preferences", json={"timezone": "Mars/Base"}).status_code == 422
    assert client.patch("/api/users/me", json={"name": "Ada K."}).json()["name"] == "Ada K."


def test_delete_account_cascades(client):
    client.post("/api/tasks", json={"title": "t"})
    assert client.request("DELETE", "/api/users/me", json={"password": "wrong"}).status_code == 400
    assert client.request("DELETE", "/api/users/me", json={"password": "analytical1"}).status_code == 204
    assert client.get("/api/auth/me").status_code == 401
