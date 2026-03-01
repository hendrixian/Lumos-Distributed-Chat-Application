from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class User(BaseModel):
    username: str
    email: Optional[str] = ""
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    visibility: Optional[str] = "public"

class RoomMemberAdd(BaseModel):
    username: str

class Room(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    visibility: str = "public"
    avatar_url: Optional[str] = ""
    created_at: datetime
    created_by: str
    type: str = "group"
    members: List[str] = []  # List of usernames currently in the room

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
