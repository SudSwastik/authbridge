package com.authbridge.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
        "OIDC_ISSUER_URI=https://example-tenant.auth0.com/",
        "OIDC_AUDIENCE=https://api.authbridge.local",
        // Setting jwk-set-uri directly (instead of relying on issuer-uri discovery) makes
        // Spring Boot build the JwtDecoder lazily (NimbusJwtDecoder.withJwkSetUri), so the
        // context can start in this test without a live network call to a real tenant.
        "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=https://example-tenant.auth0.com/.well-known/jwks.json"
})
class BackendApplicationTests {

    @Test
    void contextLoads() {
    }
}
