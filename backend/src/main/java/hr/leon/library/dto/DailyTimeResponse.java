package hr.leon.library.dto;

import java.time.LocalDate;
import java.util.List;

public record DailyTimeResponse(
        LocalDate date,
        String zone,
        long totalSeconds,
        List<DailyActivityTimeResponse> activities
) {
}
