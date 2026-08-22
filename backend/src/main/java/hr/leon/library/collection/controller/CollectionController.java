package hr.leon.library.collection.controller;

import hr.leon.library.collection.dto.CollectionDetailResponse;
import hr.leon.library.collection.dto.CollectionItemRequest;
import hr.leon.library.collection.dto.CollectionItemResponse;
import hr.leon.library.collection.dto.CollectionRequest;
import hr.leon.library.collection.dto.CollectionSummaryResponse;
import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.service.CollectionService;
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

import java.util.List;

@RestController
@RequestMapping("/api/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping
    public List<CollectionSummaryResponse> getAll() {
        return collectionService.getAll();
    }

    @GetMapping("/for-entity")
    public List<CollectionSummaryResponse> getForEntity(
            @RequestParam EntityReferenceType entityType,
            @RequestParam String entityId
    ) {
        return collectionService.getForEntity(entityType, entityId);
    }

    @GetMapping("/{collectionId}")
    public CollectionDetailResponse getById(@PathVariable String collectionId) {
        return collectionService.getById(collectionId);
    }

    @PostMapping
    public CollectionSummaryResponse create(@Valid @RequestBody CollectionRequest request) {
        return collectionService.create(request);
    }

    @PutMapping("/{collectionId}")
    public CollectionSummaryResponse update(
            @PathVariable String collectionId,
            @Valid @RequestBody CollectionRequest request
    ) {
        return collectionService.update(collectionId, request);
    }

    @DeleteMapping("/{collectionId}")
    public ResponseEntity<Void> delete(@PathVariable String collectionId) {
        collectionService.delete(collectionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{collectionId}/items")
    public CollectionItemResponse addItem(
            @PathVariable String collectionId,
            @Valid @RequestBody CollectionItemRequest request
    ) {
        return collectionService.addItem(collectionId, request);
    }

    @DeleteMapping("/{collectionId}/items/{itemId}")
    public ResponseEntity<Void> removeItem(
            @PathVariable String collectionId,
            @PathVariable String itemId
    ) {
        collectionService.removeItem(collectionId, itemId);
        return ResponseEntity.noContent().build();
    }
}
