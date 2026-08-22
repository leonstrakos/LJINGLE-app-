package hr.leon.library.media.dto;

import java.time.Instant;

public record MediaTimerResponse(
        String activityId,
        String label,
        String activityType,
        String mediaId,
        boolean running,
        String activeSessionId,
        Instant activeStartedAt,
        long completedSeconds,
        long totalSeconds
) {
}
