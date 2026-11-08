from fastapi import APIRouter

from app.api.routes import assistant, items

api_router = APIRouter()
api_router.include_router(items.router)
api_router.include_router(assistant.router)
