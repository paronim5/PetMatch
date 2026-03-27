from typing import Callable, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class EventObserver:
    def update(self, event_type: str, data: Any):
        raise NotImplementedError

class Subject:
    def __init__(self):
        self._observers: Dict[str, List[EventObserver]] = {}

    def attach(self, event_type: str, observer: EventObserver):
        if event_type not in self._observers:
            self._observers[event_type] = []
        self._observers[event_type].append(observer)

    def detach(self, event_type: str, observer: EventObserver):
        if event_type in self._observers:
            self._observers[event_type].remove(observer)

    def notify(self, event_type: str, data: Any):
        if event_type in self._observers:
            for observer in self._observers[event_type]:
                observer.update(event_type, data)

# Singleton Event Bus
event_bus = Subject()

# Example Observer for Notifications
class NotificationService(EventObserver):
    def update(self, event_type: str, data: Any):
        logger.debug(f"NotificationService: Received event {event_type}")
        # Logic to send notification would go here

notification_service = NotificationService()
event_bus.attach("user_registered", notification_service)
