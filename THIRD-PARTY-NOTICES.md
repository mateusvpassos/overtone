# Third-party notices

Overtone includes the following third-party material.

## Recorded samples (`renderer/samples`)

All samples are in the public domain (CC0 1.0). They were converted to OGG and trimmed.

- **VCSL — Versilian Community Sample Library** (https://github.com/sgossner/VCSL), CC0 1.0: grand piano, upright piano, harpsichord, pipe organ, vibraphone, concert harp, tenor sax, drum kit and percussion.
- **FreePats** (https://freepats.zenvoid.org/), CC0 1.0:
  - Nylon-String Acoustic Guitar, created by roberto@zenvoid.org for the FreePats project;
  - Clean Electric Bass, sound samples created by Andrea Biasior.

CC0 requires no attribution; the credits above are given as a courtesy.

## lamejs (MP3 encoder)

`lamejs` 1.2.1 (https://github.com/zhuker/lamejs), a JavaScript port of LAME, is licensed under the
GNU Lesser General Public License v3.0. Its full text is in [`licenses/LGPL-3.0.txt`](licenses/LGPL-3.0.txt),
which supplements the GNU GPL v3.0 in [`licenses/GPL-3.0.txt`](licenses/GPL-3.0.txt).

Overtone uses the unmodified `lame.all.js` from the npm package. In the installed app it is a plain file at
`resources/app.asar.unpacked/node_modules/lamejs/lame.all.js`, so you can replace it with another
compatible build. Its source code is available at the link above and in the npm package `lamejs@1.2.1`.

## Geist and Geist Mono fonts

`renderer/fonts/*.woff2` — Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font).
Licensed under the SIL Open Font License 1.1, see [`renderer/fonts/OFL.txt`](renderer/fonts/OFL.txt).

## Lucide icons

The SVG icons in `renderer/icons.js` follow and partly come from Lucide (https://lucide.dev), some of which
are derived from Feather. License follows.

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Electron

The installer bundles Electron (MIT) and Chromium. Their licenses are shipped next to the
executable as `LICENSE.electron.txt` and `LICENSES.chromium.html`.
