package hr.leon.library.dto;

public record DailyActivityTimeResponse(
        String activityId,
        String label,
        String activityType,
        String bookId,
        long seconds,
        boolean running
) {
}
