# JobCopilot: Client-Side Career Assistant & Autofill Engine

JobCopilot is a privacy-first, client-side Chrome Extension (Manifest V3) designed to transform online job hunting. Operating entirely within the browser sandbox with zero external network dependencies, JobCopilot parses resumes, scrapes listings on major portals (LinkedIn, Indeed, Lever, Greenhouse), calculates multidimensional match scores, aggregates market demand analytics, and automates form-filling.

---

## 1. Problem Solved

Traditional job search assistants rely on cloud-hosted parsing and AI evaluation, introducing key pain points:
*   **Data Privacy Vulnerabilities**: Sending full resumes and personally identifiable information (PII) to remote servers.
*   **High Latency**: Network round-trips for scoring listings.
*   **Style and Layout Leakage**: DOM injected widgets inheriting host site styles, leading to visual compression (e.g. LinkedIn's `62.5%` root font-size scaling down text to unreadable proportions).
*   **Scoring without Improvement Paths**: Users receive compatibility percentages (e.g. "60% Match") without knowing the specific skill gaps, progression steps, or market contexts.

JobCopilot resolves these issues by conducting all parsings, extractions, classifications, and calculations **locally on the client-side**, encapsulated within a styled **Shadow DOM** viewport.

---

## 2. Architecture Overview

JobCopilot is built with a decoupled, event-driven extension architecture to keep scraping layers separate from evaluation and rendering engines:

```
                  ┌──────────────────────────────────────────────┐
                  │                 Host Page DOM                │
                  └────────┬──────────────────────────────┬──────┘
                           │                              ▲
       [Scrapes listings & │                              │ [Injects Match Badges
        active descriptions]                              │  & autofills fields]
                           ▼                              │
┌─────────────────────────────────────────────────────────┼──────────────────┐
│ JobCopilot Context Script (Light DOM)                   │                  │
│                                                         │                  │
│ ┌───────────────────────────┐    ┌──────────────────────┴────────────────┐ │
│ │ Site Adapters             │    │ main: content.js                      │ │
│ │ (siteAdapters.js)         │    │                                       │ │
│ │  ├── LinkedIn Scraper     ├───►│  ├── Mounts div#jc-widget-container   │ │
│ │  ├── Indeed Scraper       │    │  │                                    │ │
│ │  └── Greenhouse/Lever     │    │  └───────────────────┬────────────────┘ │
│ └───────────────────────────┘    │                      │                  │
└──────────────────────────────────┼──────────────────────┼──────────────────┘
                                   │                      │ [Loads HTML & CSS
                                   │ [Invokes engine      │  inside shadow boundary]
                                   │  evaluators]         ▼
┌──────────────────────────────────┼──────────┐ ┌────────────────────────────┐
│ Extension Core Libraries (Local) │          │ │ Shadow DOM (#shadow-root)   │
│                                  ▼          │ │                            │
│ ┌─────────────────────────────────────────┐ │ │  ┌──────────────────────┐  │
│ │ Job Understanding Layer                 │ │ │  │ content.css          │  │
│ │ (jobUnderstanding.js)                   │ │ │  │ (Resets & PX Layout) │  │
│ │  ├── Heuristic Classifier               │ │ │  └──────────┬───────────┘  │
│ │  └── Pluggable KB / AI providers        │ │ │             ▼              │
│ └────────────────────┬────────────────────┘ │ │  ┌──────────────────────┐  │
│                      ▼                      │ │  │ HUD Viewport         │  │
│ ┌─────────────────────────────────────────┐ │ │  │ (Active/Jobs/Market) │  │
│ │ Match & Analytics Engine                │ │ │  └──────────────────────┘  │
│ │ (matchEngine.js)                        │ │ └────────────────────────────┘
│ │  ├── Multidimensional Evaluator         │ │
│ │  ├── Career Insights Generator          │ │
│ │  └── Market Insights Aggregator         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Key Architectural Layers

1.  **Site Adapters (`lib/siteAdapters.js`, `lib/linkedinAdapter.js`)**: Abstract away target site selectors. They handle scraping card rows, scraping active job details, and injecting compatibility tags.
2.  **Job Understanding Layer (`lib/jobUnderstanding.js`)**: Extracts technical keywords and classifies job descriptions into 13 software and operations-focused target disciplines using local heuristics.
3.  **Local Match Engine (`lib/matchEngine.js`)**: Evaluates resumes against job descriptions based on a 100-point scoring algorithm (Skill Match: 40%, Role Title: 30%, Location: 15%, Remote Status: 15%).
4.  **Shadow DOM Interface (`content/content.js`)**: Encapsulates the sidebar widget. By writing elements and binding events within `#shadow-root`, it guarantees full isolation from page scripts and styles.

---

## 3. Core Features

### 📊 Multidimensional Match Evaluation
*   **Verified vs. Estimated Scores**: Unclicked list items receive an *Estimated Score* based on visible card metadata (Title, Location, Work Mode), while selected cards run a full *Verified Score* parsing the entire job description.
*   **Transparency Dashboard**: Displays granular point-breakdowns so users know how their skills, target roles, preferred locations, and remote preferences contributed to the final percentage.

### 📈 Market Insights Dashboard
*   **Skills Demand Tracking**: Scrapes all visible cards on the page to build real-time histograms of the top 10 requested skills and emerging tools.
*   **Hiring Distributions**: Visualizes hiring location coordinates and work mode distribution rates (Remote vs. Hybrid vs. On-site).
*   **Learning Impact Estimator**: Simulates match score gains, demonstrating how acquiring high-demand missing skills updates the candidate's average compatibility rate across all visible openings.

### 💡 Career Improvement & Skill Gap Analysis
*   **Impact-Level Gap Breakdown**: Categorizes missing requirements into *High Impact* (skills referenced 3+ times in the description), *Medium Impact* (explicit requirements), and *Optional Impact* (implied role requirements).
*   **Match Progression Stepper**: Draws a step-by-step flowchart showing the progression path if skills are added to the candidate's profile.
*   **Resume Phrasing Recommendations**: Suggests tailorable, context-rich bullet points aligning the user's background with the specific target job description.

### ⚡ Framework-Aware Autofill Engine
*   **Contextual Fields Extraction**: Maps inputs, textareas, and select menus to candidate profiles using regex dictionaries.
*   **Virtual DOM Support**: Dispatches complete event sequences (`input`, `change`, `blur`) alongside prototype value setting to bypass virtual DOM boundaries in React, Angular, and Vue.

---

## 4. Technical Implementation & Encapsulation

### Shadow DOM Isolation
The extension UI mounts inside a decoupled Shadow DOM tree to bypass CSS pollution:
```javascript
// content/content.js
widgetContainer = document.createElement('div');
widgetContainer.id = 'jc-widget-container';
document.body.appendChild(widgetContainer);
shadowRoot = widgetContainer.attachShadow({ mode: 'open' });
```
Inside `shadowRoot`, styling is loaded dynamically by fetching the runtime asset path:
```javascript
shadowRoot.innerHTML = `
  <link rel="stylesheet" href="\${chrome.runtime.getURL('content/content.css')}">
  <div class="jc-card jc-visible">...</div>
`;
```

### CSS Host Resets & Absolute Positioning
To protect the HUD position and styles from page inheritance, we style the shadow boundary and standardise on absolute pixels (`px`):
```css
/* content/content.css */
#jc-widget-container {
  position: fixed !important;
  bottom: 24px !important;
  right: 24px !important;
  z-index: 2147483647 !important;
}

:host {
  all: initial; /* Strips all inherited host page rules */
  display: block;
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

---

## 5. Folder Structure

```
job-copilot/
├── manifest.json            # Extension metadata (V3)
├── background.js            # Background Service Worker script
├── content/
│   ├── content.css          # Shadow DOM stylesheet (Reset and absolute pixel styles)
│   └── content.js           # Content Script (Shadow DOM setup and event bindings)
├── lib/
│   ├── pdf.min.js           # Local PDF parser core
│   ├── pdf.worker.min.js    # Local PDF parser worker thread
│   ├── siteAdapters.js      # Host site adapter registry (Indeed, Greenhouse, Lever)
│   ├── linkedinAdapter.js   # Isolated LinkedIn scraper overrides
│   ├── jobUnderstanding.js  # Role classification and implied skills parser
│   └── matchEngine.js       # Match scoring, career insights, and market dashboard core
├── options/
│   ├── options.html         # Candidate Profile Dashboard
│   ├── options.css          # Profile styles
│   └── options.js           # Storage saving and input management
├── popup/
│   ├── popup.html           # Simple browser toolbar dropdown
│   └── popup.js             # Navigation handler
└── test/
    └── test_form.html       # Offline local testing sandbox (LinkedIn simulator)
```

---

## 6. Installation Guide

To load the extension locally for development and review:

1.  Clone or download this repository:
    ```bash
    git clone https://github.com/username/job-copilot.git
    ```
2.  Open **Google Chrome** and navigate to:
    ```
    chrome://extensions/
    ```
3.  Enable **Developer mode** using the toggle switch in the top-right corner.
4.  Click **Load unpacked** in the top-left corner.
5.  Select the project root directory (containing `manifest.json`).

---

## 7. How to Test & Verify

### 1. Offline Sandbox (Simulator)
1.  Open the options page by clicking the extension icon in the toolbar and choosing **Open Profile Dashboard**.
2.  Fill in profile fields (e.g. including skills like `JavaScript`, `React`, `Node.js` but leaving out `Docker` and `AWS`) and click **Save**.
3.  Open the local simulator file in Chrome:
    ```
    test/test_form.html
    ```
4.  Observe the floating HUD badge load at the bottom-right corner.
5.  Click simulated job cards (e.g. **Backend Intern** at Google) to verify the new Active tab grid card layout, strengths/gaps analysis, and collapsible breakdown panels.
6.  Click the **Market** tab to view aggregated metrics, distributions, and learning estimator steps.
7.  Go to the **Autofill** tab and click **Fill Form** to populate the sandbox fields instantly.

### 2. Live Job Portals
1.  Visit LinkedIn Jobs or Indeed.
2.  Observe the high-contrast desaturated badges injected directly into listing cards (e.g. `59% EST` or `85%`).
3.  Click any listing card; the HUD will recalculate description details and load the verified match score.

---

## 8. Future Roadmap & Plans

*   **Deep Offline NLP Indexing**: Replace the heuristic keyword scanner with a lightweight client-side TF-IDF or vector embeddings model (like WebAssembly-powered ONNX Runtime) to parse responsibilities semantically without cloud requests.
*   **Automated Form Fill Training**: Implement a local classification feedback loop where corrected autofill choices train a naive Bayes classifier to map unique form labels to profile attributes over time.
*   **Unified Export**: Support batch-exporting analyzed listings, match scores, and custom phrasing suggestions as JSON/CSV tables for job-hunting tracking.
