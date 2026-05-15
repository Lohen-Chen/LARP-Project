A linear-algebra learning game. You play a GPU rendering a wireframe through an obstacle course — by building the right transformation matrices.

Built by Joseph, Lohen, Shourya, Krishnansh for the Linear Algebra project.

## Stack

- **Pure static site** — `index.html`, vanilla JS, CSS.
- **p5.js** loaded from CDN for the viewport canvas.
- **Vercel** for hosting.

## Project structure

```
/
├── index.html               shell + script loading
├── styles.css               CRT/terminal aesthetic
├── vercel.json              static deploy config
└── js/
    ├── main.js              entry point, level router
    ├── matrix.js            matrix math utilities
    ├── ui.js                shared UI builders (matrix input, feedback)
    └── levels/
        ├── level1.js        2D transforms & composites
        ├── level2.js        homogeneous coords & translation
        ├── level3.js        3D homogeneous coords
        └── level4.js        perspective projection
```

## How a level works

Every level is a JS module exposing the same shape:

```js
const Level1 = (() => {
  function mount()   { /* paint tutorial + controls, start p5 sketch */ }
  function unmount() { /* tear down */ }
  return {
    id: 1,
    slug: 'level1',
    title: 'TITLE_IN_CAPS',
    tag: 'LEVEL_01',
    mount,
    unmount,
  };
})();
```

`main.js` registers all four levels in the `LEVELS` array and calls `mount` / `unmount` on transitions. Deep-link via the URL hash: `#level2`, `#level3`, etc.

## Adding the real Level 2/3/4

Replace the stub `mount()` body in `js/levels/levelN.js`. You get three DOM slots already in `index.html`:

- `#tutorial-pane` — the lesson text on the left.
- `#p5-host` (inside `.canvas-frame`) — where the p5 canvas attaches.
- `#controls` — matrix inputs and buttons.

Plus the shared helpers:

- `UI.matrixInput({ label, rows, cols, initial, locked })` — builds a styled matrix input that returns `.read()`.
- `UI.button(text, onClick, variant?)` and `UI.actionRow(...buttons)`.
- `UI.feedback(text, 'ok'|'err'|'info')` and `UI.clearFeedback()`.
- `Mat.mul`, `Mat.equals`, `Mat.identity`, `Mat.toHomogeneous2D`, `Mat.apply2D`.

Look at `level1.js` for the canonical pattern.

## Run locally
I like to use live server to test before pushing any commits. 