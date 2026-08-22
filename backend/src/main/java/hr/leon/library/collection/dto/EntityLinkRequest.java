package hr.leon.library.collection.dto;

import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.entity.RelationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EntityLinkRequest(
        @NotNull EntityReferenceType sourceType,
        @NotBlank @Size(max = 36) String sourceId,
        @NotNull EntityReferenceType targetType,
        @NotBlank @Size(max = 36) String targetId,
        @NotNull RelationType relationType,
        @Size(max = 500) String note
) {
}
