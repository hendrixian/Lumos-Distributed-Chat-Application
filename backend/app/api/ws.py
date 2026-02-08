# app/api/ws.py added by thu for getting notifications when sender send contact request
from fastapi import APIRouter, WebSocket, Depends
from app.api.auth import get_current_user
from app.core.ws_manager import manager

router = APIRouter()

@router.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket, token: str):
    user = await get_current_user(token)
    await manager.connect(user.username, websocket)

    try:
        while True:
            await websocket.receive_text()
    except:
        manager.disconnect(user.username, websocket)







