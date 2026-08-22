package hr.leon.library.metadata;

import com.fasterxml.jackson.databind.JsonNode;
import hr.leon.library.exception.MetadataProviderException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class OpenLibraryBookMetadataProvider implements BookMetadataProvider {

    private static final String FIELDS = String.join(",",
            "key",
            "title",
            "author_name",
            "first_publish_year",
            "isbn",
            "publisher",
            "cover_i",
            "number_of_pages_median",
            "first_sentence"
    );

    private final RestClient restClient;

    public OpenLibraryBookMetadataProvider(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://openlibrary.org").build();
    }

    @Override
    public MetadataProvider provider() {
        return MetadataProvider.OPEN_LIBRARY;
    }

    @Override
    public List<ExternalBookMetadata> search(String query, int limit) {
        return searchInternal(query, limit);
    }

    @Override
    public Optional<ExternalBookMetadata> lookupIsbn(String isbn) {
        return searchInternal("isbn:" + normalizeIsbn(isbn), 1).stream().findFirst();
    }

    @Override
    public Optional<ExternalBookMetadata> getByExternalId(String externalId) {
        String normalizedId = externalId == null ? "" : externalId.trim();
        if (normalizedId.startsWith("/works/")) {
            normalizedId = normalizedId.substring("/works/".length());
        }
        if (normalizedId.isBlank()) {
            return Optional.empty();
        }
        List<ExternalBookMetadata> results = searchInternal(
                "key:/works/" + normalizedId,
                1
        );
        if (results.isEmpty()) {
            results = searchInternal("key:" + normalizedId, 1);
        }
        return results.stream().findFirst();
    }

    private List<ExternalBookMetadata> searchInternal(String query, int limit) {
        try {
            JsonNode root = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/search.json")
                            .queryParam("q", query)
                            .queryParam("limit", limit)
                            .queryParam("fields", FIELDS)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            if (root == null || !root.path("docs").isArray()) {
                return List.of();
            }

            List<ExternalBookMetadata> results = new ArrayList<>();
            for (JsonNode document : root.path("docs")) {
                map(document).ifPresent(results::add);
            }
            return results;
        } catch (RestClientException exception) {
            throw new MetadataProviderException(
                    provider(),
                    "Open Library trenutno nije dostupan.",
                    exception
            );
        }
    }

    private Optional<ExternalBookMetadata> map(JsonNode document) {
        String title = text(document, "title");
        String key = text(document, "key");
        if (title == null || key == null) {
            return Optional.empty();
        }

        String externalId = key.startsWith("/works/")
                ? key.substring("/works/".length())
                : key;
        List<String> authors = stringArray(document.path("author_name"));
        List<String> isbns = stringArray(document.path("isbn"));
        String isbn13 = firstIsbn(isbns, 13);
        String isbn10 = firstIsbn(isbns, 10);
        Long coverId = document.path("cover_i").canConvertToLong()
                ? document.path("cover_i").asLong()
                : null;

        return Optional.of(new ExternalBookMetadata(
                provider(),
                externalId,
                title,
                authors,
                isbn10,
                isbn13,
                integer(document, "first_publish_year"),
                first(stringArray(document.path("publisher"))),
                integer(document, "number_of_pages_median"),
                firstSentence(document.path("first_sentence")),
                coverId == null ? null : "https://covers.openlibrary.org/b/id/" + coverId + "-L.jpg"
        ));
    }

    private String firstSentence(JsonNode node) {
        if (node.isTextual()) {
            return node.asText();
        }
        return first(stringArray(node));
    }

    private String firstIsbn(List<String> isbns, int length) {
        return isbns.stream()
                .map(OpenLibraryBookMetadataProvider::normalizeIsbn)
                .filter(value -> value.length() == length)
                .findFirst()
                .orElse(null);
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

    private String first(List<String> values) {
        return values.isEmpty() ? null : values.get(0);
    }
}
