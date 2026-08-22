CREATE TABLE games (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    game_id VARCHAR(36) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    developer VARCHAR(255),
    platform VARCHAR(120) NOT NULL,
    release_year INTEGER,
    game_status VARCHAR(32) NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    enjoyment VARCHAR(32),
    favourite BOOLEAN NOT NULL DEFAULT FALSE,
    started_on DATE,
    finished_on DATE,
    igdb_id BIGINT,
    cover_url VARCHAR(1000),
    playing_activity_id VARCHAR(36) UNIQUE,
    CONSTRAINT fk_games_playing_activity
        FOREIGN KEY (playing_activity_id) REFERENCES activities (activity_id) ON DELETE SET NULL,
    CONSTRAINT chk_games_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
    CONSTRAINT chk_games_platform_not_blank CHECK (LENGTH(BTRIM(platform)) > 0),
    CONSTRAINT chk_games_status CHECK (game_status IN (
        'BACKLOG',
        'PLAYING',
        'COMPLETED',
        'DROPPED'
    )),
    CONSTRAINT chk_games_progress CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT chk_games_enjoyment CHECK (
        enjoyment IS NULL OR enjoyment IN ('ENJOYED', 'OKAY', 'REGRET')
    ),
    CONSTRAINT chk_games_date_range CHECK (
        started_on IS NULL OR finished_on IS NULL OR finished_on >= started_on
    )
);

CREATE INDEX idx_games_title_lower ON games (LOWER(title));
CREATE INDEX idx_games_status_title ON games (game_status, title);
CREATE INDEX idx_games_platform_lower ON games (LOWER(platform));
CREATE INDEX idx_games_igdb_id ON games (igdb_id);
