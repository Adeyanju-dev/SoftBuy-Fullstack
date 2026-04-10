from django.db import migrations, models
from django.utils import timezone


def add_password_reset_fields_if_missing(apps, schema_editor):
    PasswordResetCode = apps.get_model("users", "PasswordResetCode")
    table_name = PasswordResetCode._meta.db_table
    vendor = schema_editor.connection.vendor

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }

        if "attempts" not in existing_columns:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN attempts integer DEFAULT 0")

        if "expires_at" not in existing_columns:
            if vendor == "sqlite":
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN expires_at datetime")
            else:
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN expires_at timestamp with time zone")

        columns_after = {
            column.name for column in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }
        if "attempts" in columns_after and "expires_at" in columns_after:
            if vendor == "sqlite":
                cursor.execute(
                    f"""
                    UPDATE {table_name}
                    SET attempts = COALESCE(attempts, 0),
                        expires_at = COALESCE(expires_at, datetime(created_at, '+10 minutes'))
                    """
                )
            else:
                cursor.execute(
                    f"""
                    UPDATE {table_name}
                    SET attempts = COALESCE(attempts, 0),
                        expires_at = COALESCE(expires_at, created_at + interval '10 minutes')
                    """
                )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_alter_passwordresetcode_code"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_password_reset_fields_if_missing, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="passwordresetcode",
                    name="attempts",
                    field=models.PositiveIntegerField(default=0),
                ),
                migrations.AddField(
                    model_name="passwordresetcode",
                    name="expires_at",
                    field=models.DateTimeField(default=timezone.now),
                    preserve_default=False,
                ),
            ],
        ),
    ]
