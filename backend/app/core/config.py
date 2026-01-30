from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application
    app_name: str = "Distributed Chat App"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    mongodb_url: str
    mongodb_db_name: str

    redis_host: str
    redis_port: int
    redis_password: str 
    redis_db: int = 0
    
    class Config:
        env_file = ".env"

settings = Settings()