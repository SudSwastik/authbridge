package com.authbridge.backend.security.authorities;

import java.util.Collection;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The pluggable seam for turning IdP-issued claims into Spring {@link GrantedAuthority}s.
 *
 * Swapping the upstream identity provider for one that shapes its role/group claims
 * differently means writing a new implementation of this interface only — SecurityConfig
 * and every controller stay untouched.
 */
public interface ClaimToAuthorityConverter extends Converter<Jwt, Collection<GrantedAuthority>> {
}
