package hr.leon.library.dto;

import java.time.Instant;

public record ActivityTimerResponse(
        String activityId,
        String label,
        String activityType,
        String bookId,
        String topicId,
        boolean running,
        String activeSessionId,
        Instant activeStartedAt,
        long completedSeconds,
        long totalSeconds
) {
}
