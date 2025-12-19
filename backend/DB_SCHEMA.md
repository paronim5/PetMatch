# Database Schema Documentation

This document outlines the database schema for the PetMatch application.

## Core Tables

### `users`
Stores the main user account information.
- `id`: Primary Key
- `email`: User's email address (Unique)
- `password_hash`: Hashed password
- `username`: Unique username (3-50 chars)
- `subscription_tier`: Free, Premium, Premium Plus
- `status`: Active, Suspended, Banned
- `deleted_at`: Soft deletion timestamp

### `user_profiles`
Contains detailed user profile information.
- `user_id`: Foreign Key to `users`
- `first_name`, `surname`: User's real name
- `location`: PostGIS geography point for location-based matching
- `date_of_birth`: Used for age calculation
- `gender`: Male, Female, Non-binary, etc.
- `bio`, `occupation`, `education`: Profile details
- `height_value`, `height_unit`: Physical attributes

### `user_photos`
Stores user profile photos.
- `user_id`: Foreign Key to `users`
- `photo_url`: URL to the image
- `is_primary`: Boolean indicating the main profile picture
- `photo_order`: Integer for sorting

## Matching & Interaction

### `swipes`
Records user interactions (Like, Pass, Super Like).
- `swiper_id`: User performing the action
- `swiped_id`: Target user
- `swipe_type`: 'like', 'pass', 'super_like'
- `created_at`: Timestamp

### `matches`
Represents a mutual match between two users.
- `user1_id`, `user2_id`: The two users involved (ordered by ID)
- `matched_at`: When the match occurred
- `is_active`: True if the match is still valid (not unmatched)

## Messaging

### `messages`
Stores chat messages between matched users. **Partitioned by `created_at`**.
- `match_id`: Foreign Key to `matches`
- `sender_id`: User sending the message
- `message_text`: Content of the message
- `created_at`: Timestamp (part of Composite PK)

## Notifications

### `notifications`
Stores system notifications. **Partitioned by `created_at`**.
- `user_id`: Recipient of the notification
- `notification_type`: 'like', 'match', 'message', 'system'
- `title`, `message`: Notification content
- `is_read`: Read status
- `related_match_id`, `related_user_id`: Context links

## Support Tables

- `user_preferences`: Stores matching preferences (age range, distance, gender).
- `push_tokens`: Stores FCM tokens for mobile push notifications.
- `audit_logs`: Records important system actions for security/debugging.
- `reports`, `blocks`: User safety features.
