package hr.leon.library.metadata;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.hamcrest.Matchers.containsString;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OpenLibraryBookMetadataProviderTest {

    @Test
    void mapsSearchResultToCanonicalMetadata() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OpenLibraryBookMetadataProvider provider = new OpenLibraryBookMetadataProvider(builder);

        server.expect(requestTo(containsString("/search.json")))
                .andExpect(queryParam("q", "Dune"))
                .andRespond(withSuccess("""
                        {
                          "docs": [{
                            "key": "/works/OL893415W",
                            "title": "Dune",
                            "author_name": ["Frank Herbert"],
                            "first_publish_year": 1965,
                            "isbn": ["0441172717", "9780441172719"],
                            "publisher": ["Ace"],
                            "cover_i": 12345,
                            "number_of_pages_median": 412,
                            "first_sentence": ["A beginning is the time for taking care."]
                          }]
                        }
                        """, MediaType.APPLICATION_JSON));

        ExternalBookMetadata result = provider.search("Dune", 10).get(0);

        assertThat(result.provider()).isEqualTo(MetadataProvider.OPEN_LIBRARY);
        assertThat(result.externalId()).isEqualTo("OL893415W");
        assertThat(result.title()).isEqualTo("Dune");
        assertThat(result.authors()).containsExactly("Frank Herbert");
        assertThat(result.isbn10()).isEqualTo("0441172717");
        assertThat(result.isbn13()).isEqualTo("9780441172719");
        assertThat(result.publishedYear()).isEqualTo(1965);
        assertThat(result.coverUrl()).isEqualTo(
                "https://covers.openlibrary.org/b/id/12345-L.jpg"
        );
        server.verify();
    }
}
