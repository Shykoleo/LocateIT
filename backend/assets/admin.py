from django.contrib import admin
from .models import Asset

@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("name", "asset_tag", "asset_type", "status", "condition", "assigned_to", "building", "room")
    search_fields = ("name", "asset_tag", "asset_type", "assigned_to", "building", "room")
    list_filter = ("status", "condition", "asset_type", "building")