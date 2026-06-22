# LedgerBridge — Event-Driven Banking Transaction & Risk Monitoring System

## One-Line Pitch
LedgerBridge is a production-quality event-driven banking backend in Java 21 and Spring Boot with a four-rule statistical fraud detection engine that models each customer's individual behavior — not naive global thresholds — built to target fintech and enterprise backend roles at Wells Fargo, Citi, Capital One, and Chase.

## Status
Live at [ledgerbridge-i0c5.onrender.com](https://ledgerbridge-i0c5.onrender.com) | GitHub: [cs-keni/ledgerbridge](https://github.com/cs-keni/ledgerbridge)

## Problem Statement
Most portfolio fraud detection projects use a single threshold: "flag any transaction over $500." Real bank fraud engines build per-customer behavioral baselines and flag transactions that are unusual *for that specific account* — not globally suspicious. LedgerBridge was built to demonstrate that distinction with real algorithms, while also showcasing Kafka event-driven architecture, Spring Security, and production-quality Java.

## What Was Built
A fully operational event-driven banking system: account management, real-time transaction processing, statistical fraud detection with per-customer behavioral baselines, an admin alert review queue with full risk score breakdowns, append-only audit logging via Spring AOP, a React admin dashboard with Server-Sent Events, Docker multi-service deployment with PostgreSQL and Kafka, and Testcontainers integration tests covering the full transaction → Kafka → risk pipeline.

## Tech Stack
- **Backend:** Java 21, Spring Boot 3.x, Spring Security + JJWT 0.12, Spring Data JPA + Hibernate, Spring Kafka
- **Database:** PostgreSQL 16, Supabase (managed PostgreSQL — prod), Flyway migrations
- **Messaging:** Apache Kafka (local), Upstash serverless Kafka (prod)
- **Frontend:** React 18 + TypeScript, Tailwind CSS, Zustand + React Query
- **API Docs:** SpringDoc OpenAPI (Swagger UI)
- **Observability:** Prometheus + Grafana
- **Testing:** JUnit 5 + Mockito, Testcontainers (real Postgres + Kafka per test run)
- **Infrastructure:** Docker + Docker Compose, GitHub Actions

## Features in Detail

### Four-Rule Statistical Risk Engine
Every transaction asynchronously scores across four independent rule implementations, each producing a [0, 1] confidence score, aggregated into a weighted total:

1. **Z-Score Amount Anomaly** — uses each customer's rolling mean and standard deviation (not a global threshold). A $300 transaction is suspicious for a customer whose average is $40, but routine for one whose average is $250.
2. **Sliding-Window Velocity Analysis** — compares the current transaction rate (transactions/hour in a 24h window) to that customer's own 30-day baseline rate. Catches account takeover patterns where an attacker rapidly drains funds.
3. **Behavioral Baselining** — three sub-signals: time-of-day frequency (is this an unusual hour for this account?), merchant category profile (first time using this category?), and new counterparty detection (first-ever transaction to this recipient?).
4. **Graph Pattern Analysis** — fan-in (many sources funding one account rapidly), fan-out (one account dispersing to many recipients rapidly), and round-trip detection (A → B → A within a short window). Catches money mule and structuring patterns.

Fraudulent transactions (score ≥ 0.4) are excluded from baseline updates — preventing attackers from slowly poisoning the Z-score model through gradual escalation. This is a deliberate design choice that mirrors how production fraud systems handle baseline poisoning.

### Event-Driven Architecture with Spring Kafka
TransactionService commits to PostgreSQL then publishes to a `transaction-events` Kafka topic. A dedicated RiskConsumer processes events independently and creates RiskAlert records when scores breach thresholds. New alerts appear on the Admin dashboard via Server-Sent Events — no polling. X-Correlation-ID propagates from HTTP request header → MDC logging context → Kafka message header → risk consumer, so every log line for a transaction shares the same trace ID across services.

Idempotency keys (Stripe-style): clients can replay the same POST with an `Idempotency-Key` header and receive the original result. 24-hour TTL, SHA-256 request hash validation prevents key reuse with a modified body.

### PostgreSQL Schema with Financial Precision
All monetary values use `NUMERIC(19,4)` — no floating-point arithmetic on money. UUID primary keys throughout. Flyway for version-controlled schema migrations. An append-only `AuditLog` table captures every state change, implemented via a Spring AOP `@Aspect` that intercepts all `@Audited` service methods and records before/after JSON snapshots without touching service code — the audit trail is a cross-cutting concern, not a copy-paste in every service method.

### Spring Security — Stateless JWT with Token Family Rotation
- 15-minute access tokens, 7-day refresh tokens stored in HttpOnly SameSite=Strict cookies
- Token family rotation: when a revoked refresh token is replayed, the entire token family is invalidated — all active sessions for that user are ended, not just the replayed one. This prevents refresh token theft from being leveraged silently.
- Role-based method authorization via `@PreAuthorize`
- BCrypt password hashing
- Rate limiting on auth endpoints
- Structured JSON logging that masks account numbers to last-4 only — no financial data in plaintext logs

### Testcontainers Integration Tests
Integration tests spin up real PostgreSQL and Kafka instances per test run via Testcontainers — no mocks for the database or message broker. Tests cover the full deposit → Kafka event → risk consumer → RiskAlert creation pipeline, including edge cases like idempotency key replay and token family invalidation. 87 automated tests total.

## Measurable Outcomes / Impact
- Four independent risk rule implementations, each with a [0,1] output and a weighted aggregation layer
- Baseline poisoning protection: fraudulent transactions excluded from rolling mean/stddev updates
- Token family rotation invalidates all sessions on refresh token replay — not just the replayed token
- ~90% of fields in the Kafka event stream traced via X-Correlation-ID end-to-end
- 87 automated tests: 67 unit (Moq + FluentAssertions) + 20 integration (real Postgres + Kafka via Testcontainers)

## Best For (Role Targeting)
- Backend SWE roles at banks, fintech companies, or payment processors (Wells Fargo, Citi, Capital One, Chase, Stripe, Braintree)
- Java / Spring Boot focused backend roles
- Roles that mention "event-driven architecture," "Kafka," "microservices," or "distributed systems"
- Any role where security, audit trails, or compliance-grade data handling is mentioned
- Enterprise backend roles where "production quality" means something beyond "it works locally"

## Talking Points for Interviews
- **Per-customer baselines vs. global thresholds:** The distinction between "flag anything over $500" and "flag anything more than 3 standard deviations from that account's rolling mean" is the actual difference between a portfolio project and a production fraud system — and I built the latter
- **Baseline poisoning prevention:** Explicitly excluding fraudulent transactions from rolling averages was a deliberate design choice — without it, an attacker can slowly normalize their behavior over weeks and then escalate
- **Token family rotation:** Most tutorial JWTs just check expiry. Token family rotation catches the theft case — and invalidating all sessions (not just the replayed token) is how you handle the scenario where the attacker got there first
- **X-Correlation-ID propagation:** Traced across HTTP → MDC → Kafka message header → consumer — this is what distributed tracing looks like without a full Jaeger/Zipkin setup
- **Testcontainers vs mocks:** Unit tests mock; integration tests use real containers. The distinction matters: a mocked Kafka consumer can't catch offset commit bugs or consumer group rebalancing issues
