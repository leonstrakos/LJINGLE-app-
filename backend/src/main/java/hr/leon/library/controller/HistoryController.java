package hr.leon.library.controller;

import hr.leon.library.dto.HistorySessionResponse;
import hr.leon.library.dto.PagedResponse;
import hr.leon.library.service.HistoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoryService historyService;

    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping("/sessions")
    public PagedResponse<HistorySessionResponse> getSessions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String zone
    ) {
        return historyService.getSessions(page, size, date, zone);
    }
}
