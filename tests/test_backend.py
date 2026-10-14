"""Security and API integration tests. Run: python -m unittest discover -s tests -v"""
import os
import tempfile
import unittest
from pathlib import Path

_TEST_DIR = tempfile.TemporaryDirectory(prefix="ssrm-test-")
os.environ["DATABASE_PATH"] = str(Path(_TEST_DIR.name) / "test.sqlite3")
os.environ["SECRET_KEY"] = "test-only-secret"
os.environ["BOOTSTRAP_ADMIN_USERNAME"] = "test-admin"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "test-password-123"
os.environ["BOOTSTRAP_ADMIN_NAME"] = "Test Administrator"

from backend.app import app, connect  # noqa: E402


class BackendApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True, SECRET_KEY="test-only-secret")

    def setUp(self):
        self.client = app.test_client()
        response = self.client.post("/api/auth/login", json={"username": "test-admin", "password": "test-password-123"})
        self.assertEqual(response.status_code, 200)

    def login_as(self, username, password):
        client = app.test_client()
        response = client.post("/api/auth/login", json={"username": username, "password": password})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        return client

    def create_account(self, username, role, school_id=None, classes=None):
        payload = {"username": username, "password": "test-password-123", "name": username.title(), "role": role,
                   "schoolId": school_id, "assignedClassIds": classes or []}
        response = self.client.post("/api/admin/accounts", json=payload)
        self.assertEqual(response.status_code, 201, response.get_data(as_text=True))
        return response.json["user"]

    def test_health_is_public_but_data_requires_authentication(self):
        client = app.test_client()
        self.assertEqual(client.get("/api/health").status_code, 200)
        self.assertEqual(client.get("/api/storage").status_code, 401)
        self.assertEqual(client.get("/api/students").status_code, 401)

    def test_storage_round_trip_and_key_validation(self):
        key = "smart_register_test_fixture"
        saved = self.client.put(f"/api/storage/{key}", json={"value": {"count": 3}})
        self.assertEqual(saved.status_code, 200)
        snapshot = self.client.get("/api/storage")
        self.assertEqual(snapshot.json["items"][key], {"count": 3})
        rejected = self.client.put("/api/storage/unrelated", json={"value": 1})
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(self.client.delete(f"/api/storage/{key}").status_code, 204)

    def test_bootstrap_account_login_session(self):
        client = app.test_client()
        response = client.post("/api/auth/login", json={"username": "test-admin", "password": "test-password-123"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["user"]["role"], "SUPER_ADMIN")
        self.assertEqual(client.get("/api/auth/me").status_code, 200)
        self.assertEqual(client.post("/api/auth/logout").status_code, 200)
        self.assertEqual(client.get("/api/auth/me").status_code, 401)

    def test_school_admin_cannot_read_or_change_another_school(self):
        self.client.post("/api/students", json={"id": "s-a", "name": "Student A", "schoolId": "school-a"})
        self.client.post("/api/students", json={"id": "s-b", "name": "Student B", "schoolId": "school-b"})
        self.create_account("school-admin-a", "SCHOOL_ADMIN", "school-a")
        client = self.login_as("school-admin-a", "test-password-123")
        response = client.get("/api/students")
        self.assertEqual([x["id"] for x in response.json["items"]], ["s-a"])
        self.assertEqual(client.get("/api/students/s-b").status_code, 403)
        self.assertEqual(client.patch("/api/students/s-a", json={"schoolId": "school-b"}).status_code, 403)
        created = client.post("/api/students", json={"id": "s-a2", "name": "Assigned School Student"})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["schoolId"], "school-a")

    def test_teacher_class_scope_and_read_only_viewer(self):
        self.client.post("/api/attendance_records", json={"id": "att-a", "schoolId": "school-a", "classId": "class-1", "status": "PRESENT"})
        self.client.post("/api/attendance_records", json={"id": "att-b", "schoolId": "school-a", "classId": "class-2", "status": "ABSENT"})
        self.create_account("teacher-a", "TEACHER", "school-a", ["class-1"])
        teacher = self.login_as("teacher-a", "test-password-123")
        self.assertEqual([x["id"] for x in teacher.get("/api/attendance_records").json["items"]], ["att-a"])
        self.assertEqual(teacher.patch("/api/attendance_records/att-a", json={"classId": "class-2"}).status_code, 403)
        self.assertEqual(teacher.post("/api/students", json={"id": "teacher-student", "schoolId": "school-a"}).status_code, 403)
        self.create_account("viewer-a", "VIEWER", "school-a")
        viewer = self.login_as("viewer-a", "test-password-123")
        self.assertEqual(viewer.put("/api/storage/smart_register_students", json={"value": []}).status_code, 403)

    def test_school_scoped_storage_preserves_other_school_records(self):
        self.client.put("/api/storage/smart_register_students", json={"value": [
            {"id": "a", "schoolId": "school-a", "name": "A"},
            {"id": "b", "schoolId": "school-b", "name": "B"},
        ]})
        self.create_account("school-admin-storage", "SCHOOL_ADMIN", "school-a")
        client = self.login_as("school-admin-storage", "test-password-123")
        snap = client.get("/api/storage").json["items"]["smart_register_students"]
        self.assertEqual([x["id"] for x in snap], ["a"])
        result = client.put("/api/storage/smart_register_students", json={"value": [
            {"id": "a", "schoolId": "school-a", "name": "A updated"},
        ]})
        self.assertEqual(result.status_code, 200)
        with connect() as db:
            rows = db.execute("SELECT value FROM app_storage WHERE key='smart_register_students'").fetchone()
        persisted = __import__("json").loads(rows["value"])
        self.assertEqual({x["id"] for x in persisted}, {"a", "b"})

    def test_only_super_admin_can_create_accounts(self):
        self.create_account("school-admin-b", "SCHOOL_ADMIN", "school-b")
        client = self.login_as("school-admin-b", "test-password-123")
        response = client.post("/api/admin/accounts", json={"username": "nope", "password": "long-password-123", "name": "Nope", "role": "SUPER_ADMIN"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
