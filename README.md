# Peony for Abel

An interactive, moonlit digital peony flower garden made with love for Abel.

## Features

- **Landing Experience**: Dark fantasy night atmosphere with *"A Flower Made Just for You"* and *"Enter the Garden"*.
- **Procedural Peony Garden (HTML5 Canvas)**: Dozens of layered, mathematically generated ruffled peony blooms with compound botanical foliage, secondary branches, plump buds, sequential one-by-one petal unfurling, wind sway, glowing fireflies, and interactive touch/cursor sparkles.
- **Cinematic 8-Stage Choreography**: Smooth ~75-second sequence from awakening night sky and gathering light particles to full bloom and panoramic camera zoom-out.
- **Background Music**: Local audio playback (`assets/music/great-fairy-fountain.m4a`) triggered only after user interaction, with a minimalist Play/Pause toggle and an automatic Web Audio ethereal harp fallback.
- **Romantic Message & Love Letter**: Gentle fade-in poetic lines followed by a 3D wax-sealed envelope opening animation revealing a personal letter over the live swaying garden.
- **Responsive & Static**: Optimized for smartphones, tablets, and desktops with zero backend, database, or external API dependencies. Ready for GitHub Pages.

## Project Structure

```text
peony-for-abel/
├── index.html
├── style.css
├── script.js
└── assets/
    ├── music/
    │   └── great-fairy-fountain.m4a
    ├── fonts/
    └── images/
        └── peony-favicon.svg
```

## Customization

- **Animation Duration**: Edit `CONFIG.durationSec` at the top of `script.js` (default: `75` seconds; range 60–120s recommended). For quick local previews, append `?duration=15` to the URL.
- **Love Letter Content**: Edit the paragraphs inside `<div class="letter-body">` in `index.html`.
- **Music**: Replace `assets/music/great-fairy-fountain.m4a` if desired (update the `<source>` tag in `index.html` if changing format).

## Run Locally

Open `index.html` through any local static server (for example XAMPP at `http://localhost/flowersformybb/`, or `python -m http.server 8000`).

## Deploy to GitHub Pages

1. Push `index.html`, `style.css`, `script.js`, and the `assets/` folder to your GitHub repository.
2. Go to **Settings → Pages** in your repository.
3. Under **Build and deployment**, select **Deploy from a branch**, choose your main branch and `/ (root)`, then click **Save**.
