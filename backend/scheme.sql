
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
        username VARCHAR(50) UNIQUE, -- Added directly in CREATE
        password_hash VARCHAR(255) NOT NULL,
        phone_number_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP,
        status user_status_type DEFAULT 'active',
        is_verified BOOLEAN DEFAULT FALSE,
        subscription_tier subscription_tier_type DEFAULT 'free',
        deleted_at TIMESTAMP,
        CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
        CONSTRAINT valid_username CHECK (username IS NULL OR username ~* '^[a-zA-Z0-9_-]{3,50}$') -- Added constraint
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        surname VARCHAR(100), -- Added directly in CREATE
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

    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_text TEXT,
        media_url VARCHAR(500),
        reply_to_message_id INTEGER, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        CONSTRAINT message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL),
        PRIMARY KEY (id, created_at) 
    ) PARTITION BY RANGE (created_at);

    -- Partitions
    CREATE TABLE IF NOT EXISTS messages_2025_01 PARTITION OF messages FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
    CREATE TABLE IF NOT EXISTS messages_2025_02 PARTITION OF messages FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

    -- Message Reactions
    CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        message_created_at TIMESTAMP NOT NULL, 
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction_emoji VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (message_id, user_id, reaction_emoji),
        FOREIGN KEY (message_id, message_created_at) REFERENCES messages(id, created_at) ON DELETE CASCADE
    );

    -- Message Reads
    CREATE TABLE IF NOT EXISTS message_reads (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        message_created_at TIMESTAMP NOT NULL, 
        reader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (message_id, reader_id),
        FOREIGN KEY (message_id, message_created_at) REFERENCES messages(id, created_at) ON DELETE CASCADE
    );

    -- 6. SUPPORT TABLES

    -- Notifications (PARTITIONED)
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

    -- ==========================================
    -- MIGRATION SUPPORT (Backward Compatibility)
    -- ==========================================

    -- These ALTER statements are kept for existing databases. 
    -- For fresh installs, the columns are already added in CREATE TABLE above.

    -- 1. Add username to users table
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

    -- Add constraint for username format
    DO $$
    BEGIN
        BEGIN
            ALTER TABLE users ADD CONSTRAINT valid_username CHECK (username IS NULL OR username ~* '^[a-zA-Z0-9_-]{3,50}$');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END $$;

    -- Add index for faster username lookups
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;

    -- 2. Add surname to user_profiles table
    ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS surname VARCHAR(100);

    -- 4. Optional: Create a unique constraint that ignores soft-deleted users
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active 
    ON users(LOWER(username)) 
    WHERE deleted_at IS NULL;

    -- 5. Helper function for username generation
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

