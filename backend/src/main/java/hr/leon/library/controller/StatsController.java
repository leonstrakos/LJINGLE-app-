package hr.leon.library.controller;

import hr.leon.library.dto.DailyTimeResponse;
import hr.leon.library.service.StatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/daily")
    public DailyTimeResponse getDaily(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String zone
    ) {
        return statsService.getDaily(date, zone);
    }
}
