/* ============================================================
   level4.js — Perspective Projections (STUB)
   ============================================================ */

const Level4 = (() => {

  function mount() {
    document.getElementById('tutorial-content').innerHTML = `
      <h3>// PREVIEW</h3>
      <p>The final stage: collapse a 3D scene onto a 2D screen. Via similar triangles, a point at depth z projects to:</p>
      <div class="matrix-block">x* = x / (1 − z/d)</div>
      <p>The projection matrix P encodes this as a single multiplication in homogeneous coordinates.</p>
      <div class="matrix-block">P = [ 1 0 0 0 ; 0 1 0 0 ; 0 0 0 0 ; 0 0 −1/d 1 ]</div>
    `;

    document.getElementById('controls').innerHTML = '';
    Console.clear();
    Console.info('Level 4 initialized. (Awaiting build.)');

    const host = document.getElementById('p5-host');
    host.innerHTML = `
      <div class="stub">
        <h3>LEVEL 04 :: AWAITING_BUILD</h3>
        <p>Perspective projection — 3D into 2D via P.</p>
        <p class="blink">> stand by</p>
      </div>
    `;
  }

  function unmount() {}

  return {
    id: 4,
    slug: 'level4',
    title: 'PERSPECTIVE PROJECTIONS',
    mount,
    unmount,
  };
})();
