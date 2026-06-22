# QuantVault — Quantitative Portfolio Analytics & Risk Modeling Platform

## One-Line Pitch
QuantVault is a full-stack quantitative portfolio analytics platform that implements real financial mathematics — Markowitz mean-variance optimization, historical simulation VaR/CVaR, Monte Carlo projections using geometric Brownian motion, and a backtesting engine with full performance tearsheets — all computed on real Yahoo Finance market data.

## Status
GitHub: [cs-keni/quantvault](https://github.com/cs-keni/quantvault)

## Problem Statement
I invest in Vanguard index funds and wanted to understand the actual math behind portfolio risk and diversification — not the marketing version. What does my real volatility look like? Where does my portfolio sit on the efficient frontier? What does a bad decade look like across 1,000 simulated futures? Most "portfolio analytics" tools show you a pie chart. QuantVault computes the math.

## What Was Built
A fully functional quantitative portfolio analytics platform: efficient frontier visualization with minimum-variance and maximum-Sharpe labeled points, five risk metrics on real historical data, Monte Carlo projections with P5/P50/P95 percentile bands and probability-of-doubling, a backtesting engine that compares any allocation against the S&P 500 over any historical window, a Redis caching layer over Yahoo Finance, and a React + Recharts interactive frontend.

## Tech Stack
- **Backend:** Python 3.12, FastAPI, NumPy, Pandas, SciPy
- **Financial data:** yfinance (Yahoo Finance), cached via Redis (24h TTL for daily returns, 15m for quotes, 7d for company metadata)
- **Database:** SQLAlchemy (async) + asyncpg, PostgreSQL, Alembic (migrations)
- **Frontend:** React 18 + TypeScript, Tailwind CSS, Recharts, Zustand
- **Testing:** pytest + httpx
- **Infrastructure:** Docker + Docker Compose, GitHub Actions

## Features in Detail

### Markowitz Mean-Variance Optimization — Efficient Frontier
Implemented using `scipy.optimize.minimize` with the SLSQP solver. The optimizer solves for the portfolio weight vector that minimizes variance at each target return level across a fine grid, subject to:
- Long-only constraint: all weights ≥ 0 (no short selling)
- Budget constraint: weights sum to 1

The full efficient frontier curve is plotted as a scatter of risk/return points, with two labeled reference portfolios: the **minimum-variance portfolio** (leftmost point on the frontier) and the **maximum-Sharpe portfolio** (tangency portfolio — the point where the Capital Market Line is tangent to the frontier).

Results are verified against known asset pairs: a 60/40 SPY+BND blend must sit at lower volatility than 100% SPY — a sanity check that confirms the optimizer is solving correctly.

### Five Financial Risk Metrics on Real Historical Data
All computed from real daily returns pulled from Yahoo Finance:
1. **Value at Risk (VaR)** via historical simulation — sort daily returns ascending, take the Nth percentile (e.g., 5th for 95% confidence VaR). No distributional assumption.
2. **Conditional VaR / Expected Shortfall (CVaR)** — mean of all returns worse than the VaR threshold. Captures tail risk that VaR alone ignores.
3. **Sharpe Ratio** — (portfolio return − risk-free rate) / annualized volatility, using the live 10-year US Treasury yield as the risk-free rate (fetched from FRED or yfinance).
4. **Sortino Ratio** — same as Sharpe but denominator is downside deviation only (standard deviation of negative returns). Penalizes downside volatility more than upside volatility.
5. **Maximum Drawdown** — peak-to-trough decline as a percentage, with date attribution for when the peak and trough occurred.

### Monte Carlo Simulation — Geometric Brownian Motion
The Monte Carlo engine simulates N daily return paths using geometric Brownian motion:
- Expected annual return (µ) and annualized volatility (σ) are estimated from historical data
- Daily returns are drawn from a normal distribution parameterized by the daily equivalents of µ and σ
- Each path is compounded into a full equity curve over the projection horizon
- Output: P5, P10, P25, P50, P75, P90, P95 percentile band curves
- Derived metrics: probability-of-profit (paths ending above initial investment) and probability-of-doubling
- Supports configurable annual contributions injected at year boundaries (simulates dollar-cost averaging)

### Backtesting Engine — Full Performance Tearsheet
Simulates a rebalanced portfolio against real Yahoo Finance historical daily returns over any user-specified date range, at monthly / quarterly / annual / never rebalancing frequencies. Generates a full tearsheet:
- CAGR (compound annual growth rate)
- Annualized volatility
- Sharpe, Sortino, Calmar ratios
- Beta and Alpha vs. S&P 500 (SPY) benchmark
- Win rate (percentage of positive return days)
- Maximum drawdown with date attribution
- Equity curve chart overlaid against the benchmark

### Redis Caching Layer
Three TTL tiers over Yahoo Finance market data:
- 24-hour TTL for historical daily returns (stable data that changes at most once per market day)
- 15-minute TTL for real-time quotes (needs freshness but not tick-level speed)
- 7-day TTL for company metadata (name, sector, description — rarely changes)

Reduces external API calls by ~90% in a typical interactive session, preventing Yahoo Finance rate limiting and making the architecture suitable for a production deployment with multiple concurrent users.

## Measurable Outcomes / Impact
- Five distinct financial algorithms implemented and verified against known correct results
- Redis caching reduces Yahoo Finance API calls by ~90% in typical sessions
- Monte Carlo outputs P5–P95 bands across N simulated paths with configurable annual contributions
- Backtesting tearsheet includes 9 performance metrics + alpha/beta vs. benchmark
- Full Dockerized multi-service deployment (API, frontend, Redis, PostgreSQL) via Docker Compose

## Best For (Role Targeting)
- Roles at investment management firms, wealth tech, or fintech companies (Vanguard, BlackRock, Fidelity, Goldman, Morgan Stanley, Jane Street)
- Quantitative / data-heavy backend roles in Python
- Full-stack SWE roles at fintech or data-heavy startups
- Any role where "financial modeling," "data pipelines," or "Python + NumPy/Pandas/SciPy" appears in the JD
- Roles that mention "data engineering," "analytics platform," or "research infrastructure"

## Talking Points for Interviews
- **Real financial math, not charting:** The distinction between "shows a portfolio pie chart" and "solves a constrained optimization problem over the efficient frontier" is the whole point — this demonstrates understanding of what quantitative finance actually involves
- **Verifiable results:** The efficient frontier optimizer is validated against known-correct asset pairs — a SPY+BND blend must have lower variance than 100% SPY by definition. If it doesn't, the optimizer is wrong.
- **Monte Carlo parameterization:** GBM uses historical µ and σ estimated from real data, not fabricated inputs — the simulation is grounded in actual observed market behavior
- **CVaR vs VaR:** VaR tells you the threshold; CVaR tells you what you lose on average when you cross it. CVaR is the risk measure that actually matters for tail risk — shows awareness of why CVaR was added to regulatory frameworks after VaR proved insufficient
- **Redis TTL design:** Different data types have different freshness requirements — daily returns need 24h TTL, real-time quotes need 15m. Applying a single global TTL would either over-cache or over-fetch.
