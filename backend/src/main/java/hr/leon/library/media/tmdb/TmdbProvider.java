package hr.leon.library.media.tmdb;

import hr.leon.library.media.dto.TmdbMediaResponse;
import hr.leon.library.media.dto.TmdbSearchResponse;
import hr.leon.library.media.entity.MediaType;

public interface TmdbProvider {
    TmdbSearchResponse search(String query, MediaType mediaType, int page);

    TmdbMediaResponse getDetails(MediaType mediaType, long tmdbId);
}
