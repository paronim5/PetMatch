import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings
from app.domain.models import Notification

def cleanup_notifications():
    # Fix: Convert PostgresDsn to string
    database_url = str(settings.SQLALCHEMY_DATABASE_URI)
    engine = create_engine(database_url)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("Checking for malformed 'message' notifications...")
        
        # Find message notifications with no related_message_id
        malformed = db.query(Notification).filter(
            Notification.notification_type == 'message',
            Notification.related_message_id == None
        ).all()
        
        count = len(malformed)
        if count > 0:
            print(f"Found {count} malformed notifications. Deleting...")
            for n in malformed:
                db.delete(n)
            db.commit()
            print("Deleted malformed notifications.")
        else:
            print("No malformed notifications found.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_notifications()