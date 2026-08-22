package hr.leon.library.exception;

import hr.leon.library.metadata.MetadataProvider;

public class MetadataProviderException extends RuntimeException {

    public MetadataProviderException(MetadataProvider provider, String message, Throwable cause) {
        super(message + " (" + provider.name() + ")", cause);
    }
}
