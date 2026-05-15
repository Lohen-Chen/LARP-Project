/* ============================================================
   level2.js — Homogeneous Coordinates & Translation (STUB)
   ============================================================ */

const Level2 = (() => {

  function mount() {
    document.getElementById('tutorial-content').innerHTML = `
      <h3>// PREVIEW</h3>
      <p>Pure 2&times;2 matrices can scale, shear, and rotate &mdash; but they can't <i>translate</i>.</p>
      <p>The fix: lift every point <span class="inline">(x, y)</span> to <span class="inline">(x, y, 1)</span>.</p>
      <div class="matrix-block">[ 1 0 dx ; 0 1 dy ; 0 0 1 ] · [ x ; y ; 1 ] = [ x+dx ; y+dy ; 1 ]</div>
      <p>In this level the wireframe will need to <b>jump</b> across the viewport using a translation matrix.</p>
    `;

    document.getElementById('controls').innerHTML = '';
    Console.clear();
    Console.info('Level 2 initialized. (Awaiting build.)');

    const host = document.getElementById('p5-host');
    host.innerHTML = `
      <div class="stub">
        <h3>LEVEL 02 :: Under construction</h3>
      </div>
    `;
  }

  function unmount() {}

  return {
    id: 2,
    slug: 'level2',
    title: 'HOMOGENEOUS COORDS',
    mount,
    unmount,
  };
})();
