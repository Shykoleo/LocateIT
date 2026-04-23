from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets
from .models import Asset
from .serializers import AssetSerializer
import json


class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer


@csrf_exempt
def login_view(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            password = data.get("password")

            user = authenticate(request, username=username, password=password)

            if user is not None:
                login(request, user)
                return JsonResponse({
                    "success": True,
                    "username": user.username
                })
            else:
                return JsonResponse({
                    "success": False,
                    "message": "Invalid username or password"
                }, status=401)
        except Exception:
            return JsonResponse({
                "success": False,
                "message": "Invalid request"
            }, status=400)

    return JsonResponse({"message": "Only POST allowed"}, status=405)


@csrf_exempt
def logout_view(request):
    if request.method == "POST":
        logout(request)
        return JsonResponse({"success": True})

    return JsonResponse({"message": "Only POST allowed"}, status=405)


def session_view(request):
    if request.user.is_authenticated:
        return JsonResponse({
            "authenticated": True,
            "username": request.user.username
        })
    return JsonResponse({
        "authenticated": False
    })