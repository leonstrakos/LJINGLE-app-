package hr.leon.library.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BookMetadataReconcileRequest(
        @NotEmpty(message = "Pošaljite barem jedan izvor metapodataka.")
        @Size(max = 5, message = "Odjednom je moguće uskladiti najviše pet izvora.")
        List<@Valid BookMetadataSource> sources
) {
}
