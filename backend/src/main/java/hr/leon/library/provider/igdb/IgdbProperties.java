package hr.leon.library.provider.igdb;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "igdb")
public class IgdbProperties {

    private String clientId = "";
    private String accessToken = "";

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public boolean isConfigured() {
        return clientId != null
                && !clientId.isBlank()
                && accessToken != null
                && !accessToken.isBlank();
    }
}
