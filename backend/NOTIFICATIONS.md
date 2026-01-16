# Notification Service Documentation

## Overview
The Notification Service manages real-time and push notifications for the PetMatch application. It supports the following event types:
1. **Like**: When a user receives a like.
2. **Super-like**: When a user receives a super-like.
3. **Message**: When a user receives a new chat message.
4. **Match**: When two users match.

## Architecture
The service uses a hybrid approach:
- **In-App Real-time**: Uses an `EventBus` to publish events to connected clients via WebSocket (handled by `websocket_manager.py`).
- **Push Notifications**: Uses Firebase Cloud Messaging (FCM) to send push notifications to mobile devices.

## Configuration
To enable Push Notifications, you must provide Firebase Admin credentials:
- **Environment Variable**: `GOOGLE_APPLICATION_CREDENTIALS` pointing to the JSON key file.
- **Default Path**: `firebase-service-account.json` in the root directory.

If credentials are missing, the service falls back to a mock mode (logs only) to prevent crashes during development.

## Error Handling & Logging
The service has been enhanced to ensure robustness:
- **Database Consistency**: Notification records are created transactionally.
- **FCM Failures**: Failures to send push notifications do NOT roll back the database transaction. They are logged as errors but the system proceeds (best-effort delivery).
- **Logging**: All failures (FCM, EventBus) are logged with stack traces for debugging.

## Event Triggers
- **Likes/Super-likes**: Triggered in `app.api.v1.endpoints.matching.create_swipe`.
- **Messages**: Triggered in `app.services.messaging_service.MessagingService.send_message`.
- **Matches**: Triggered in `app.api.v1.endpoints.matching.create_swipe` when a mutual like is detected.

## Testing
Automated tests are located in `backend/tests/test_notifications.py`. Run them using:
```bash
# Windows (Powershell)
$env:PYTHONPATH="backend"; py backend/tests/test_notifications.py

# Linux/Mac
PYTHONPATH=backend python backend/tests/test_notifications.py
```
