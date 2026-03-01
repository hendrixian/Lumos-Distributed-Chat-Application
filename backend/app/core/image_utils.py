import base64

from fastapi import HTTPException, UploadFile, status

MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB
ALLOWED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
}


async def image_file_to_data_url(image: UploadFile) -> str:
    """
    Validate and convert an uploaded image file into a data URL string.
    """
    content_type = (image.content_type or "").lower()
    if content_type == "image/jpg":
        content_type = "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Use PNG, JPEG, WEBP, or GIF.",
        )

    data = await image.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image is empty.",
        )
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image too large. Max size is 2 MB.",
        )

    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"
