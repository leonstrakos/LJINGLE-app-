package hr.leon.library.exception;

public class ActivityNotFoundException extends RuntimeException {
    public ActivityNotFoundException(String activityId) {
        super("Aktivnost s identifikatorom " + activityId + " nije pronađena.");
    }
}
