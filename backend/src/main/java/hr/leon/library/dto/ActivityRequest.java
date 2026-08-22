package hr.leon.library.dto;

import hr.leon.library.entity.ActivityType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ActivityRequest(
        @NotBlank(message = "Naziv aktivnosti je obavezan.")
        @Size(max = 255, message = "Naziv aktivnosti smije imati najviše 255 znakova.")
        String label,

        @NotNull(message = "Kategorija aktivnosti je obavezna.")
        ActivityType activityType
) {
}
