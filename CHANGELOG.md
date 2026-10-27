# Changelog

## 1.0.0 (2026-10-27)


### Features

* **chart:** add an optional queue worker and in-cluster service URLs ([65a0786](https://github.com/MuriloSergioDev/shopwise-platform/commit/65a0786d9738f1e5e2f68dd34bd54f8eb682e511))
* **tilt:** forward the OTLP collector to localhost:4318 for host BFFs ([87b6d31](https://github.com/MuriloSergioDev/shopwise-platform/commit/87b6d3104028252e2b69d3525033df49ad52237f))
* **tilt:** wire P3/P4 services, saga topics, admin and Stripe secrets ([3e8f503](https://github.com/MuriloSergioDev/shopwise-platform/commit/3e8f503159fcec74f303ac2b28668187c6d580f8))


### Bug Fixes

* **chart:** set APP_KEY and disable service links in laravel-service pods ([d4ec078](https://github.com/MuriloSergioDev/shopwise-platform/commit/d4ec0783e892d91d12a53af856fa08919e6aec1b))
* **ci:** grant pull-requests read to the hygiene job ([c2857b6](https://github.com/MuriloSergioDev/shopwise-platform/commit/c2857b6df745071b6f54f4cd2ec47f45f2c1cb4f))
* **ci:** raise phpstan memory and use apicurio system/info for readiness ([91e8830](https://github.com/MuriloSergioDev/shopwise-platform/commit/91e8830621c092bbc5819b1ba1c944d394f8f24b))
* **tilt:** split comma-separated --only values ([f262eb2](https://github.com/MuriloSergioDev/shopwise-platform/commit/f262eb277a10a476d6effd4f7eccfa3b84910cac))
