package hr.leon.library.service;

import hr.leon.library.dto.BookMetadataCandidate;
import hr.leon.library.dto.BookMetadataDuplicate;
import hr.leon.library.dto.BookMetadataDuplicate.DuplicateReason;
import hr.leon.library.dto.BookMetadataIsbnResponse;
import hr.leon.library.dto.BookMetadataSearchResponse;
import hr.leon.library.dto.BookMetadataSource;
import hr.leon.library.entity.BookEntity;
import hr.leon.library.exception.InvalidRequestException;
import hr.leon.library.exception.MetadataItemNotFoundException;
import hr.leon.library.exception.MetadataProviderException;
import hr.leon.library.metadata.BookMetadataProvider;
import hr.leon.library.metadata.ExternalBookMetadata;
import hr.leon.library.metadata.MetadataProvider;
import hr.leon.library.repository.BookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class BookMetadataService {

    private final Map<MetadataProvider, BookMetadataProvider> providers;
    private final BookRepository bookRepository;

    public BookMetadataService(
            List<BookMetadataProvider> providers,
            BookRepository bookRepository
    ) {
        this.providers = new EnumMap<>(MetadataProvider.class);
        providers.forEach(provider -> this.providers.put(provider.provider(), provider));
        this.bookRepository = bookRepository;
    }

    public BookMetadataSearchResponse search(
            String query,
            MetadataProvider requestedProvider,
            int limit
    ) {
        String normalizedQuery = validateQuery(query);
        List<ExternalBookMetadata> externalResults = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (BookMetadataProvider provider : selectedProviders(requestedProvider)) {
            try {
                externalResults.addAll(provider.search(normalizedQuery, limit));
            } catch (MetadataProviderException exception) {
                if (requestedProvider != null) {
                    throw exception;
                }
                warnings.add(exception.getMessage());
            }
        }

        List<BookMetadataCandidate> candidates = merge(externalResults).stream()
                .limit(limit)
                .toList();
        return new BookMetadataSearchResponse(normalizedQuery, candidates, List.copyOf(warnings));
    }

    public BookMetadataIsbnResponse lookupIsbn(String isbn) {
        String normalizedIsbn = validateIsbn(isbn);
        List<ExternalBookMetadata> results = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (BookMetadataProvider provider : selectedProviders(null)) {
            try {
                provider.lookupIsbn(normalizedIsbn).ifPresent(results::add);
            } catch (MetadataProviderException exception) {
                warnings.add(exception.getMessage());
            }
        }

        BookMetadataCandidate candidate = merge(results).stream().findFirst().orElse(null);
        return new BookMetadataIsbnResponse(
                normalizedIsbn,
                candidate,
                candidate == null ? List.of() : findDuplicates(candidate),
                List.copyOf(warnings)
        );
    }

    public BookMetadataCandidate reconcile(List<BookMetadataSource> sources) {
        if (sources == null || sources.isEmpty()) {
            throw new InvalidRequestException("Pošaljite barem jedan izvor metapodataka.");
        }
        List<ExternalBookMetadata> resolved = sources.stream()
                .map(this::resolveExact)
                .toList();
        List<BookMetadataCandidate> merged = merge(resolved);
        if (merged.size() != 1) {
            throw new InvalidRequestException("Odabrani izvori ne opisuju istu knjigu.");
        }
        return merged.get(0);
    }

    public BookMetadataCandidate resolveForImport(BookMetadataSource source) {
        ExternalBookMetadata selected = resolveExact(source);
        List<ExternalBookMetadata> resolved = new ArrayList<>();
        resolved.add(selected);

        String isbn = firstNonBlank(selected.isbn13(), selected.isbn10());
        if (isbn != null) {
            for (BookMetadataProvider provider : selectedProviders(null)) {
                if (provider.provider() == selected.provider()) {
                    continue;
                }
                try {
                    provider.lookupIsbn(isbn).ifPresent(resolved::add);
                } catch (MetadataProviderException ignored) {
                    // The selected source remains usable when the supplemental source is unavailable.
                }
            }
        }
        return merge(resolved).get(0);
    }

    public List<BookMetadataDuplicate> findDuplicates(BookMetadataCandidate candidate) {
        String candidateIsbn13 = normalizeIsbn(candidate.isbn13());
        String candidateIsbn10 = normalizeIsbn(candidate.isbn10());
        String candidateTitle = normalizeText(candidate.title());
        Set<String> candidateAuthors = new LinkedHashSet<>();
        if (candidate.authors() != null) {
            candidate.authors().stream()
                    .map(BookMetadataService::normalizeText)
                    .filter(value -> !value.isBlank())
                    .forEach(candidateAuthors::add);
            candidateAuthors.add(normalizeText(String.join(", ", candidate.authors())));
        }

        List<BookMetadataDuplicate> duplicates = new ArrayList<>();
        for (BookEntity book : bookRepository.findAll()) {
            String storedIsbn = normalizeIsbn(book.getIsbn());
            DuplicateReason reason = null;
            if (!storedIsbn.isBlank()
                    && (storedIsbn.equals(candidateIsbn13) || storedIsbn.equals(candidateIsbn10))) {
                reason = DuplicateReason.ISBN;
            } else if (!candidateTitle.isBlank()
                    && candidateTitle.equals(normalizeText(book.getTitle()))
                    && candidateAuthors.contains(normalizeText(book.getAuthor()))) {
                reason = DuplicateReason.TITLE_AUTHOR;
            }

            if (reason != null) {
                duplicates.add(new BookMetadataDuplicate(
                        book.getBookId(),
                        book.getTitle(),
                        book.getAuthor(),
                        book.getIsbn(),
                        reason
                ));
            }
        }
        return List.copyOf(duplicates);
    }

    private ExternalBookMetadata resolveExact(BookMetadataSource source) {
        BookMetadataProvider provider = provider(source.provider());
        return provider.getByExternalId(source.externalId())
                .orElseThrow(() -> new MetadataItemNotFoundException(
                        source.provider(),
                        source.externalId()
                ));
    }

    private List<BookMetadataProvider> selectedProviders(MetadataProvider requestedProvider) {
        if (requestedProvider != null) {
            return List.of(provider(requestedProvider));
        }
        return Arrays.stream(MetadataProvider.values())
                .map(providers::get)
                .filter(Objects::nonNull)
                .toList();
    }

    private BookMetadataProvider provider(MetadataProvider provider) {
        BookMetadataProvider resolved = providers.get(provider);
        if (resolved == null) {
            throw new InvalidRequestException("Izvor metapodataka nije konfiguriran: " + provider);
        }
        return resolved;
    }

    private List<BookMetadataCandidate> merge(Collection<ExternalBookMetadata> books) {
        List<MergedBook> merged = new ArrayList<>();
        for (ExternalBookMetadata book : books) {
            Optional<MergedBook> match = merged.stream()
                    .filter(existing -> existing.matches(book))
                    .findFirst();
            if (match.isPresent()) {
                match.get().merge(book);
            } else {
                merged.add(new MergedBook(book));
            }
        }
        return merged.stream().map(MergedBook::toCandidate).toList();
    }

    private String validateQuery(String query) {
        String value = query == null ? "" : query.trim();
        if (value.length() < 2 || value.length() > 200) {
            throw new InvalidRequestException("Pretraga mora imati između 2 i 200 znakova.");
        }
        return value;
    }

    private String validateIsbn(String isbn) {
        String normalized = normalizeIsbn(isbn);
        if (normalized.length() != 10 && normalized.length() != 13) {
            throw new InvalidRequestException("ISBN mora imati 10 ili 13 znakova.");
        }
        return normalized;
    }

    static String normalizeIsbn(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[^0-9Xx]", "").toUpperCase(Locale.ROOT);
    }

    static String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }

    private static String firstNonBlank(String... values) {
        return Arrays.stream(values)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private static final class MergedBook {
        private String title;
        private List<String> authors;
        private String isbn10;
        private String isbn13;
        private Integer publishedYear;
        private String publisher;
        private Integer pageCount;
        private String description;
        private String coverUrl;
        private final LinkedHashSet<BookMetadataSource> sources = new LinkedHashSet<>();

        private MergedBook(ExternalBookMetadata book) {
            merge(book);
        }

        private boolean matches(ExternalBookMetadata other) {
            Set<String> currentIsbns = normalizedIsbns(isbn10, isbn13);
            Set<String> otherIsbns = normalizedIsbns(other.isbn10(), other.isbn13());
            boolean sharedIsbn = currentIsbns.stream()
                    .anyMatch(otherIsbns::contains);
            if (sharedIsbn) {
                return true;
            }
            if (!currentIsbns.isEmpty() && !otherIsbns.isEmpty()) {
                return false;
            }

            if (!normalizeText(title).equals(normalizeText(other.title()))) {
                return false;
            }
            Set<String> currentAuthors = normalizedAuthors(authors);
            Set<String> otherAuthors = normalizedAuthors(other.authors());
            return !currentAuthors.isEmpty()
                    && currentAuthors.stream().anyMatch(otherAuthors::contains);
        }

        private void merge(ExternalBookMetadata book) {
            title = firstNonBlank(title, book.title());
            if ((authors == null || authors.isEmpty()) && book.authors() != null) {
                authors = List.copyOf(book.authors());
            }
            isbn10 = firstNonBlank(isbn10, book.isbn10());
            isbn13 = firstNonBlank(isbn13, book.isbn13());
            publishedYear = publishedYear == null ? book.publishedYear() : publishedYear;
            publisher = firstNonBlank(publisher, book.publisher());
            pageCount = pageCount == null ? book.pageCount() : pageCount;
            if (book.description() != null
                    && (description == null || book.description().length() > description.length())) {
                description = book.description();
            }
            coverUrl = firstNonBlank(coverUrl, book.coverUrl());
            sources.add(new BookMetadataSource(book.provider(), book.externalId()));
        }

        private BookMetadataCandidate toCandidate() {
            return new BookMetadataCandidate(
                    title,
                    authors == null ? List.of() : List.copyOf(authors),
                    isbn10,
                    isbn13,
                    publishedYear,
                    publisher,
                    pageCount,
                    description,
                    coverUrl,
                    List.copyOf(sources)
            );
        }

        private static Set<String> normalizedAuthors(List<String> values) {
            if (values == null) {
                return Set.of();
            }
            return values.stream()
                    .map(BookMetadataService::normalizeText)
                    .filter(value -> !value.isBlank())
                    .collect(java.util.stream.Collectors.toSet());
        }

        private static Set<String> normalizedIsbns(String... values) {
            Set<String> normalized = new LinkedHashSet<>();
            Arrays.stream(values)
                    .map(BookMetadataService::normalizeIsbn)
                    .filter(value -> !value.isBlank())
                    .forEach(normalized::add);
            return normalized;
        }
    }
}
