package hr.leon.library.controller;

import hr.leon.library.dto.ActivityTimerResponse;
import hr.leon.library.dto.TimeSessionResponse;
import hr.leon.library.service.ActivityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping("/books/{bookId}/reading")
    public ActivityTimerResponse getReadingTimer(@PathVariable String bookId) {
        return activityService.getReadingTimer(bookId);
    }

    @PostMapping("/books/{bookId}/reading/start")
    public ActivityTimerResponse startReading(@PathVariable String bookId) {
        return activityService.startReading(bookId);
    }

    @PostMapping("/books/{bookId}/reading/stop")
    public ActivityTimerResponse stopReading(@PathVariable String bookId) {
        return activityService.stopReading(bookId);
    }

    @GetMapping("/active")
    public List<ActivityTimerResponse> getActiveTimers() {
        return activityService.getActiveTimers();
    }

    @GetMapping("/recent")
    public List<ActivityTimerResponse> getRecentActivities(
            @RequestParam(defaultValue = "6") int limit
    ) {
        return activityService.getRecentActivities(limit);
    }

    @PostMapping("/{activityId}/stop")
    public ActivityTimerResponse stopActivity(@PathVariable String activityId) {
        return activityService.stopActivity(activityId);
    }

    @PostMapping("/{activityId}/start")
    public ActivityTimerResponse startActivity(@PathVariable String activityId) {
        return activityService.startActivity(activityId);
    }

    @GetMapping("/{activityId}/sessions")
    public List<TimeSessionResponse> getSessions(@PathVariable String activityId) {
        return activityService.getSessions(activityId);
    }
}
