ALTER TABLE books
    ADD COLUMN reading_status VARCHAR(32) NOT NULL DEFAULT 'LATER',
    ADD COLUMN progress INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN enjoyment VARCHAR(32),
    ADD COLUMN favourite BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN started_on DATE,
    ADD COLUMN finished_on DATE;

ALTER TABLE books
    ADD CONSTRAINT chk_books_reading_status
        CHECK (reading_status IN ('LATER', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'DROPPED')),
    ADD CONSTRAINT chk_books_progress
        CHECK (progress BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_books_enjoyment
        CHECK (enjoyment IS NULL OR enjoyment IN ('ENJOYED', 'OKAY', 'REGRET')),
    ADD CONSTRAINT chk_books_date_range
        CHECK (started_on IS NULL OR finished_on IS NULL OR finished_on >= started_on);

CREATE INDEX idx_books_reading_status ON books (reading_status);
CREATE INDEX idx_books_favourite ON books (favourite);
