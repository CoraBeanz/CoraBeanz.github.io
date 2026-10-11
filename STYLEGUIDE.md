# Site style guide

The site should look like a person made it carefully: plain type, neutral colours,
generous space, and figures doing the talking. When in doubt, take something away.

## Rules

- One typeface: Hanken Grotesk, weights 400 to 600. No italics in headings, no
  uppercase labels, no monospace, no gradients, glows, badges or pill buttons.
- Colour comes from the figures. Text is near-black on off-white (light theme) or
  off-white on near-black (dark theme); captions and dates are grey.
- Every figure sits on the dark panel colour (`--panel`) in both themes, because most
  of them are renders and screen recordings drawn on black.
- Links are underlined text. Buttons only where a click does something on the page
  (the theme switch, "Copy").

## Work pages

```html
<section class="topic" id="oct" aria-labelledby="oct-title">
  <div class="wrap">
    <header class="topic__head">
      <h2 class="topic__title" id="oct-title">Retinal OCT</h2>
      <p class="topic__meta">KineoLabs, 2026 to present</p>
      <p class="topic__lede">One sentence, two at most.</p>
    </header>
    <div class="montage">
      <div class="montage__row">
        <!-- tiles from tools/tile.py -->
      </div>
    </div>
  </div>
</section>
```

- The header is the subject, not the company. The company and years go in `topic__meta`.
- A row holds two to four tiles. Each tile's `--ar` is its media's width / height, so
  every tile in a row comes out the same height. Under 720 px the rows wrap.
- Captions name what the figure shows in a few words. Add "simulated", "rendered" or
  "illustrative" when it is not a photo or measurement.
- `data-note` on the `figure` adds one sentence to the enlarged view only.
- `data-zoom-mobile` on an image swaps in a taller phone layout in the enlarged view.
- When a diagram's labels are unreadable at phone width, show the phone layout in the page too: wrap the img in
  `<picture><source media="(max-width: 720px)" srcset="...-mobile.svg">...</picture>` and add `--ar-m` (its width / height) to the tile's style.
- `tile--phone-wide` makes that tile the full-width one in a row of three on phones (it moves to the end of the row).
- `tile__media--bare` drops the dark panel behind an image with transparent parts, so its gaps take the page colour.
- Videos are muted loops: `<video data-loop data-zoom muted playsinline ...>`. They play
  only while on screen, and a small pause button appears on hover. If burned-in text
  sits bottom-right, move the button with `data-loop-btn="top-right"`.

## Files

- Images: `.webp`, long side at most 2000 px. Diagrams: `.svg` without a DOCTYPE.
- Videos: H.264 `.mp4` (`yuv420p`, `-movflags +faststart`, no audio), with a `.webp` poster.
