# backend/init_db.py

from sqlalchemy import text
from database import engine
import models

def init_db():
    """
    Initializes the database by creating tables if they don't exist
    and altering the 'details' column in 'user_activities' from JSON to TEXT.
    """
    # Create all tables based on the models
    models.Base.metadata.create_all(bind=engine)
    print("All tables created or verified.")

    # Alter 'details' column in 'user_activities' table if it's of type JSON
    with engine.connect() as connection:
        # Check the current data type of the 'details' column
        result = connection.execute(
            text("""
                SELECT data_type
                FROM information_schema.columns
                WHERE table_name = 'user_activities' AND column_name = 'details';
            """)
        )
        column = result.fetchone()

        if column:
            current_type = column[0].lower()
            print(f"Current data type of 'details' column: {current_type}")

            if current_type == 'json' or current_type == 'jsonb':
                try:
                    # Alter the column type to TEXT
                    connection.execute(
                        text("""
                            ALTER TABLE user_activities
                            ALTER COLUMN details TYPE TEXT
                            USING details::TEXT;
                        """)
                    )
                    print("Successfully altered 'details' column to TEXT.")
                except Exception as e:
                    print(f"Error altering 'details' column: {e}")
            else:
                print("'details' column is already of type TEXT. No changes made.")
        else:
            print("The 'details' column does not exist in 'user_activities' table. No changes made.")

if __name__ == '__main__':
    init_db()
