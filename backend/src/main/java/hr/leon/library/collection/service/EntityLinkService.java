package hr.leon.library.collection.service;

import hr.leon.library.collection.dto.EntityLinkRequest;
import hr.leon.library.collection.dto.EntityLinkResponse;
import hr.leon.library.collection.dto.EntityReferenceResponse;
import hr.leon.library.collection.entity.EntityLinkEntity;
import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.repository.EntityLinkRepository;
import hr.leon.library.exception.InvalidRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class EntityLinkService {

    private final EntityLinkRepository linkRepository;
    private final EntityReferenceService referenceService;

    public EntityLinkService(
            EntityLinkRepository linkRepository,
            EntityReferenceService referenceService
    ) {
        this.linkRepository = linkRepository;
        this.referenceService = referenceService;
    }

    public List<EntityLinkResponse> getForEntity(EntityReferenceType entityType, String entityId) {
        referenceService.resolve(entityType, entityId);
        return linkRepository.findAllForEntity(entityType, entityId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public EntityLinkResponse create(EntityLinkRequest request) {
        if (request.sourceType() == request.targetType() && request.sourceId().equals(request.targetId())) {
            throw new InvalidRequestException("Stavka se ne može povezati sama sa sobom.");
        }
        referenceService.resolve(request.sourceType(), request.sourceId());
        referenceService.resolve(request.targetType(), request.targetId());
        if (linkRepository.existsBySourceTypeAndSourceIdAndTargetTypeAndTargetIdAndRelationType(
                request.sourceType(),
                request.sourceId(),
                request.targetType(),
                request.targetId(),
                request.relationType()
        )) {
            throw new InvalidRequestException("Ta poveznica već postoji.");
        }

        EntityLinkEntity link = new EntityLinkEntity();
        link.setSourceType(request.sourceType());
        link.setSourceId(request.sourceId());
        link.setTargetType(request.targetType());
        link.setTargetId(request.targetId());
        link.setRelationType(request.relationType());
        link.setNote(normalize(request.note()));
        return toResponse(linkRepository.save(link));
    }

    @Transactional
    public void delete(String linkId) {
        EntityLinkEntity link = linkRepository.findByLinkId(linkId)
                .orElseThrow(() -> new InvalidRequestException("Poveznica nije pronađena."));
        linkRepository.delete(link);
    }

    private EntityLinkResponse toResponse(EntityLinkEntity link) {
        EntityReferenceResponse source = referenceService.resolve(link.getSourceType(), link.getSourceId());
        EntityReferenceResponse target = referenceService.resolve(link.getTargetType(), link.getTargetId());
        return new EntityLinkResponse(
                link.getLinkId(),
                link.getSourceType(),
                link.getSourceId(),
                link.getTargetType(),
                link.getTargetId(),
                link.getRelationType(),
                link.getNote(),
                source,
                target,
                link.getCreatedAt()
        );
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
