from django.db import migrations


def forwards(apps, schema_editor):
    User = apps.get_model("users", "User")
    Role = apps.get_model("access_control", "Role")
    for user in User.objects.all():
        if user.role:
            try:
                role_obj = Role.objects.get(slug=user.role, is_system=True)
                user.role_obj = role_obj
                user.save(update_fields=["role_obj"])
            except Role.DoesNotExist:
                pass


def backwards(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.all().update(role_obj=None)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_add_role_fk"),
        ("access_control", "0002_modulepermission"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
