# CivicFlow — Permit & Compliance Management Platform

## One-Line Pitch
CivicFlow is a production-quality full-stack permit and compliance management platform for government environmental agencies — built in C# / .NET 8 / Blazor WebAssembly / SQL Server / SignalR to directly mirror the Windsor Solutions stack and target their open roles in Tigard, OR.

## Status
Ongoing (in active development) | GitHub: [cs-keni/civicflow](https://github.com/cs-keni/civicflow)

## Problem Statement
Government environmental agencies still manage permit applications, inspections, and compliance violations through paper forms and disconnected spreadsheets. Windsor Solutions builds the software (nVIRO) that replaces these workflows for state and county agencies across the US. CivicFlow was built to understand and model that domain deeply — five distinct user roles, regulated permit state machines, immutable audit trails, and real-time queue updates — in the exact same technology stack Windsor uses.

## What Was Built
A complete, containerized permit compliance platform: five user roles (Applicant, Reviewer, Inspector, Compliance Officer, Admin), full permit status lifecycle with an immutable append-only audit trail, real-time SignalR queue updates for staff review workflows, AI-generated public inspection summaries, WCAG 2.1 AA-accessible public search, hand-authored T-SQL stored procedures and indexed views, and 87 automated tests across unit and integration suites.

## Tech Stack
- **Backend:** C# 12, .NET 8, ASP.NET Core Web API (clean layered architecture: API → Application → Domain → Infrastructure)
- **ORM / DB:** Entity Framework Core 8, SQL Server 2022, T-SQL, Flyway-style migrations
- **Frontend:** Blazor WebAssembly (hosted at same origin — BFF pattern)
- **Auth:** ASP.NET Core Identity, HttpOnly SameSite=Strict cookie auth (BFF — no JWTs in browser storage)
- **Real-time:** ASP.NET Core SignalR with four domain hubs and role-scoped client groups
- **AI integration:** Anthropic Claude API (.NET SDK) — Haiku for permit field suggestions, Sonnet for inspection public summaries — behind an `IPermitAIService` / `IInspectionAIService` interface that switches between real and mock implementations via a single environment variable
- **Validation / Logging:** FluentValidation, Serilog
- **Testing:** xUnit + Moq + FluentAssertions (unit), WebApplicationFactory + InMemory DB (integration)
- **Infrastructure:** Docker + Docker Compose, GitHub Actions

## Features in Detail

### Permit Lifecycle State Machine
Full permit status progression: Draft → Submitted → Under Review → Changes Requested → Approved / Denied. Every status transition appends an immutable `PermitStatusHistory` record capturing actor ID, timestamp, previous status, new status, and optional reviewer notes. The history table is append-only — no UPDATE or DELETE paths exist on it. This matches real regulatory compliance requirements: government agencies cannot retroactively modify an audit trail.

### Claude API Integration with Clean Abstraction
Claude Haiku surfaces permit field suggestions as an applicant fills out a form (non-blocking, advisory only — never gates form submission). Claude Sonnet generates plain-English public-facing summaries of inspection findings for the public transparency portal. Both are injected via `IPermitAIService` and `IInspectionAIService` interfaces. A single `AI_PROVIDER` environment variable switches between the real implementation (Claude API calls) and a deterministic mock that returns valid structured data. Result: all core workflows function completely without an API key, CI runs with zero API cost, and advisory features degrade gracefully if the API is unreachable.

### ASP.NET Core SignalR — Real-Time Review Queue
Four domain hubs with role-scoped client groups:
- `applicant-{userId}`: status change notifications for applicants
- `staff-reviewers`: new application arrivals in the review queue
- `inspector-{userId}`: newly assigned inspection notifications
- `admin-feed`: real-time activity stream for admins

All SignalR sends are fire-and-forget — hub failures never propagate to HTTP response codes. New permit submissions appear live in the staff queue without polling.

### Security — OWASP Top 10 A07 BFF Pattern
- HttpOnly SameSite=Strict cookies for session — zero JWTs in browser storage (mitigates XSS token theft)
- 5 req/min rate limiting on auth endpoints
- EF Core parameterized queries throughout (no raw SQL string concatenation)
- IDOR protection via ownership-scoped queries (applicants can only query their own permits)
- `HasQueryFilter` soft-delete on ReviewComment (deleted comments are filtered at the ORM layer, not in application code)
- WCAG 2.1 AA accessibility: `aria-live` regions for SignalR notifications, `aria-required` on all form inputs, semantic HTML, color-independent status badges

### T-SQL Beyond EF Core
- Stored procedure for permit activity reporting (parameterized date range, grouped by status and facility)
- Denormalized facility compliance view with a heuristic scoring formula computed in SQL
- 14 documented covering indexes for the most common query shapes
- Three `SEQUENCE` objects for atomic, concurrency-safe permit / inspection / violation number generation (no race condition on `MAX(id) + 1` style increments)

### Testing — 87 Automated Tests
- 67 xUnit unit tests using Moq + FluentAssertions covering all service-layer behaviors
- 20 WebApplicationFactory integration tests with InMemory DB covering full HTTP request → response cycles, including 6 role-boundary tests that assert 403 responses on endpoints guarded by role authorization

## Measurable Outcomes / Impact
- Five distinct user roles with role-scoped SignalR groups and IDOR-scoped data access
- Append-only audit trail on every permit status transition — no UPDATE/DELETE path exists
- 87 automated tests, including 6 explicit role-boundary 403 verification tests
- Zero API cost in CI: `AI_PROVIDER=mock` routes all Claude calls to a deterministic stub
- Three SQL Server SEQUENCEs for atomic permit/inspection/violation number generation
- WCAG 2.1 AA compliance across all pages

## Best For (Role Targeting)
- C# / .NET backend roles (Windows-ecosystem shops, government contractors, enterprise software)
- Windsor Solutions specifically (direct stack match: C# .NET 8, Blazor, SQL Server, SignalR)
- Roles at enterprise software companies building regulated-industry software (healthcare, legal, gov-tech)
- Roles that mention "event-driven," "real-time," "audit trail," or "compliance"
- Java/Spring-adjacent enterprise backend roles (the architecture patterns translate directly)

## Talking Points for Interviews
- **Domain complexity:** Five user roles, a regulated state machine, immutable audit trails, and WCAG accessibility — this is what a real government SaaS product looks like, not a CRUD app
- **AI abstraction pattern:** `IPermitAIService` with a `AI_PROVIDER` env var switch is the correct production pattern for AI integration: core workflows never gate on external API availability
- **Append-only audit log via AOP:** The audit trail is a Spring AOP `@Aspect` (Java equivalent: cross-cutting concern) — not a copy-paste `auditLog.save()` in every service method
- **SignalR fire-and-forget:** SignalR hub failures must not propagate to HTTP responses — this is an operational detail most tutorials skip
- **T-SQL SEQUENCE objects:** `MAX(id) + 1` is a race condition under concurrent inserts. SQL Server SEQUENCE objects are the correct fix — shows awareness of concurrency hazards in relational schema design
