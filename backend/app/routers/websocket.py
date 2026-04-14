from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.config import settings
from app.websocket.manager import websocket_manager

router = APIRouter()


async def get_user_from_token(token: str) -> str:
    """Extract user ID from JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise ValueError("Invalid token")
        return user_id
    except (JWTError, ValueError):
        raise ValueError("Invalid token")


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time updates"""
    try:
        user_id = None
        if token.startswith("public-"):
            # Format: public-{access_token}
            # For now, we trust the access_token format for the MVP. 
            # Real production apps should verify this against the DB.
            user_id = f"anonymous:{token}"
        else:
            user_id = await get_user_from_token(token)
            
        await websocket_manager.connect(websocket, user_id)
        
        try:
            while True:
                # Keep connection alive and handle incoming messages if needed
                data = await websocket.receive_text()
                # Echo back or handle client messages
                await websocket.send_json({"type": "pong", "data": data})
        except WebSocketDisconnect:
            await websocket_manager.disconnect(websocket, user_id)
    except ValueError:
        await websocket.close(code=1008, reason="Invalid authentication")

