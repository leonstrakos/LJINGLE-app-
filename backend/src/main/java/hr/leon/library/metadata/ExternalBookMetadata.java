package hr.leon.library.metadata;

import java.util.List;

public record ExternalBookMetadata(
        MetadataProvider provider,
        String externalId,
        String title,
        List<String> authors,
        String isbn10,
        String isbn13,
        Integer publishedYear,
        String publisher,
        Integer pageCount,
        String description,
        String coverUrl
) {
}
