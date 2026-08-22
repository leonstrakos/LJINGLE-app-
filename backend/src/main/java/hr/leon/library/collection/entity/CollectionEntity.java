package hr.leon.library.collection.entity;

import hr.leon.library.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "collections")
public class CollectionEntity extends BaseEntity {

    @Column(name = "collection_id", nullable = false, unique = true, updatable = false, length = 36)
    private String collectionId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(length = 16)
    private String symbol;

    @PrePersist
    void initializeCollectionId() {
        if (collectionId == null) {
            collectionId = UUID.randomUUID().toString();
        }
    }

    public String getCollectionId() { return collectionId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }
}
