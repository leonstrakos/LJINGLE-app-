package hr.leon.library.collection.controller;

import hr.leon.library.collection.dto.EntityLinkRequest;
import hr.leon.library.collection.dto.EntityLinkResponse;
import hr.leon.library.collection.dto.EntityReferenceResponse;
import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.service.EntityLinkService;
import hr.leon.library.collection.service.EntityReferenceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class EntityLinkController {

    private final EntityLinkService linkService;
    private final EntityReferenceService referenceService;

    public EntityLinkController(EntityLinkService linkService, EntityReferenceService referenceService) {
        this.linkService = linkService;
        this.referenceService = referenceService;
    }

    @GetMapping("/api/entity-links")
    public List<EntityLinkResponse> getLinks(
            @RequestParam EntityReferenceType entityType,
            @RequestParam String entityId
    ) {
        return linkService.getForEntity(entityType, entityId);
    }

    @PostMapping("/api/entity-links")
    public EntityLinkResponse create(@Valid @RequestBody EntityLinkRequest request) {
        return linkService.create(request);
    }

    @DeleteMapping("/api/entity-links/{linkId}")
    public ResponseEntity<Void> delete(@PathVariable String linkId) {
        linkService.delete(linkId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/entity-references")
    public List<EntityReferenceResponse> search(@RequestParam(required = false) String query) {
        return referenceService.search(query);
    }
}
