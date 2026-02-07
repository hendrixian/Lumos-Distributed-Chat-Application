#this code file is added by thu for searching user to add contact
from fastapi import APIRouter, Depends, HTTPException
from app.core.database import mongodb
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/search")
async def search_user(username: str, current_user=Depends(get_current_user)):
    users_col = mongodb.get_collection("users")

    user = await users_col.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # prevent returning yourself
    if user["username"] == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    return {
        "username": user["username"]
    }
