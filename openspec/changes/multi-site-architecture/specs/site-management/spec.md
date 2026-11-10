# Spec Delta: site-management

## Purpose

Provides administrative management of multi-tenant sites, allowing operators to register, configure, and manage distinct domains with site-specific settings and automated origin authorization.

## ADDED Requirements

### Requirement: Admin Site Management API
The system SHALL provide administrative REST endpoints to create, list, retrieve, update, and delete site records with domain validation and unique domain constraints.

#### Scenario: Create a new site with valid domain
- **WHEN** an authenticated administrator sends a POST to `/admin/api/sites` with a unique domain `news2.david888.com` and display name `888 快訊`
- **THEN** the system creates the site record with an assigned ID and returns a 201 Created status with the site details

#### Scenario: Reject duplicate domain registration
- **WHEN** an administrator attempts to create a site using a domain that is already registered
- **THEN** the system rejects the request with a 409 Conflict status code and an informative error message

#### Scenario: Update existing site configuration
- **WHEN** an administrator sends a PATCH to `/admin/api/sites/:id` updating the display name, default locale, or anonymous commenting setting
- **THEN** the system updates the specified fields, preserves unmodified settings, and returns the updated site payload

### Requirement: Admin Sites Management Console
The system SHALL provide an administrative web interface at `/admin/sites` displaying registered sites and permitting configuration changes.

#### Scenario: View list of registered sites
- **WHEN** an administrator navigates to `/admin/sites`
- **THEN** the interface renders a table of all registered sites displaying their domain, display name, default locale, creation timestamp, and management actions

#### Scenario: Edit site settings from console
- **WHEN** an administrator opens the edit dialog or form for a registered site and submits changes
- **THEN** the interface submits the changes to `/admin/api/sites/:id` and updates the displayed site list upon success

### Requirement: Dynamic CORS and Origin Synchronization
The system SHALL dynamically treat any domain registered in active site records as an authorized origin for CORS preflight and API Origin validation without requiring manual redeployment.

#### Scenario: CORS preflight from registered site domain
- **WHEN** a browser sends an OPTIONS preflight request with `Origin: https://news2.david888.com` and that domain is registered in the sites table
- **THEN** the system returns 204 with `Access-Control-Allow-Origin: https://news2.david888.com` and `Access-Control-Allow-Credentials: true`

#### Scenario: Rejection of unregistered origin
- **WHEN** a browser sends a request with an Origin header that is not in `ALLOWED_ORIGINS` and not registered in the sites table
- **THEN** the system rejects the request with an origin forbidden error
