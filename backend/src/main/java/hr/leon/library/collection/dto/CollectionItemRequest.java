package hr.leon.library.collection.dto;

import hr.leon.library.collection.entity.EntityReferenceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CollectionItemRequest(
        @NotNull(message = "Vrsta stavke je obavezna.")
        EntityReferenceType entityType,

        @NotBlank(message = "Identifikator stavke je obavezan.")
        @Size(max = 36, message = "Identifikator stavke nije valjan.")
        String entityId
) {
}
