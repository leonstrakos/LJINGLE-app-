package hr.leon.library.provider.igdb;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class IgdbHttpGameProviderTest {

    @Test
    void usesPublicSteamSearchWhenIgdbCredentialsAreMissing() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo(containsString("store.steampowered.com/api/storesearch")))
                .andRespond(withSuccess("""
                        {
                          "total": 1,
                          "items": [{
                            "type": "app",
                            "name": "Outer Wilds",
                            "id": 753640,
                            "tiny_image": "https://example.test/outer-wilds.jpg",
                            "platforms": {"windows": true, "mac": false, "linux": true}
                          }]
                        }
                        """, MediaType.APPLICATION_JSON));
        IgdbProperties properties = new IgdbProperties();
        IgdbHttpGameProvider provider = new IgdbHttpGameProvider(builder, properties);

        var results = provider.search("Outer Wilds");

        assertEquals(1, results.size());
        assertEquals(753640, results.get(0).igdbId());
        assertEquals("Outer Wilds", results.get(0).title());
        assertEquals("PC (Windows)", results.get(0).platforms().get(0));
        assertEquals("Linux", results.get(0).platforms().get(1));
        server.verify();
    }
}
