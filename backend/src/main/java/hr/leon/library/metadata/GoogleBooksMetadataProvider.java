package hr.leon.library.metadata;

import com.fasterxml.jackson.databind.JsonNode;
import hr.leon.library.exception.MetadataProviderException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class GoogleBooksMetadataProvider implements BookMetadataProvider {

    private static final Pattern YEAR_PATTERN = Pattern.compile("(\\d{4})");

    private final RestClient restClient;
    private final String apiKey;

    public GoogleBooksMetadataProvider(
            RestClient.Builder builder,
            @Value("${book-metadata.google-books.api-key:}") String apiKey
    ) {
        this.restClient = builder.baseUrl("https://www.googleapis.com/books/v1").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    @Override
    public MetadataProvider provider() {
        return MetadataProvider.GOOGLE_BOOKS;
    }

    @Override
    public List<ExternalBookMetadata> search(String query, int limit) {
        try {
            JsonNode root = restClient.get()
                    .uri(withApiKey(uriBuilder -> uriBuilder
                            .path("/volumes")
                            .queryParam("q", query)
                            .queryParam("maxResults", Math.min(limit, 40))
                            .queryParam("printType", "books")
                            .queryParam("projection", "full")
                            .build()))
                    .retrieve()
                    .body(JsonNode.class);

            if (root == null || !root.path("items").isArray()) {
                return List.of();
            }
            List<ExternalBookMetadata> results = new ArrayList<>();
            for (JsonNode item : root.path("items")) {
                map(item).ifPresent(results::add);
            }
            return results;
        } catch (RestClientException exception) {
            throw unavailable(exception);
        }
    }

    @Override
    public Optional<ExternalBookMetadata> lookupIsbn(String isbn) {
        return search("isbn:" + normalizeIsbn(isbn), 1).stream().findFirst();
    }

    @Override
    public Optional<ExternalBookMetadata> getByExternalId(String externalId) {
        if (externalId == null || externalId.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode item = restClient.get()
                    .uri(withApiKey(uriBuilder -> uriBuilder
                            .path("/volumes/{volumeId}")
                            .build(externalId.trim())))
                    .retrieve()
                    .body(JsonNode.class);
            return item == null ? Optional.empty() : map(item);
        } catch (org.springframework.web.client.HttpClientErrorException.NotFound exception) {
            return Optional.empty();
        } catch (RestClientException exception) {
            throw unavailable(exception);
        }
    }

    private Optional<ExternalBookMetadata> map(JsonNode item) {
        String externalId = text(item, "id");
        JsonNode info = item.path("volumeInfo");
        String title = text(info, "title");
        if (externalId == null || title == null) {
            return Optional.empty();
        }

        String isbn10 = null;
        String isbn13 = null;
        if (info.path("industryIdentifiers").isArray()) {
            for (JsonNode identifier : info.path("industryIdentifiers")) {
                String type = text(identifier, "type");
                String value = normalizeIsbn(text(identifier, "identifier"));
                if ("ISBN_13".equals(type) && value.length() == 13) {
                    isbn13 = value;
                } else if ("ISBN_10".equals(type) && value.length() == 10) {
                    isbn10 = value;
                }
            }
        }

        JsonNode imageLinks = info.path("imageLinks");
        String coverUrl = text(imageLinks, "thumbnail");
        if (coverUrl == null) {
            coverUrl = text(imageLinks, "smallThumbnail");
        }
        if (coverUrl != null && coverUrl.startsWith("http://")) {
            coverUrl = "https://" + coverUrl.substring("http://".length());
        }

        return Optional.of(new ExternalBookMetadata(
                provider(),
                externalId,
                title,
                stringArray(info.path("authors")),
                isbn10,
                isbn13,
                parseYear(text(info, "publishedDate")),
                text(info, "publisher"),
                integer(info, "pageCount"),
                text(info, "description"),
                coverUrl
        ));
    }

    private Function<UriBuilder, URI> withApiKey(Function<UriBuilder, URI> uriFactory) {
        return uriBuilder -> {
            if (apiKey.isBlank()) {
                return uriFactory.apply(uriBuilder);
            }
            return uriFactory.apply(uriBuilder.queryParam("key", apiKey));
        };
    }

    private MetadataProviderException unavailable(RestClientException cause) {
        return new MetadataProviderException(
                provider(),
                "Google Books trenutno nije dostupan.",
                cause
        );
    }

    private Integer parseYear(String value) {
        if (value == null) {
            return null;
        }
        Matcher matcher = YEAR_PATTERN.matcher(value);
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private static String normalizeIsbn(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[^0-9Xx]", "").toUpperCase(Locale.ROOT);
    }

    private List<String> stringArray(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        node.forEach(value -> {
            if (value.isTextual() && !value.asText().isBlank()) {
                values.add(value.asText().trim());
            }
        });
        return List.copyOf(values);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText().trim() : null;
    }

    private Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.canConvertToInt() ? value.asInt() : null;
    }
}
