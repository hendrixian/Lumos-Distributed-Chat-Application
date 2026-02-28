from fastapi import APIRouter, WebSocket

from app.api.auth import get_user_from_token
from app.core.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket, token: str):
    try:
        user = await get_user_from_token(token)
    except Exception:
        await websocket.close(code=1008)
        return

    await manager.connect(user.username, websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(user.username, websocket)
