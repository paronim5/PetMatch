from typing import List, Dict
from fastapi import WebSocket
from app.domain.events import EventObserver, event_bus
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager(EventObserver):
    def __init__(self):
        # user_id -> List[WebSocket]
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.loop = None
        # Attach self to event bus
        event_bus.attach("new_message", self)
        event_bus.attach("new_match", self)
        event_bus.attach("new_notification", self)

    async def connect(self, websocket: WebSocket, user_id: int):
        import asyncio
        if self.loop is None:
            try:
                self.loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
                
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected via WebSocket")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected")

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            # Create a copy of the list to avoid modification during iteration if any disconnect happens
            connections = list(self.active_connections[user_id])
            for connection in connections:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error sending WS message to user {user_id}: {e}")

    # EventObserver implementation
    def update(self, event_type: str, data: Dict):
        import asyncio
        recipient_id = data.get("recipient_id") or data.get("user_id")
        
        if recipient_id:
            message = json.dumps({
                "type": event_type,
                "data": data
            })
            
            # Try to use the captured loop (thread-safe)
            if self.loop and self.loop.is_running():
                asyncio.run_coroutine_threadsafe(self.send_personal_message(message, recipient_id), self.loop)
                return

            # Fallback for same-loop or when loop not captured yet
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.send_personal_message(message, recipient_id))
            except RuntimeError:
                # No event loop (e.g. testing), ignore
                pass

manager = ConnectionManager()
