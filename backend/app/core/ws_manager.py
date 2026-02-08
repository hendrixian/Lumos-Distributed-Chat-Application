# app/core/ws_manager.py added by thu for getting notifications when sender send contact request
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list] = {}

    async def connect(self, username: str, websocket):
        await websocket.accept()
        self.active_connections.setdefault(username, []).append(websocket)

    def disconnect(self, username: str, websocket):
        self.active_connections[username].remove(websocket)

    async def send(self, username: str, message: dict):
        if username in self.active_connections:
            for ws in self.active_connections[username]:
                await ws.send_json(message)

manager = ConnectionManager()
