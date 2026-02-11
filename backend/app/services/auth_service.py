from typing import Optional
from sqlalchemy.orm import Session
from app.core.security import verify_password, create_access_token
from app.services.user_service import user_service
from app.domain.models import User
from app.domain.schemas import Token

class AuthService:
    def authenticate_user(self, db: Session, email: str, password: str) -> Optional[User]:
        user = user_service.get_user_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def login(self, db: Session, email: str, password: str) -> Optional[Token]:
        user = self.authenticate_user(db, email, password)
        if not user:
            return None
        access_token = create_access_token(data={"sub": user.email})
        
        # Check profile status
        profile_incomplete = not user.profile or not user.profile.date_of_birth or not user.phone_number_hash
        
        return Token(access_token=access_token, token_type="bearer", profile_incomplete=profile_incomplete)

auth_service = AuthService()
