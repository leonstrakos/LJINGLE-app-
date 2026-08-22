package hr.leon.library.media.dto;

import java.util.List;

public record TmdbSearchResponse(
        int page,
        int totalPages,
        long totalResults,
        List<TmdbMediaResponse> results
) {
}
