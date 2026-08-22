package hr.leon.library.collection.repository;

import hr.leon.library.collection.entity.CollectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CollectionRepository extends JpaRepository<CollectionEntity, Long> {
    Optional<CollectionEntity> findByCollectionId(String collectionId);
    List<CollectionEntity> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCaseAndCollectionIdNot(String name, String collectionId);
    boolean existsByNameIgnoreCase(String name);
}
