package hr.leon.library.collection.dto;

import hr.leon.library.collection.entity.EntityReferenceType;

import java.time.Instant;

public record CollectionItemResponse(
        String itemId,
        EntityReferenceType entityType,
        String entityId,
        String title,
        String subtitle,
        int position,
        Instant addedAt
) {
}
