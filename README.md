# Ryan Vincent, personal site

A static site (plain HTML, CSS and JavaScript, no build step) for GitHub Pages.
It is mostly pictures: each topic is a header, one line of text and a montage of
small figures that enlarge when clicked.

## Pages

| File | What it covers |
|---|---|
| `index.html` | Home: short intro, the two work pages, patents, publications and talks |
| `optics.html` | Optical systems, robotics & spectroscopy: retinal OCT (KineoLabs), 3D hyperspectral robotic perception, DIY snapshot hyperspectral imaging, the self-aligning fiber bench, printed optomechanics (OpenFSO) |
| `materials.html` | Materials science: multiphoton lithography materials (Irradiant), quantum dot in perovskite scintillators (RadiantNano), nanodiamond tags (DUST Identity), nanoparticle self-assembly (M.S.) |
| `cv.html` | Full CV with a PDF download |
| `cora.html` | Photos of Cora, my dog |
| `404.html` | Not-found page |

`optics.html` and `materials.html` share a two-tab strip at the top; the header's
"Work" link opens the first tab. A forest photo sits behind the home intro and, as a
short band, at the top of the work, CV and 404 pages (not the Cora page).

## Run it locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Publish on GitHub Pages

1. Push this folder to the repository `CoraBeanz/CoraBeanz.github.io`.
2. In the repository, open **Settings → Pages**, choose **Deploy from a branch**, branch
   `main`, folder `/ (root)`.
3. The site appears at `https://corabeanz.github.io`.

## Update it

- **Add a figure:** save it under `assets/img/<topic>/` (`.webp` for photos and renders,
  long side at most 2000 px; `.svg` for diagrams) or `assets/video/` (H.264 `.mp4` plus a
  `.webp` poster). Then print a tile to paste into a row:
  `python tools/tile.py assets/img/<topic>/file.webp "Short caption"`.
  Keep captions to a few words. Say "simulated", "rendered" or "illustrative" when a
  figure is not a photo or measurement; a longer note can go in the figure's
  `data-note` attribute, which shows only in the enlarged view.
- **Nav or footer:** edit `partials/header.html` or `partials/footer.html`, then run
  `python tools/sync_partials.py`.

## What may be published

This repository is public, and GitHub Pages serves every file in it, linked or not.

- **KineoLabs:** only images and videos of the working app and its synthetic eye images.
  No source code, snippets, file or module names, configs or data files from the
  KineoLabs repository.
- **Patents:** list an application only once it has been filed.
- Third-party figures from papers stay off the site.

See `STYLEGUIDE.md` for the design rules.
