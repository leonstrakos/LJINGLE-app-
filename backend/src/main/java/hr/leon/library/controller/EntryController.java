package hr.leon.library.controller;

import hr.leon.library.dto.EntryRequest;
import hr.leon.library.dto.EntryResponse;
import hr.leon.library.service.EntryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/entries")
public class EntryController {

    private final EntryService entryService;

    public EntryController(EntryService entryService) {
        this.entryService = entryService;
    }

    @GetMapping
    public List<EntryResponse> getAll(
            @RequestParam(required = false) String bookId,
            @RequestParam(required = false) String topicId,
            @RequestParam(required = false) String activityId,
            @RequestParam(required = false) String type
    ) {
        return entryService.getAll(bookId, topicId, activityId, type);
    }

    @GetMapping("/{entryId}")
    public EntryResponse getByEntryId(@PathVariable String entryId) {
        return entryService.getByEntryId(entryId);
    }

    @PostMapping
    public ResponseEntity<EntryResponse> create(@Valid @RequestBody EntryRequest request) {
        EntryResponse created = entryService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{entryId}")
                .buildAndExpand(created.entryId())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{entryId}")
    public EntryResponse update(
            @PathVariable String entryId,
            @Valid @RequestBody EntryRequest request
    ) {
        return entryService.update(entryId, request);
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> delete(@PathVariable String entryId) {
        entryService.delete(entryId);
        return ResponseEntity.noContent().build();
    }
}
