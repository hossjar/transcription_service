# backend/models.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone
from enum import Enum

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    picture = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=False)
    remaining_time = Column(Float, default=10)  # Stored in minutes
    total_used_time = Column(Float, default=0)  # Total used transcription time in minutes
    successful_jobs = Column(Integer, default=0)
    failed_jobs = Column(Integer, default=0)
    last_login = Column(DateTime, nullable=True)
    is_admin = Column(Boolean, default=False)
    expiration_date = Column(DateTime, nullable=True)  # New field for expiration

    files = relationship("UploadedFile", back_populates="user")
    activities = relationship("UserActivity", back_populates="user")
    payment_transactions = relationship("PaymentTransaction", back_populates="user")

    @property
    def expiration_date_aware(self):
        if self.expiration_date:
            return self.expiration_date.replace(tzinfo=timezone.utc)
        return None

class UploadedFile(Base):
    __tablename__ = 'uploaded_files'

    id = Column(Integer, primary_key=True, index=True)
    is_video = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey('users.id'))
    filename = Column(String)
    filepath = Column(String)
    upload_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String)
    transcription = Column(Text, nullable=True)
    transcription_job_id = Column(String, nullable=True)
    output_format = Column(String, default='txt')
    language = Column(String, default='fa')
    media_duration = Column(Integer, default=0)  # Duration in seconds
    summary = Column(Text, nullable=True)  #  for summary

    user = relationship("User", back_populates="files")

class UserActivity(Base):
    __tablename__ = 'user_activities'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    activity_type = Column(String, nullable=False)  # e.g., 'signup', 'login', 'logout'
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(String, nullable=True)

    user = relationship("User", back_populates="activities")
    
class AdminUser(Base):
    __tablename__ = 'admin_users'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    # Add other necessary fields

    user = relationship("User")
    # Define relationships as needed

class AdminActivity(Base):
    __tablename__ = 'admin_activities'

    id = Column(Integer, primary_key=True, index=True)
    admin_user_id = Column(Integer, ForeignKey('admin_users.id'), nullable=False)
    activity_type = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(String, nullable=True)

    admin_user = relationship("AdminUser")

class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    CANCELED = "canceled"

class PaymentTransaction(Base):
    __tablename__ = 'payment_transactions'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    amount = Column(Float, nullable=False)  # Amount in Tomans
    hours_purchased = Column(Float, nullable=False)  # Time purchased in hours
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    authority = Column(String, nullable=True)  # Zarinpal authority token
    reference_id = Column(String, nullable=True)  # Zarinpal reference ID after successful payment
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with User model
    user = relationship("User", back_populates="payment_transactions")