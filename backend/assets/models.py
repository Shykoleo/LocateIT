from django.db import models

class Asset(models.Model):
    STATUS_CHOICES = [
        ("available", "Available"),
        ("in_use", "In Use"),
        ("maintenance", "Maintenance"),
        ("lost", "Lost"),
    ]

    CONDITION_CHOICES = [
        ("excellent", "Excellent"),
        ("good", "Good"),
        ("fair", "Fair"),
        ("poor", "Poor"),
    ]

    name = models.CharField(max_length=100)
    asset_tag = models.CharField(max_length=50, unique=True, blank=True, null=True)
    asset_type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="available")
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default="good")
    assigned_to = models.CharField(max_length=100, blank=True)
    building = models.CharField(max_length=100, blank=True)
    room = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    image = models.ImageField(upload_to="asset_images/", blank=True, null=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name