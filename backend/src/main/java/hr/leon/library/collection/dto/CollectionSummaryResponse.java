package hr.leon.library.collection.dto;

public record CollectionSummaryResponse(
        String collectionId,
        String name,
        String description,
        String symbol,
        long itemCount
) {
}
