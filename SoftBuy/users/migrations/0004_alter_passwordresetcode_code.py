from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_alter_passwordresetcode_options_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="passwordresetcode",
            name="code",
            field=models.CharField(max_length=128),
        ),
    ]
