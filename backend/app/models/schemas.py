from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str

class User(BaseModel):
    username: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class RoomCreate(BaseModel):
    name: str

class Room(BaseModel):
    id: str
    name: str
    created_at: datetime
    created_by: str

class Message(BaseModel):
    room_id: str
    username: str
    content: str
    timestamp: datetime

class ChatMessage(BaseModel):
    type: str  # "message", "user_joined", "user_left"
    room_id: str
    username: str
    content: str
    timestamp: str