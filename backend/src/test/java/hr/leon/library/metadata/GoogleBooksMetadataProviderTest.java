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

class GoogleBooksMetadataProviderTest {

    @Test
    void sendsServerSideApiKeyAndMapsVolume() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        GoogleBooksMetadataProvider provider = new GoogleBooksMetadataProvider(builder, "secret-key");

        server.expect(requestTo(containsString("/volumes")))
                .andExpect(queryParam("q", "Dune"))
                .andExpect(queryParam("key", "secret-key"))
                .andRespond(withSuccess("""
                        {
                          "items": [{
                            "id": "google-volume-1",
                            "volumeInfo": {
                              "title": "Dune",
                              "authors": ["Frank Herbert"],
                              "publisher": "Ace",
                              "publishedDate": "1965-08-01",
                              "description": "Science-fiction novel.",
                              "pageCount": 412,
                              "industryIdentifiers": [
                                {"type": "ISBN_10", "identifier": "0441172717"},
                                {"type": "ISBN_13", "identifier": "9780441172719"}
                              ],
                              "imageLinks": {"thumbnail": "http://example.test/dune.jpg"}
                            }
                          }]
                        }
                        """, MediaType.APPLICATION_JSON));

        ExternalBookMetadata result = provider.search("Dune", 10).get(0);

        assertThat(result.provider()).isEqualTo(MetadataProvider.GOOGLE_BOOKS);
        assertThat(result.externalId()).isEqualTo("google-volume-1");
        assertThat(result.publishedYear()).isEqualTo(1965);
        assertThat(result.isbn13()).isEqualTo("9780441172719");
        assertThat(result.coverUrl()).isEqualTo("https://example.test/dune.jpg");
        server.verify();
    }
}
