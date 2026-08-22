package hr.leon.library.service;

import hr.leon.library.dto.BookMetadataCandidate;
import hr.leon.library.dto.BookMetadataIsbnResponse;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.metadata.BookMetadataProvider;
import hr.leon.library.metadata.ExternalBookMetadata;
import hr.leon.library.metadata.MetadataProvider;
import hr.leon.library.repository.BookRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BookMetadataServiceTest {

    @Test
    void reconcilesSameIsbnAcrossProvidersIntoOneCandidate() {
        BookRepository repository = mock(BookRepository.class);
        BookMetadataProvider openLibrary = stub(
                MetadataProvider.OPEN_LIBRARY,
                metadata(MetadataProvider.OPEN_LIBRARY, "ol-1", "Dune", "9780441172719", null)
        );
        BookMetadataProvider googleBooks = stub(
                MetadataProvider.GOOGLE_BOOKS,
                metadata(MetadataProvider.GOOGLE_BOOKS, "gb-1", "Dune", "9780441172719", "Long description")
        );
        BookMetadataService service = new BookMetadataService(
                List.of(openLibrary, googleBooks),
                repository
        );

        var response = service.search("Dune", null, 20);

        assertThat(response.results()).hasSize(1);
        BookMetadataCandidate result = response.results().get(0);
        assertThat(result.sources()).hasSize(2);
        assertThat(result.description()).isEqualTo("Long description");
    }

    @Test
    void isbnLookupFindsStoredDuplicateDespiteFormatting() {
        BookRepository repository = mock(BookRepository.class);
        BookEntity stored = new BookEntity();
        ReflectionTestUtils.setField(stored, "bookId", "book-1");
        stored.setTitle("Dina");
        stored.setAuthor("Frank Herbert");
        stored.setIsbn("978-0-441-17271-9");
        stored.setPublishedYear(1965);
        when(repository.findAll()).thenReturn(List.of(stored));

        BookMetadataProvider provider = stub(
                MetadataProvider.OPEN_LIBRARY,
                metadata(MetadataProvider.OPEN_LIBRARY, "ol-1", "Dune", "9780441172719", null)
        );
        BookMetadataService service = new BookMetadataService(List.of(provider), repository);

        BookMetadataIsbnResponse response = service.lookupIsbn("978-0-441-17271-9");

        assertThat(response.duplicates()).hasSize(1);
        assertThat(response.duplicates().get(0).bookId()).isEqualTo("book-1");
        assertThat(response.duplicates().get(0).reason().name()).isEqualTo("ISBN");
    }

    private static BookMetadataProvider stub(
            MetadataProvider provider,
            ExternalBookMetadata metadata
    ) {
        return new BookMetadataProvider() {
            @Override
            public MetadataProvider provider() {
                return provider;
            }

            @Override
            public List<ExternalBookMetadata> search(String query, int limit) {
                return List.of(metadata);
            }

            @Override
            public Optional<ExternalBookMetadata> lookupIsbn(String isbn) {
                return Optional.of(metadata);
            }

            @Override
            public Optional<ExternalBookMetadata> getByExternalId(String externalId) {
                return Optional.of(metadata);
            }
        };
    }

    private static ExternalBookMetadata metadata(
            MetadataProvider provider,
            String id,
            String title,
            String isbn13,
            String description
    ) {
        return new ExternalBookMetadata(
                provider,
                id,
                title,
                List.of("Frank Herbert"),
                "0441172717",
                isbn13,
                1965,
                "Ace",
                412,
                description,
                null
        );
    }
}
