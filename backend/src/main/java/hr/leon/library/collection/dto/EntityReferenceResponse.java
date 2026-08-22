package hr.leon.library.collection.dto;

import hr.leon.library.collection.entity.EntityReferenceType;

public record EntityReferenceResponse(
        EntityReferenceType entityType,
        String entityId,
        String title,
        String subtitle
) {
}
