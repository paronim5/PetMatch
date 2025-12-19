from typing import Optional
from sqlalchemy.orm import Session
from app.infrastructure.repositories.user import user_repository
from app.domain.schemas import UserCreate
from app.domain.models import User

class UserService:
    def create_user(self, db: Session, user_in: UserCreate) -> User:
        user = user_repository.get_by_email(db, email=user_in.email)
        if user:
            raise ValueError("User with this email already exists")
        if getattr(user_in, "username", None):
            existing_by_username = user_repository.get_by_username(db, username=user_in.username)
            if existing_by_username:
                raise ValueError("Username already exists")
        return user_repository.create(db, obj_in=user_in)

    def get_user_by_email(self, db: Session, email: str) -> Optional[User]:
        return user_repository.get_by_email(db, email=email)

    def get_user(self, db: Session, user_id: int) -> Optional[User]:
        return user_repository.get(db, id=user_id)

    def get_user_by_username(self, db: Session, username: str) -> Optional[User]:
        return user_repository.get_by_username(db, username=username)

user_service = UserService()
