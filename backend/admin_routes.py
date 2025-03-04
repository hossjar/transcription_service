# backend/admin_routes.py

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
import models
from sqlalchemy import func
from database import get_db
from dependencies import get_current_user
from schemas import User as UserSchema, UserListResponse, UploadedFile as UploadedFileSchema, UserActivity as UserActivitySchema, UpdateTimeRequest
from datetime import datetime
from pydantic import BaseModel

admin_router = APIRouter(prefix="/admin", tags=["admin"])

class UpdateTimeRequest(BaseModel):
    amount: float

# Dependency to check if the current user is admin
def get_admin_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized as admin")
    return user

@admin_router.get("/users", response_model=UserListResponse)
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: models.User = Depends(get_admin_user)):
    total_users = db.query(func.count(models.User.id)).scalar()
    users = db.query(models.User).offset(skip).limit(limit).all()

    user_list = []
    for user in users:
        # Number of successful jobs
        successful_jobs = db.query(models.UploadedFile).filter(
            models.UploadedFile.user_id == user.id,
            models.UploadedFile.status == 'transcribed'
        ).count()

        # Number of unsuccessful (failed) jobs
        unsuccessful_jobs = db.query(models.UploadedFile).filter(
            models.UploadedFile.user_id == user.id,
            models.UploadedFile.status.in_(['error', 'failed'])
        ).count()

        # Total successful transcription duration (in seconds)
        total_duration_seconds = db.query(func.sum(models.UploadedFile.media_duration)).filter(
            models.UploadedFile.user_id == user.id,
            models.UploadedFile.status == 'transcribed'
        ).scalar() or 0

        # Convert to minutes
        total_duration_minutes = total_duration_seconds / 60.0

        # Last login date
        last_login_activity = db.query(models.UserActivity).filter(
            models.UserActivity.user_id == user.id,
            models.UserActivity.activity_type == 'login'
        ).order_by(models.UserActivity.timestamp.desc()).first()
        last_login = last_login_activity.timestamp if last_login_activity else None

        # Create a user schema instance with the additional fields
        user_schema = UserSchema(
            id=user.id,
            email=user.email,
            name=user.name,
            picture=user.picture,
            is_admin=user.is_admin,
            remaining_time=user.remaining_time,
            successful_jobs=successful_jobs,
            failed_jobs=unsuccessful_jobs,
            # We store minutes into total_used_time:
            total_used_time=total_duration_minutes,
            last_login=last_login
        )
        user_list.append(user_schema)
    return UserListResponse(total=total_users, users=user_list)

@admin_router.get("/users/{user_id}/files", response_model=List[UploadedFileSchema])
def get_user_files(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_admin_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user.files

@admin_router.get("/users/{user_id}/activities", response_model=List[UserActivitySchema])
def get_user_activities(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_admin_user)):
    activities = db.query(models.UserActivity).filter(models.UserActivity.user_id == user_id).order_by(models.UserActivity.timestamp.desc()).all()
    return activities

@admin_router.put("/users/{user_id}/time")
def update_user_time(
    user_id: int,
    request_body: UpdateTimeRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_admin_user)
):
    amount = request_body.amount  # Amount in minutes

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.remaining_time += amount  # No need to multiply by 60, we already store in minutes
    if user.remaining_time < 0:
        user.remaining_time = 0
    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "new_remaining_time": user.remaining_time}

@admin_router.get("/users/{user_id}/stats")
def get_user_stats(user_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_admin_user)):
    """
    Get user's total completed transcription duration.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    total_completed_duration = db.query(func.coalesce(func.sum(models.UploadedFile.media_duration), 0)).filter(
        models.UploadedFile.user_id == user.id,
        models.UploadedFile.status == 'transcribed'
    ).scalar() or 0
    return {"user_id": user.id, "total_completed_duration": total_completed_duration}
