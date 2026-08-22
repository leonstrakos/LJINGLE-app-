INSERT INTO books (created_at, modified_at, book_id, title, author, isbn, published_year, available)
VALUES
    (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '71ca50e7-0f55-4e1e-a169-857f3fb94e55', 'Proces', 'Franz Kafka', '978-953-313-212-6', 1925, TRUE),
    (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'dd646d4f-69d1-4229-a0c1-41ff5e60230a', 'Stranac', 'Albert Camus', '978-953-201-504-8', 1942, TRUE),
    (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '0f63c448-472f-485f-bab3-b168fb90e49e', 'Ime ruže', 'Umberto Eco', '978-953-220-826-6', 1980, FALSE);
