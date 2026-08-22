package hr.leon.library.dto;

import java.time.Instant;

public record TopicResponse(
        String topicId,
        String name,
        String description,
        long activityCount,
        Instant createdAt,
        Instant modifiedAt
) {
}
