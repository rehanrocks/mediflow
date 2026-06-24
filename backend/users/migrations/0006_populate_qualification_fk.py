from django.db import migrations


def forwards(apps, schema_editor):
    User = apps.get_model("users", "User")
    Qualification = apps.get_model("users", "Qualification")

    for user in User.objects.exclude(
        qualification=""
    ).exclude(qualification__isnull=True):
        raw = user.qualification
        first_part = raw.split(",")[0].strip()
        if not first_part:
            continue
        q, _ = Qualification.objects.get_or_create(
            name=first_part.lower(),
        )
        user.qualification_obj = q
        user.save(update_fields=["qualification_obj"])


def backwards(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.all().update(qualification_obj=None)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0005_add_qualification_fk"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
