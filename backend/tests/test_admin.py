# backend/tests/test_admin.py

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from database import SessionLocal
import models

client = TestClient(app)

@pytest.fixture
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_list_users_as_admin(db):
    # Assume you have a fixture or method to authenticate as admin
    admin_user = db.query(models.User).filter(models.User.is_admin == True).first()
    assert admin_user is not None

    # Simulate session or token
    with client:
        client.cookies.set('session', admin_user.id)
        response = client.get("/admin/users")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

def test_update_user_time_as_admin(db):
    admin_user = db.query(models.User).filter(models.User.is_admin == True).first()
    user = db.query(models.User).filter(models.User.is_admin == False).first()
    assert user is not None

    with client:
        client.cookies.set('session', admin_user.id)
        response = client.put(f"/admin/users/{user.id}/time", json={"amount": 300})
        assert response.status_code == 200
        assert response.json()["new_remaining_time"] == user.remaining_time + 300
