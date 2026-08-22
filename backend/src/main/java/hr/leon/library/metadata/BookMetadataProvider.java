package hr.leon.library.metadata;

import java.util.List;
import java.util.Optional;

public interface BookMetadataProvider {

    MetadataProvider provider();

    List<ExternalBookMetadata> search(String query, int limit);

    Optional<ExternalBookMetadata> lookupIsbn(String isbn);

    Optional<ExternalBookMetadata> getByExternalId(String externalId);
}
