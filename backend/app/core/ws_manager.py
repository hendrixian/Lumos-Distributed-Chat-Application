# app/core/ws_manager.py added by thu for getting notifications when sender send contact request
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list] = {}

    async def connect(self, username: str, websocket):
        await websocket.accept()
        self.active_connections.setdefault(username, []).append(websocket)

    def disconnect(self, username: str, websocket):
        if username not in self.active_connections:
            return
        if websocket in self.active_connections[username]:
            self.active_connections[username].remove(websocket)
        if not self.active_connections[username]:
            del self.active_connections[username]

    async def send(self, username: str, message: dict):
        if username in self.active_connections:
            stale = []
            for ws in self.active_connections[username]:
                try:
                    await ws.send_json(message)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                self.disconnect(username, ws)

manager = ConnectionManager()
