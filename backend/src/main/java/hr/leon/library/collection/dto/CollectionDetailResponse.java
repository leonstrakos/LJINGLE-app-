package hr.leon.library.collection.dto;

import java.util.List;

public record CollectionDetailResponse(
        String collectionId,
        String name,
        String description,
        String symbol,
        List<CollectionItemResponse> items
) {
}
