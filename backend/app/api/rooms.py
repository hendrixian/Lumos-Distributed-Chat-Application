from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Dict
from datetime import datetime
import uuid
from ..models.schemas import Room, RoomCreate, User
from .auth import get_current_user

router = APIRouter()

# In-memory room storage (replace with database in production)
rooms_db: Dict[str, dict] = {}

@router.post("/", response_model=Room)
async def create_room(room: RoomCreate, current_user: User = Depends(get_current_user)):
    room_id = str(uuid.uuid4())
    new_room = {
        "id": room_id,
        "name": room.name,
        "created_at": datetime.utcnow(),
        "created_by": current_user.username
    }
    rooms_db[room_id] = new_room
    return Room(**new_room)

@router.get("/", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    return [Room(**room) for room in rooms_db.values()]

@router.get("/{room_id}", response_model=Room)
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = rooms_db.get(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    return Room(**room)

@router.delete("/{room_id}")
async def delete_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = rooms_db.get(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    if room["created_by"] != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can delete the room"
        )
    
    del rooms_db[room_id]
    return {"message": "Room deleted successfully"}