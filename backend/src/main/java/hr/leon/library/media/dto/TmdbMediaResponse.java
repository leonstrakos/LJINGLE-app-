package hr.leon.library.media.dto;

import hr.leon.library.media.entity.MediaType;

public record TmdbMediaResponse(
        long tmdbId,
        MediaType mediaType,
        String title,
        String originalTitle,
        String overview,
        String posterPath,
        String posterUrl,
        String backdropPath,
        String backdropUrl,
        Integer releaseYear
) {
}
