package hr.leon.library.media;

import hr.leon.library.media.entity.MediaType;
import hr.leon.library.media.tmdb.TmdbClient;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class TmdbClientTest {

    @Test
    void usesPublicAppleSearchWhenTmdbTokenIsMissing() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo(containsString("itunes.apple.com/search")))
                .andRespond(withSuccess("""
                        {
                          "resultCount": 1,
                          "results": [{
                            "trackId": 550,
                            "trackName": "Fight Club",
                            "longDescription": "Overview",
                            "artworkUrl100": "https://example.test/100x100bb.jpg",
                            "releaseDate": "1999-10-15T07:00:00Z"
                          }]
                        }
                        """, org.springframework.http.MediaType.APPLICATION_JSON));
        TmdbClient client = new TmdbClient(builder, " ");

        var response = client.search("Fight Club", MediaType.MOVIE, 1);

        assertEquals(1, response.results().size());
        assertEquals("Fight Club", response.results().get(0).title());
        assertEquals(1999, response.results().get(0).releaseYear());
        assertTrue(response.results().get(0).posterUrl().contains("600x600bb"));
        server.verify();
    }

    @Test
    void usesPublicTvMazeSearchForSeriesWhenTmdbTokenIsMissing() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo(containsString("api.tvmaze.com/search/shows")))
                .andRespond(withSuccess("""
                        [{
                          "score": 1.0,
                          "show": {
                            "id": 61744,
                            "name": "Severance",
                            "summary": "<p>A team has their memories <b>divided</b>.</p>",
                            "premiered": "2022-02-18",
                            "image": {"original": "https://example.test/severance.jpg"}
                          }
                        }]
                        """, org.springframework.http.MediaType.APPLICATION_JSON));
        TmdbClient client = new TmdbClient(builder, "");

        var response = client.search("Severance", MediaType.SERIES, 1);

        assertEquals(1, response.results().size());
        assertEquals("Severance", response.results().get(0).title());
        assertEquals("A team has their memories divided .", response.results().get(0).overview());
        assertEquals(2022, response.results().get(0).releaseYear());
        server.verify();
    }
}
