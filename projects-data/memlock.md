# MemLock — Static Security Analysis CLI for C Source Code

## One-Line Pitch
MemLock is a Python-based static security analysis CLI that parses C source files into abstract syntax trees with Tree-sitter and runs seven vulnerability detection rules — covering buffer overflows, use-after-free, format string injection, hardcoded secrets, and more — producing color-coded terminal reports and integrating into CI pipelines, all without compiling or executing the target program.

## Status
GitHub: [cs-keni/memlock](https://github.com/cs-keni/memlock)

## Problem Statement
Built for a Computer Security course, MemLock demonstrates the category of tool that operates on source text rather than binary output — a static analysis approach. The goal was to understand how real tools like Clang-SA, Cppcheck, and Semgrep find vulnerabilities at the AST level, then build a version from scratch that covers the most commonly exploited C vulnerability classes.

## What Was Built
A single Python CLI scanner that accepts one or more C source files (or a directory), parses them into ASTs via Tree-sitter, runs eight vulnerability detection rules, and produces color-coded Rich terminal output with inline code snippets, severity levels, and a per-file safety summary — all without compiling or executing the target program. Integrated into GitHub Actions CI via a 50+ fixture test suite.

## Tech Stack
- **Language:** Python
- **AST parsing:** Tree-sitter (tree-sitter-c grammar)
- **Terminal UI:** Rich (color-coded output, tables, inline snippets)
- **CLI framework:** Typer
- **Data validation:** Pydantic (finding schema)
- **Testing:** pytest
- **Linting / type checking:** ruff, mypy
- **CI:** GitHub Actions

## Features in Detail

### Eight-Rule Vulnerability Detection Engine
Each rule is an independent AST visitor that walks the Tree-sitter parse tree and emits `Finding` objects (Pydantic model: file, line, column, severity, rule, code snippet, remediation hint):

1. **Buffer Overflow Detection** — identifies calls to `gets()`, `strcpy()`, `strcat()`, `sprintf()`, and `scanf()` with unbounded `%s`; flags array subscripts with statically-detectable out-of-bounds indices
2. **Use-After-Free** — tracks `free()` calls and flags subsequent dereferences of the same pointer within the same scope
3. **Format String Injection** — detects `printf()`, `fprintf()`, `syslog()`, and similar calls where the format argument is a variable (not a string literal), enabling format string attacks
4. **Hardcoded Secrets** — regex-based sub-rule on string literal nodes: matches patterns like `password =`, `secret =`, `api_key =`, `token =` followed by a non-empty string literal
5. **Null Pointer Dereference** — identifies dereferences of pointers returned by `malloc()`, `calloc()`, or function calls without a NULL check in the preceding control flow
6. **Integer Overflow** — flags arithmetic on `int` types used as array indices or allocation sizes without bounds checks; detects sign-conversion patterns
7. **Unsafe Standard Library Functions** — flags the entire family of unsafe string functions (`gets`, `strcpy`, `strcat`, `sprintf`, `vsprintf`) and suggests safe alternatives (`fgets`, `strncpy`, `strncat`, `snprintf`)
8. **Memory Management Errors** — detects double-free patterns, `malloc`/`free` mismatches within a function scope, and allocation without corresponding deallocation in non-returning code paths

### AST-Driven Analysis Pipeline
Tree-sitter parses the raw C source text into a concrete syntax tree in milliseconds — no compilation step required. The analysis layer walks the CST using Tree-sitter's Python binding with cursor-based traversal, which is more efficient than recursive tree descent for large files. Every finding carries precise line and column attribution extracted from the AST node's position metadata, enabling the Rich output layer to render the exact offending expression as an inline code snippet.

### Rich Terminal UI
Output is grouped by file. Each file section shows:
- File path header with safe/unsafe status badge
- Per-finding rows: severity chip (HIGH in red, WARNING in yellow, LOW in blue), rule name, line:column, inline code snippet (3-line context window around the finding), and a remediation hint
- A summary table at the end of the run: one row per file, columns for HIGH / WARNING / LOW counts and overall status

The `--format simple` flag strips all Rich formatting and outputs plain text — compatible with CI log parsers and tools that consume stdout.

### Test Suite — 50+ Purpose-Built Fixtures
The test suite uses purpose-built C fixture files: for each rule, there is a `safe_easy.c`, `safe_medium.c`, `safe_hard.c`, `vulnerable_easy.c`, `vulnerable_medium.c`, and `vulnerable_hard.c`. Hard fixtures include patterns that naive implementations false-positive on (e.g., a variable named `password_length` that doesn't actually contain a secret, or a `strcpy` into a buffer large enough for the source string).

pytest parameterizes across all fixture pairs: every safe file must produce zero findings for its rule; every vulnerable file must produce at least one finding. Run on every push via GitHub Actions.

### Typer CLI
```
memlock scan [FILES...] [--format rich|simple] [--verbose] [--output FILE]
```
- `--verbose`: include remediation hints and rule documentation in output
- `--output FILE`: write findings as JSON for consumption by other tools
- Accepts individual `.c` files or a directory (recursive `.c` scan)

## Measurable Outcomes / Impact
- Eight vulnerability rule categories covering the most commonly exploited C vulnerability classes
- 50+ purpose-built fixture files (safe and vulnerable, easy/medium/hard per rule) in the test suite
- GitHub Actions CI enforces test coverage on every push
- Zero compilation required — analysis runs on raw source text via Tree-sitter
- `--format simple` output integrates into existing CI pipelines without post-processing

## Best For (Role Targeting)
- Security engineering or application security roles
- DevSecOps / security tooling roles (especially companies building SAST/DAST tooling)
- Infrastructure or platform engineering roles where security tooling is part of the remit
- Roles at security-focused companies (Snyk, Semgrep, GitHub Advanced Security, Checkmarx, Veracode)
- Roles where "Python," "static analysis," "security tooling," or "CI integration" appears in the JD
- Any role that surfaces via a Computer Security coursework context

## Talking Points for Interviews
- **AST-based vs. regex-based analysis:** Regex on source text produces high false-positive rates on comments, strings, and multi-line constructs. AST-based analysis operates on the parse tree — `printf` inside a comment doesn't emit a finding; only the actual function call node does.
- **Tree-sitter cursor traversal:** Tree-sitter's cursor API is more efficient than recursive tree descent for large files — it avoids allocating intermediate node objects for every non-matching subtree
- **False-positive hardening:** The "hard" fixture files are specifically designed to trip up naive implementations — e.g., a variable named `password_label` (not a secret) or a `strcpy` into a static buffer that's demonstrably large enough. Passing these requires more precise AST matching.
- **CI integration:** The `--format simple` output flag means findings can be piped into `grep` or parsed by standard CI log processors — the tool is designed to fit into a pipeline, not just work locally
- **Remediation hints:** Every finding includes a suggested fix, not just a flag — this is the difference between a security scanner that developers ignore and one they actually use
