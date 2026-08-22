CREATE TABLE topics (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    topic_id VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    CONSTRAINT chk_topics_name_not_blank CHECK (LENGTH(BTRIM(name)) > 0)
);

ALTER TABLE activities
    ADD COLUMN topic_id VARCHAR(36),
    ADD CONSTRAINT fk_activities_topic
        FOREIGN KEY (topic_id) REFERENCES topics (topic_id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_activities_type
        CHECK (activity_type IN (
            'READING',
            'STUDYING',
            'PLAYING',
            'RESEARCH',
            'WORK',
            'EXERCISE',
            'CUSTOM'
        ));

CREATE UNIQUE INDEX uq_topics_name_lower ON topics (LOWER(name));
CREATE INDEX idx_activities_topic ON activities (topic_id);
