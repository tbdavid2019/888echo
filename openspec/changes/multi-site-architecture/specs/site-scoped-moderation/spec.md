# Spec Delta: site-scoped-moderation

## Purpose

Provides site-aware moderation navigation, filtered administrative dashboards, and targeted notification routing so operators can monitor and route events per site.

## ADDED Requirements

### Requirement: Admin Global Site Switcher
The system SHALL provide a site switcher selector in the administrative sidebar enabling operators to filter the current administrative view to a specific site or view all sites combined.

#### Scenario: Switching active site filter in admin console
- **WHEN** an operator selects a specific site from the sidebar site switcher dropdown
- **THEN** the system updates the active site selection and redirects or refreshes the view filtered by that site's identifier

#### Scenario: Viewing all sites combined
- **WHEN** an operator selects "All Sites" from the site switcher
- **THEN** the system clears the site filter and presents aggregated data across all registered sites

### Requirement: Site-Scoped Dashboard and Moderation Queue
The system SHALL filter metrics and comments in the moderation dashboard and review queue based on the currently selected site filter.

#### Scenario: Filter queue by selected site
- **WHEN** the active site filter is set to a specific site and the operator loads `/admin/queue`
- **THEN** the system renders only pending or flagged comments originating from that site and indicates the site on comment metadata badges

#### Scenario: Dashboard metrics respect active site filter
- **WHEN** an operator views the dashboard with an active site filter applied
- **THEN** all KPI cards (pending count, approved total, reaction totals) reflect only the activity for that site

### Requirement: Site-Scoped Webhook and Alert Routing
The system SHALL support binding webhook endpoints to specific sites so that event notifications are dispatched only to the matching site's notification channels.

#### Scenario: Dispatch comment event to site-specific webhook
- **WHEN** a new comment is posted on a thread belonging to a site with a site-specific Discord webhook configured
- **THEN** the system dispatches the webhook payload to that site's webhook endpoint and any global webhook endpoints, while ignoring webhooks bound to other sites

#### Scenario: Global webhook receives events from all sites
- **WHEN** a webhook endpoint is configured with no site binding
- **THEN** the system dispatches events to that endpoint regardless of which site the activity occurred on
