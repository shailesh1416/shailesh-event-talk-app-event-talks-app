# BigQuery Release Notes Dashboard & X (Twitter) Publisher

A modern, glassmorphic web dashboard built using **Python Flask** and **Vanilla HTML, CSS, and JavaScript**. The application dynamically fetches Google Cloud's BigQuery release notes, splits daily updates into distinct categorization cards, and provides a customized compose drawer to draft and publish highlight posts directly to X (Twitter).

---

## 🚀 Key Features

*   **Granular Update Splitting**: Splits multi-category daily updates (e.g. Features, Fixes, Announcements on the same day) into individual display cards.
*   **Real-time Search & Filtering**: Client-side filtering by category pills (All, Features, Fixes, Announcements, Changes) and live full-text search.
*   **Adaptive Tweet Drafting**: Automatically constructs an X-compliant tweet draft with a direct anchor-link to the Google documentation, calculating text length margins dynamically to guarantee it stays under the **280-character ceiling**.
*   **Character Budget Progress Indicator**: Features an interactive SVG-styled progress bar and character counter that dynamically changes colors (Green ➔ Yellow ➔ Red) and disables submission if the draft exceeds limits.
*   **Server-Side Caching**: Uses a 5-minute memory cache to optimize network usage and page load times, backed by a "Sync Feed" bypass button to force-refresh data on demand.
*   **Visual Aesthetics**: Sleek dark mode featuring ambient neon backdrops, loading skeletons, hover micro-animations, and glassmorphic container panels.

---

## 🛠️ Technology Stack

*   **Backend**: Python 3.x, Flask, Requests, XML ElementTree (native parsing)
*   **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom properties, grid layouts, backdrop filters), ES6 JavaScript

---

## 📁 Directory Structure

```text
E:/agenticai/lab2/
├── app.py                  # Flask Application Server (XML parsing, caching, APIs)
├── requirements.txt        # Backend dependencies
├── .gitignore              # Git ignore rules for Python, IDE, and system files
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Dashboard HTML structure
└── static/
    ├── css/
    │   └── style.css       # Visual themes, layout, and animations
    └── js/
        └── app.js          # Live search, filters, tweet composer & API bindings
```

---

## 💻 Installation & Local Setup

### 1. Prerequisites
Ensure you have **Python 3.x** and **pip** installed on your machine.

### 2. Clone/Download the Workspace
Navigate to your local directory:
```bash
cd E:/agenticai/lab2
```

### 3. Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```

### 5. Access the Web App
Open your browser and navigate to:
```text
http://127.0.0.1:5000/
```

---

## 🔌 API Reference

### Fetch Release Notes
Returns the list of parsed, categorized release notes.

*   **Endpoint**: `GET /api/updates`
*   **Query Parameters**:
    *   `force_refresh` (optional): Set to `true` to bypass server cache and pull fresh data directly from Google Cloud.
*   **Sample JSON Response**:
    ```json
    {
      "source": "network",
      "last_fetched": "2026-06-21T15:43:01.123456",
      "updates": [
        {
          "id": "June_17_2026_0",
          "date": "June 17, 2026",
          "category": "Feature",
          "content_html": "<h3>Feature</h3>\n<p>You can enable autonomous embedding generation...</p>",
          "content_text": "You can enable autonomous embedding generation on tables...",
          "anchor": "June_17_2026",
          "ref_link": "https://cloud.google.com/bigquery/docs/release-notes#June_17_2026"
        }
      ]
    }
    ```

---

## 📝 License
This project is open-source and available under the MIT License.
