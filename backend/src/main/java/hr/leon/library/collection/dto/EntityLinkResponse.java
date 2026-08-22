package hr.leon.library.collection.dto;

import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.entity.RelationType;

import java.time.Instant;

public record EntityLinkResponse(
        String linkId,
        EntityReferenceType sourceType,
        String sourceId,
        EntityReferenceType targetType,
        String targetId,
        RelationType relationType,
        String note,
        EntityReferenceResponse source,
        EntityReferenceResponse target,
        Instant createdAt
) {
}
