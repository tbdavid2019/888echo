# Spec Delta: multi-site-routing

## Purpose

Enables edge-level request resolution to identify caller sites by request origin, isolating comment threads and engagement counters per domain without breaking legacy embed integrations.

## ADDED Requirements

### Requirement: Request Site Resolution
The system SHALL extract the calling domain from request headers (Origin, Referer, or parent_origin query parameter) and match it against registered sites to determine the target site context.

#### Scenario: Resolve site from Origin header
- **WHEN** a client widget sends a request with header `Origin: https://news2.david888.com` matching a registered site
- **THEN** the system resolves the context to that site's identifier for all subsequent thread operations

#### Scenario: Fallback resolution for unregistered or legacy requests
- **WHEN** a request arrives from an origin that does not match any registered site record
- **THEN** the system falls back to the default legacy site scope without rejecting the request

### Requirement: Cross-Domain Post Slug Isolation
The system SHALL isolate comment threads by domain so that identical post slugs on distinct sites create independent threads and records.

#### Scenario: Distinct threads for identical slugs across different domains
- **WHEN** a user posts a comment on `news2.david888.com` with slug `welcome` and another user posts a comment on `blog.david888.com` with slug `welcome`
- **THEN** the system stores them in separate threads such that neither thread displays comments from the other

#### Scenario: Consistent retrieval of site-scoped comments
- **WHEN** a reader on `news2.david888.com` loads comments for slug `welcome` via `/api/v1/bootstrap`
- **THEN** the system returns only comments associated with `news2.david888.com` for that slug

### Requirement: Transparent Client Payload Representation
The system SHALL accept clean post slugs in client requests and emit clean post slugs in JSON responses without exposing internal tenancy prefixes to the embed widget.

#### Scenario: Clean slug returned in bootstrap payload
- **WHEN** the widget requests bootstrap data for a site-scoped thread
- **THEN** the comments payload returns the original user-facing slug in `slug` and post metadata fields
