# backend/schemas.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    id: int
    email: str
    name: str
    picture: Optional[str]
    is_admin: bool

    class Config:
        from_attributes = True
        
class User(UserBase):
    remaining_time: float
    expiration_date: Optional[datetime]  # Added expiration_date
    total_used_time: float
    successful_jobs: int
    failed_jobs: int
    last_login: Optional[datetime]

    class Config:
        from_attributes = True   
        
class UserListResponse(BaseModel):
    total: int
    users: List[User]

    class Config:
        orm_mode = True
        
class UpdateTimeRequest(BaseModel):
    amount: float

    class Config:
        orm_mode = True

class UploadedFileBase(BaseModel):
    id: int
    user_id: int
    filename: str
    filepath: str
    upload_time: datetime
    status: str
    transcription: Optional[str]
    transcription_job_id: Optional[str]
    output_format: str
    language: str
    media_duration: int

    class Config:
        orm_mode = True

class UploadedFile(UploadedFileBase):
    pass

class UserActivityBase(BaseModel):
    id: int
    user_id: int
    activity_type: str  # e.g., 'signup', 'login', 'logout'
    timestamp: datetime
    details: Optional[str]

    class Config:
        orm_mode = True

class UserActivity(UserActivityBase):
    pass

class UpdateTimeRequest(BaseModel):
    amount: float

    model_config = {
        "from_attributes": True
    }