package hr.leon.library.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TopicRequest(
        @NotBlank(message = "Naziv teme je obavezan.")
        @Size(max = 120, message = "Naziv teme smije imati najviše 120 znakova.")
        String name,

        @Size(max = 1000, message = "Opis teme smije imati najviše 1000 znakova.")
        String description
) {
}
