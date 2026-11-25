import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://nexus:nexus@localhost:5432/nexus_test")
os.environ["ENVIRONMENT"] = "test"
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.main import app  # noqa: E402

HEADERS = {"X-Requested-With": "nexus"}


@pytest.fixture(scope="session", autouse=True)
def _migrate():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))


def make_client(email: str = "ada@example.com", name: str = "Ada Lovelace") -> TestClient:
    c = TestClient(app, headers=HEADERS)
    r = c.post("/api/auth/register", json={"name": name, "email": email, "password": "analytical1",
                                           "timezone": "Europe/London"})
    assert r.status_code == 201, r.text
    return c


@pytest.fixture
def client() -> TestClient:
    return make_client()


@pytest.fixture
def other() -> TestClient:
    return make_client("grace@example.com", "Grace Hopper")
