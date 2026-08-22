CREATE TABLE collections (
    id BIGSERIAL PRIMARY KEY,
    collection_id VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    symbol VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE collection_items (
    id BIGSERIAL PRIMARY KEY,
    item_id VARCHAR(36) NOT NULL UNIQUE,
    collection_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(24) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_collection_items_collection
        FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
    CONSTRAINT uq_collection_entity UNIQUE (collection_id, entity_type, entity_id)
);

CREATE TABLE entity_links (
    id BIGSERIAL PRIMARY KEY,
    link_id VARCHAR(36) NOT NULL UNIQUE,
    source_type VARCHAR(24) NOT NULL,
    source_id VARCHAR(36) NOT NULL,
    target_type VARCHAR(24) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    relation_type VARCHAR(32) NOT NULL DEFAULT 'RELATED',
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_entity_link UNIQUE (source_type, source_id, target_type, target_id, relation_type)
);

CREATE INDEX idx_collection_items_collection_position
    ON collection_items(collection_id, position, created_at);
CREATE INDEX idx_collection_items_entity
    ON collection_items(entity_type, entity_id);
CREATE INDEX idx_entity_links_source
    ON entity_links(source_type, source_id);
CREATE INDEX idx_entity_links_target
    ON entity_links(target_type, target_id);

-- Starter shelves/lists. These are ordinary editable collections, not hard-coded app categories.
INSERT INTO collections (collection_id, name, description, symbol, created_at, modified_at) VALUES
('00000000-0000-4000-8000-000000000101', 'Childhood', 'Stvari koje pripadaju djetinjstvu i ranim uspomenama.', '◌', NOW(), NOW()),
('00000000-0000-4000-8000-000000000102', 'Rainy Night Movies', 'Filmovi i serije za kišne noći.', '☂', NOW(), NOW()),
('00000000-0000-4000-8000-000000000103', 'Philosophy', 'Knjige, teme, citati i bilješke povezani s filozofijom.', '◇', NOW(), NOW()),
('00000000-0000-4000-8000-000000000104', 'Weird Internet', 'Čudni kutovi interneta, rabbit holes i reference.', '⌁', NOW(), NOW()),
('00000000-0000-4000-8000-000000000105', 'Comfort Games', 'Igre kojima se vraćaš radi poznatog osjećaja.', '☆', NOW(), NOW()),
('00000000-0000-4000-8000-000000000106', 'Summer 2026', 'Stvari koje pripadaju ljetu 2026.', '☼', NOW(), NOW()),
('00000000-0000-4000-8000-000000000107', 'To Revisit', 'Stvari kojima se želiš vratiti kasnije.', '↻', NOW(), NOW());
