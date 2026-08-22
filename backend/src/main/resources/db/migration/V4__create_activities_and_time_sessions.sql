CREATE TABLE activities (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    activity_id VARCHAR(36) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    activity_type VARCHAR(32) NOT NULL,
    book_id VARCHAR(36),
    CONSTRAINT fk_activities_book
        FOREIGN KEY (book_id) REFERENCES books (book_id) ON DELETE SET NULL,
    CONSTRAINT uq_activities_book_type UNIQUE (book_id, activity_type)
);

CREATE TABLE time_sessions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    session_id VARCHAR(36) NOT NULL UNIQUE,
    activity_id VARCHAR(36) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    CONSTRAINT fk_time_sessions_activity
        FOREIGN KEY (activity_id) REFERENCES activities (activity_id) ON DELETE CASCADE
);

CREATE INDEX idx_activities_book ON activities (book_id);
CREATE INDEX idx_time_sessions_activity_started
    ON time_sessions (activity_id, started_at DESC);
CREATE UNIQUE INDEX uq_time_sessions_one_running_per_activity
    ON time_sessions (activity_id)
    WHERE ended_at IS NULL;
