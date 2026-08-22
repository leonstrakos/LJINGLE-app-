package hr.leon.library.media.controller;

import hr.leon.library.media.dto.MediaRequest;
import hr.leon.library.media.dto.MediaResponse;
import hr.leon.library.media.dto.MediaTimerResponse;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.entity.WatchStatus;
import hr.leon.library.media.service.MediaActivityService;
import hr.leon.library.media.service.MediaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaService mediaService;
    private final MediaActivityService mediaActivityService;

    public MediaController(MediaService mediaService, MediaActivityService mediaActivityService) {
        this.mediaService = mediaService;
        this.mediaActivityService = mediaActivityService;
    }

    @GetMapping
    public List<MediaResponse> getAll(
            @RequestParam(required = false) MediaType mediaType,
            @RequestParam(required = false) WatchStatus status
    ) {
        return mediaService.getAll(mediaType, status);
    }

    @GetMapping("/{mediaId}")
    public MediaResponse getById(@PathVariable String mediaId) {
        return mediaService.getByMediaId(mediaId);
    }

    @PostMapping
    public ResponseEntity<MediaResponse> create(@Valid @RequestBody MediaRequest request) {
        MediaResponse created = mediaService.create(request);
        return ResponseEntity
                .created(URI.create("/api/media/" + created.mediaId()))
                .body(created);
    }

    @PutMapping("/{mediaId}")
    public MediaResponse update(
            @PathVariable String mediaId,
            @Valid @RequestBody MediaRequest request
    ) {
        return mediaService.update(mediaId, request);
    }

    @DeleteMapping("/{mediaId}")
    public ResponseEntity<Void> delete(@PathVariable String mediaId) {
        mediaService.delete(mediaId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @GetMapping("/{mediaId}/watching")
    public MediaTimerResponse getWatchingTimer(@PathVariable String mediaId) {
        return mediaActivityService.getWatchingTimer(mediaId);
    }

    @PostMapping("/{mediaId}/watching/start")
    public MediaTimerResponse startWatching(@PathVariable String mediaId) {
        return mediaActivityService.startWatching(mediaId);
    }

    @PostMapping("/{mediaId}/watching/stop")
    public MediaTimerResponse stopWatching(@PathVariable String mediaId) {
        return mediaActivityService.stopWatching(mediaId);
    }
}
