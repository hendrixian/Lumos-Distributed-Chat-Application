from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.core.database import mongodb
from app.models.schemas import User

router = APIRouter()


@router.get("/search")
async def search_users(username: str, current_user: User = Depends(get_current_user)):
    query = username.strip()
    if not query:
        raise HTTPException(status_code=400, detail="username query is required")

    users_col = mongodb.get_collection("users")
    cursor = users_col.find(
        {
            "$and": [
                {"username": {"$regex": query, "$options": "i"}},
                {"username": {"$ne": current_user.username}},
            ]
        },
        {"username": 1, "_id": 0},
    ).limit(10)

    results = await cursor.to_list(length=10)
    return results
