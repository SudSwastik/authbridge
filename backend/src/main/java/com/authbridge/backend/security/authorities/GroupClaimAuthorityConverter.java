package com.authbridge.backend.security.authorities;

import com.authbridge.backend.config.AuthorizationProperties;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Default {@link ClaimToAuthorityConverter}: reads the group/role identifiers from the
 * configured claim ({@link AuthorizationProperties#rolesClaim()}) and maps each one through
 * {@link AuthorizationProperties#roleMapping()} to a Spring "ROLE_x" authority.
 *
 * Entra ID's default group claim contains group *object GUIDs*, so this map is what turns
 * an opaque GUID into something {@code hasRole("ADMIN")} can check — replace the mapping
 * (or this whole class, for a fundamentally different claim shape) without touching
 * SecurityConfig or any controller.
 */
@Component
public class GroupClaimAuthorityConverter implements ClaimToAuthorityConverter {

    private final AuthorizationProperties properties;

    public GroupClaimAuthorityConverter(AuthorizationProperties properties) {
        this.properties = properties;
    }

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        List<String> claimValues = jwt.getClaimAsStringList(properties.rolesClaim());
        if (claimValues == null) {
            return List.of();
        }

        return claimValues.stream()
                .map(properties.roleMapping()::get)
                .filter(Objects::nonNull)
                .distinct()
                .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role))
                .toList();
    }
}
