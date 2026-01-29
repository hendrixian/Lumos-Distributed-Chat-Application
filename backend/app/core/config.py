from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application
    app_name: str = "Distributed Chat App"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "chat_app"
    
    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""
    
    class Config:
        env_file = ".env"

settings = Settings()