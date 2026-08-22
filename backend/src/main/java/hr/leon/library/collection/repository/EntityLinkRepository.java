package hr.leon.library.collection.repository;

import hr.leon.library.collection.entity.EntityLinkEntity;
import hr.leon.library.collection.entity.EntityReferenceType;
import hr.leon.library.collection.entity.RelationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EntityLinkRepository extends JpaRepository<EntityLinkEntity, Long> {
    Optional<EntityLinkEntity> findByLinkId(String linkId);

    @Query("""
            select link from EntityLinkEntity link
            where (link.sourceType = :entityType and link.sourceId = :entityId)
               or (link.targetType = :entityType and link.targetId = :entityId)
            order by link.createdAt desc
            """)
    List<EntityLinkEntity> findAllForEntity(
            @Param("entityType") EntityReferenceType entityType,
            @Param("entityId") String entityId
    );

    boolean existsBySourceTypeAndSourceIdAndTargetTypeAndTargetIdAndRelationType(
            EntityReferenceType sourceType,
            String sourceId,
            EntityReferenceType targetType,
            String targetId,
            RelationType relationType
    );
}
