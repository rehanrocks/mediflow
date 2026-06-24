from django.apps import AppConfig


class AccessControlConfig(AppConfig):
    name = "access_control"

    def ready(self):
        import access_control.permissions  # noqa: F401
