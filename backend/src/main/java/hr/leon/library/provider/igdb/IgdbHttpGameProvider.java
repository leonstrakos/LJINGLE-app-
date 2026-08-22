package hr.leon.library.provider.igdb;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import hr.leon.library.dto.GameMetadataResponse;
import hr.leon.library.exception.IgdbUnavailableException;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Component
public class IgdbHttpGameProvider implements IgdbGameProvider {

    private static final String GAMES_ENDPOINT = "https://api.igdb.com/v4/games";
    private static final String COVER_BASE_URL =
            "https://images.igdb.com/igdb/image/upload/t_cover_big/";

    private final RestClient restClient;
    private final IgdbProperties properties;

    public IgdbHttpGameProvider(RestClient.Builder restClientBuilder, IgdbProperties properties) {
        this.restClient = restClientBuilder.build();
        this.properties = properties;
    }

    @Override
    public List<GameMetadataResponse> search(String query) {
        if (properties.isConfigured()) {
            try {
                return searchIgdb(query);
            } catch (IgdbUnavailableException ignored) {
                // A public Steam fallback keeps search usable when IGDB is unavailable.
            }
        }
        return searchSteam(query);
    }

    private List<GameMetadataResponse> searchIgdb(String query) {
        String body = "search \"" + escape(query.trim()) + "\"; "
                + "fields id,name,first_release_date,cover.image_id,"
                + "involved_companies.developer,involved_companies.company.name,platforms.name; "
                + "limit 20;";

        try {
            List<IgdbApiGame> response = restClient.post()
                    .uri(GAMES_ENDPOINT)
                    .header("Client-ID", properties.getClientId())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getAccessToken())
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });

            if (response == null) {
                return List.of();
            }
            return response.stream().map(this::toResponse).toList();
        } catch (RestClientException exception) {
            throw new IgdbUnavailableException(
                    "IGDB trenutačno nije dostupan. Pokušajte ponovno kasnije.",
                    exception
            );
        }
    }

    private List<GameMetadataResponse> searchSteam(String query) {
        URI uri = UriComponentsBuilder.fromUriString("https://store.steampowered.com")
                .path("/api/storesearch/")
                .queryParam("term", query.trim())
                .queryParam("l", "english")
                .queryParam("cc", "HR")
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.USER_AGENT, "TrackingApp/1.2")
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null) {
                throw new IgdbUnavailableException("Online izvor igara nije vratio odgovor.");
            }

            List<GameMetadataResponse> results = new ArrayList<>();
            for (JsonNode item : root.path("items")) {
                if (!"app".equals(item.path("type").asText()) || results.size() >= 20) {
                    continue;
                }
                long appId = item.path("id").asLong(0);
                String title = textOrNull(item, "name");
                if (appId <= 0 || title == null) {
                    continue;
                }
                results.add(new GameMetadataResponse(
                        appId,
                        title,
                        null,
                        null,
                        textOrNull(item, "tiny_image"),
                        steamPlatforms(item.path("platforms"))
                ));
            }
            return results;
        } catch (IgdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new IgdbUnavailableException(
                    "Online pretraga igara trenutno nije dostupna.",
                    exception
            );
        }
    }

    private List<String> steamPlatforms(JsonNode platforms) {
        List<String> result = new ArrayList<>();
        if (platforms.path("windows").asBoolean(false)) {
            result.add("PC (Windows)");
        }
        if (platforms.path("mac").asBoolean(false)) {
            result.add("macOS");
        }
        if (platforms.path("linux").asBoolean(false)) {
            result.add("Linux");
        }
        return result;
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.asText().isBlank()
                ? null
                : value.asText();
    }

    private GameMetadataResponse toResponse(IgdbApiGame game) {
        String developer = game.involvedCompanies() == null
                ? null
                : game.involvedCompanies().stream()
                .filter(company -> Boolean.TRUE.equals(company.developer()))
                .map(IgdbInvolvedCompany::company)
                .filter(Objects::nonNull)
                .map(IgdbCompany::name)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
        Integer releaseYear = game.firstReleaseDate() == null
                ? null
                : Instant.ofEpochSecond(game.firstReleaseDate())
                .atZone(ZoneOffset.UTC)
                .getYear();
        String coverUrl = game.cover() == null || game.cover().imageId() == null
                ? null
                : COVER_BASE_URL + game.cover().imageId() + ".jpg";
        List<String> platforms = game.platforms() == null
                ? List.of()
                : game.platforms().stream()
                .map(IgdbPlatform::name)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        return new GameMetadataResponse(
                game.id(),
                game.name(),
                developer,
                releaseYear,
                coverUrl,
                platforms
        );
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private record IgdbApiGame(
            long id,
            String name,
            @JsonProperty("first_release_date") Long firstReleaseDate,
            IgdbCover cover,
            @JsonProperty("involved_companies") List<IgdbInvolvedCompany> involvedCompanies,
            List<IgdbPlatform> platforms
    ) {
    }

    private record IgdbCover(@JsonProperty("image_id") String imageId) {
    }

    private record IgdbInvolvedCompany(Boolean developer, IgdbCompany company) {
    }

    private record IgdbCompany(String name) {
    }

    private record IgdbPlatform(String name) {
    }
}
