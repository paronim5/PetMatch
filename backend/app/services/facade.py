from sqlalchemy.orm import Session
from app.domain.schemas import UserCreate
from app.services.user_service import user_service
from app.domain.events import event_bus
from app.core.decorators import log_execution_time

class UserManagementFacade:
    """
    Facade to simplify complex user management interactions.
    Handles creation, notification, and initial setup.
    """

    @log_execution_time
    def register_new_user(self, db: Session, user_in: UserCreate):
        # 1. Create the user
        user = user_service.create_user(db, user_in=user_in)
        
        # 2. Trigger events (Observer Pattern)
        event_bus.notify("user_registered", {"user_id": user.id, "email": user.email})
        
        # 3. Any other complex setup (e.g. creating default preferences, sending welcome email) can be orchestrated here
        # This keeps the controller/API layer clean.
        
        return user

user_facade = UserManagementFacade()
