package hr.leon.library.dto;

import java.util.List;

public record GameMetadataResponse(
        long igdbId,
        String title,
        String developer,
        Integer releaseYear,
        String coverUrl,
        List<String> platforms
) {
}
