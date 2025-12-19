from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.infrastructure.repositories.base import BaseRepository
from app.domain.models import User
from app.domain.schemas import UserCreate, UserUpdate
from app.core.security import get_password_hash
import hashlib
import secrets

class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def get_by_username(self, db: Session, *, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        # Hash phone number for privacy
        phone_hash = None
        if getattr(obj_in, "phone_number", None):
            phone_hash = hashlib.sha256(obj_in.phone_number.encode("utf-8")).hexdigest()
        db_obj = User(
            email=obj_in.email,
            username=getattr(obj_in, "username", None),
            password_hash=get_password_hash(obj_in.password),
            phone_number_hash=phone_hash,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_social_user(self, db: Session, *, email: str) -> User:
        # Generate username using DB function
        username = db.execute(text("SELECT generate_username_from_email(:email)"), {"email": email}).scalar()
        
        # Create user with dummy password (since it's NOT NULL)
        dummy_password = secrets.token_urlsafe(32)
        password_hash = get_password_hash(dummy_password)
        
        db_obj = User(
            email=email,
            username=username,
            password_hash=password_hash,
            is_verified=True,
            status='active'
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

user_repository = UserRepository(User)
