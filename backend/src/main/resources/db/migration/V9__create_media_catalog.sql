CREATE TABLE media_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    media_id VARCHAR(36) NOT NULL UNIQUE,
    media_type VARCHAR(16) NOT NULL,
    tmdb_id BIGINT,
    title VARCHAR(255) NOT NULL,
    original_title VARCHAR(255),
    overview TEXT,
    poster_path VARCHAR(500),
    backdrop_path VARCHAR(500),
    release_year INTEGER,
    watch_status VARCHAR(32) NOT NULL DEFAULT 'WATCHLIST',
    progress INTEGER NOT NULL DEFAULT 0,
    enjoyment VARCHAR(32),
    favourite BOOLEAN NOT NULL DEFAULT FALSE,
    started_on DATE,
    completed_on DATE,
    CONSTRAINT chk_media_type
        CHECK (media_type IN ('MOVIE', 'SERIES')),
    CONSTRAINT chk_media_watch_status
        CHECK (watch_status IN ('WATCHLIST', 'WATCHING', 'COMPLETED', 'DROPPED')),
    CONSTRAINT chk_media_progress
        CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT chk_media_enjoyment
        CHECK (enjoyment IS NULL OR enjoyment IN ('ENJOYED', 'OKAY', 'REGRET')),
    CONSTRAINT chk_media_release_year
        CHECK (release_year IS NULL OR release_year BETWEEN 1800 AND 3000),
    CONSTRAINT chk_media_date_range
        CHECK (started_on IS NULL OR completed_on IS NULL OR completed_on >= started_on),
    CONSTRAINT chk_media_completed_progress
        CHECK (watch_status <> 'COMPLETED' OR progress = 100)
);

CREATE UNIQUE INDEX uq_media_tmdb_type
    ON media_items (media_type, tmdb_id)
    WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_media_type_status
    ON media_items (media_type, watch_status);
CREATE INDEX idx_media_favourite
    ON media_items (favourite);

ALTER TABLE activities
    ADD COLUMN media_id VARCHAR(36),
    ADD CONSTRAINT fk_activities_media
        FOREIGN KEY (media_id) REFERENCES media_items (media_id) ON DELETE SET NULL;

ALTER TABLE activities
    DROP CONSTRAINT chk_activities_type,
    ADD CONSTRAINT chk_activities_type
        CHECK (activity_type IN (
            'READING',
            'WATCHING',
            'STUDYING',
            'PLAYING',
            'RESEARCH',
            'WORK',
            'EXERCISE',
            'CUSTOM'
        ));

CREATE INDEX idx_activities_media ON activities (media_id);
CREATE UNIQUE INDEX uq_activities_media_type
    ON activities (media_id, activity_type)
    WHERE media_id IS NOT NULL;
