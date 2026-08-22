package hr.leon.library.collection.repository;

import hr.leon.library.collection.entity.CollectionItemEntity;
import hr.leon.library.collection.entity.EntityReferenceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CollectionItemRepository extends JpaRepository<CollectionItemEntity, Long> {
    List<CollectionItemEntity> findAllByCollectionCollectionIdOrderByPositionAscCreatedAtAsc(String collectionId);
    List<CollectionItemEntity> findAllByEntityTypeAndEntityId(EntityReferenceType entityType, String entityId);
    Optional<CollectionItemEntity> findByItemId(String itemId);
    Optional<CollectionItemEntity> findByCollectionCollectionIdAndItemId(String collectionId, String itemId);
    boolean existsByCollectionCollectionIdAndEntityTypeAndEntityId(
            String collectionId,
            EntityReferenceType entityType,
            String entityId
    );
    long countByCollectionCollectionId(String collectionId);
}
