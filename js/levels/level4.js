/* ============================================================
   level4.js - Perspective Projections
   ------------------------------------------------------------
   Lesson (Linear Algebra Project PDF):
     - Put the viewer's eye at (0,0,d) and the computer screen on
       the xy-plane, z = 0.
     - A 3D point (x,y,z) projects to
           ( x / (1 - z/d), y / (1 - z/d), 0 )
       by similar triangles.
     - Homogeneous coordinates turn that divide into one 4x4
       matrix multiplication:
           [ 1 0 0   0 ]
           [ 0 1 0   0 ]
           [ 0 0 0   0 ]
           [ 0 0 -1/d 1 ]
       because P[x,y,z,1]^T = [x,y,0,1-z/d]^T, then we divide
       by w.

   Puzzle: build P for d = 4, then project the 3D wireframe onto
   the z = 0 viewing plane. The viewport uses a fixed axonometric
   camera only so the player can see the eye, rays, object, and
   target screen plane in one scene.
   ============================================================ */

const Level4 = (() => {

  /* ---------- 3D object geometry ---------- */

  // An asymmetric "beacon" wireframe. The uneven depth values make
  // the perspective divide visible: nearer points grow farther apart.
  const OBJECT_PTS = [
    [-1.6, -1.0, -1.2], [ 1.6, -1.0, -1.2], [ 1.2,  1.0, -0.8], [-1.2,  1.0, -0.8],
    [-0.9, -0.5,  1.6], [ 0.9, -0.5,  1.6], [ 0.0,  1.4,  1.9], [ 0.0, -1.5,  0.9],
    [ 0.0,  0.0, -2.1],
  ];

  const OBJECT_EDGES = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,4],
    [0,4],[1,5],[2,6],[3,6],
    [0,8],[1,8],[2,8],[3,8],
    [4,7],[5,7],[7,8],
  ];

  function toHomogeneous3D(pts) {
    return [
      pts.map(p => p[0]),
      pts.map(p => p[1]),
      pts.map(p => p[2]),
      pts.map(() => 1),
    ];
  }

  const D = toHomogeneous3D(OBJECT_PTS);

  /* ---------- target projection matrix ---------- */

  const EYE_D = 4;
  const TARGET_P = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, -1 / EYE_D, 1],
  ];

  const GOAL_POINTS = projectiveTransform(TARGET_P, D);

  /* ---------- canvas + fixed view ---------- */

  const W = 640, H = 420;
  const UNIT = 44;
  const VIEW_YAW = -0.72;
  const VIEW_PITCH = -0.48;
  const SCREEN_X = 320;
  const SCREEN_Y = 258;

  /* ---------- module state ---------- */

  let p5Instance = null;
  let currentMatrix = Mat.identity(4);
  let currentPoints = D;
  let applyButtons = [];

  const anim = {
    stage: 'idle',          // idle | project | done
    t: 0,
    elapsed: 0,
    stageMs: 0,
    matrix: Mat.identity(4),
    onDone: null,
  };

  const STEP_MS = 1100;

  /* ---------- tutorial ---------- */

  function renderTutorial(container) {
    container.innerHTML = `
      <h3>// BRIEFING</h3>
      <p>The final render step turns a <b>3D scene</b> into a <b>2D screen</b>. Put the eye at <span class="inline">(0,0,d)</span> and the viewing plane at <span class="inline">z = 0</span>.</p>
      <p>Each object point, its projected screen point, and the eye all lie on one line.</p>

      <h3>// SIMILAR TRIANGLES</h3>
      <p>For a point <span class="inline">(x,y,z)</span>, similar triangles give:</p>
      <div class="matrix-block">x* = x / (1 - z/d), y* = y / (1 - z/d), z* = 0</div>
      <p>Points closer to the eye have a smaller denominator, so they appear larger.</p>

      <h3>// HOMOGENEOUS MATRIX</h3>
      <p>The divide lives in the <b>w</b> coordinate:</p>
      <div class="matrix-block">P = [ 1 0 0 0 ; 0 1 0 0 ; 0 0 0 0 ; 0 0 -1/d 1 ]</div>
      <p>After multiplying, divide by w. That is the perspective divide.</p>

      <h3>// OBJECTIVE</h3>
      <ul>
        <li>Use <b>d = 4</b>.</li>
        <li>Build the 4&times;4 perspective matrix <b>P</b>.</li>
        <li>Enter <span class="inline">-1/d = -0.25</span> in the bottom row.</li>
        <li>Apply <b>P</b> to collapse the beacon onto the screen plane.</li>
      </ul>

      <h3>// READING THE VIEWPORT</h3>
      <ul>
        <li>The blue frame is the screen plane <span class="inline">z = 0</span>.</li>
        <li>The yellow point is the eye at <span class="inline">(0,0,4)</span>.</li>
        <li>Dashed yellow: the target projection. Solid green: your projection.</li>
      </ul>
    `;
  }

  /* ---------- controls ---------- */

  function renderControls(container) {
    container.innerHTML = '';

    const pInput = UI.matrixInput({ label: 'PERSPECTIVE (P)', rows: 4, cols: 4 });
    container.appendChild(pInput.el);

    const apply = () => {
      if (anim.stage === 'project') return;
      const P = pInput.read();
      if (!isValid4x4(P)) {
        Console.error('Matrix entries must all be numbers. P is a 4x4 matrix.');
        return;
      }
      runProjection(P, () => evaluate(P));
    };

    const reset = () => {
      anim.stage = 'idle';
      currentMatrix = Mat.identity(4);
      currentPoints = D;
      if (p5Instance) { p5Instance.noLoop(); p5Instance.redraw(); }
      setButtonsEnabled(true);
      Console.note('Projection reset to the original 3D beacon.');
    };

    const btnApply = UI.button('APPLY P', apply);
    const btnReset = UI.button('RESET', reset, 'secondary');
    applyButtons = [btnApply];
    container.appendChild(UI.actionRow(btnApply, btnReset));
  }

  function isValid4x4(M) {
    return M.length === 4 && M.every(row => row.length === 4) &&
           M.flat().every(v => Number.isFinite(v));
  }

  function setButtonsEnabled(on) {
    applyButtons.forEach(b => {
      b.disabled = !on;
      b.style.opacity = on ? '1' : '0.4';
      b.style.cursor = on ? 'pointer' : 'not-allowed';
    });
  }

  /* ---------- animation ---------- */

  function runProjection(P, onComplete) {
    setButtonsEnabled(false);
    anim.matrix = P;
    anim.stage = 'project';
    anim.t = 0;
    anim.elapsed = 0;
    anim.stageMs = STEP_MS;
    anim.onDone = onComplete;
    if (p5Instance) p5Instance.loop();
  }

  function tickAnimation(dtMs) {
    anim.elapsed += dtMs;
    anim.t = Math.min(1, anim.elapsed / anim.stageMs);
    const e = easeInOutCubic(anim.t);
    currentMatrix = tweenProjectionMatrix(anim.matrix, e);
    currentPoints = projectiveTransform(currentMatrix, D);

    if (anim.t >= 1) {
      currentMatrix = anim.matrix;
      currentPoints = projectiveTransform(anim.matrix, D);
      anim.stage = 'done';
      if (p5Instance) p5Instance.noLoop();
      setButtonsEnabled(true);
      if (anim.onDone) anim.onDone();
    }
  }

  // Interpolate from identity toward the player's projective matrix.
  // For the perspective matrix this visibly slides z to 0 while w
  // becomes 1 - z/d, matching the similar-triangle formula.
  function tweenProjectionMatrix(P, t) {
    return lerpMat(Mat.identity(4), P, t);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpMat(A, B, t) {
    const out = [];
    for (let i = 0; i < A.length; i++) {
      out.push([]);
      for (let j = 0; j < A[0].length; j++) {
        out[i].push(A[i][j] + (B[i][j] - A[i][j]) * t);
      }
    }
    return out;
  }

  /* ---------- evaluation ---------- */

  function evaluate(P) {
    const pOk = Mat.equals(P, TARGET_P, 1e-4);

    if (pOk) {
      Console.success('P is correct. The homogeneous w coordinate performs the perspective divide.');
      Progress.markComplete(4);
      document.dispatchEvent(new CustomEvent('wfr:progress-changed'));
      return;
    }

    const notes = [];
    if (!rowsClose(P[0], [1,0,0,0]) || !rowsClose(P[1], [0,1,0,0])) {
      notes.push('the first two rows should preserve x and y before the divide');
    }
    if (!rowsClose(P[2], [0,0,0,0])) {
      notes.push('the third row should collapse z onto the screen plane');
    }
    if (!rowsClose(P[3], [0,0,-0.25,1])) {
      notes.push('the bottom row should be [0 0 -0.25 1] for d = 4');
    }

    if (notes.length === 0) {
      Console.warning('The projection is close, but not exact. Check decimal precision and signs.');
    } else if (notes.length === 1) {
      Console.warning(`Almost there: ${notes[0]}.`);
    } else {
      Console.error(`The matrix is not the target P: ${joinList(notes)}.`);
    }
  }

  function rowsClose(a, b) {
    return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 1e-4);
  }

  function joinList(items) {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  /* ---------- projective math ---------- */

  function projectiveTransform(M, pts4) {
    const raw = Mat.mul(M, pts4);
    const out = [[], [], [], []];
    const n = raw[0].length;

    for (let i = 0; i < n; i++) {
      const w = raw[3][i];
      if (!Number.isFinite(w) || Math.abs(w) < 1e-6) {
        out[0][i] = NaN;
        out[1][i] = NaN;
        out[2][i] = NaN;
        out[3][i] = 1;
        continue;
      }
      out[0][i] = raw[0][i] / w;
      out[1][i] = raw[1][i] / w;
      out[2][i] = raw[2][i] / w;
      out[3][i] = 1;
    }

    return out;
  }

  /* ---------- 3D -> 2D viewport camera ---------- */

  function viewProject(x, y, z) {
    const cy = Math.cos(VIEW_YAW), sy = Math.sin(VIEW_YAW);
    let x1 = cy * x + sy * z;
    let z1 = -sy * x + cy * z;
    let y1 = y;

    const cp = Math.cos(VIEW_PITCH), sp = Math.sin(VIEW_PITCH);
    let y2 = cp * y1 - sp * z1;
    let z2 = sp * y1 + cp * z1;
    let x2 = x1;

    return {
      sx: SCREEN_X + x2 * UNIT,
      sy: SCREEN_Y - y2 * UNIT,
      depth: z2,
    };
  }

  /* ---------- p5 sketch ---------- */

  function makeSketch() {
    return (p) => {
      let lastMs = 0;

      p.setup = () => {
        const c = p.createCanvas(W, H);
        c.parent('p5-host');
        p.noLoop();
        p.textFont('VT323');
        lastMs = p.millis();
      };

      p.draw = () => {
        const now = p.millis();
        const dt = now - lastMs;
        lastMs = now;

        if (anim.stage === 'project') tickAnimation(dt);
        renderScene(p);
      };
    };
  }

  function renderScene(p) {
    p.background(1, 4, 1);
    drawViewingPlane(p);
    drawWorldAxes(p);
    drawEyeAndRays(p);

    drawWireframe(p, GOAL_POINTS, {
      base: [255, 255, 51], dashed: true, dots: false, alpha: 150,
    });

    if (anim.stage !== 'idle') {
      drawWireframe(p, D, {
        base: [0, 253, 0], dashed: true, dots: false, alpha: 55,
      });
    }

    drawWireframe(p, currentPoints, {
      base: [0, 253, 0], dashed: false, dots: true, alpha: 240,
    });

    drawCaption(p);
  }

  function drawViewingPlane(p) {
    p.strokeWeight(1);
    for (let i = -4; i <= 4; i++) {
      p.stroke(120, 170, 255, i === 0 ? 95 : 35);
      let a = viewProject(i, -3, 0), b = viewProject(i, 3, 0);
      p.line(a.sx, a.sy, b.sx, b.sy);
      a = viewProject(-4, i, 0); b = viewProject(4, i, 0);
      p.line(a.sx, a.sy, b.sx, b.sy);
    }

    const corners = [
      viewProject(-4, -3, 0), viewProject(4, -3, 0),
      viewProject(4, 3, 0), viewProject(-4, 3, 0),
    ];
    p.noFill();
    p.stroke(120, 170, 255, 150);
    p.strokeWeight(2);
    p.beginShape();
    corners.forEach(c => p.vertex(c.sx, c.sy));
    p.endShape(p.CLOSE);

    p.noStroke();
    p.fill(120, 170, 255, 210);
    p.textSize(14);
    p.textAlign(p.LEFT, p.TOP);
    const label = viewProject(-4, 3, 0);
    p.text('z = 0 screen', label.sx + 8, label.sy - 12);
  }

  function drawWorldAxes(p) {
    const o = viewProject(0, 0, 0);
    const axes = [
      { v: [2.7, 0, 0], col: [237, 4, 0], label: 'x' },
      { v: [0, 2.7, 0], col: [0, 253, 0], label: 'y' },
      { v: [0, 0, 2.7], col: [120, 170, 255], label: 'z' },
    ];
    p.strokeWeight(2);
    for (const ax of axes) {
      const e = viewProject(ax.v[0], ax.v[1], ax.v[2]);
      p.stroke(...ax.col, 190);
      p.line(o.sx, o.sy, e.sx, e.sy);
      p.noStroke();
      p.fill(...ax.col, 230);
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(ax.label, e.sx, e.sy - 8);
    }
  }

  function drawEyeAndRays(p) {
    const eye = viewProject(0, 0, EYE_D);

    p.strokeWeight(1);
    for (let i = 0; i < OBJECT_PTS.length; i++) {
      const goal = pointAt(GOAL_POINTS, i);
      if (!isFinitePoint(goal)) continue;
      const g = viewProject(goal.x, goal.y, goal.z);
      p.stroke(255, 255, 51, 35);
      p.line(eye.sx, eye.sy, g.sx, g.sy);
    }

    p.noStroke();
    p.fill(255, 255, 51, 230);
    p.circle(eye.sx, eye.sy, 8);
    p.textSize(14);
    p.textAlign(p.CENTER, p.BOTTOM);
    p.text('eye (0,0,4)', eye.sx, eye.sy - 8);
  }

  /* ---------- wireframe drawing ---------- */

  function drawWireframe(p, pts4, style) {
    const proj = [];
    for (let i = 0; i < pts4[0].length; i++) {
      const pt = pointAt(pts4, i);
      proj.push(isFinitePoint(pt) ? viewProject(pt.x, pt.y, pt.z) : null);
    }

    const depths = proj.filter(Boolean).map(pr => pr.depth);
    const dMin = depths.length ? Math.min(...depths) : 0;
    const dMax = depths.length ? Math.max(...depths) : 1;
    const span = (dMax - dMin) || 1;

    for (const [a, b] of OBJECT_EDGES) {
      if (!proj[a] || !proj[b]) continue;
      const near = (((proj[a].depth + proj[b].depth) / 2) - dMin) / span;
      const alpha = (style.alpha || 220) * (0.55 + near * 0.45);
      p.stroke(style.base[0], style.base[1], style.base[2], alpha);
      p.strokeWeight(style.dashed ? 1.4 : 1.7 + near * 1.4);
      if (style.dashed) {
        dashedLine(p, proj[a].sx, proj[a].sy, proj[b].sx, proj[b].sy, 6, 4);
      } else {
        p.line(proj[a].sx, proj[a].sy, proj[b].sx, proj[b].sy);
      }
    }

    if (style.dots) {
      p.noStroke();
      for (const pr of proj) {
        if (!pr) continue;
        const near = (pr.depth - dMin) / span;
        p.fill(style.base[0], style.base[1], style.base[2], 145 + near * 95);
        p.circle(pr.sx, pr.sy, 3.5 + near * 3.5);
      }
    }
  }

  function pointAt(pts4, i) {
    return { x: pts4[0][i], y: pts4[1][i], z: pts4[2][i] };
  }

  function isFinitePoint(pt) {
    return Number.isFinite(pt.x) && Number.isFinite(pt.y) && Number.isFinite(pt.z);
  }

  function dashedLine(p, x1, y1, x2, y2, dash, gap) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;
    let d = 0;
    while (d < len) {
      const e = Math.min(d + dash, len);
      p.line(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
      d = e + gap;
    }
  }

  /* ---------- caption overlay ---------- */

  function drawCaption(p) {
    if (anim.stage === 'idle') return;

    const boxW = 242, boxH = 180;
    const boxX = W - boxW - 14, boxY = 14;

    p.fill(0, 0, 0, 212);
    p.stroke(0, 253, 0, 180);
    p.strokeWeight(2);
    p.rect(boxX, boxY, boxW, boxH, 6);
    p.noStroke();

    const mat = anim.stage === 'project'
      ? tweenProjectionMatrix(anim.matrix, easeInOutCubic(anim.t))
      : currentMatrix;

    p.fill(255, 255, 51, 240);
    p.textSize(15);
    p.textAlign(p.LEFT, p.TOP);
    p.text(anim.stage === 'project' ? 'APPLYING P' : 'RESULT P', boxX + 12, boxY + 9);

    p.fill(0, 253, 0, 240);
    p.textSize(14);
    const colX = [boxX + 40, boxX + 86, boxX + 132, boxX + 178];
    const rowY = [boxY + 34, boxY + 56, boxY + 78, boxY + 100];
    p.textAlign(p.LEFT, p.TOP);
    for (const y of rowY) {
      p.text('[', boxX + 14, y);
      p.text(']', boxX + boxW - 20, y);
    }
    p.textAlign(p.CENTER, p.TOP);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        p.text(fmt(mat[r][c]), colX[c], rowY[r]);
      }
    }

    p.fill(120, 170, 255, 220);
    p.textSize(13);
    p.textAlign(p.LEFT, p.TOP);
    p.text('divide by w = 1 - z/4', boxX + 14, boxY + 128);

    const barX = boxX + 12, barY = boxY + boxH - 16, barW = boxW - 24, barH = 5;
    p.noStroke();
    p.fill(0, 253, 0, 50);
    p.rect(barX, barY, barW, barH, 2);
    p.fill(0, 253, 0, 230);
    p.rect(barX, barY, barW * (anim.stage === 'project' ? anim.t : 1), barH, 2);
  }

  function fmt(v) {
    if (!Number.isFinite(v)) return '?';
    if (Math.abs(v) < 1e-9) return '0';
    const s = v.toFixed(3);
    return s.replace(/\.?0+$/, '') || '0';
  }

  /* ---------- lifecycle ---------- */

  function mount() {
    renderTutorial(document.getElementById('tutorial-content'));
    renderControls(document.getElementById('controls'));
    Console.clear();
    Console.info('Level 4 initialized. Build P for d = 4 and project the beacon onto z = 0.');
    Console.note('Tip: P leaves x and y in place, zeros z, and stores -z/4 in w.');

    currentMatrix = Mat.identity(4);
    currentPoints = D;
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
    p5Instance = new p5(makeSketch());
  }

  function unmount() {
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
  }

  return {
    id: 4,
    slug: 'level4',
    title: 'PERSPECTIVE PROJECTIONS',
    mount,
    unmount,
  };
})();
