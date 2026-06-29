from django.test import TestCase
from rest_framework.test import APIClient

from organizations.models import Organization
from users.models import User
from chat.models import Message, Group, GroupMembership, GroupMessage


class ChatModelTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Chat Clinic", slug="chat-clinic")
        self.admin = User.objects.create_user(
            username="chatadmin", password="pass", role="admin", organization=self.org
        )
        self.doctor = User.objects.create_user(
            username="chatdoc", password="pass", role="doctor", organization=self.org
        )
        self.receptionist = User.objects.create_user(
            username="chatrec", password="pass", role="receptionist", organization=self.org
        )

    def test_create_dm_message(self):
        msg = Message.objects.create(
            sender=self.admin, receiver=self.doctor, content="Hello Doctor"
        )
        self.assertEqual(msg.status, Message.STATUS_SENT)
        self.assertFalse(msg.is_read)
        self.assertEqual(str(msg.sender_id), str(self.admin.id))

    def test_mark_message_read(self):
        msg = Message.objects.create(
            sender=self.admin, receiver=self.doctor, content="Hello"
        )
        msg.mark_read()
        msg.refresh_from_db()
        self.assertTrue(msg.is_read)
        self.assertIsNotNone(msg.read_at)
        self.assertEqual(msg.status, Message.STATUS_READ)

    def test_create_group(self):
        group = Group.objects.create(name="Test Group", created_by=self.admin)
        GroupMembership.objects.create(group=group, user=self.admin, is_admin=True)
        GroupMembership.objects.create(group=group, user=self.doctor)
        self.assertEqual(group.members.count(), 2)
        self.assertTrue(group.memberships.filter(user=self.admin, is_admin=True).exists())

    def test_send_group_message(self):
        group = Group.objects.create(name="Group", created_by=self.admin)
        GroupMembership.objects.create(group=group, user=self.admin)
        msg = GroupMessage.objects.create(
            group=group, sender=self.admin, content="Group chat message"
        )
        self.assertEqual(msg.group, group)
        self.assertEqual(msg.sender, self.admin)


class ChatAPITests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="API Clinic", slug="api-clinic")
        self.admin = User.objects.create_user(
            username="apadmin", password="pass", role="admin", organization=self.org
        )
        self.doctor = User.objects.create_user(
            username="apdoc", password="pass", role="doctor", organization=self.org
        )
        self.receptionist = User.objects.create_user(
            username="aprec", password="pass", role="receptionist", organization=self.org
        )
        self.client = APIClient()

    def test_chat_users_list(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/chat/users/")
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        user_ids = [u["id"] for u in results]
        self.assertIn(self.doctor.id, user_ids)
        self.assertIn(self.receptionist.id, user_ids)
        self.assertNotIn(self.admin.id, user_ids)  # excludes self

    def test_chat_users_list_unauthorized(self):
        resp = self.client.get("/api/chat/users/")
        self.assertEqual(resp.status_code, 401)

    def test_send_dm_via_api(self):
        self.client.force_authenticate(user=self.admin)
        msg = Message.objects.create(
            sender=self.admin, receiver=self.doctor, content="Test DM"
        )
        resp = self.client.get(f"/api/chat/dm/{self.doctor.id}/messages/")
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["content"], "Test DM")

    def test_conversations_list(self):
        self.client.force_authenticate(user=self.admin)
        Message.objects.create(sender=self.admin, receiver=self.doctor, content="Hi")
        resp = self.client.get("/api/chat/conversations/")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data), 1)

    def test_create_group_api(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/chat/groups/", {
            "name": "New Group",
            "member_ids": [self.doctor.id, self.receptionist.id],
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["name"], "New Group")
        self.assertEqual(resp.data["member_count"], 3)  # creator + 2 members

    def test_group_detail(self):
        self.client.force_authenticate(user=self.admin)
        group = Group.objects.create(name="Detail Group", created_by=self.admin)
        GroupMembership.objects.create(group=group, user=self.admin, is_admin=True)
        GroupMembership.objects.create(group=group, user=self.doctor)
        resp = self.client.get(f"/api/chat/groups/{group.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("members", resp.data)

    def test_group_messages(self):
        self.client.force_authenticate(user=self.admin)
        group = Group.objects.create(name="Msg Group", created_by=self.admin)
        GroupMembership.objects.create(group=group, user=self.admin)
        GroupMessage.objects.create(group=group, sender=self.admin, content="Hello Group")
        resp = self.client.get(f"/api/chat/groups/{group.id}/messages/")
        self.assertEqual(resp.status_code, 200)
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)

    def test_add_group_member(self):
        self.client.force_authenticate(user=self.admin)
        group = Group.objects.create(name="Add Member Group", created_by=self.admin)
        GroupMembership.objects.create(group=group, user=self.admin, is_admin=True)
        resp = self.client.post(
            f"/api/chat/groups/{group.id}/members/",
            {"user_id": self.doctor.id},
            format="json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(group.members.filter(id=self.doctor.id).exists())

    def test_remove_group_member(self):
        self.client.force_authenticate(user=self.admin)
        group = Group.objects.create(name="Remove Group", created_by=self.admin)
        GroupMembership.objects.create(group=group, user=self.admin, is_admin=True)
        GroupMembership.objects.create(group=group, user=self.doctor)
        resp = self.client.delete(f"/api/chat/groups/{group.id}/members/{self.doctor.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(group.members.filter(id=self.doctor.id).exists())

    def test_search_messages(self):
        self.client.force_authenticate(user=self.admin)
        Message.objects.create(sender=self.admin, receiver=self.doctor, content="urgent patient")
        resp = self.client.get("/api/chat/search/?conversation=dm_" + str(self.doctor.id) + "&q=urgent")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_patient_cannot_access_chat(self):
        patient = User.objects.create_user(
            username="patient", password="pass", role="patient", organization=self.org
        )
        self.client.force_authenticate(user=patient)
        resp = self.client.get("/api/chat/users/")
        self.assertEqual(resp.status_code, 403)

    def test_dm_history_marks_delivered(self):
        self.client.force_authenticate(user=self.admin)
        msg = Message.objects.create(
            sender=self.doctor, receiver=self.admin, content="Message to admin"
        )
        self.assertEqual(msg.status, Message.STATUS_SENT)
        resp = self.client.get(f"/api/chat/dm/{self.doctor.id}/messages/")
        self.assertEqual(resp.status_code, 200)
        msg.refresh_from_db()
        self.assertEqual(msg.status, Message.STATUS_DELIVERED)
