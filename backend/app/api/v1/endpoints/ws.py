from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Any
from sqlalchemy.orm import Session
from app.services.websocket_manager import manager
from app.api import deps
from app.services.user_service import user_service
from jose import jwt, JWTError
from app.core.config import settings
#
# Note: WebSocket cannot easily use OAuth2 header auth, so we accept a `token` query param,
# decode it to get the email, and look up the user to obtain their id.

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(deps.get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            await websocket.close(code=1008)
            return
        user = user_service.get_user_by_email(db, email=email)
        if not user:
            await websocket.close(code=1008)
            return
        user_id = user.id
    except JWTError:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if any (e.g. typing indicators)
            # For now, just echo or ignore
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
