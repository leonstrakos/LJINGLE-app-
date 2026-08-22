package hr.leon.library.dto;

import java.util.List;

public record BookImportPreviewResponse(
        BookMetadataCandidate candidate,
        BookImportAction action,
        BookResponse existingBook,
        List<BookMetadataDuplicate> duplicates,
        List<String> changedBibliographicFields,
        List<String> protectedPersonalFields,
        boolean confirmationRequired,
        boolean importable,
        List<String> warnings
) {
}
