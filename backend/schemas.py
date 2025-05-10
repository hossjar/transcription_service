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
    expiration_date: Optional[datetime]
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
        from_attributes = True

class UpdateTimeRequest(BaseModel):
    amount: float
    class Config:
        from_attributes = True

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
        from_attributes = True

class UploadedFile(UploadedFileBase):
    pass

class UserActivityBase(BaseModel):
    id: int
    user_id: int
    activity_type: str
    timestamp: datetime
    details: Optional[str]
    class Config:
        from_attributes = True

class UserActivity(UserActivityBase):
    pass

class PurchaseTimeRequest(BaseModel):
    hours: float
    discount_code: Optional[str] = None

class ValidateDiscountRequest(BaseModel):
    hours: float
    discount_code: str

class ValidateDiscountResponse(BaseModel):
    is_valid: bool
    message: str
    original_price: Optional[float] = None
    discount_amount: Optional[float] = None
    discounted_price: Optional[float] = None
    final_amount: Optional[float] = None

class DiscountCodeBase(BaseModel):
    code: str
    discount_percent: float
    max_discount_amount: float
    total_usage_limit: int
    expiration_date: datetime
    is_active: bool

class DiscountCodeCreate(DiscountCodeBase):
    pass

class DiscountCodeUpdate(BaseModel):
    discount_percent: Optional[float] = None
    max_discount_amount: Optional[float] = None
    total_usage_limit: Optional[int] = None
    expiration_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class DiscountCode(DiscountCodeBase):
    id: int
    times_used: int
    created_at: datetime
    class Config:
        from_attributes = True