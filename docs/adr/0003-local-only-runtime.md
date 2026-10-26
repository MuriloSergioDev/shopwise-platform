# ADR-0003: Local-only runtime on k3d + Tilt

- Status: accepted
- Date: 2026-10-26

## Decision
Nothing is deployed to the cloud for now. The full system runs on a local k3d cluster driven by Tilt.
GitHub Actions does CI only (lint, static analysis, tests, schema compatibility, image build without push).
Images and Helm charts are written so that adding CD later (GHCR + Argo CD) needs no service changes.
