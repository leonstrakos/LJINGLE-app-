package hr.leon.library.collection.entity;

import hr.leon.library.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "entity_links")
public class EntityLinkEntity extends BaseEntity {

    @Column(name = "link_id", nullable = false, unique = true, updatable = false, length = 36)
    private String linkId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 24)
    private EntityReferenceType sourceType;

    @Column(name = "source_id", nullable = false, length = 36)
    private String sourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 24)
    private EntityReferenceType targetType;

    @Column(name = "target_id", nullable = false, length = 36)
    private String targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "relation_type", nullable = false, length = 32)
    private RelationType relationType = RelationType.RELATED;

    @Column(length = 500)
    private String note;

    @PrePersist
    void initializeLinkId() {
        if (linkId == null) {
            linkId = UUID.randomUUID().toString();
        }
    }

    public String getLinkId() { return linkId; }
    public EntityReferenceType getSourceType() { return sourceType; }
    public void setSourceType(EntityReferenceType sourceType) { this.sourceType = sourceType; }
    public String getSourceId() { return sourceId; }
    public void setSourceId(String sourceId) { this.sourceId = sourceId; }
    public EntityReferenceType getTargetType() { return targetType; }
    public void setTargetType(EntityReferenceType targetType) { this.targetType = targetType; }
    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }
    public RelationType getRelationType() { return relationType; }
    public void setRelationType(RelationType relationType) { this.relationType = relationType; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
