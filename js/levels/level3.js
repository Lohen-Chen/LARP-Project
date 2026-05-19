/* ============================================================
   level3.js — 3D Homogeneous Coordinates
   ------------------------------------------------------------
   Lesson (Linear_Algebra_Project_1_.md):
     - A 3D point (x,y,z) has homogeneous coordinates (x,y,z,1)
       in R⁴. Any nonzero scalar multiple (X,Y,Z,H), H≠0, gives
       the same point (X/H, Y/H, Z/H).
     - Example 7 (molecular modeling — moving a drug into a
       protein) asks for 4×4 matrices for:
         a. Rotation about the y-axis by 30°
         b. Translation by the vector p = (-6, 4, 5)

   4×4 forms used here:
     Rotation about y by θ:
        [  cosθ  0  sinθ  0 ]
        [   0    1   0    0 ]
        [ -sinθ  0  cosθ  0 ]
        [   0    0   0    1 ]
     Translation by (a,b,c):
        [ 1 0 0 a ; 0 1 0 b ; 0 0 1 c ; 0 0 0 1 ]

   Puzzle: build R and T as 4×4 matrices, apply the composite
   T·R to carry a 3D cube wireframe onto the goal silhouette.
   The viewport draws the cube with a fixed axonometric (parallel)
   projection so all three axes are visible — true perspective
   projection is saved for Level 4.
   ============================================================ */

const Level3 = (() => {

  /* ---------- 3D geometry: a unit-ish cube ---------- */

  // 8 cube corners, each (x,y,z). Side length 2, centered on origin.
  const CUBE_PTS = [
    [-1, -1, -1], [ 1, -1, -1], [ 1,  1, -1], [-1,  1, -1],  // back face  (z = -1)
    [-1, -1,  1], [ 1, -1,  1], [ 1,  1,  1], [-1,  1,  1],   // front face (z = +1)
  ];
  // 12 edges as index pairs into CUBE_PTS.
  const CUBE_EDGES = [
    [0,1],[1,2],[2,3],[3,0],   // back face
    [4,5],[5,6],[6,7],[7,4],   // front face
    [0,4],[1,5],[2,6],[3,7],   // connecting edges
  ];

  // Homogeneous 4xN matrix: rows x, y, z, w(=1); columns are points.
  function toHomogeneous3D(pts) {
    return [
      pts.map(p => p[0]),
      pts.map(p => p[1]),
      pts.map(p => p[2]),
      pts.map(() => 1),
    ];
  }
  const D = toHomogeneous3D(CUBE_PTS);

  /* ---------- target matrices (lesson's Example 7) ---------- */

  const ANGLE_DEG = 30;
  const TH = ANGLE_DEG * Math.PI / 180;
  const C30 = Math.cos(TH), S30 = Math.sin(TH);

  // Rotation about the y-axis by 30°.
  const TARGET_R = [
    [ C30, 0, S30, 0],
    [ 0,   1, 0,   0],
    [-S30, 0, C30, 0],
    [ 0,   0, 0,   1],
  ];
  // Translation by p = (-6, 4, 5).
  const TARGET_T = [
    [1, 0, 0, -6],
    [0, 1, 0,  4],
    [0, 0, 1,  5],
    [0, 0, 0,  1],
  ];
  // Composite, applied right-to-left: rotate, then translate.
  const GOAL = Mat.mul(TARGET_T, TARGET_R);

  /* ---------- canvas + projection ---------- */

  const W = 640, H = 420;
  const UNIT = 18;                  // px per world unit

  // Fixed axonometric camera: yaw + pitch applied to every point
  // before projecting. This is a constant VIEW transform — it is
  // not part of the puzzle, just how we look at the 3D scene.
  const VIEW_YAW   = -0.62;         // radians, rotate around world y
  const VIEW_PITCH = -0.42;         // radians, tilt down

  // Screen origin (where world (0,0,0) projects to). Placed so the
  // start cube sits lower-right and the translated goal cube lands
  // upper-left — both clear of the top-right caption panel.
  const SCREEN_X = 320;
  const SCREEN_Y = 300;

  /* ---------- state ---------- */

  let p5Instance = null;
  let currentTransform = Mat.identity(4);
  let applyButtons = [];

  const anim = {
    stage: 'idle',          // idle | s1 | p1 | s2 | done
    t: 0, elapsed: 0, stageMs: 0,
    base: Mat.identity(4),
    order: [],
    stepIndex: 0,
    onDone: null,
  };
  const STEP_MS  = 720;
  const PAUSE_MS = 320;

  /* ---------- tutorial ---------- */

  function renderTutorial(container) {
    container.innerHTML = `
      <h3>// BRIEFING</h3>
      <p>The render is now <b>three-dimensional</b>. A point <span class="inline">(x, y, z)</span> gets homogeneous coordinates <span class="inline">(x, y, z, 1)</span> in R&#8308;.</p>
      <p>Any nonzero scalar multiple <span class="inline">(X, Y, Z, H)</span> with <span class="inline">H &ne; 0</span> represents the same point <span class="inline">(X/H, Y/H, Z/H)</span>.</p>

      <h3>// 4×4 TRANSFORMS</h3>
      <p>Every 3D transform is now a <b>4&times;4</b> matrix. Rotation about the <b>y-axis</b> by &theta;:</p>
      <div class="matrix-block">[ cos&theta; 0 sin&theta; 0 ; 0 1 0 0 ; -sin&theta; 0 cos&theta; 0 ; 0 0 0 1 ]</div>
      <p>Translation by <span class="inline">(a, b, c)</span>:</p>
      <div class="matrix-block">[ 1 0 0 a ; 0 1 0 b ; 0 0 1 c ; 0 0 0 1 ]</div>

      <h3>// OBJECTIVE</h3>
      <p>Reproduce Example 7 &mdash; moving a molecule into position. Build two matrices:</p>
      <ul>
        <li><b>R</b> &mdash; rotation about the y-axis by <b>30&deg;</b>.</li>
        <li><b>T</b> &mdash; translation by <b>p = (&minus;6, 4, 5)</b>.</li>
      </ul>
      <p>Use <span class="inline">cos 30&deg; &asymp; 0.866</span> and <span class="inline">sin 30&deg; &asymp; 0.5</span> (3 decimals). Then apply the composite <b>T &middot; R</b> &mdash; rotate first, then translate.</p>

      <h3>// READING THE VIEWPORT</h3>
      <ul>
        <li>The cube is drawn in a fixed 3/4 view so all three axes show.</li>
        <li>Red / green / blue stubs mark the +x / +y / +z axes.</li>
        <li>Solid green: your render. Dashed yellow: the goal.</li>
        <li>Back edges are drawn dimmer than front edges.</li>
      </ul>
    `;
  }

  /* ---------- controls ---------- */

  function renderControls(container) {
    container.innerHTML = '';

    const rInput = UI.matrixInput({ label: 'ROTATE Y (R)',  rows: 4, cols: 4 });
    const tInput = UI.matrixInput({ label: 'TRANSLATE (T)', rows: 4, cols: 4 });

    const group = document.createElement('div');
    group.className = 'matrix-input-group';
    group.appendChild(rInput.el);
    group.appendChild(tInput.el);
    container.appendChild(group);

    const apply = () => {
      if (anim.stage !== 'idle' && anim.stage !== 'done') return;
      const R = rInput.read();
      const T = tInput.read();

      if (!isValid4x4(R) || !isValid4x4(T)) {
        Console.error('Matrix entries must all be numbers. Each matrix is 4×4.');
        return;
      }
      runSequence(R, T, () => evaluate(R, T));
    };

    const reset = () => {
      anim.stage = 'idle';
      currentTransform = Mat.identity(4);
      if (p5Instance) { p5Instance.noLoop(); p5Instance.redraw(); }
      setButtonsEnabled(true);
      Console.note('Transform reset to identity.');
    };

    const btnApply = UI.button('APPLY T·R', apply);
    const btnReset = UI.button('RESET', reset, 'secondary');
    applyButtons = [btnApply];
    container.appendChild(UI.actionRow(btnApply, btnReset));
  }

  function setButtonsEnabled(on) {
    applyButtons.forEach(b => {
      b.disabled = !on;
      b.style.opacity = on ? '1' : '0.4';
      b.style.cursor = on ? 'pointer' : 'not-allowed';
    });
  }

  function isValid4x4(M) {
    return M.length === 4 && M.every(row => row.length === 4) &&
           M.flat().every(v => Number.isFinite(v));
  }

  /* ---------- animation ---------- */

  function runSequence(R, T, onComplete) {
    setButtonsEnabled(false);
    anim.order = [
      { label: 'APPLYING R', factor: R, kind: classify(R) },
      { label: 'APPLYING T', factor: T, kind: classify(T) },
    ];
    anim.stepIndex = 0;
    anim.base = Mat.identity(4);
    anim.stage = 's1';
    anim.t = 0;
    anim.elapsed = 0;
    anim.stageMs = STEP_MS;
    anim.onDone = onComplete;
    if (p5Instance) p5Instance.loop();
  }

  // Decide how a 4×4 homogeneous matrix should be interpolated.
  // A y-axis rotation must tween by ANGLE so the cube doesn't
  // collapse through a degenerate state mid-spin.
  function classify(M) {
    const c = M[0][0], s = M[0][2];
    const looksYRotation =
      Math.abs(M[2][0] + s) < 1e-6 &&
      Math.abs(M[2][2] - c) < 1e-6 &&
      Math.abs(M[1][1] - 1) < 1e-6 &&
      Math.abs(c * c + s * s - 1) < 1e-3 &&
      Math.abs(M[0][3]) < 1e-9 && Math.abs(M[1][3]) < 1e-9 && Math.abs(M[2][3]) < 1e-9 &&
      !(Math.abs(c - 1) < 1e-9 && Math.abs(s) < 1e-9);
    if (looksYRotation) {
      return { type: 'yrotation', angle: Math.atan2(s, c) };
    }
    return { type: 'entrywise' };
  }

  // The factor matrix partially applied at parameter u in [0,1].
  function partialFactor(step, u) {
    if (step.kind.type === 'yrotation') {
      const a = step.kind.angle * u;
      const c = Math.cos(a), s = Math.sin(a);
      return [
        [ c, 0, s, 0],
        [ 0, 1, 0, 0],
        [-s, 0, c, 0],
        [ 0, 0, 0, 1],
      ];
    }
    return lerpMat(Mat.identity(4), step.factor, u);
  }

  function tickAnimation(dtMs) {
    anim.elapsed += dtMs;
    anim.t = Math.min(1, anim.elapsed / anim.stageMs);

    const isStep  = anim.stage === 's1' || anim.stage === 's2';
    const isPause = anim.stage === 'p1';

    if (isStep) {
      const step = anim.order[anim.stepIndex];
      const e = easeInOutCubic(anim.t);
      currentTransform = Mat.mul(partialFactor(step, e), anim.base);

      if (anim.t >= 1) {
        anim.base = Mat.mul(step.factor, anim.base);
        currentTransform = anim.base;

        if (anim.stage === 's1') {
          anim.stage = 'p1';
          anim.stageMs = PAUSE_MS;
        } else { // s2 done
          anim.stage = 'done';
          if (p5Instance) p5Instance.noLoop();
          setButtonsEnabled(true);
          if (anim.onDone) anim.onDone();
        }
        anim.elapsed = 0;
        anim.t = 0;
      }
    } else if (isPause) {
      if (anim.t >= 1) {
        anim.stepIndex = 1;
        anim.stage = 's2';
        anim.stageMs = STEP_MS;
        anim.elapsed = 0;
        anim.t = 0;
      }
    }
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

  function evaluate(R, T) {
    const rOk = Mat.equals(R, TARGET_R, 2e-3);
    const tOk = Mat.equals(T, TARGET_T);

    if (rOk && tOk) {
      Console.success('Both matrices are correct. The composite T·R moves the molecule onto the goal.');
      Progress.markComplete(3);
      document.dispatchEvent(new CustomEvent('wfr:progress-changed'));
    } else if (!rOk && !tOk) {
      Console.error('You have not correctly input the rotation matrix R or the translation matrix T.');
    } else if (rOk && !tOk) {
      Console.warning('The rotation matrix R is correct, but the translation matrix T is not.');
    } else {
      Console.warning('The translation matrix T is correct, but the rotation matrix R is not. Check cos 30° ≈ 0.866 and sin 30° ≈ 0.5.');
    }
  }

  /* ---------- 3D → 2D projection ---------- */

  // Apply the fixed view rotation (yaw about y, then pitch about x)
  // to a world point, then orthographically project to screen.
  // Returns { sx, sy, depth } — depth is camera-space z for sorting.
  function project(x, y, z) {
    // yaw about y
    const cy = Math.cos(VIEW_YAW), sy = Math.sin(VIEW_YAW);
    let x1 =  cy * x + sy * z;
    let z1 = -sy * x + cy * z;
    let y1 =  y;
    // pitch about x
    const cp = Math.cos(VIEW_PITCH), sp = Math.sin(VIEW_PITCH);
    let y2 = cp * y1 - sp * z1;
    let z2 = sp * y1 + cp * z1;
    let x2 = x1;
    // orthographic: screen x from camera x, screen y from camera y (flip)
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
        if (anim.stage !== 'idle' && anim.stage !== 'done') {
          tickAnimation(dt);
        }
        renderScene(p);
      };
    };
  }

  function renderScene(p) {
    p.background(1, 4, 1);
    drawFloorGrid(p);
    drawAxes(p);

    // Goal silhouette — dashed warning-yellow
    drawCube(p, applyTransform(GOAL, D), {
      base: [255, 255, 51], dashed: true, fillFaces: false,
    });

    // Ghost of the starting cube — faint, shows "before"
    if (anim.stage !== 'idle') {
      drawCube(p, applyTransform(Mat.identity(4), D), {
        base: [0, 253, 0], dashed: true, fillFaces: false, ghost: true,
      });
    }

    // Current (animated) render — solid primary green
    drawCube(p, applyTransform(currentTransform, D), {
      base: [0, 253, 0], dashed: false, fillFaces: true,
    });

    drawOrigin(p);
    drawCaption(p);
  }

  // Multiply a 4x4 transform by the 4xN homogeneous cube, return 4xN.
  function applyTransform(M, pts4) {
    return Mat.mul(M, pts4);
  }

  /* ---------- world reference: floor grid + axes ---------- */

  function drawFloorGrid(p) {
    // grid on the y=0 plane, from -5..5 in x and z
    p.strokeWeight(1);
    for (let i = -5; i <= 5; i++) {
      p.stroke(0, 253, 0, i === 0 ? 70 : 24);
      let a = project(i, 0, -5), b = project(i, 0, 5);
      p.line(a.sx, a.sy, b.sx, b.sy);
      a = project(-5, 0, i); b = project(5, 0, i);
      p.line(a.sx, a.sy, b.sx, b.sy);
    }
  }

  function drawAxes(p) {
    const o = project(0, 0, 0);
    const axes = [
      { v: [4, 0, 0], col: [237, 4, 0],   label: 'x' },  // red   +x
      { v: [0, 4, 0], col: [0, 253, 0],   label: 'y' },  // green +y
      { v: [0, 0, 4], col: [120, 170, 255], label: 'z' },// blue  +z
    ];
    p.strokeWeight(2);
    for (const ax of axes) {
      const e = project(ax.v[0], ax.v[1], ax.v[2]);
      p.stroke(...ax.col, 200);
      p.line(o.sx, o.sy, e.sx, e.sy);
      p.noStroke();
      p.fill(...ax.col, 230);
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(ax.label, e.sx + (ax.label === 'x' ? 8 : 0), e.sy - (ax.label === 'y' ? 8 : 0));
    }
  }

  function drawOrigin(p) {
    const o = project(0, 0, 0);
    p.noStroke();
    p.fill(255, 255, 51, 220);
    p.circle(o.sx, o.sy, 5);
  }

  /* ---------- cube drawing ---------- */

  // pts4 is a 4xN homogeneous matrix (the transformed cube corners).
  function drawCube(p, pts4, style) {
    const n = pts4[0].length;

    // Project all 8 corners. Perspective-divide by w for safety
    // (w stays 1 for affine transforms, but this keeps it correct).
    const proj = [];
    for (let i = 0; i < n; i++) {
      const w = pts4[3][i] || 1;
      const pr = project(pts4[0][i] / w, pts4[1][i] / w, pts4[2][i] / w);
      proj.push(pr);
    }

    // Optional translucent faces for the solid cube (front-most only,
    // kept subtle). We skip faces for dashed/ghost cubes.
    if (style.fillFaces) {
      const faces = [
        [0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4],
      ];
      // sort faces back-to-front by average depth
      const ordered = faces
        .map(f => ({ f, d: f.reduce((s,i) => s + proj[i].depth, 0) / 4 }))
        .sort((a,b) => a.d - b.d);
      p.noStroke();
      for (const { f } of ordered) {
        p.fill(style.base[0], style.base[1], style.base[2], 14);
        p.beginShape();
        for (const idx of f) p.vertex(proj[idx].sx, proj[idx].sy);
        p.endShape(p.CLOSE);
      }
    }

    // Edges, with depth cue: nearer edges brighter & thicker.
    const depths = proj.map(pr => pr.depth);
    const dMin = Math.min(...depths), dMax = Math.max(...depths);
    const span = (dMax - dMin) || 1;

    for (const [a, b] of CUBE_EDGES) {
      const avg = (proj[a].depth + proj[b].depth) / 2;
      const near = (avg - dMin) / span;          // 0 = far, 1 = near
      let alpha, weight;
      if (style.ghost) {
        alpha = 30 + near * 35;
        weight = 1.4;
      } else if (style.dashed) {
        alpha = 70 + near * 80;
        weight = 1.6;
      } else {
        alpha = 110 + near * 145;
        weight = 1.6 + near * 1.6;
      }
      p.stroke(style.base[0], style.base[1], style.base[2], alpha);
      p.strokeWeight(weight);
      if (style.dashed) {
        dashedLine(p, proj[a].sx, proj[a].sy, proj[b].sx, proj[b].sy, 6, 4);
      } else {
        p.line(proj[a].sx, proj[a].sy, proj[b].sx, proj[b].sy);
      }
    }

    // Corner dots for the solid cube.
    if (!style.dashed && !style.ghost) {
      p.noStroke();
      for (let i = 0; i < n; i++) {
        const near = (proj[i].depth - dMin) / span;
        p.fill(style.base[0], style.base[1], style.base[2], 130 + near * 110);
        p.circle(proj[i].sx, proj[i].sy, 3 + near * 3);
      }
    }
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

    const boxW = 232, boxH = 168;
    const boxX = W - boxW - 14, boxY = 14;

    p.fill(0, 0, 0, 210);
    p.stroke(0, 253, 0, 180);
    p.strokeWeight(2);
    p.rect(boxX, boxY, boxW, boxH, 6);
    p.noStroke();

    let label, mat;
    const isStep  = anim.stage === 's1' || anim.stage === 's2';
    const isPause = anim.stage === 'p1';

    if (isStep) {
      const step = anim.order[anim.stepIndex];
      label = step.label;
      mat = partialFactor(step, easeInOutCubic(anim.t));
    } else if (isPause) {
      const step = anim.order[anim.stepIndex];
      label = step.label;
      mat = step.factor;
    } else {
      label = 'RESULT T·R';
      mat = GOAL;
    }

    p.fill(255, 255, 51, 240);
    p.textSize(15);
    p.textAlign(p.LEFT, p.TOP);
    p.text(label, boxX + 12, boxY + 9);

    // 4×4 matrix in compact numbers
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

    // progress bar across the 2 steps
    const segDone = isStep ? anim.stepIndex : (isPause ? 1 : 2);
    const within  = isStep ? anim.t : 0;
    const progress = Math.min(1, (segDone + within) / 2);
    const barX = boxX + 12, barY = boxY + boxH - 16, barW = boxW - 24, barH = 5;
    p.noStroke();
    p.fill(0, 253, 0, 50);
    p.rect(barX, barY, barW, barH, 2);
    p.fill(0, 253, 0, 230);
    p.rect(barX, barY, barW * progress, barH, 2);
  }

  function fmt(v) {
    if (Math.abs(v) < 1e-9) return '0';
    const s = v.toFixed(3);
    return s.replace(/\.?0+$/, '') || '0';
  }

  /* ---------- lifecycle ---------- */

  function mount() {
    renderTutorial(document.getElementById('tutorial-content'));
    renderControls(document.getElementById('controls'));
    Console.clear();
    Console.info('Level 3 initialized. Build R and T as 4×4 homogeneous matrices.');
    Console.note('Tip: rotation about y uses cos/sin of 30°. Apply T·R — rotate first.');

    currentTransform = Mat.identity(4);
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
    p5Instance = new p5(makeSketch());
  }

  function unmount() {
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
  }

  return {
    id: 3,
    slug: 'level3',
    title: '3D HOMOGENEOUS COORDS',
    mount,
    unmount,
  };
})();
