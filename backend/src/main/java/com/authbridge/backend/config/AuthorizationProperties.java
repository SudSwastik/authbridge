package com.authbridge.backend.config;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code app.authorization.*} — the config-driven claim name and group/role mapping
 * that {@code GroupClaimAuthorityConverter} uses. Changing IdP or renaming upstream groups
 * never requires touching Java code, only this YAML section.
 *
 * @param rolesClaim  name of the JWT claim holding the caller's group/role identifiers
 *                    (e.g. "https://authbridge.app/groups"). Entra ID emits group *object
 *                    GUIDs*, not human-readable names, in this claim by default.
 * @param roleMapping map of upstream group/role identifier (GUID, for Entra) to the app-level
 *                    role name Spring Security should grant (e.g. "3f2a...": "ADMIN").
 *                    Identifiers with no entry here are silently ignored, not treated as an
 *                    error — an authenticated user with an unmapped or missing group claim
 *                    still gets a valid principal with zero extra authorities.
 */
@ConfigurationProperties(prefix = "app.authorization")
public record AuthorizationProperties(String rolesClaim, Map<String, String> roleMapping) {

    public AuthorizationProperties {
        if (roleMapping == null) {
            roleMapping = Map.of();
        }
    }
}
