package hr.leon.library.dto;

import java.time.Instant;

public record HistorySessionResponse(
        String sessionId,
        String activityId,
        String activityLabel,
        String activityType,
        String bookId,
        String topicId,
        Instant startedAt,
        Instant endedAt,
        long durationSeconds,
        boolean running
) {
}
