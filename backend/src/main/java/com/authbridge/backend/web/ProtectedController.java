package com.authbridge.backend.web;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sample endpoints proving the JWT → GrantedAuthority pipeline end to end. {@code /hello}
 * shows what any authenticated caller sees regardless of role mapping (useful for verifying
 * a token validates at all); {@code /admin/ping} shows role-gated access built purely from
 * config (app.authorization.role-mapping), not from any hardcoded role string in this class.
 */
@RestController
public class ProtectedController {

    @GetMapping("/api/protected/hello")
    public Map<String, Object> hello(JwtAuthenticationToken authentication) {
        Jwt jwt = authentication.getToken();
        List<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        return Map.of(
                "subject", jwt.getSubject(),
                "authorities", authorities);
    }

    @GetMapping("/api/protected/admin/ping")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, String> adminPing() {
        return Map.of("status", "ok", "scope", "admin");
    }
}
