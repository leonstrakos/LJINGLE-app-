package hr.leon.library.dto;

import java.time.Instant;

public record TimeSessionResponse(
        String sessionId,
        Instant startedAt,
        Instant endedAt,
        long durationSeconds,
        boolean running
) {
}
