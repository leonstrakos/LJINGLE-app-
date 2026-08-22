package hr.leon.library.collection.entity;

import hr.leon.library.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "collection_items")
public class CollectionItemEntity extends BaseEntity {

    @Column(name = "item_id", nullable = false, unique = true, updatable = false, length = 36)
    private String itemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collection_id", referencedColumnName = "collection_id", nullable = false)
    private CollectionEntity collection;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 24)
    private EntityReferenceType entityType;

    @Column(name = "entity_id", nullable = false, length = 36)
    private String entityId;

    @Column(nullable = false)
    private int position;

    @PrePersist
    void initializeItemId() {
        if (itemId == null) {
            itemId = UUID.randomUUID().toString();
        }
    }

    public String getItemId() { return itemId; }
    public CollectionEntity getCollection() { return collection; }
    public void setCollection(CollectionEntity collection) { this.collection = collection; }
    public EntityReferenceType getEntityType() { return entityType; }
    public void setEntityType(EntityReferenceType entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
