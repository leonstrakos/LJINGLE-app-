package hr.leon.library.dto;

import java.util.List;

public record BookMetadataIsbnResponse(
        String isbn,
        BookMetadataCandidate candidate,
        List<BookMetadataDuplicate> duplicates,
        List<String> warnings
) {
}
