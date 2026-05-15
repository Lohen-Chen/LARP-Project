/* ============================================================
   level3.js — 3D Homogeneous Coordinates (STUB)
   ============================================================ */

const Level3 = (() => {

  function mount() {
    document.getElementById('tutorial-content').innerHTML = `
      <h3>// PREVIEW</h3>
      <p>The render upgrades to 3D. Points become <span class="inline">(x, y, z, 1)</span>, and every transform is a <span class="inline">4&times;4</span> matrix.</p>
      <div class="matrix-block">[ 1 0 0 dx ; 0 1 0 dy ; 0 0 1 dz ; 0 0 0 1 ]</div>
      <p>The player will rotate a 3D wireframe box and translate it through space to dodge a 3D obstacle.</p>
    `;

    document.getElementById('controls').innerHTML = '';
    Console.clear();
    Console.info('Level 3 initialized. (Awaiting build.)');

    const host = document.getElementById('p5-host');
    host.innerHTML = `
      <div class="stub">
        <h3>LEVEL 03 :: AWAITING_BUILD</h3>
        <p>3D rotation + translation in homogeneous coordinates.</p>
        <p class="blink">> stand by</p>
      </div>
    `;
  }

  function unmount() {}

  return {
    id: 3,
    slug: 'level3',
    title: '3D HOMOGENEOUS COORDS',
    mount,
    unmount,
  };
})();
