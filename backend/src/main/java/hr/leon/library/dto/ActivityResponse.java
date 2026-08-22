package hr.leon.library.dto;

import java.time.Instant;

public record ActivityResponse(
        String activityId,
        String label,
        String activityType,
        String bookId,
        String topicId,
        Instant createdAt,
        Instant modifiedAt
) {
}
