package hr.leon.library.media.tmdb;

import com.fasterxml.jackson.databind.JsonNode;
import hr.leon.library.media.dto.TmdbMediaResponse;
import hr.leon.library.media.dto.TmdbSearchResponse;
import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.exception.TmdbUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class TmdbClient implements TmdbProvider {

    private static final String IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
    private static final String TMDB_BASE_URL = "https://api.themoviedb.org/3";
    private static final String APPLE_BASE_URL = "https://itunes.apple.com";
    private static final String TVMAZE_BASE_URL = "https://api.tvmaze.com";
    private static final String WIKIDATA_BASE_URL = "https://www.wikidata.org";
    private static final long APPLE_SERIES_OFFSET = 1_000_000_000_000L;
    private static final long WIKIDATA_OFFSET = 2_000_000_000_000L;
    private final RestClient restClient;
    private final String apiToken;

    public TmdbClient(
            RestClient.Builder restClientBuilder,
            @Value("${tmdb.api-token:}") String apiToken
    ) {
        this.restClient = restClientBuilder.build();
        this.apiToken = apiToken == null ? "" : apiToken.trim();
    }

    @Override
    public TmdbSearchResponse search(String query, MediaType mediaType, int page) {
        if (apiToken.isBlank()) {
            return searchPublicSource(query, mediaType, page);
        }

        try {
            return searchTmdb(query, mediaType, page);
        } catch (TmdbUnavailableException exception) {
            return searchPublicSource(query, mediaType, page);
        }
    }

    private TmdbSearchResponse searchPublicSource(String query, MediaType mediaType, int page) {
        if (mediaType == MediaType.MOVIE) {
            try {
                TmdbSearchResponse wikidata = searchWikidata(query, mediaType, page);
                if (!wikidata.results().isEmpty()) {
                    return wikidata;
                }
            } catch (TmdbUnavailableException ignored) {
                // Apple remains a fallback only.
            }
            return searchAppleMovies(query, page);
        }

        try {
            TmdbSearchResponse tvMaze = searchTvMaze(query, page);
            if (!tvMaze.results().isEmpty()) {
                return tvMaze;
            }
        } catch (TmdbUnavailableException ignored) {
            // Apple TV is the first TVmaze fallback.
        }

        try {
            TmdbSearchResponse appleTv = searchAppleSeries(query, page);
            if (!appleTv.results().isEmpty()) {
                return appleTv;
            }
        } catch (TmdbUnavailableException ignored) {
            // Wikidata is the final keyless TV fallback.
        }
        return searchWikidata(query, mediaType, page);
    }

    private TmdbSearchResponse searchTmdb(String query, MediaType mediaType, int page) {
        String path = mediaType == MediaType.MOVIE ? "/search/movie" : "/search/tv";
        try {
            URI uri = UriComponentsBuilder.fromUriString(TMDB_BASE_URL)
                    .path(path)
                    .queryParam("query", query)
                    .queryParam("page", page)
                    .queryParam("include_adult", false)
                    .build()
                    .encode()
                    .toUri();
            JsonNode root = restClient.get()
                    .uri(uri)
                    .headers(headers -> headers.setBearerAuth(apiToken))
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null) {
                throw new TmdbUnavailableException("TMDB nije vratio odgovor.");
            }

            List<TmdbMediaResponse> results = new ArrayList<>();
            root.path("results").forEach(node -> results.add(toMediaResponse(node, mediaType)));
            return new TmdbSearchResponse(
                    root.path("page").asInt(page),
                    root.path("total_pages").asInt(0),
                    root.path("total_results").asLong(0),
                    results
            );
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException(
                    "TMDB trenutno nije dostupan. Pokušajte ponovno kasnije.",
                    exception
            );
        }
    }

    @Override
    public TmdbMediaResponse getDetails(MediaType mediaType, long tmdbId) {
        if (apiToken.isBlank()) {
            return getPublicDetails(mediaType, tmdbId);
        }

        try {
            return getTmdbDetails(mediaType, tmdbId);
        } catch (TmdbUnavailableException exception) {
            return getPublicDetails(mediaType, tmdbId);
        }
    }

    private TmdbMediaResponse getPublicDetails(MediaType mediaType, long sourceId) {
        if (sourceId >= WIKIDATA_OFFSET) {
            return getWikidataDetails(mediaType, sourceId - WIKIDATA_OFFSET);
        }
        if (mediaType == MediaType.SERIES && sourceId >= APPLE_SERIES_OFFSET) {
            return getAppleSeriesDetails(sourceId - APPLE_SERIES_OFFSET);
        }
        return mediaType == MediaType.MOVIE
                ? getAppleMovieDetails(sourceId)
                : getTvMazeDetails(sourceId);
    }

    private TmdbMediaResponse getTmdbDetails(MediaType mediaType, long tmdbId) {
        String path = mediaType == MediaType.MOVIE
                ? "/movie/{tmdbId}"
                : "/tv/{tmdbId}";
        try {
            URI uri = UriComponentsBuilder.fromUriString(TMDB_BASE_URL)
                    .path(path)
                    .buildAndExpand(tmdbId)
                    .encode()
                    .toUri();
            JsonNode result = restClient.get()
                    .uri(uri)
                    .headers(headers -> headers.setBearerAuth(apiToken))
                    .retrieve()
                    .body(JsonNode.class);
            if (result == null) {
                throw new TmdbUnavailableException("TMDB nije vratio odgovor.");
            }
            return toMediaResponse(result, mediaType);
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException(
                    "TMDB naslov nije moguće dohvatiti.",
                    exception
            );
        }
    }

    private TmdbSearchResponse searchAppleMovies(String query, int page) {
        if (page > 1) {
            return new TmdbSearchResponse(page, 1, 0, List.of());
        }

        URI uri = UriComponentsBuilder.fromUriString(APPLE_BASE_URL)
                .path("/search")
                .queryParam("term", query)
                .queryParam("country", "HR")
                .queryParam("media", "movie")
                .queryParam("entity", "movie")
                .queryParam("limit", 30)
                .queryParam("explicit", "No")
                .build()
                .encode()
                .toUri();

        try {
            JsonNode root = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null) {
                throw new TmdbUnavailableException("Online izvor nije vratio odgovor.");
            }

            List<TmdbMediaResponse> results = new ArrayList<>();
            Set<Long> seenIds = new HashSet<>();
            root.path("results").forEach(node -> {
                TmdbMediaResponse result = toAppleMovieResponse(node);
                if (result != null && seenIds.add(result.tmdbId())) {
                    results.add(result);
                }
            });
            return new TmdbSearchResponse(1, 1, results.size(), results);
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException(
                    "Online pretraga filmova trenutno nije dostupna.",
                    exception
            );
        }
    }

    private TmdbMediaResponse getAppleMovieDetails(long sourceId) {
        URI uri = UriComponentsBuilder.fromUriString(APPLE_BASE_URL)
                .path("/lookup")
                .queryParam("id", sourceId)
                .queryParam("country", "HR")
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null || root.path("results").isEmpty()) {
                throw new TmdbUnavailableException("Naslov nije pronađen u online izvoru.");
            }
            for (JsonNode node : root.path("results")) {
                TmdbMediaResponse result = toAppleMovieResponse(node);
                if (result != null) {
                    return result;
                }
            }
            throw new TmdbUnavailableException("Naslov nije pronađen u online izvoru.");
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException("Naslov nije moguće dohvatiti.", exception);
        }
    }

    private TmdbSearchResponse searchAppleSeries(String query, int page) {
        if (page > 1) {
            return new TmdbSearchResponse(page, 1, 0, List.of());
        }

        URI uri = UriComponentsBuilder.fromUriString(APPLE_BASE_URL)
                .path("/search")
                .queryParam("term", query)
                .queryParam("country", "HR")
                .queryParam("media", "tvShow")
                .queryParam("entity", "tvSeason")
                .queryParam("limit", 30)
                .queryParam("explicit", "No")
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get().uri(uri).retrieve().body(JsonNode.class);
            if (root == null) {
                throw new TmdbUnavailableException("Apple TV nije vratio odgovor.");
            }
            List<TmdbMediaResponse> results = new ArrayList<>();
            Set<Long> seenIds = new HashSet<>();
            root.path("results").forEach(node -> {
                TmdbMediaResponse result = toAppleSeriesResponse(node);
                if (result != null && seenIds.add(result.tmdbId())) {
                    results.add(result);
                }
            });
            return new TmdbSearchResponse(1, 1, results.size(), results);
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException("Apple TV pretraga trenutno nije dostupna.", exception);
        }
    }

    private TmdbMediaResponse getAppleSeriesDetails(long collectionId) {
        URI uri = UriComponentsBuilder.fromUriString(APPLE_BASE_URL)
                .path("/lookup")
                .queryParam("id", collectionId)
                .queryParam("country", "HR")
                .queryParam("entity", "tvSeason")
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get().uri(uri).retrieve().body(JsonNode.class);
            if (root != null) {
                for (JsonNode node : root.path("results")) {
                    TmdbMediaResponse result = toAppleSeriesResponse(node);
                    if (result != null) {
                        return result;
                    }
                }
            }
            throw new TmdbUnavailableException("Serija nije pronađena na Apple TV izvoru.");
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException("Apple TV detalje nije moguće dohvatiti.", exception);
        }
    }

    private TmdbSearchResponse searchWikidata(String query, MediaType mediaType, int page) {
        if (page > 1) {
            return new TmdbSearchResponse(page, 1, 0, List.of());
        }
        String typedQuery = query + (mediaType == MediaType.MOVIE ? " film" : " television series");
        URI uri = UriComponentsBuilder.fromUriString(WIKIDATA_BASE_URL)
                .path("/w/api.php")
                .queryParam("action", "wbsearchentities")
                .queryParam("search", typedQuery)
                .queryParam("language", "en")
                .queryParam("uselang", "hr")
                .queryParam("type", "item")
                .queryParam("limit", 20)
                .queryParam("format", "json")
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get()
                    .uri(uri)
                    .header("User-Agent", "TrackingApp/1.4 (personal catalogue)")
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null) {
                throw new TmdbUnavailableException("Wikidata nije vratila odgovor.");
            }
            List<TmdbMediaResponse> results = new ArrayList<>();
            for (JsonNode node : root.path("search")) {
                TmdbMediaResponse result = toWikidataSearchResponse(node, mediaType);
                if (result != null) {
                    results.add(result);
                }
            }
            return new TmdbSearchResponse(1, 1, results.size(), results);
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException("Rezervna Wikidata pretraga nije dostupna.", exception);
        }
    }

    private TmdbMediaResponse getWikidataDetails(MediaType mediaType, long numericId) {
        URI uri = UriComponentsBuilder.fromUriString(WIKIDATA_BASE_URL)
                .path("/w/api.php")
                .queryParam("action", "wbgetentities")
                .queryParam("ids", "Q" + numericId)
                .queryParam("props", "labels|descriptions|claims")
                .queryParam("languages", "hr|en")
                .queryParam("format", "json")
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get()
                    .uri(uri)
                    .header("User-Agent", "TrackingApp/1.4 (personal catalogue)")
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode entity = root == null ? null : root.path("entities").path("Q" + numericId);
            if (entity == null || entity.isMissingNode()) {
                throw new TmdbUnavailableException("Wikidata naslov nije pronađen.");
            }
            String title = firstNestedText(entity, "labels", "hr", "value");
            if (title == null) {
                title = firstNestedText(entity, "labels", "en", "value");
            }
            String description = firstNestedText(entity, "descriptions", "hr", "value");
            if (description == null) {
                description = firstNestedText(entity, "descriptions", "en", "value");
            }
            String date = firstClaimValue(entity, "P577", "time");
            String imageName = firstClaimValue(entity, "P18", null);
            String image = wikimediaImageUrl(imageName);
            return new TmdbMediaResponse(
                    WIKIDATA_OFFSET + numericId,
                    mediaType,
                    title == null ? "Naslov nije dostupan" : title,
                    null,
                    description,
                    image,
                    image,
                    null,
                    null,
                    yearFrom(date == null ? null : date.replace("+", ""))
            );
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException("Wikidata detalje nije moguće dohvatiti.", exception);
        }
    }

    private TmdbSearchResponse searchTvMaze(String query, int page) {
        if (page > 1) {
            return new TmdbSearchResponse(page, 1, 0, List.of());
        }

        URI uri = UriComponentsBuilder.fromUriString(TVMAZE_BASE_URL)
                .path("/search/shows")
                .queryParam("q", query)
                .build()
                .encode()
                .toUri();
        try {
            JsonNode root = restClient.get()
                    .uri(uri)
                    .header("User-Agent", "TrackingApp/1.3")
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null || !root.isArray()) {
                throw new TmdbUnavailableException("Online izvor serija nije vratio odgovor.");
            }

            List<TmdbMediaResponse> results = new ArrayList<>();
            for (JsonNode match : root) {
                TmdbMediaResponse result = toTvMazeResponse(match.path("show"));
                if (result != null) {
                    results.add(result);
                }
            }
            return new TmdbSearchResponse(1, 1, results.size(), results);
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException(
                    "Online pretraga serija trenutno nije dostupna.",
                    exception
            );
        }
    }

    private TmdbMediaResponse getTvMazeDetails(long sourceId) {
        URI uri = UriComponentsBuilder.fromUriString(TVMAZE_BASE_URL)
                .path("/shows/{id}")
                .buildAndExpand(sourceId)
                .encode()
                .toUri();
        try {
            JsonNode show = restClient.get()
                    .uri(uri)
                    .header("User-Agent", "TrackingApp/1.3")
                    .retrieve()
                    .body(JsonNode.class);
            TmdbMediaResponse result = show == null ? null : toTvMazeResponse(show);
            if (result == null) {
                throw new TmdbUnavailableException("Serija nije pronađena u online izvoru.");
            }
            return result;
        } catch (TmdbUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new TmdbUnavailableException("Seriju nije moguće dohvatiti.", exception);
        }
    }

    private TmdbMediaResponse toMediaResponse(JsonNode node, MediaType mediaType) {
        boolean movie = mediaType == MediaType.MOVIE;
        String title = textOrNull(node, movie ? "title" : "name");
        String originalTitle = textOrNull(node, movie ? "original_title" : "original_name");
        String posterPath = textOrNull(node, "poster_path");
        String backdropPath = textOrNull(node, "backdrop_path");
        String releaseDate = textOrNull(node, movie ? "release_date" : "first_air_date");

        return new TmdbMediaResponse(
                node.path("id").asLong(),
                mediaType,
                title == null ? "Naslov nije dostupan" : title,
                originalTitle,
                textOrNull(node, "overview"),
                posterPath,
                imageUrl(posterPath),
                backdropPath,
                imageUrl(backdropPath),
                yearFrom(releaseDate)
        );
    }

    private TmdbMediaResponse toAppleMovieResponse(JsonNode node) {
        long sourceId = node.path("trackId").asLong(0);
        String title = textOrNull(node, "trackName");
        if (sourceId <= 0 || title == null) {
            return null;
        }

        String artwork = highResolutionArtwork(
                firstText(node, "artworkUrl600", "artworkUrl512", "artworkUrl100")
        );
        String overview = firstText(node, "longDescription", "shortDescription", "description");
        String releaseDate = textOrNull(node, "releaseDate");
        return new TmdbMediaResponse(
                sourceId,
                MediaType.MOVIE,
                title,
                null,
                overview,
                artwork,
                artwork,
                null,
                null,
                yearFrom(releaseDate)
        );
    }

    private TmdbMediaResponse toAppleSeriesResponse(JsonNode node) {
        long collectionId = node.path("collectionId").asLong(0);
        String title = firstText(node, "collectionName", "trackName");
        if (collectionId <= 0 || title == null) {
            return null;
        }
        String artwork = highResolutionArtwork(
                firstText(node, "artworkUrl600", "artworkUrl512", "artworkUrl100")
        );
        String overview = firstText(node, "longDescription", "shortDescription", "description", "copyright");
        return new TmdbMediaResponse(
                APPLE_SERIES_OFFSET + collectionId,
                MediaType.SERIES,
                title,
                null,
                overview,
                artwork,
                artwork,
                null,
                null,
                yearFrom(textOrNull(node, "releaseDate"))
        );
    }

    private TmdbMediaResponse toWikidataSearchResponse(JsonNode node, MediaType mediaType) {
        String id = textOrNull(node, "id");
        String title = textOrNull(node, "label");
        if (id == null || title == null || !id.matches("Q\\d+")) {
            return null;
        }
        String description = textOrNull(node, "description");
        String normalized = description == null ? "" : description.toLowerCase();
        boolean matchingType = mediaType == MediaType.MOVIE
                ? normalized.contains("film") || normalized.contains("movie")
                : normalized.contains("television") || normalized.contains("tv series")
                    || normalized.contains("streaming series");
        if (!matchingType) {
            return null;
        }
        long numericId;
        try {
            numericId = Long.parseLong(id.substring(1));
        } catch (NumberFormatException exception) {
            return null;
        }
        return new TmdbMediaResponse(
                WIKIDATA_OFFSET + numericId,
                mediaType,
                title,
                null,
                description,
                null,
                null,
                null,
                null,
                null
        );
    }

    private TmdbMediaResponse toTvMazeResponse(JsonNode show) {
        long sourceId = show.path("id").asLong(0);
        String title = textOrNull(show, "name");
        if (sourceId <= 0 || title == null) {
            return null;
        }
        String poster = firstText(show.path("image"), "original", "medium");
        return new TmdbMediaResponse(
                sourceId,
                MediaType.SERIES,
                title,
                null,
                plainText(textOrNull(show, "summary")),
                poster,
                poster,
                null,
                null,
                yearFrom(textOrNull(show, "premiered"))
        );
    }

    private String plainText(String html) {
        if (html == null) {
            return null;
        }
        return html.replaceAll("<[^>]+>", " ")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = textOrNull(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNestedText(JsonNode node, String... path) {
        JsonNode current = node;
        for (String segment : path) {
            current = current.path(segment);
        }
        return current.isMissingNode() || current.isNull() || current.asText().isBlank()
                ? null
                : current.asText();
    }

    private String firstClaimValue(JsonNode entity, String property, String nestedField) {
        JsonNode claims = entity.path("claims").path(property);
        if (!claims.isArray() || claims.isEmpty()) {
            return null;
        }
        JsonNode value = claims.path(0).path("mainsnak").path("datavalue").path("value");
        if (nestedField != null) {
            value = value.path(nestedField);
        }
        return value.isMissingNode() || value.isNull() || value.asText().isBlank()
                ? null
                : value.asText();
    }

    private String wikimediaImageUrl(String fileName) {
        if (fileName == null) {
            return null;
        }
        return UriComponentsBuilder.fromUriString("https://commons.wikimedia.org")
                .path("/wiki/Special:FilePath/")
                .path(fileName)
                .queryParam("width", 600)
                .build()
                .encode()
                .toUriString();
    }

    private String highResolutionArtwork(String url) {
        if (url == null) {
            return null;
        }
        return url.replace("100x100bb", "600x600bb");
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            return null;
        }
        return value.asText();
    }

    private Integer yearFrom(String date) {
        if (date == null || date.length() < 4) {
            return null;
        }
        try {
            return Integer.valueOf(date.substring(0, 4));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String imageUrl(String path) {
        return path == null ? null : IMAGE_BASE_URL + path;
    }

}
