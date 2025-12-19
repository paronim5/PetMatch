from typing import Optional
from sqlalchemy.orm import Session
from app.infrastructure.repositories.base import BaseRepository
from app.domain.models import User
from app.domain.schemas import UserCreate, UserUpdate
from app.core.security import get_password_hash
import hashlib

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

user_repository = UserRepository(User)
