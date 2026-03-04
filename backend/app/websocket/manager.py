import asyncio
import json

import asyncpg
from fastapi import WebSocket

from app.config import settings


class WebSocketManager:
    """Manages WebSocket connections and distributes PostgreSQL NOTIFY events"""
    
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}
        self.pg_connection: asyncpg.Connection | None = None
        self.listen_task: asyncio.Task | None = None
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Connect a WebSocket for a specific user"""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        """Disconnect a WebSocket"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send a message to a specific user"""
        if user_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            
            # Remove disconnected connections
            for conn in disconnected:
                await self.disconnect(conn, user_id)
    
    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients"""
        disconnected = set()
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add((connection, user_id))
        
        # Remove disconnected connections
        for conn, uid in disconnected:
            await self.disconnect(conn, uid)
    
    async def start_listening(self):
        """Start listening to PostgreSQL NOTIFY events"""
        try:
            # Parse DATABASE_URL to extract connection parameters
            db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "")
            # Format: user:password@host:port/dbname
            # Simplistic parsing, robust production code should use urlparse or similar
            if "@" in db_url:
                parts = db_url.split("@")
                user_pass = parts[0].split(":")
                host_db = parts[1].split("/")
                host_port = host_db[0].split(":")
                
                self.pg_connection = await asyncpg.connect(
                    host=host_port[0],
                    port=int(host_port[1]) if len(host_port) > 1 else 5432,
                    user=user_pass[0],
                    password=user_pass[1] if len(user_pass) > 1 else "",
                    database=host_db[1] if len(host_db) > 1 else "web_rrhh"
                )
            else:
                db_url_clean = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
                self.pg_connection = await asyncpg.connect(db_url_clean)
            
            # Listen to channels corresponding to tables
            await self.pg_connection.add_listener("news", self._handle_db_notification)
            await self.pg_connection.add_listener("vacation_requests", self._handle_db_notification)
            await self.pg_connection.add_listener("complaints", self._handle_db_notification)
            await self.pg_connection.add_listener("holidays", self._handle_db_notification)
            await self.pg_connection.add_listener("users", self._handle_db_notification)
            
            print("PostgreSQL listener started for channels: news, vacation_requests, complaints, holidays, users")
        except Exception as e:
            print(f"Error starting PostgreSQL listener: {e}")
            import traceback
            traceback.print_exc()
    
    async def stop_listening(self):
        """Stop listening to PostgreSQL NOTIFY events"""
        if self.pg_connection:
            await self.pg_connection.close()
            self.pg_connection = None
    
    def _handle_db_notification(self, connection, pid, channel, payload):
        """Generic handler for DB notifications"""
        try:
            data = json.loads(payload)
            # Standardize the event structure
            # Standardize the event structure matching Frontend expectations {type: '...', data: {...}}
            event = {
                "type": "db_update",
                "data": {
                    "table": channel,
                    "action": data.get("action"),
                    "data": data.get("data"),
                    "id": data.get("id")
                }
            }
            
            # Broadcast everything by default for this MVP
            # Refinement: In real app, check permissions or target specific users based on 'data'
            asyncio.create_task(self.broadcast(event))
            
        except Exception as e:
            print(f"Error handling DB notification on channel {channel}: {e}")

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

