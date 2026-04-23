from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, login_view, logout_view, session_view

router = DefaultRouter()
router.register(r'assets', AssetViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("login/", login_view),
    path("logout/", logout_view),
    path("session/", session_view),
]