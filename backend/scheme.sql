
-- 1. Add username to users table (must be unique)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Add constraint for username format (alphanumeric, underscore, hyphen only)
ALTER TABLE users 
ADD CONSTRAINT valid_username 
CHECK (username IS NULL OR username ~* '^[a-zA-Z0-9_-]{3,50}$');

-- Add index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;

-- 2. Add surname to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS surname VARCHAR(100);

-- 3. Optional: Make username NOT NULL after giving users time to set it
-- Uncomment this after all existing users have set their usernames:
-- ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- 4. Optional: Create a unique constraint that ignores soft-deleted users
-- This is already handled by the index above, but you can add explicit constraint:
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active 
ON users(LOWER(username)) 
WHERE deleted_at IS NULL;

-- Drop the simpler unique constraint if you want case-insensitive uniqueness
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- 5. Optional: Add a function to generate unique usernames from email
CREATE OR REPLACE FUNCTION generate_username_from_email(p_email VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    base_username VARCHAR;
    final_username VARCHAR;
    counter INTEGER := 1;
BEGIN
    -- Extract username part from email (before @)
    base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(p_email, '@', 1), '[^a-z0-9_-]', '', 'g'));
    
    -- Ensure minimum length
    IF LENGTH(base_username) < 3 THEN
        base_username := base_username || '123';
    END IF;
    
    -- Truncate if too long
    IF LENGTH(base_username) > 45 THEN
        base_username := SUBSTRING(base_username, 1, 45);
    END IF;
    
    final_username := base_username;
    
    -- Check if username exists and add number suffix if needed
    WHILE EXISTS (SELECT 1 FROM users WHERE username = final_username AND deleted_at IS NULL) LOOP
        final_username := base_username || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_username;
END;
$$ LANGUAGE plpgsql;

-- 6. Optional: Populate usernames for existing users (if any)
-- This will generate usernames from emails for users who don't have one yet
UPDATE users 
SET username = generate_username_from_email(email)
WHERE username IS NULL AND deleted_at IS NULL;

-- 7. Optional: After all users have usernames, make it required
-- ALTER TABLE users ALTER COLUMN username SET NOT NULL;

COMMENT ON COLUMN users.username IS 'Unique username for the user, 3-50 characters, alphanumeric with underscore/hyphen';
COMMENT ON COLUMN user_profiles.surname IS 'User last name/surname/family name';

-- Verification queries to check the changes
-- Run these to verify everything worked:
/*
-- Check if columns were added
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name IN ('users', 'user_profiles') 
  AND column_name IN ('username', 'surname');

-- Check constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'users' AND constraint_name LIKE '%username%';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users' AND indexname LIKE '%username%';

-- Sample query to see the new fields
SELECT id, email, username, subscription_tier 
FROM users 
LIMIT 5;

SELECT id, user_id, first_name, surname, date_of_birth
FROM user_profiles
LIMIT 5;
*/
-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS postgis;

DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say');
    CREATE TYPE swipe_type AS ENUM ('like', 'pass', 'super_like');
    CREATE TYPE relationship_goal_type AS ENUM ('relationship', 'casual', 'friendship', 'undecided');
    CREATE TYPE smoking_type AS ENUM ('never', 'occasionally', 'regularly', 'prefer_not_to_say');
    CREATE TYPE drinking_type AS ENUM ('never', 'occasionally', 'regularly', 'prefer_not_to_say');
    CREATE TYPE user_status_type AS ENUM ('active', 'suspended', 'banned', 'deactivated');
    CREATE TYPE report_status_type AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');
    CREATE TYPE subscription_tier_type AS ENUM ('free', 'premium', 'premium_plus');
    CREATE TYPE notification_priority_type AS ENUM ('high', 'medium', 'low');
    CREATE TYPE location_privacy_type AS ENUM ('exact', 'approximate', 'hidden');
    CREATE TYPE height_unit_type AS ENUM ('cm', 'feet_inches');
    CREATE TYPE deal_breaker_type AS ENUM ('smoking', 'drinking', 'has_children', 'wants_children', 'different_religion', 'long_distance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CORE TABLES

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP,
    status user_status_type DEFAULT 'active',
    is_verified BOOLEAN DEFAULT FALSE,
    subscription_tier subscription_tier_type DEFAULT 'free',
    deleted_at TIMESTAMP,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender gender_type,
    bio TEXT,
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_country VARCHAR(100),
    location GEOGRAPHY(POINT, 4326),
    location_privacy location_privacy_type DEFAULT 'approximate',
    height_value INTEGER,
    height_unit height_unit_type DEFAULT 'cm',
    education VARCHAR(100),
    occupation VARCHAR(100),
    relationship_goal relationship_goal_type,
    smoking smoking_type,
    drinking drinking_type,
    has_children BOOLEAN,
    wants_children BOOLEAN,
    locale VARCHAR(10) DEFAULT 'en_US',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT valid_height_cm CHECK (height_unit != 'cm' OR height_value IS NULL OR (height_value >= 100 AND height_value <= 250)),
    CONSTRAINT valid_height_inches CHECK (height_unit != 'feet_inches' OR height_value IS NULL OR (height_value >= 36 AND height_value <= 96))
);

CREATE TABLE IF NOT EXISTS user_photos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    photo_order INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT valid_photo_order CHECK (photo_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_photos_primary_unique 
ON user_photos(user_id) 
WHERE is_primary = TRUE AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS interests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50),
    locale VARCHAR(10) DEFAULT 'en_US'
);

CREATE TABLE IF NOT EXISTS user_interests (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id INTEGER NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, interest_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    min_age INTEGER,
    max_age INTEGER,
    max_distance INTEGER,
    preferred_genders gender_type[],
    deal_breakers deal_breaker_type[],
    notify_likes BOOLEAN DEFAULT TRUE,
    notify_matches BOOLEAN DEFAULT TRUE,
    notify_messages BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_age_range CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
    CONSTRAINT valid_min_age CHECK (min_age IS NULL OR min_age >= 18),
    CONSTRAINT valid_max_age CHECK (max_age IS NULL OR max_age <= 100),
    CONSTRAINT valid_distance CHECK (max_distance IS NULL OR max_distance > 0)
);

-- 3. LOGIC & LIMITS

CREATE TABLE IF NOT EXISTS tier_limits (
    id SERIAL PRIMARY KEY,
    tier subscription_tier_type UNIQUE NOT NULL,
    daily_swipe_limit INTEGER,
    daily_super_likes INTEGER,
    profile_views_visible BOOLEAN DEFAULT FALSE,
    can_see_who_liked BOOLEAN DEFAULT FALSE,
    ad_free BOOLEAN DEFAULT FALSE,
    rewind_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tier_limits (tier, daily_swipe_limit, daily_super_likes, profile_views_visible, can_see_who_liked, ad_free, rewind_enabled) 
VALUES
('free', 50, 1, FALSE, FALSE, FALSE, FALSE),
('premium', NULL, 5, TRUE, TRUE, TRUE, TRUE),
('premium_plus', NULL, NULL, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier subscription_tier_type NOT NULL,
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    auto_renew BOOLEAN DEFAULT TRUE,
    payment_method VARCHAR(50),
    amount DECIMAL(12, 4),
    currency VARCHAR(3) DEFAULT 'USD',
    external_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_subscription_dates CHECK (end_date IS NULL OR end_date > start_date)
);

CREATE TABLE IF NOT EXISTS daily_swipe_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    swipe_count INTEGER DEFAULT 0,
    super_like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_swipe_count CHECK (swipe_count >= 0),
    CONSTRAINT valid_super_like_count CHECK (super_like_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_swipe_limits_user_date ON daily_swipe_limits(user_id, date);

-- 4. INTERACTIONS

CREATE TABLE IF NOT EXISTS swipes (
    id SERIAL PRIMARY KEY,
    swiper_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swipe_type swipe_type NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_swipe CHECK (swiper_id != swiped_id)
);

CREATE INDEX IF NOT EXISTS idx_swipes_lookup ON swipes(swiper_id, swiped_id);

CREATE TABLE IF NOT EXISTS profile_views (
    id SERIAL PRIMARY KEY,
    viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_view CHECK (viewer_id != viewed_id)
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    unmatched_by INTEGER REFERENCES users(id),
    unmatched_at TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT ordered_users CHECK (user1_id < user2_id),
    CONSTRAINT no_self_match CHECK (user1_id != user2_id),
    UNIQUE (user1_id, user2_id)
);

-- 5. MESSAGING (PARTITIONED)
-- FIX: Primary Key includes 'created_at' to satisfy partitioning requirements

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT,
    media_url VARCHAR(500),
    reply_to_message_id INTEGER, -- Removed FK for now to avoid circular complexity with partitions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL),
    PRIMARY KEY (id, created_at) -- Composite PK required for partitioning
) PARTITION BY RANGE (created_at);

-- Partitions
CREATE TABLE IF NOT EXISTS messages_2025_01 PARTITION OF messages FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS messages_2025_02 PARTITION OF messages FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Message Reactions
-- FIX: Must reference composite key (id, created_at)
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    message_created_at TIMESTAMP NOT NULL, -- Added to support FK
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (message_id, user_id, reaction_emoji),
    FOREIGN KEY (message_id, message_created_at) REFERENCES messages(id, created_at) ON DELETE CASCADE
);

-- Message Reads
-- FIX: Must reference composite key (id, created_at)
CREATE TABLE IF NOT EXISTS message_reads (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    message_created_at TIMESTAMP NOT NULL, -- Added to support FK
    reader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (message_id, reader_id),
    FOREIGN KEY (message_id, message_created_at) REFERENCES messages(id, created_at) ON DELETE CASCADE
);

-- 6. SUPPORT TABLES

-- Notifications (PARTITIONED)
-- FIX: Primary Key includes 'created_at'
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    priority notification_priority_type DEFAULT 'medium',
    title VARCHAR(200),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    related_user_id INTEGER REFERENCES users(id),
    related_match_id INTEGER REFERENCES matches(id),
    
    -- Foreign Key to Messages (Composite)
    related_message_id INTEGER,
    related_message_created_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    deleted_at TIMESTAMP,
    PRIMARY KEY (id, created_at),
    FOREIGN KEY (related_message_id, related_message_created_at) REFERENCES messages(id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS notifications_2025_01 PARTITION OF notifications FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Audit Logs (PARTITIONED)
-- FIX: Primary Key includes 'created_at'
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for audit_logs (example: monthly partitions)
CREATE TABLE IF NOT EXISTS audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Index for JSONB queries in audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN(details);

-- ==========================================
-- OPTIMIZATION INDEXES (Added for Notification Performance)
-- ==========================================

-- Notification Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_lookup ON notifications(user_id, is_read, created_at DESC);

-- Message Indexes
CREATE INDEX IF NOT EXISTS idx_messages_match_created ON messages(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Match Indexes
CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_active_user1 ON matches(user1_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_matches_active_user2 ON matches(user2_id) WHERE is_active = TRUE;

-- Swipe Indexes
CREATE INDEX IF NOT EXISTS idx_swipes_lookup ON swipes(swiper_id, swiped_id);
CREATE INDEX IF NOT EXISTS idx_swipes_incoming_likes ON swipes(swiped_id, swipe_type) WHERE swipe_type IN ('like', 'super_like');

CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token VARCHAR(500) NOT NULL,
    device_type VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, device_token)
);

CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
    UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status report_status_type DEFAULT 'pending',
    resolver_id INTEGER REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    CONSTRAINT no_self_report CHECK (reporter_id != reported_id)
);

-- 7. FUNCTIONS & TRIGGERS

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Age Validation (Trigger instead of Constraint)
CREATE OR REPLACE FUNCTION validate_age_18()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years') THEN
        RAISE EXCEPTION 'User must be at least 18 years old.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_age BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION validate_age_18();

-- Unique Active Swipe (Trigger instead of Constraint)
CREATE OR REPLACE FUNCTION validate_unique_active_swipe()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM swipes 
        WHERE swiper_id = NEW.swiper_id 
          AND swiped_id = NEW.swiped_id 
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          AND id != COALESCE(NEW.id, -1)
    ) THEN
        RAISE EXCEPTION 'An active swipe already exists for this user pair.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_unique_active_swipe BEFORE INSERT ON swipes
FOR EACH ROW EXECUTE FUNCTION validate_unique_active_swipe();

-- Handle unmatch
CREATE OR REPLACE FUNCTION handle_unmatch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unmatched_by IS NOT NULL AND OLD.unmatched_by IS NULL THEN
        NEW.is_active = FALSE;
        NEW.unmatched_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_unmatch BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION handle_unmatch();

-- Helper: Calculate Age (STABLE)
CREATE OR REPLACE FUNCTION calculate_age(dob DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN DATE_PART('year', AGE(CURRENT_DATE, dob));
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. INDEXES & VIEWS

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_location ON user_profiles USING GIST(location) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_dob ON user_profiles(date_of_birth) WHERE deleted_at IS NULL;
CREATE INDEX idx_matches_user1 ON matches(user1_id) WHERE is_active = TRUE;
CREATE INDEX idx_matches_user2 ON matches(user2_id) WHERE is_active = TRUE;
CREATE INDEX idx_swipes_swiper ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped ON swipes(swiped_id);
CREATE INDEX idx_user_interests_user ON user_interests(user_id);
CREATE INDEX idx_user_interests_interest ON user_interests(interest_id);

CREATE VIEW user_active_matches AS
SELECT 
    m.id as match_id,
    m.user1_id,
    m.user2_id,
    m.matched_at,
    CASE 
        WHEN m.user1_id = u.id THEN m.user2_id
        ELSE m.user1_id
    END as other_user_id
FROM matches m
CROSS JOIN users u
WHERE m.is_active = TRUE 
  AND m.deleted_at IS NULL
  AND (m.user1_id = u.id OR m.user2_id = u.id)
  AND u.deleted_at IS NULL;

CREATE MATERIALIZED VIEW potential_matches AS
SELECT 
    u1.id as user_id,
    u2.id as potential_match_id,
    ST_Distance(up1.location, up2.location) / 1000 AS distance_km,
    calculate_age(up2.date_of_birth) AS match_age,
    COALESCE(
        ARRAY_AGG(DISTINCT ui2.interest_id) FILTER (WHERE ui1.interest_id = ui2.interest_id AND ui2.interest_id IS NOT NULL),
        ARRAY[]::INTEGER[]
    ) as shared_interests
FROM users u1
JOIN user_profiles up1 ON u1.id = up1.user_id
JOIN user_preferences pref ON u1.id = pref.user_id
JOIN users u2 ON u1.id != u2.id
JOIN user_profiles up2 ON u2.id = up2.user_id
LEFT JOIN user_interests ui1 ON u1.id = ui1.user_id
LEFT JOIN user_interests ui2 ON u2.id = ui2.user_id AND ui1.interest_id = ui2.interest_id
WHERE u1.status = 'active' AND u1.deleted_at IS NULL
    AND u2.status = 'active' AND u2.deleted_at IS NULL
    AND up1.deleted_at IS NULL AND up2.deleted_at IS NULL
    AND up2.gender = ANY(pref.preferred_genders)
    -- Optimized Age Calculation
    AND up2.date_of_birth <= (CURRENT_DATE - (COALESCE(pref.min_age, 18) || ' years')::INTERVAL)
    AND up2.date_of_birth >= (CURRENT_DATE - (COALESCE(pref.max_age, 100) || ' years')::INTERVAL)
    AND (pref.max_distance IS NULL OR ST_DWithin(up1.location, up2.location, pref.max_distance * 1000))
    AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = u1.id AND s.swiped_id = u2.id AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP))
    AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = u1.id AND blocked_id = u2.id) OR (blocker_id = u2.id AND blocked_id = u1.id))
GROUP BY u1.id, u2.id, up1.location, up2.location, up2.date_of_birth;

CREATE INDEX idx_potential_matches_user ON potential_matches(user_id, distance_km);


-- -- Dating App Database Schema - Production-Ready Version
-- -- This schema is designed for PostgreSQL with PostGIS extension

-- -- Enable PostGIS extension for geospatial queries
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- -- Create ENUM types for consistency and data validation
-- CREATE TYPE gender_type AS ENUM ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say');
-- CREATE TYPE swipe_type AS ENUM ('like', 'pass', 'super_like');
-- CREATE TYPE relationship_goal_type AS ENUM ('relationship', 'casual', 'friendship', 'undecided');
-- CREATE TYPE smoking_type AS ENUM ('never', 'occasionally', 'regularly', 'prefer_not_to_say');
-- CREATE TYPE drinking_type AS ENUM ('never', 'occasionally', 'regularly', 'prefer_not_to_say');
-- CREATE TYPE user_status_type AS ENUM ('active', 'suspended', 'banned', 'deactivated');
-- CREATE TYPE report_status_type AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');
-- CREATE TYPE subscription_tier_type AS ENUM ('free', 'premium', 'premium_plus');
-- CREATE TYPE notification_priority_type AS ENUM ('high', 'medium', 'low');
-- CREATE TYPE location_privacy_type AS ENUM ('exact', 'approximate', 'hidden');
-- CREATE TYPE height_unit_type AS ENUM ('cm', 'feet_inches');
-- CREATE TYPE deal_breaker_type AS ENUM ('smoking', 'drinking', 'has_children', 'wants_children', 'different_religion', 'long_distance');

-- -- Users table - stores basic user information
-- CREATE TABLE users (
--     id SERIAL PRIMARY KEY,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     phone_number_hash VARCHAR(255), -- hashed for privacy
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     last_active TIMESTAMP,
--     status user_status_type DEFAULT 'active',
--     is_verified BOOLEAN DEFAULT FALSE,
--     subscription_tier subscription_tier_type DEFAULT 'free',
--     deleted_at TIMESTAMP, -- soft delete
--     CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
-- );

-- -- User profiles table - stores detailed profile information
-- CREATE TABLE user_profiles (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     first_name VARCHAR(100) NOT NULL,
--     date_of_birth DATE NOT NULL,
--     gender gender_type,
--     bio TEXT,
--     location_city VARCHAR(100),
--     location_state VARCHAR(100),
--     location_country VARCHAR(100),
--     location GEOGRAPHY(POINT, 4326), -- PostGIS geography type for accurate distance calculations
--     location_privacy location_privacy_type DEFAULT 'approximate',
--     height_value INTEGER, -- numeric value
--     height_unit height_unit_type DEFAULT 'cm',
--     education VARCHAR(100),
--     occupation VARCHAR(100),
--     relationship_goal relationship_goal_type,
--     smoking smoking_type,
--     drinking drinking_type,
--     has_children BOOLEAN,
--     wants_children BOOLEAN,
--     locale VARCHAR(10) DEFAULT 'en_US', -- for internationalization
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     deleted_at TIMESTAMP, -- soft delete
--     CONSTRAINT valid_dob CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '18 years'),
--     CONSTRAINT valid_height_cm CHECK (height_unit != 'cm' OR height_value IS NULL OR (height_value >= 100 AND height_value <= 250)),
--     CONSTRAINT valid_height_inches CHECK (height_unit != 'feet_inches' OR height_value IS NULL OR (height_value >= 36 AND height_value <= 96))
-- );

-- -- User photos table - stores multiple photos per user
-- CREATE TABLE user_photos (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     photo_url VARCHAR(500) NOT NULL,
--     is_primary BOOLEAN DEFAULT FALSE,
--     photo_order INTEGER DEFAULT 0,
--     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     deleted_at TIMESTAMP, -- soft delete
--     CONSTRAINT valid_photo_order CHECK (photo_order >= 0)
-- );

-- -- Ensure only one primary photo per user
-- CREATE UNIQUE INDEX idx_user_photos_primary_unique 
-- ON user_photos(user_id) 
-- WHERE is_primary = TRUE AND deleted_at IS NULL;

-- -- User interests/hobbies table
-- CREATE TABLE interests (
--     id SERIAL PRIMARY KEY,
--     name VARCHAR(100) UNIQUE NOT NULL,
--     category VARCHAR(50), -- e.g., 'sports', 'arts', 'music', 'food'
--     locale VARCHAR(10) DEFAULT 'en_US'
-- );

-- -- Junction table for users and their interests
-- CREATE TABLE user_interests (
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     interest_id INTEGER NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
--     added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     PRIMARY KEY (user_id, interest_id)
-- );

-- -- User preferences table - stores what users are looking for
-- CREATE TABLE user_preferences (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     min_age INTEGER,
--     max_age INTEGER,
--     max_distance INTEGER, -- in kilometers
--     preferred_genders gender_type[],
--     deal_breakers deal_breaker_type[],
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT valid_age_range CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
--     CONSTRAINT valid_min_age CHECK (min_age IS NULL OR min_age >= 18),
--     CONSTRAINT valid_max_age CHECK (max_age IS NULL OR max_age <= 100),
--     CONSTRAINT valid_distance CHECK (max_distance IS NULL OR max_distance > 0)
-- );

-- -- Tier limits configuration table - makes swipe limits configurable
-- CREATE TABLE tier_limits (
--     id SERIAL PRIMARY KEY,
--     tier subscription_tier_type UNIQUE NOT NULL,
--     daily_swipe_limit INTEGER, -- NULL means unlimited
--     daily_super_likes INTEGER,
--     profile_views_visible BOOLEAN DEFAULT FALSE,
--     can_see_who_liked BOOLEAN DEFAULT FALSE,
--     ad_free BOOLEAN DEFAULT FALSE,
--     rewind_enabled BOOLEAN DEFAULT FALSE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Insert default tier limits
-- INSERT INTO tier_limits (tier, daily_swipe_limit, daily_super_likes, profile_views_visible, can_see_who_liked, ad_free, rewind_enabled) VALUES
-- ('free', 50, 1, FALSE, FALSE, FALSE, FALSE),
-- ('premium', NULL, 5, TRUE, TRUE, TRUE, TRUE),
-- ('premium_plus', NULL, NULL, TRUE, TRUE, TRUE, TRUE);

-- -- Subscriptions table - manages premium features and billing
-- CREATE TABLE subscriptions (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     tier subscription_tier_type NOT NULL,
--     start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     end_date TIMESTAMP,
--     is_active BOOLEAN DEFAULT TRUE,
--     auto_renew BOOLEAN DEFAULT TRUE,
--     payment_method VARCHAR(50),
--     amount DECIMAL(12, 4), -- increased precision for micro-currencies
--     currency VARCHAR(3) DEFAULT 'USD',
--     external_payment_id VARCHAR(255), -- Stripe/PayPal transaction ID
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT valid_subscription_dates CHECK (end_date IS NULL OR end_date > start_date)
-- );

-- -- Daily swipe limits table - tracks swipes for users
-- CREATE TABLE daily_swipe_limits (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     date DATE NOT NULL DEFAULT CURRENT_DATE,
--     swipe_count INTEGER DEFAULT 0,
--     super_like_count INTEGER DEFAULT 0,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT valid_swipe_count CHECK (swipe_count >= 0),
--     CONSTRAINT valid_super_like_count CHECK (super_like_count >= 0)
-- );

-- -- Use UPSERT to avoid race conditions
-- CREATE UNIQUE INDEX idx_daily_swipe_limits_user_date ON daily_swipe_limits(user_id, date);

-- -- Swipes/Likes table - tracks user interactions
-- CREATE TABLE swipes (
--     id SERIAL PRIMARY KEY,
--     swiper_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     swiped_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     swipe_type swipe_type NOT NULL,
--     expires_at TIMESTAMP, -- optional: allow reswipes after expiration
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT no_self_swipe CHECK (swiper_id != swiped_id)
-- );

-- -- Allow reswipes after expiration
-- CREATE UNIQUE INDEX idx_swipes_unique_active 
-- ON swipes(swiper_id, swiped_id) 
-- WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

-- -- Profile views table - tracks who viewed whose profile
-- CREATE TABLE profile_views (
--     id SERIAL PRIMARY KEY,
--     viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     viewed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT no_self_view CHECK (viewer_id != viewed_id)
-- );

-- -- Partition by date for better performance
-- CREATE INDEX idx_profile_views_viewed ON profile_views(viewed_id, viewed_at DESC);
-- CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_id, viewed_at DESC);

-- -- Matches table - stores mutual likes
-- CREATE TABLE matches (
--     id SERIAL PRIMARY KEY,
--     user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     is_active BOOLEAN DEFAULT TRUE,
--     unmatched_by INTEGER REFERENCES users(id),
--     unmatched_at TIMESTAMP,
--     deleted_at TIMESTAMP, -- soft delete
--     CONSTRAINT ordered_users CHECK (user1_id < user2_id),
--     CONSTRAINT no_self_match CHECK (user1_id != user2_id),
--     UNIQUE (user1_id, user2_id)
-- );

-- -- Messages table - stores chat messages between matches
-- CREATE TABLE messages (
--     id SERIAL PRIMARY KEY,
--     match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
--     sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     message_text TEXT,
--     media_url VARCHAR(500),
--     reply_to_message_id INTEGER REFERENCES messages(id), -- for threading
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     deleted_at TIMESTAMP, -- soft delete
--     CONSTRAINT message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL)
-- ) PARTITION BY RANGE (created_at);

-- -- Create partitions for messages (example: monthly partitions)
-- CREATE TABLE messages_2025_01 PARTITION OF messages
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- CREATE TABLE messages_2025_02 PARTITION OF messages
--     FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- -- Add more partitions as needed

-- -- Message reactions table - for emoji reactions
-- CREATE TABLE message_reactions (
--     id SERIAL PRIMARY KEY,
--     message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     reaction_emoji VARCHAR(10) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (message_id, user_id, reaction_emoji)
-- );

-- -- Message reads table - tracks read receipts
-- CREATE TABLE message_reads (
--     id SERIAL PRIMARY KEY,
--     message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
--     reader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (message_id, reader_id)
-- );

-- -- Typing indicators table - for "user is typing..." feature
-- CREATE TABLE typing_indicators (
--     match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 seconds',
--     PRIMARY KEY (match_id, user_id)
-- );

-- -- Notifications table - stores push notifications and in-app alerts
-- CREATE TABLE notifications (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     notification_type VARCHAR(50) NOT NULL, -- e.g., 'new_match', 'new_message', 'profile_view'
--     priority notification_priority_type DEFAULT 'medium',
--     title VARCHAR(200),
--     message TEXT,
--     is_read BOOLEAN DEFAULT FALSE,
--     related_user_id INTEGER REFERENCES users(id),
--     related_match_id INTEGER REFERENCES matches(id),
--     related_message_id INTEGER REFERENCES messages(id),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     read_at TIMESTAMP,
--     deleted_at TIMESTAMP -- soft delete
-- ) PARTITION BY RANGE (created_at);

-- -- Create partitions for notifications (example: monthly partitions)
-- CREATE TABLE notifications_2025_01 PARTITION OF notifications
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- CREATE TABLE notifications_2025_02 PARTITION OF notifications
--     FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- -- Add more partitions as needed

-- -- Push notification tokens table - stores device tokens for push notifications
-- CREATE TABLE push_tokens (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     device_token VARCHAR(500) NOT NULL,
--     device_type VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
--     is_active BOOLEAN DEFAULT TRUE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (user_id, device_token)
-- );

-- -- Icebreaker prompts table - predefined conversation starters
-- CREATE TABLE icebreaker_prompts (
--     id SERIAL PRIMARY KEY,
--     prompt_text TEXT NOT NULL,
--     category VARCHAR(50),
--     locale VARCHAR(10) DEFAULT 'en_US',
--     is_active BOOLEAN DEFAULT TRUE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- User icebreaker answers table
-- CREATE TABLE user_icebreaker_answers (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     prompt_id INTEGER NOT NULL REFERENCES icebreaker_prompts(id),
--     answer_text TEXT NOT NULL,
--     display_order INTEGER DEFAULT 0,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (user_id, prompt_id)
-- );

-- -- Blocks table - stores blocked users
-- CREATE TABLE blocks (
--     id SERIAL PRIMARY KEY,
--     blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     reason TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
--     UNIQUE (blocker_id, blocked_id)
-- );

-- -- Reports table - stores user reports
-- CREATE TABLE reports (
--     id SERIAL PRIMARY KEY,
--     reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
--     reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
--     reason VARCHAR(100) NOT NULL,
--     description TEXT,
--     status report_status_type DEFAULT 'pending',
--     resolver_id INTEGER REFERENCES users(id), -- admin who resolved the report
--     resolution_notes TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     resolved_at TIMESTAMP,
--     CONSTRAINT no_self_report CHECK (reporter_id != reported_id)
-- );

-- -- Phone verification table - for SMS verification codes
-- CREATE TABLE phone_verifications (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     phone_number_hash VARCHAR(255) NOT NULL, -- hashed for privacy
--     verification_code VARCHAR(10) NOT NULL,
--     expires_at TIMESTAMP NOT NULL,
--     is_verified BOOLEAN DEFAULT FALSE,
--     attempts INTEGER DEFAULT 0,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT valid_attempts CHECK (attempts >= 0 AND attempts <= 5)
-- );

-- -- Audit log table - tracks sensitive actions for compliance and security
-- CREATE TABLE audit_logs (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
--     action VARCHAR(100) NOT NULL, -- e.g., 'login', 'profile_update', 'account_deletion'
--     ip_address INET,
--     user_agent TEXT,
--     details JSONB,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- ) PARTITION BY RANGE (created_at);

-- -- Create partitions for audit_logs (example: monthly partitions)
-- CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
--     FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- -- Index for JSONB queries in audit_logs
-- CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);

-- -- Create indexes for better query performance
-- CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_users_status ON users(status) WHERE status = 'active' AND deleted_at IS NULL;
-- CREATE INDEX idx_users_subscription ON users(subscription_tier) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_users_last_active ON users(last_active) WHERE status = 'active' AND deleted_at IS NULL;

-- CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_user_profiles_gender ON user_profiles(gender) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_user_profiles_dob ON user_profiles(date_of_birth) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_user_profiles_location ON user_profiles USING GIST(location) WHERE deleted_at IS NULL;

-- CREATE INDEX idx_user_photos_user_id ON user_photos(user_id) WHERE deleted_at IS NULL;

-- CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
-- CREATE INDEX idx_user_interests_interest_id ON user_interests(interest_id);

-- CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
-- CREATE INDEX idx_user_preferences_genders ON user_preferences USING GIN(preferred_genders);

-- CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
-- CREATE INDEX idx_subscriptions_active ON subscriptions(user_id, is_active) WHERE is_active = TRUE;
-- CREATE INDEX idx_subscriptions_external_id ON subscriptions(external_payment_id);

-- CREATE INDEX idx_swipes_swiper ON swipes(swiper_id, created_at DESC);
-- CREATE INDEX idx_swipes_swiped ON swipes(swiped_id, created_at DESC);

-- CREATE INDEX idx_matches_user1 ON matches(user1_id) WHERE is_active = TRUE AND deleted_at IS NULL;
-- CREATE INDEX idx_matches_user2 ON matches(user2_id) WHERE is_active = TRUE AND deleted_at IS NULL;

-- CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
-- CREATE INDEX idx_message_reads_message ON message_reads(message_id);

-- CREATE INDEX idx_push_tokens_user ON push_tokens(user_id) WHERE is_active = TRUE;

-- CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
-- CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- CREATE INDEX idx_reports_status ON reports(status) WHERE status = 'pending';

-- -- Create a function to automatically update the updated_at timestamp
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Create triggers to auto-update updated_at
-- CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CREATE TRIGGER update_push_tokens_updated_at BEFORE UPDATE ON push_tokens
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -- Trigger to auto-set match is_active to FALSE on unmatch
-- CREATE OR REPLACE FUNCTION handle_unmatch()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.unmatched_by IS NOT NULL AND OLD.unmatched_by IS NULL THEN
--         NEW.is_active = FALSE;
--         NEW.unmatched_at = CURRENT_TIMESTAMP;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trigger_handle_unmatch BEFORE UPDATE ON matches
--     FOR EACH ROW EXECUTE FUNCTION handle_unmatch();

-- -- Function to calculate age from date of birth
-- CREATE OR REPLACE FUNCTION calculate_age(dob DATE)
-- RETURNS INTEGER AS $$
-- BEGIN
--     RETURN DATE_PART('year', AGE(dob));
-- END;
-- $$ LANGUAGE plpgsql IMMUTABLE;

-- -- Improved function to check swipe limits with configurable tiers
-- CREATE OR REPLACE FUNCTION check_swipe_limit(p_user_id INTEGER, p_swipe_type swipe_type)
-- RETURNS BOOLEAN AS $$
-- DECLARE
--     v_subscription subscription_tier_type;
--     v_swipe_count INTEGER;
--     v_super_like_count INTEGER;
--     v_tier_limit INTEGER;
--     v_super_like_limit INTEGER;
-- BEGIN
--     -- Get user's subscription tier
--     SELECT subscription_tier INTO v_subscription FROM users WHERE id = p_user_id AND deleted_at IS NULL;
    
--     -- Get tier limits
--     SELECT daily_swipe_limit, daily_super_likes INTO v_tier_limit, v_super_like_limit
--     FROM tier_limits WHERE tier = v_subscription;
    
--     -- NULL limit means unlimited
--     IF p_swipe_type = 'super_like' AND v_super_like_limit IS NULL THEN
--         RETURN TRUE;
--     ELSIF p_swipe_type != 'super_like' AND v_tier_limit IS NULL THEN
--         RETURN TRUE;
--     END IF;
    
--     -- Get or create today's swipe record using UPSERT to avoid race conditions
--     INSERT INTO daily_swipe_limits (user_id, date, swipe_count, super_like_count)
--     VALUES (p_user_id, CURRENT_DATE, 0, 0)
--     ON CONFLICT (user_id, date) DO NOTHING;
    
--     SELECT swipe_count, super_like_count INTO v_swipe_count, v_super_like_count
--     FROM daily_swipe_limits
--     WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
--     -- Check limits
--     IF p_swipe_type = 'super_like' THEN
--         RETURN v_super_like_count < v_super_like_limit;
--     ELSE
--         RETURN v_swipe_count < v_tier_limit;
--     END IF;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- Function for atomic unmatch operation
-- CREATE OR REPLACE FUNCTION unmatch_users(p_match_id INTEGER, p_user_id INTEGER)
-- RETURNS BOOLEAN AS $$
-- BEGIN
--     UPDATE matches
--     SET unmatched_by = p_user_id,
--         unmatched_at = CURRENT_TIMESTAMP,
--         is_active = FALSE
--     WHERE id = p_match_id 
--       AND (user1_id = p_user_id OR user2_id = p_user_id)
--       AND is_active = TRUE;
    
--     RETURN FOUND;
-- END;
-- $$ LANGUAGE plpgsql;

-- -- View for active matches per user
-- CREATE VIEW user_active_matches AS
-- SELECT 
--     m.id as match_id,
--     m.user1_id,
--     m.user2_id,
--     m.matched_at,
--     CASE 
--         WHEN m.user1_id = u.id THEN m.user2_id
--         ELSE m.user1_id
--     END as other_user_id
-- FROM matches m
-- CROSS JOIN users u
-- WHERE m.is_active = TRUE 
--   AND m.deleted_at IS NULL
--   AND (m.user1_id = u.id OR m.user2_id = u.id)
--   AND u.deleted_at IS NULL;

-- -- Optimized materialized view for potential matches (refresh via scheduled job)
-- CREATE MATERIALIZED VIEW potential_matches AS
-- SELECT 
--     u1.id as user_id,
--     u2.id as potential_match_id,
--     ST_Distance(up1.location, up2.location) / 1000 AS distance_km,
--     calculate_age(up2.date_of_birth) AS match_age,
--     ARRAY_AGG(DISTINCT ui2.interest_id) FILTER (WHERE ui1.interest_id = ui2.interest_id) as shared_interests
-- FROM users u1
-- JOIN user_profiles up1 ON u1.id = up1.user_id
-- JOIN user_preferences pref ON u1.id = pref.user_id
-- JOIN users u2 ON u1.id != u2.id
-- JOIN user_profiles up2 ON u2.id = up2.user_id
-- LEFT JOIN user_interests ui1 ON u1.id = ui1.user_id
-- LEFT JOIN user_interests ui2 ON u2.id = ui2.user_id AND ui1.interest_id = ui2.interest_id
-- WHERE u1.status = 'active' AND u1.deleted_at IS NULL
--     AND u2.status = 'active' AND u2.deleted_at IS NULL
--     AND up1.deleted_at IS NULL AND up2.deleted_at IS NULL
--     AND up2.gender = ANY(pref.preferred_genders)
--     AND calculate_age(up2.date_of_birth) BETWEEN COALESCE(pref.min_age, 18) AND COALESCE(pref.max_age, 100)
--     AND (pref.max_distance IS NULL OR ST_DWithin(up1.location, up2.location, pref.max_distance * 1000))
--     AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = u1.id AND s.swiped_id = u2.id AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP))
--     AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = u1.id AND blocked_id = u2.id) OR (blocker_id = u2.id AND blocked_id = u1.id))
-- GROUP BY u1.id, u2.id, up1.location, up2.location, up2.date_of_birth;

-- CREATE INDEX idx_potential_matches_user ON potential_matches(user_id, distance_km);
-- CREATE INDEX idx_potential_matches_shared ON potential_matches(user_id) WHERE array_length(shared_interests, 1) > 0;



-- Dating App Database Schema - Production-Ready Version
-- FIXED: Partitioning Constraints (SQL State 0A000)
-- FIXED: Immutability Errors (SQL State 42P17)
