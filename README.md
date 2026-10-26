# Tidewater Banker Simulator

An interactive, ocean-inspired laboratory for learning and exploring **Banker’s Algorithm** and operating-system deadlock avoidance. The simulator combines resource-allocation matrices, safety checks, safe-sequence exploration, and what-if resource requests in a single-page web application.

## Live demo

After GitHub Pages is enabled for this repository, the site will be available at:

`https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPOSITORY-NAME>/`

Replace the placeholders with your GitHub username and repository name.

## Features

- Interactive Banker’s Algorithm simulation and safety-state analysis.
- Allocation, maximum-claim, need, and available-resource views.
- Safe-sequence exploration and resource-request what-if analysis.
- Scenario editing and state-reset workflows.
- Animated water effects with a Canvas fallback for environments where WebGL is unavailable.
- Locally bundled KaTeX assets for formula rendering without a required CDN connection.
- Automated algorithm regression tests for common and boundary cases.
- Capacitor Android project for opening the same web experience in an Android WebView.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
npm test
npm run build:site
```

Then serve the generated `_site/` directory using any static HTTP server. For example, with Python:

```bash
python -m http.server 8000 --directory _site
```

Open `http://localhost:8000` in your browser. Serving over HTTP is recommended over opening `index.html` directly because browser security rules can differ for `file://` URLs.

## Tests

Run the automated algorithm regression suite with:

```bash
npm test
```

The suite covers safe and unsafe states, safe-sequence enumeration, resource-request validation, zero-resource boundaries, invalid inputs, and scenario reset/isolation. Test results describe the logic exercised by this suite; they do not replace full browser-based usability and visual testing.

## Deploy free with GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

1. Create a new GitHub repository.
2. Upload or push the **contents** of this project to the repository root (not an extra enclosing folder).
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, select **GitHub Actions** as the source.
5. Push to the `main` branch. The workflow builds a clean static site and deploys it automatically.
6. Open the deployment URL shown under the repository’s **Actions** tab or **Settings → Pages**.

The workflow publishes only the website and its required local assets, not the Android source, tests, or development dependencies.

## Android project

The `android/` directory contains the Capacitor Android project. To refresh its bundled web assets after changing `index.html` or `vendor/`, run:

```bash
npm ci
npm run cap:sync
npm run cap:open
```

Build and test the Android app in Android Studio with an Android SDK installed. Signing credentials and release artifacts should be managed locally and must **never** be committed to Git.

## Project structure

```text
.
├── index.html                 # Main single-page application
├── vendor/katex/              # Locally bundled formula-rendering assets
├── test_bankers.js            # Automated algorithm regression tests
├── scripts/build-site.js      # Prepares the GitHub Pages site
├── scripts/build-www.js       # Prepares Capacitor web assets
├── .github/workflows/pages.yml
├── capacitor.config.json
└── android/                   # Capacitor Android project
```

## Notes

- GitHub Pages is suitable for this client-side application; it does not provide a backend or server-side database.
- Keep `node_modules/`, generated Android build outputs, local SDK settings, signing keys, and secrets out of version control.
- Review third-party asset licenses before redistributing or modifying bundled dependencies.
