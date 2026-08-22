package hr.leon.library.collection.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollectionRequest(
        @NotBlank(message = "Naziv kolekcije je obavezan.")
        @Size(max = 120, message = "Naziv kolekcije smije imati najviše 120 znakova.")
        String name,

        @Size(max = 1000, message = "Opis smije imati najviše 1000 znakova.")
        String description,

        @Size(max = 16, message = "Simbol smije imati najviše 16 znakova.")
        String symbol
) {
}
