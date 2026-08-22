package hr.leon.library.service;

import hr.leon.library.dto.BookImportAction;
import hr.leon.library.dto.BookImportConfirmRequest;
import hr.leon.library.dto.BookImportPreviewRequest;
import hr.leon.library.dto.BookImportPreviewResponse;
import hr.leon.library.dto.BookImportResultResponse;
import hr.leon.library.dto.BookMetadataCandidate;
import hr.leon.library.dto.BookMetadataDuplicate;
import hr.leon.library.dto.BookResponse;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.exception.BookNotFoundException;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.mapper.BookMapper;
import hr.leon.library.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class BookImportService {

    private static final List<String> PROTECTED_PERSONAL_FIELDS = List.of(
            "readingStatus",
            "progress",
            "enjoyment",
            "favourite",
            "startedOn",
            "finishedOn",
            "activities",
            "timeHistory"
    );

    private final BookMetadataService metadataService;
    private final BookRepository bookRepository;
    private final BookMapper bookMapper;

    public BookImportService(
            BookMetadataService metadataService,
            BookRepository bookRepository,
            BookMapper bookMapper
    ) {
        this.metadataService = metadataService;
        this.bookRepository = bookRepository;
        this.bookMapper = bookMapper;
    }

    @Transactional(readOnly = true)
    public BookImportPreviewResponse preview(BookImportPreviewRequest request) {
        BookMetadataCandidate candidate = metadataService.resolveForImport(request.source());
        List<BookMetadataDuplicate> duplicates = metadataService.findDuplicates(candidate);
        List<String> warnings = validateImportable(candidate);

        if (!warnings.isEmpty()) {
            return response(
                    candidate,
                    BookImportAction.BLOCKED,
                    null,
                    duplicates,
                    List.of(),
                    false,
                    false,
                    warnings
            );
        }

        BookEntity existing = resolveTarget(request.targetBookId(), duplicates);
        if (existing == null && duplicates.size() > 1) {
            return response(
                    candidate,
                    BookImportAction.BLOCKED,
                    null,
                    duplicates,
                    List.of(),
                    false,
                    false,
                    List.of("Pronađeno je više mogućih duplikata. Odaberite ciljnu knjigu ručno.")
            );
        }
        if (existing == null && duplicates.size() == 1) {
            existing = findBook(duplicates.get(0).bookId());
        }
        if (existing == null) {
            return response(
                    candidate,
                    BookImportAction.CREATE,
                    null,
                    duplicates,
                    List.of("title", "author", "isbn", "publishedYear"),
                    false,
                    true,
                    List.of()
            );
        }

        List<String> changedFields = changedFields(existing, candidate);
        BookImportAction action = changedFields.isEmpty()
                ? BookImportAction.ALREADY_IMPORTED
                : BookImportAction.UPDATE_EXISTING;
        return response(
                candidate,
                action,
                existing,
                duplicates,
                changedFields,
                action == BookImportAction.UPDATE_EXISTING,
                true,
                List.of()
        );
    }

    @Transactional
    public BookImportResultResponse confirm(BookImportConfirmRequest request) {
        BookImportPreviewResponse preview = preview(new BookImportPreviewRequest(
                request.source(),
                request.targetBookId()
        ));

        if (!preview.importable() || preview.action() == BookImportAction.BLOCKED) {
            throw new InvalidRequestException(String.join(" ", preview.warnings()));
        }
        if (preview.action() == BookImportAction.CREATE) {
            if (request.targetBookId() != null) {
                throw new InvalidRequestException("Ciljna knjiga nije potrebna za novi unos.");
            }
            BookEntity created = new BookEntity();
            applyBibliographicFields(created, preview.candidate());
            BookResponse saved = bookMapper.toResponse(bookRepository.save(created));
            return new BookImportResultResponse(
                    BookImportAction.CREATE,
                    saved,
                    preview.changedBibliographicFields(),
                    PROTECTED_PERSONAL_FIELDS
            );
        }

        BookEntity existing = findBook(preview.existingBook().bookId());
        if (request.targetBookId() != null
                && !request.targetBookId().equals(existing.getBookId())) {
            throw new InvalidRequestException("Ciljna knjiga više se ne podudara s pregledom uvoza.");
        }
        if (preview.action() == BookImportAction.UPDATE_EXISTING
                && !request.confirmMetadataUpdate()) {
            throw new InvalidRequestException(
                    "Bibliografske promjene moraju biti izričito potvrđene."
            );
        }
        if (preview.action() == BookImportAction.UPDATE_EXISTING) {
            applyBibliographicFields(existing, preview.candidate());
            bookRepository.save(existing);
        }

        return new BookImportResultResponse(
                preview.action(),
                bookMapper.toResponse(existing),
                preview.changedBibliographicFields(),
                PROTECTED_PERSONAL_FIELDS
        );
    }

    private BookImportPreviewResponse response(
            BookMetadataCandidate candidate,
            BookImportAction action,
            BookEntity existing,
            List<BookMetadataDuplicate> duplicates,
            List<String> changedFields,
            boolean confirmationRequired,
            boolean importable,
            List<String> warnings
    ) {
        return new BookImportPreviewResponse(
                candidate,
                action,
                existing == null ? null : bookMapper.toResponse(existing),
                List.copyOf(duplicates),
                List.copyOf(changedFields),
                PROTECTED_PERSONAL_FIELDS,
                confirmationRequired,
                importable,
                List.copyOf(warnings)
        );
    }

    private BookEntity resolveTarget(
            String targetBookId,
            List<BookMetadataDuplicate> duplicates
    ) {
        if (targetBookId == null || targetBookId.isBlank()) {
            return null;
        }
        BookEntity target = findBook(targetBookId);
        if (!duplicates.isEmpty()
                && duplicates.stream().noneMatch(duplicate -> duplicate.bookId().equals(targetBookId))) {
            throw new InvalidRequestException("Odabrana ciljna knjiga nije među pronađenim duplikatima.");
        }
        return target;
    }

    private List<String> validateImportable(BookMetadataCandidate candidate) {
        List<String> warnings = new ArrayList<>();
        String author = joinedAuthors(candidate);
        String isbn = preferredIsbn(candidate);
        if (candidate.title() == null || candidate.title().isBlank()) {
            warnings.add("Izvor ne sadrži naslov.");
        } else if (candidate.title().length() > 255) {
            warnings.add("Naslov je predug za katalog.");
        }
        if (author.isBlank()) {
            warnings.add("Izvor ne sadrži autora.");
        } else if (author.length() > 255) {
            warnings.add("Popis autora je predug za katalog.");
        }
        if (isbn == null) {
            warnings.add("Izvor ne sadrži ISBN-10 ili ISBN-13.");
        }
        if (candidate.publishedYear() == null
                || candidate.publishedYear() < 0
                || candidate.publishedYear() > 3000) {
            warnings.add("Izvor ne sadrži valjanu godinu izdanja.");
        }
        return List.copyOf(warnings);
    }

    private List<String> changedFields(BookEntity existing, BookMetadataCandidate candidate) {
        List<String> fields = new ArrayList<>();
        if (!Objects.equals(existing.getTitle(), candidate.title().trim())) {
            fields.add("title");
        }
        if (!Objects.equals(existing.getAuthor(), joinedAuthors(candidate))) {
            fields.add("author");
        }
        if (!BookMetadataService.normalizeIsbn(existing.getIsbn())
                .equals(BookMetadataService.normalizeIsbn(preferredIsbn(candidate)))) {
            fields.add("isbn");
        }
        if (!Objects.equals(existing.getPublishedYear(), candidate.publishedYear())) {
            fields.add("publishedYear");
        }
        return List.copyOf(fields);
    }

    private void applyBibliographicFields(BookEntity entity, BookMetadataCandidate candidate) {
        entity.setTitle(candidate.title().trim());
        entity.setAuthor(joinedAuthors(candidate));
        entity.setIsbn(preferredIsbn(candidate));
        entity.setPublishedYear(candidate.publishedYear());
    }

    private String joinedAuthors(BookMetadataCandidate candidate) {
        return candidate.authors() == null
                ? ""
                : candidate.authors().stream()
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .filter(value -> !value.isBlank())
                        .distinct()
                        .collect(java.util.stream.Collectors.joining(", "));
    }

    private String preferredIsbn(BookMetadataCandidate candidate) {
        String isbn13 = BookMetadataService.normalizeIsbn(candidate.isbn13());
        if (isbn13.length() == 13) {
            return isbn13;
        }
        String isbn10 = BookMetadataService.normalizeIsbn(candidate.isbn10());
        return isbn10.length() == 10 ? isbn10 : null;
    }

    private BookEntity findBook(String bookId) {
        return bookRepository.findByBookId(bookId)
                .orElseThrow(() -> new BookNotFoundException(bookId));
    }
}
