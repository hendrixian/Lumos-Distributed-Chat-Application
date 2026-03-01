"""
Authentication API endpoints
Handles user registration, login, and JWT token management
Uses MongoDB for user storage
"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from ..models.schemas import UserCreate, User, Token, TokenData
from ..core.config import settings
from ..core.database import mongodb

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# MongoDB collections
USERS_COLLECTION = "users"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password


def get_password_hash(password: str) -> str:
    """
    Hash a password using SHA256
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password
    """
    return hashlib.sha256(password.encode()).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Data to encode in token
        expires_delta: Token expiration time
        
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Get current authenticated user from JWT token
    
    Args:
        token: JWT token from request
        
    Returns:
        Current user
        
    Raises:
        HTTPException: If token is invalid
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    return await get_user_from_token(token, credentials_exception)


async def get_user_from_token(token: str, credentials_exception: Optional[HTTPException] = None) -> User:
    """
    Resolve a User from a raw JWT token string.
    Useful for contexts like WebSocket query params where Depends() isn't used.
    """
    if credentials_exception is None:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = await get_user_by_username(token_data.username)
    if user is None:
        raise credentials_exception

    return User(
        username=user["username"],
        email=user.get("email"),
        bio=user.get("bio", ""),
        avatar_url=user.get("avatar_url", ""),
    )


async def user_exists(username: str, email: str = None) -> bool:
    """
    Check if a user already exists in MongoDB
    
    Args:
        username: Username to check
        email: Email to check (optional)
        
    Returns:
        True if user exists, False otherwise
    """
    users_collection = mongodb.get_collection("users")
    
    # Check if username exists
    user_by_username = await users_collection.find_one({"username": username})
    if user_by_username:
        return True
    
    # Also check if email exists (if provided)
    if email:
        user_by_email = await users_collection.find_one({"email": email})
        if user_by_email:
            return True
    
    return False

async def create_user(username: str, email: str, hashed_password: str):
    """
    Create a new user in MongoDB
    
    Args:
        username: Username
        email: Email
        hashed_password: Hashed password
    """
    users_collection = mongodb.get_collection("users")
    user_document = {
        "username": username,
        "email": email,
        "bio": "",
        "avatar_url": "",
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await users_collection.insert_one(user_document)

async def get_user_by_username(username: str) -> Optional[dict]:
    """
    Get user by username from MongoDB
    
    Args:
        username: Username to find
        
    Returns:
        User document or None if not found
    """
    users_collection = mongodb.get_collection("users")
    user = await users_collection.find_one({"username": username})
    return user


@router.post("/register", response_model=User)
async def register(user: UserCreate):
    """
    Register a new user
    
    Args:
        user: User registration data
        
    Returns:
        Created user
        
    Raises:
        HTTPException: If username or email already exists
    """
    # Check if user already exists (by username or email)
    if await user_exists(user.username, user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Hash password and create user in MongoDB
    hashed_password = get_password_hash(user.password)
    await create_user(user.username, user.email, hashed_password)
    
    return User(username=user.username, email=user.email)


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login and receive JWT token
    
    Args:
        form_data: Login form data (username, password)
        
    Returns:
        Access token
        
    Raises:
        HTTPException: If credentials are invalid
    """
    user = await get_user_by_username(form_data.username)
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"]}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    #Get current user information
    db_user = await get_user_by_username(current_user.username)
    return User(
        username=db_user["username"],
        email=db_user.get("email", ""),
        bio=db_user.get("bio", ""),
        avatar_url=db_user.get("avatar_url", ""),
    )
