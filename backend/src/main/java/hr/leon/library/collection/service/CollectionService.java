package hr.leon.library.collection.service;

import hr.leon.library.collection.dto.CollectionDetailResponse;
import hr.leon.library.collection.dto.CollectionItemRequest;
import hr.leon.library.collection.dto.CollectionItemResponse;
import hr.leon.library.collection.dto.CollectionRequest;
import hr.leon.library.collection.dto.CollectionSummaryResponse;
import hr.leon.library.collection.dto.EntityReferenceResponse;
import hr.leon.library.collection.entity.CollectionEntity;
import hr.leon.library.collection.entity.CollectionItemEntity;
import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.repository.CollectionItemRepository;
import hr.leon.library.collection.repository.CollectionRepository;
import hr.leon.library.exception.InvalidRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final CollectionItemRepository itemRepository;
    private final EntityReferenceService referenceService;

    public CollectionService(
            CollectionRepository collectionRepository,
            CollectionItemRepository itemRepository,
            EntityReferenceService referenceService
    ) {
        this.collectionRepository = collectionRepository;
        this.itemRepository = itemRepository;
        this.referenceService = referenceService;
    }

    public List<CollectionSummaryResponse> getAll() {
        return collectionRepository.findAllByOrderByNameAsc().stream()
                .map(this::toSummary)
                .toList();
    }

    public CollectionDetailResponse getById(String collectionId) {
        CollectionEntity collection = findCollection(collectionId);
        List<CollectionItemResponse> items = itemRepository
                .findAllByCollectionCollectionIdOrderByPositionAscCreatedAtAsc(collectionId)
                .stream()
                .map(this::toItemResponse)
                .toList();
        return new CollectionDetailResponse(
                collection.getCollectionId(),
                collection.getName(),
                collection.getDescription(),
                collection.getSymbol(),
                items
        );
    }

    public List<CollectionSummaryResponse> getForEntity(EntityReferenceType type, String entityId) {
        referenceService.resolve(type, entityId);
        Map<String, CollectionSummaryResponse> unique = new LinkedHashMap<>();
        itemRepository.findAllByEntityTypeAndEntityId(type, entityId).forEach(item -> {
            CollectionEntity collection = item.getCollection();
            unique.put(collection.getCollectionId(), toSummary(collection));
        });
        return List.copyOf(unique.values());
    }

    @Transactional
    public CollectionSummaryResponse create(CollectionRequest request) {
        String name = requiredName(request.name());
        if (collectionRepository.existsByNameIgnoreCase(name)) {
            throw new InvalidRequestException("Kolekcija s tim nazivom već postoji.");
        }
        CollectionEntity entity = new CollectionEntity();
        apply(entity, request);
        return toSummary(collectionRepository.save(entity));
    }

    @Transactional
    public CollectionSummaryResponse update(String collectionId, CollectionRequest request) {
        CollectionEntity entity = findCollection(collectionId);
        String name = requiredName(request.name());
        if (collectionRepository.existsByNameIgnoreCaseAndCollectionIdNot(name, collectionId)) {
            throw new InvalidRequestException("Kolekcija s tim nazivom već postoji.");
        }
        apply(entity, request);
        return toSummary(collectionRepository.saveAndFlush(entity));
    }

    @Transactional
    public void delete(String collectionId) {
        collectionRepository.delete(findCollection(collectionId));
    }

    @Transactional
    public CollectionItemResponse addItem(String collectionId, CollectionItemRequest request) {
        CollectionEntity collection = findCollection(collectionId);
        EntityReferenceResponse reference = referenceService.resolve(request.entityType(), request.entityId());
        if (itemRepository.existsByCollectionCollectionIdAndEntityTypeAndEntityId(
                collectionId,
                request.entityType(),
                request.entityId()
        )) {
            throw new InvalidRequestException("Ta je stavka već u kolekciji.");
        }
        CollectionItemEntity item = new CollectionItemEntity();
        item.setCollection(collection);
        item.setEntityType(request.entityType());
        item.setEntityId(request.entityId());
        item.setPosition((int) itemRepository.countByCollectionCollectionId(collectionId));
        CollectionItemEntity saved = itemRepository.save(item);
        return new CollectionItemResponse(
                saved.getItemId(),
                saved.getEntityType(),
                saved.getEntityId(),
                reference.title(),
                reference.subtitle(),
                saved.getPosition(),
                saved.getCreatedAt()
        );
    }

    @Transactional
    public void removeItem(String collectionId, String itemId) {
        CollectionItemEntity item = itemRepository
                .findByCollectionCollectionIdAndItemId(collectionId, itemId)
                .orElseThrow(() -> new InvalidRequestException("Stavka nije pronađena u toj kolekciji."));
        itemRepository.delete(item);
    }

    private CollectionEntity findCollection(String collectionId) {
        return collectionRepository.findByCollectionId(collectionId)
                .orElseThrow(() -> new InvalidRequestException("Kolekcija nije pronađena."));
    }

    private CollectionSummaryResponse toSummary(CollectionEntity entity) {
        return new CollectionSummaryResponse(
                entity.getCollectionId(),
                entity.getName(),
                entity.getDescription(),
                entity.getSymbol(),
                itemRepository.countByCollectionCollectionId(entity.getCollectionId())
        );
    }

    private CollectionItemResponse toItemResponse(CollectionItemEntity item) {
        EntityReferenceResponse reference = referenceService.resolve(item.getEntityType(), item.getEntityId());
        return new CollectionItemResponse(
                item.getItemId(),
                item.getEntityType(),
                item.getEntityId(),
                reference.title(),
                reference.subtitle(),
                item.getPosition(),
                item.getCreatedAt()
        );
    }

    private void apply(CollectionEntity entity, CollectionRequest request) {
        entity.setName(requiredName(request.name()));
        entity.setDescription(normalize(request.description()));
        entity.setSymbol(normalize(request.symbol()));
    }

    private String requiredName(String value) {
        String normalized = normalize(value);
        if (normalized == null) throw new InvalidRequestException("Naziv kolekcije je obavezan.");
        return normalized;
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
