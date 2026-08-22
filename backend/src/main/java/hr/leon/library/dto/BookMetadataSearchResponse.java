package hr.leon.library.dto;

import java.util.List;

public record BookMetadataSearchResponse(
        String query,
        List<BookMetadataCandidate> results,
        List<String> warnings
) {
}
