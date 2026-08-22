package hr.leon.library.dto;

import java.util.List;

public record BookImportResultResponse(
        BookImportAction action,
        BookResponse book,
        List<String> changedBibliographicFields,
        List<String> protectedPersonalFields
) {
}
