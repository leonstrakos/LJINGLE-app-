CREATE TABLE entries (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    entry_id VARCHAR(36) NOT NULL UNIQUE,
    title VARCHAR(255),
    content TEXT NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    book_id VARCHAR(36),
    topic_id VARCHAR(36),
    activity_id VARCHAR(36),
    CONSTRAINT fk_entries_book
        FOREIGN KEY (book_id) REFERENCES books (book_id) ON DELETE SET NULL,
    CONSTRAINT fk_entries_topic
        FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE SET NULL,
    CONSTRAINT fk_entries_activity
        FOREIGN KEY (activity_id) REFERENCES activities (activity_id) ON DELETE SET NULL,
    CONSTRAINT chk_entries_title_not_blank
        CHECK (title IS NULL OR LENGTH(BTRIM(title)) > 0),
    CONSTRAINT chk_entries_content_not_blank
        CHECK (LENGTH(BTRIM(content)) > 0),
    CONSTRAINT chk_entries_type
        CHECK (entry_type IN (
            'NOTE',
            'QUOTE',
            'OBSERVATION',
            'REVIEW',
            'PROGRESS_UPDATE'
        ))
);

CREATE INDEX idx_entries_book_modified
    ON entries (book_id, modified_at DESC);
CREATE INDEX idx_entries_topic_modified
    ON entries (topic_id, modified_at DESC);
CREATE INDEX idx_entries_activity_modified
    ON entries (activity_id, modified_at DESC);
CREATE INDEX idx_entries_type_modified
    ON entries (entry_type, modified_at DESC);
