package hr.leon.library.controller;

import hr.leon.library.dto.ActivityRequest;
import hr.leon.library.dto.ActivityResponse;
import hr.leon.library.dto.TopicRequest;
import hr.leon.library.dto.TopicResponse;
import hr.leon.library.service.ActivityService;
import hr.leon.library.service.TopicService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final TopicService topicService;
    private final ActivityService activityService;

    public TopicController(TopicService topicService, ActivityService activityService) {
        this.topicService = topicService;
        this.activityService = activityService;
    }

    @GetMapping
    public List<TopicResponse> getAll() {
        return topicService.getAll();
    }

    @GetMapping("/{topicId}")
    public TopicResponse getByTopicId(@PathVariable String topicId) {
        return topicService.getByTopicId(topicId);
    }

    @PostMapping
    public ResponseEntity<TopicResponse> create(@Valid @RequestBody TopicRequest request) {
        TopicResponse created = topicService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{topicId}")
                .buildAndExpand(created.topicId())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{topicId}")
    public TopicResponse update(
            @PathVariable String topicId,
            @Valid @RequestBody TopicRequest request
    ) {
        return topicService.update(topicId, request);
    }

    @DeleteMapping("/{topicId}")
    public ResponseEntity<Void> delete(@PathVariable String topicId) {
        topicService.delete(topicId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{topicId}/activities")
    public List<ActivityResponse> getActivities(@PathVariable String topicId) {
        return activityService.getActivitiesForTopic(topicId);
    }

    @PostMapping("/{topicId}/activities")
    public ResponseEntity<ActivityResponse> createActivity(
            @PathVariable String topicId,
            @Valid @RequestBody ActivityRequest request
    ) {
        ActivityResponse created = activityService.createActivity(topicId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
