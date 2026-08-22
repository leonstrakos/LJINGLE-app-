package hr.leon.library.exception;

import hr.leon.library.metadata.MetadataProvider;

public class MetadataItemNotFoundException extends RuntimeException {

    public MetadataItemNotFoundException(MetadataProvider provider, String externalId) {
        super("Knjiga nije pronađena kod izvora " + provider.name() + ": " + externalId);
    }
}
