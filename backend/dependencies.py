# backend/dependencies.py

from fastapi import Request, Depends
from sqlalchemy.orm import Session
from models import User
from database import get_db

def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get('user_id')
    if user_id is None:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user
