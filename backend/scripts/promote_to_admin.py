# backend/scripts/promote_to_admin.py

import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models
import sys

def promote_user_to_admin(email: str):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.is_admin = True
            db.commit()
            print(f"User {email} has been promoted to admin.")
        else:
            print(f"No user found with email: {email}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python promote_to_admin.py user@example.com")
    else:
        promote_user_to_admin(sys.argv[1])
