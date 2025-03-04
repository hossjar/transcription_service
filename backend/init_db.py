from database import engine
import models

def init_db():
    models.Base.metadata.create_all(bind=engine)  # Creates tables if they don't exist

if __name__ == '__main__':
    init_db()
