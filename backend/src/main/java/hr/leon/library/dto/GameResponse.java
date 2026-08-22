package hr.leon.library.dto;

import hr.leon.library.entity.Enjoyment;
import hr.leon.library.entity.GameStatus;

import java.time.LocalDate;

public record GameResponse(
        String gameId,
        String title,
        String developer,
        String platform,
        Integer releaseYear,
        GameStatus gameStatus,
        int progress,
        Enjoyment enjoyment,
        boolean favourite,
        LocalDate startedOn,
        LocalDate finishedOn,
        Long igdbId,
        String coverUrl,
        String playingActivityId
) {
}
