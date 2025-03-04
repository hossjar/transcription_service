# backend/scripts/demote_admin.py

import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models
import sys

def demote_user_from_admin(email: str):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.is_admin = False
            db.commit()
            print(f"User {email} has been demoted from admin.")
        else:
            print(f"No user found with email: {email}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python demote_admin.py user@example.com")
    else:
        demote_user_from_admin(sys.argv[1])
