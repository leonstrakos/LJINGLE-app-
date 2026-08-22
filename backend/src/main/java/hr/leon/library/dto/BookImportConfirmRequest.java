package hr.leon.library.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BookImportConfirmRequest(
        @NotNull(message = "Izvor metapodataka je obvezan.")
        @Valid
        BookMetadataSource source,

        @Size(max = 36, message = "Identifikator knjige nije valjan.")
        String targetBookId,

        boolean confirmMetadataUpdate
) {
}
