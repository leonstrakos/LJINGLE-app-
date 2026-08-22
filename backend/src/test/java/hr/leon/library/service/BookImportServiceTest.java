package hr.leon.library.service;

import hr.leon.library.dto.BookImportAction;
import hr.leon.library.dto.BookImportConfirmRequest;
import hr.leon.library.dto.BookImportPreviewRequest;
import hr.leon.library.dto.BookMetadataCandidate;
import hr.leon.library.dto.BookMetadataDuplicate;
import hr.leon.library.dto.BookMetadataDuplicate.DuplicateReason;
import hr.leon.library.dto.BookMetadataSource;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.entity.Enjoyment;
import hr.leon.library.entity.ReadingStatus;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.mapper.BookMapper;
import hr.leon.library.metadata.MetadataProvider;
import hr.leon.library.repository.BookRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookImportServiceTest {

    private static final BookMetadataSource SOURCE = new BookMetadataSource(
            MetadataProvider.GOOGLE_BOOKS,
            "volume-1"
    );

    @Mock
    private BookMetadataService metadataService;

    @Mock
    private BookRepository bookRepository;

    private BookImportService importService;
    private BookEntity existing;
    private BookMetadataCandidate candidate;

    @BeforeEach
    void setUp() {
        importService = new BookImportService(metadataService, bookRepository, new BookMapper());
        existing = existingBook();
        candidate = candidate();

        when(metadataService.resolveForImport(SOURCE)).thenReturn(candidate);
        when(metadataService.findDuplicates(candidate)).thenReturn(List.of(new BookMetadataDuplicate(
                "book-1",
                "Dina",
                "Frank Herbert",
                "9780441172719",
                DuplicateReason.ISBN
        )));
        when(bookRepository.findByBookId("book-1")).thenReturn(Optional.of(existing));
    }

    @Test
    void previewRequiresExplicitConfirmationForBibliographicUpdate() {
        var preview = importService.preview(new BookImportPreviewRequest(SOURCE, null));

        assertThat(preview.action()).isEqualTo(BookImportAction.UPDATE_EXISTING);
        assertThat(preview.confirmationRequired()).isTrue();
        assertThat(preview.changedBibliographicFields()).containsExactly("title", "publishedYear");
        assertThat(preview.protectedPersonalFields()).contains(
                "readingStatus",
                "progress",
                "enjoyment",
                "favourite",
                "timeHistory"
        );
    }

    @Test
    void rejectsUnconfirmedMetadataUpdate() {
        assertThatThrownBy(() -> importService.confirm(new BookImportConfirmRequest(
                SOURCE,
                "book-1",
                false
        )))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("izričito potvrđene");
    }

    @Test
    void updatesOnlyBibliographicFieldsAndPreservesPersonalTracking() {
        var result = importService.confirm(new BookImportConfirmRequest(
                SOURCE,
                "book-1",
                true
        ));

        assertThat(result.action()).isEqualTo(BookImportAction.UPDATE_EXISTING);
        assertThat(existing.getTitle()).isEqualTo("Dune");
        assertThat(existing.getPublishedYear()).isEqualTo(1966);
        assertThat(existing.getReadingStatus()).isEqualTo(ReadingStatus.IN_PROGRESS);
        assertThat(existing.getProgress()).isEqualTo(73);
        assertThat(existing.getEnjoyment()).isEqualTo(Enjoyment.ENJOYED);
        assertThat(existing.isFavourite()).isTrue();
        assertThat(existing.getStartedOn()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(existing.getFinishedOn()).isNull();
        verify(bookRepository).save(existing);
    }

    private BookEntity existingBook() {
        BookEntity book = new BookEntity();
        ReflectionTestUtils.setField(book, "bookId", "book-1");
        book.setTitle("Dina");
        book.setAuthor("Frank Herbert");
        book.setIsbn("9780441172719");
        book.setPublishedYear(1965);
        book.setReadingStatus(ReadingStatus.IN_PROGRESS);
        book.setProgress(73);
        book.setEnjoyment(Enjoyment.ENJOYED);
        book.setFavourite(true);
        book.setStartedOn(LocalDate.of(2026, 8, 1));
        return book;
    }

    private BookMetadataCandidate candidate() {
        return new BookMetadataCandidate(
                "Dune",
                List.of("Frank Herbert"),
                "0441172717",
                "9780441172719",
                1966,
                "Ace",
                412,
                "Novel",
                null,
                List.of(SOURCE)
        );
    }
}
