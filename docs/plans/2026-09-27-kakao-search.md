# Kakao Book Search Implementation Plan

**Goal:** Add a small Vercel-compatible book search endpoint and connect the Add a book flow, keeping Kakao credentials server-side.

**Architecture:** `/api/books` calls Kakao's fixed HTTPS book-search endpoint. A pure request handler with injected fetch/key access supports meaningful offline tests; a Vite middleware adapter serves the same implementation locally. Search results become edition metadata on independently identified physical copies. Existing local shelves and lending flows remain intact.

**Tech Stack:** Existing React/Vite, native Node/Web APIs, Vercel Functions; no extra production dependency.

## Tasks
1. Test input validation, normalized Korean results/ISBNs, pagination, authentication header privacy, missing credentials, timeout, quota errors, and malformed responses.
2. Implement server handler, Vercel adapter and local Vite integration. Add `.env.example`, ignore Vercel metadata, and document setup.
3. Add debounced title/author/ISBN search with loading/error/empty states, pagination, selection and manual-entry fallback. Retain metadata and safe cover URLs in saved copies.
4. Verify endpoint tests, production build, missing-key behavior and responsive manual-entry flow. Document the live Kakao and hosted deployment checks that require user credentials.

## User setup
Create a Kakao developer app and put its REST API key in local `.env.local` as `KAKAO_REST_API_KEY`. For hosting, import `Uzihoon/bookbook` into Vercel and set the same private environment variable. Do not use a `VITE_` prefix or commit credentials. No deployment or live-provider success is claimed without verification.
