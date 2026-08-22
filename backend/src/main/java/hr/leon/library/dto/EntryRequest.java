package hr.leon.library.dto;

import hr.leon.library.entity.EntryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EntryRequest(
        @Size(max = 255, message = "Naslov zapisa smije imati najviše 255 znakova.")
        String title,

        @NotBlank(message = "Sadržaj zapisa je obavezan.")
        @Size(max = 50000, message = "Sadržaj zapisa smije imati najviše 50000 znakova.")
        String content,

        @NotNull(message = "Vrsta zapisa je obavezna.")
        EntryType type,

        @Size(max = 36, message = "Identifikator knjige nije valjan.")
        String bookId,

        @Size(max = 36, message = "Identifikator teme nije valjan.")
        String topicId,

        @Size(max = 36, message = "Identifikator aktivnosti nije valjan.")
        String activityId
) {
}
