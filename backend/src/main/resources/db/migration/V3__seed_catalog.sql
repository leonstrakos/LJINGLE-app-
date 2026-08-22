-- Flyway migracija koja automatski dodaje 100 demo-knjiga.
-- Postojeće knjige s istim naslovom i autorom neće biti duplicirane.

WITH book_data(title, author, published_year) AS (
    VALUES
        ('1984', 'George Orwell', 1949),
        ('Životinjska farma', 'George Orwell', 1945),
        ('Ponos i predrasude', 'Jane Austen', 1813),
        ('Razum i osjećaji', 'Jane Austen', 1811),
        ('Zločin i kazna', 'Fjodor Mihajlovič Dostojevski', 1866),
        ('Braća Karamazovi', 'Fjodor Mihajlovič Dostojevski', 1880),
        ('Idiot', 'Fjodor Mihajlovič Dostojevski', 1869),
        ('Ana Karenjina', 'Lav Nikolajevič Tolstoj', 1878),
        ('Rat i mir', 'Lav Nikolajevič Tolstoj', 1869),
        ('Amerika', 'Franz Kafka', 1927),
        ('Preobrazba', 'Franz Kafka', 1915),
        ('Dvorac', 'Franz Kafka', 1926),
        ('Sretna smrt', 'Albert Camus', 1971),
        ('Kuga', 'Albert Camus', 1947),
        ('Pad', 'Albert Camus', 1956),
        ('Mučnina', 'Jean-Paul Sartre', 1938),
        ('Madame Bovary', 'Gustave Flaubert', 1857),
        ('Jadnici', 'Victor Hugo', 1862),
        ('Zvonar crkve Notre-Dame', 'Victor Hugo', 1831),
        ('Crveno i crno', 'Stendhal', 1830),
        ('Grof Monte Cristo', 'Alexandre Dumas', 1844),
        ('Tri mušketira', 'Alexandre Dumas', 1844),
        ('Don Quijote', 'Miguel de Cervantes', 1605),
        ('Sto godina samoće', 'Gabriel García Márquez', 1967),
        ('Ljubav u doba kolere', 'Gabriel García Márquez', 1985),
        ('Baudolino', 'Umberto Eco', 2000),
        ('Foucaultovo njihalo', 'Umberto Eco', 1988),
        ('Praško groblje', 'Umberto Eco', 2010),
        ('Majstor i Margarita', 'Mihail Bulgakov', 1967),
        ('Doktor Živago', 'Boris Pasternak', 1957),
        ('Lolita', 'Vladimir Nabokov', 1955),
        ('Veliki Gatsby', 'F. Scott Fitzgerald', 1925),
        ('Moby Dick', 'Herman Melville', 1851),
        ('Starac i more', 'Ernest Hemingway', 1952),
        ('Sunce se ponovno rađa', 'Ernest Hemingway', 1926),
        ('Za kim zvona zvone', 'Ernest Hemingway', 1940),
        ('Uliks', 'James Joyce', 1922),
        ('Dublinci', 'James Joyce', 1914),
        ('Portret umjetnika u mladosti', 'James Joyce', 1916),
        ('Gospođa Dalloway', 'Virginia Woolf', 1925),
        ('K svjetioniku', 'Virginia Woolf', 1927),
        ('Vrli novi svijet', 'Aldous Huxley', 1932),
        ('Fahrenheit 451', 'Ray Bradbury', 1953),
        ('Mi', 'Jevgenij Zamjatin', 1924),
        ('Sluškinjina priča', 'Margaret Atwood', 1985),
        ('Dina', 'Frank Herbert', 1965),
        ('Mesija Dine', 'Frank Herbert', 1969),
        ('Neuromancer', 'William Gibson', 1984),
        ('Solaris', 'Stanisław Lem', 1961),
        ('2001: Odiseja u svemiru', 'Arthur C. Clarke', 1968),
        ('Vodič kroz galaksiju za autostopere', 'Douglas Adams', 1979),
        ('Prstenova družina', 'J. R. R. Tolkien', 1954),
        ('Dvije kule', 'J. R. R. Tolkien', 1954),
        ('Povratak kralja', 'J. R. R. Tolkien', 1955),
        ('Hobit', 'J. R. R. Tolkien', 1937),
        ('Silmarillion', 'J. R. R. Tolkien', 1977),
        ('Harry Potter i kamen mudraca', 'J. K. Rowling', 1997),
        ('Harry Potter i odaja tajni', 'J. K. Rowling', 1998),
        ('Harry Potter i zatočenik Azkabana', 'J. K. Rowling', 1999),
        ('Harry Potter i plameni pehar', 'J. K. Rowling', 2000),
        ('Lav, Vještica i ormar', 'C. S. Lewis', 1950),
        ('Mali princ', 'Antoine de Saint-Exupéry', 1943),
        ('Alisa u zemlji čudesa', 'Lewis Carroll', 1865),
        ('Petar Pan', 'J. M. Barrie', 1911),
        ('Pinokio', 'Carlo Collodi', 1883),
        ('Robinson Crusoe', 'Daniel Defoe', 1719),
        ('Gulliverova putovanja', 'Jonathan Swift', 1726),
        ('Otok s blagom', 'Robert Louis Stevenson', 1883),
        ('Frankenstein', 'Mary Shelley', 1818),
        ('Drakula', 'Bram Stoker', 1897),
        ('Slika Doriana Graya', 'Oscar Wilde', 1890),
        ('Orkanski visovi', 'Emily Brontë', 1847),
        ('Jane Eyre', 'Charlotte Brontë', 1847),
        ('Male žene', 'Louisa May Alcott', 1868),
        ('Ubiti pticu rugalicu', 'Harper Lee', 1960),
        ('Lovac u žitu', 'J. D. Salinger', 1951),
        ('Gospodar muha', 'William Golding', 1954),
        ('Cvijeće za Algernona', 'Daniel Keyes', 1966),
        ('Let iznad kukavičjeg gnijezda', 'Ken Kesey', 1962),
        ('Klub boraca', 'Chuck Palahniuk', 1996),
        ('Američki psiho', 'Bret Easton Ellis', 1991),
        ('Put', 'Cormac McCarthy', 2006),
        ('Krvavi meridijan', 'Cormac McCarthy', 1985),
        ('Sjena vjetra', 'Carlos Ruiz Zafón', 2001),
        ('Kradljivica knjiga', 'Markus Zusak', 2005),
        ('Pijev život', 'Yann Martel', 2001),
        ('Nikad me ne ostavljaj', 'Kazuo Ishiguro', 2005),
        ('Ostaci dana', 'Kazuo Ishiguro', 1989),
        ('Norveška šuma', 'Haruki Murakami', 1987),
        ('Kafka na žalu', 'Haruki Murakami', 2002),
        ('1Q84', 'Haruki Murakami', 2009),
        ('Sapiens', 'Yuval Noah Harari', 2011),
        ('Homo Deus', 'Yuval Noah Harari', 2015),
        ('Kratka povijest vremena', 'Stephen Hawking', 1988),
        ('Sebični gen', 'Richard Dawkins', 1976),
        ('Čovjekovo traganje za smislom', 'Viktor E. Frankl', 1946),
        ('Meditacije', 'Marko Aurelije', 180),
        ('Država', 'Platon', 1900),
        ('Tako je govorio Zaratustra', 'Friedrich Nietzsche', 1883),
        ('Svijet kao volja i predodžba', 'Arthur Schopenhauer', 1818)
),
numbered AS (
    SELECT
        title,
        author,
        published_year,
        ROW_NUMBER() OVER () AS n
    FROM book_data
),
isbn_bases AS (
    SELECT
        title,
        author,
        published_year,
        n,
        '978000000' || LPAD(n::TEXT, 3, '0') AS isbn_base
    FROM numbered
),
prepared AS (
    SELECT
        title,
        author,
        published_year,
        n,
        isbn_base || (
            (
                10 - (
                    SELECT SUM(
                        SUBSTRING(isbn_base, position, 1)::INTEGER *
                        CASE
                            WHEN position % 2 = 1 THEN 1
                            ELSE 3
                        END
                    )
                    FROM GENERATE_SERIES(1, 12) AS position
                ) % 10
            ) % 10
        )::TEXT AS isbn
    FROM isbn_bases
)
INSERT INTO books (
    created_at,
    modified_at,
    book_id,
    title,
    author,
    isbn,
    published_year,
    available
)
SELECT
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    GEN_RANDOM_UUID()::TEXT,
    prepared.title,
    prepared.author,
    prepared.isbn,
    prepared.published_year,
    prepared.n % 4 <> 0
FROM prepared
WHERE NOT EXISTS (
    SELECT 1
    FROM books existing
    WHERE LOWER(existing.title) = LOWER(prepared.title)
      AND LOWER(existing.author) = LOWER(prepared.author)
);

SELECT COUNT(*) AS ukupan_broj_knjiga
FROM books;