package hr.leon.library.dto;

import hr.leon.library.metadata.MetadataProvider;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BookMetadataSource(
        @NotNull(message = "Izvor metapodataka je obvezan.")
        MetadataProvider provider,

        @NotBlank(message = "Vanjski identifikator je obvezan.")
        @Size(max = 255, message = "Vanjski identifikator smije imati najviše 255 znakova.")
        String externalId
) {
}
