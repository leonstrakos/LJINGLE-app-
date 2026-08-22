package hr.leon.library.dto;

import java.util.List;

public record BookMetadataCandidate(
        String title,
        List<String> authors,
        String isbn10,
        String isbn13,
        Integer publishedYear,
        String publisher,
        Integer pageCount,
        String description,
        String coverUrl,
        List<BookMetadataSource> sources
) {
}
