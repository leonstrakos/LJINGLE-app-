package hr.leon.library.dto;

import java.time.Instant;

public record EntryResponse(
        String entryId,
        String title,
        String content,
        String type,
        String bookId,
        String topicId,
        String activityId,
        Instant createdAt,
        Instant modifiedAt
) {
}
