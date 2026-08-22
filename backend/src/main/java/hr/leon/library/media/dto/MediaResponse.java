package hr.leon.library.media.dto;

import hr.leon.library.entity.Enjoyment;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.entity.WatchStatus;

import java.time.LocalDate;

public record MediaResponse(
        String mediaId,
        MediaType mediaType,
        Long tmdbId,
        String title,
        String originalTitle,
        String overview,
        String posterPath,
        String backdropPath,
        Integer releaseYear,
        WatchStatus watchStatus,
        int progress,
        Enjoyment enjoyment,
        boolean favourite,
        LocalDate startedOn,
        LocalDate completedOn
) {
}
