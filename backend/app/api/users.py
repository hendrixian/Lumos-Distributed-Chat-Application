from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.auth import get_current_user
from app.core.database import mongodb
from app.core.image_utils import image_file_to_data_url
from app.core.ws_manager import manager as notification_ws_manager
from app.models.schemas import PublicUserProfile, PublicUserProfilesRequest, User

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
        {"username": 1, "avatar_url": 1, "_id": 0},
    ).limit(10)

    results = await cursor.to_list(length=10)
    return results


@router.post("/public/batch", response_model=list[PublicUserProfile])
async def get_public_profiles_batch(
    payload: PublicUserProfilesRequest,
    current_user: User = Depends(get_current_user),
):
    del current_user  # Keep endpoint authenticated; requester identity not needed below.

    usernames = []
    seen = set()
    for raw_username in payload.usernames:
        username = (raw_username or "").strip()
        if not username or username in seen:
            continue
        seen.add(username)
        usernames.append(username)

    if not usernames:
        return []

    users_col = mongodb.get_collection("users")
    docs = await users_col.find(
        {"username": {"$in": usernames}},
        {"username": 1, "bio": 1, "avatar_url": 1, "_id": 0},
    ).to_list(length=len(usernames))
    docs_by_username = {doc.get("username"): doc for doc in docs}

    # Preserve request order to keep frontend mapping deterministic.
    ordered_profiles = []
    for username in usernames:
        doc = docs_by_username.get(username)
        if not doc:
            continue
        ordered_profiles.append(
            PublicUserProfile(
                username=doc.get("username", username),
                bio=doc.get("bio", ""),
                avatar_url=doc.get("avatar_url", ""),
            )
        )

    return ordered_profiles


@router.get("/online/{username}")
async def get_user_online_status(
    username: str,
    current_user: User = Depends(get_current_user),
):
    del current_user

    target_username = (username or "").strip()
    if not target_username:
        raise HTTPException(status_code=400, detail="username is required")

    users_col = mongodb.get_collection("users")
    target_user = await users_col.find_one({"username": target_username}, {"_id": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "username": target_username,
        "online": notification_ws_manager.is_online(target_username),
    }


@router.get("/me", response_model=User)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    users_col = mongodb.get_collection("users")
    user_doc = await users_col.find_one({"username": current_user.username})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return User(
        username=user_doc["username"],
        email=user_doc.get("email", ""),
        bio=user_doc.get("bio", ""),
        avatar_url=user_doc.get("avatar_url", ""),
    )


@router.patch("/me", response_model=User)
async def update_my_profile(
    bio: str | None = Form(default=None),
    avatar: UploadFile | None = File(default=None),
    remove_avatar: bool = Form(default=False),
    current_user: User = Depends(get_current_user),
):
    users_col = mongodb.get_collection("users")
    user_doc = await users_col.find_one({"username": current_user.username})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_fields = {"updated_at": datetime.utcnow()}
    if bio is not None:
        update_fields["bio"] = bio.strip()
    if remove_avatar:
        update_fields["avatar_url"] = ""
    if avatar is not None:
        update_fields["avatar_url"] = await image_file_to_data_url(avatar)

    await users_col.update_one(
        {"username": current_user.username},
        {"$set": update_fields},
    )
    updated = await users_col.find_one({"username": current_user.username})

    return User(
        username=updated["username"],
        email=updated.get("email", ""),
        bio=updated.get("bio", ""),
        avatar_url=updated.get("avatar_url", ""),
    )
