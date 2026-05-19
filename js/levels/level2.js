/* ============================================================
   level2.js — Homogeneous Coordinates & Translation
   ------------------------------------------------------------
   Lesson (Linear_Algebra_Project.md):
     - A 2D point (x, y) is identified with (x, y, 1) in R³ — a
       homogeneous coordinate one unit above the xy-plane.
     - Translation, which is NOT linear in 2D, becomes a single
       3×3 matrix multiplication in homogeneous coordinates:
           T = [ 1 0 h ; 0 1 k ; 0 0 1 ]
     - A general transform embeds a 2×2 block A:
           [ A A 0 ; A A 0 ; 0 0 1 ]
     - Worked example: scale (2,3) by 2, rotate 90°, translate
       1 unit down  →  expression  T · R · S · point,
       written right-to-left, multiplied left-to-right.

   Puzzle: the player builds S, R, T as 3×3 homogeneous matrices
   and applies the composite  T · R · S  to move the wireframe
   onto the goal silhouette. Translation is the new capability —
   no 2×2 matrix from Level 1 could slide the shape like this.
   ============================================================ */

const Level2 = (() => {

  /* ---------- geometry ---------- */

  // A compact arrow marker, ~3 units wide/tall, drawn as a closed
  // polygon. An arrow (vs. Level 1's near-symmetric N) makes the
  // 90° rotation unmistakable — you can see which way it points.
  // Columns are vertices; stored as a 2xN set, lifted to 3xN below.
  const SHAPE_2D = [
    [0, 2, 1.2, 1.2, -1.2, -1.2, -2,  0  ],  // x
    [2, 0, 0,   -2,  -2,    0,    0,  2  ],  // y
  ];
  const D = Mat.toHomogeneous2D(SHAPE_2D);   // 3xN homogeneous

  /* ---------- target matrices (the lesson's worked example) ---------- */

  // Scale by 2 (sx = sy = 2)
  const TARGET_S = [
    [2, 0, 0],
    [0, 2, 0],
    [0, 0, 1],
  ];
  // Rotate 90° counter-clockwise
  const TARGET_R = [
    [0, -1, 0],
    [1,  0, 0],
    [0,  0, 1],
  ];
  // Translate: 1 unit down  (h = 0, k = -1)
  const TARGET_T = [
    [1, 0,  0],
    [0, 1, -1],
    [0, 0,  1],
  ];

  // Composite, applied right-to-left:  T · R · S
  const GOAL = Mat.mul(TARGET_T, Mat.mul(TARGET_R, TARGET_S));

  /* ---------- canvas + grid ---------- */

  const W = 640, H = 420;
  const UNIT = 30;                 // px per unit
  const ORIGIN_X = 11 * UNIT;      // 330 — multiple of UNIT, snaps to grid
  const ORIGIN_Y = 8  * UNIT;      // 240 — multiple of UNIT, snaps to grid

  /* ---------- state ---------- */

  let p5Instance = null;
  let currentTransform = Mat.identity(3);
  let applyButtons = [];

  // Animation: a 3-step sequence (apply S, then R, then T).
  // Each step tweens the *cumulative* transform. The rotation step
  // interpolates the ANGLE (not the matrix entries) so the shape
  // doesn't collapse through a degenerate state mid-rotation.
  const anim = {
    stage: 'idle',          // idle | s1 | p1 | s2 | p2 | s3 | done
    t: 0, elapsed: 0, stageMs: 0,
    base: Mat.identity(3),  // cumulative transform before current step
    order: [],              // sequence of step descriptors
    stepIndex: 0,
    onDone: null,
  };
  const STEP_MS  = 680;
  const PAUSE_MS = 300;

  /* ---------- tutorial ---------- */

  function renderTutorial(container) {
    container.innerHTML = `
      <h3>// BRIEFING</h3>
      <p>A 2&times;2 matrix cannot <b>translate</b> a shape &mdash; sliding isn't a linear map. The fix from this lesson: <b>homogeneous coordinates</b>.</p>
      <p>Every point <span class="inline">(x, y)</span> is lifted to <span class="inline">(x, y, 1)</span> &mdash; a point one unit above the plane in R&sup3;.</p>

      <h3>// TRANSLATION</h3>
      <p>With the extra coordinate, a translation by <span class="inline">(h, k)</span> becomes a single 3&times;3 multiply:</p>
      <div class="matrix-block">T = [ 1 0 h ; 0 1 k ; 0 0 1 ]</div>

      <h3>// EMBEDDING A LINEAR MAP</h3>
      <p>Any 2&times;2 transform <span class="inline">A</span> (scale, rotation, reflection) sits in the top-left block:</p>
      <div class="matrix-block">[ A A 0 ; A A 0 ; 0 0 1 ]</div>
      <p>Rotation by &theta;: <span class="inline">[cos&theta; -sin&theta;; sin&theta; cos&theta;]</span>. Scale by s, t: <span class="inline">[s 0; 0 t]</span>.</p>

      <h3>// OBJECTIVE</h3>
      <p>Reproduce the lesson's worked example. Build three matrices:</p>
      <ul>
        <li><b>S</b> &mdash; scale by <b>2</b> on both axes.</li>
        <li><b>R</b> &mdash; rotate <b>90&deg;</b> counter-clockwise.</li>
        <li><b>T</b> &mdash; translate <b>1 unit down</b> (h = 0, k = &minus;1).</li>
      </ul>
      <p>Then apply the composite <b>T &middot; R &middot; S</b>. Transforms are written right-to-left: S happens first, then R, then T.</p>

      <h3>// READING THE VIEWPORT</h3>
      <ul>
        <li>Solid green: your current render.</li>
        <li>Dashed yellow: the goal silhouette.</li>
        <li>The arrow makes rotation visible &mdash; watch where it points.</li>
      </ul>
    `;
  }

  /* ---------- controls ---------- */

  function renderControls(container) {
    container.innerHTML = '';

    const sInput = UI.matrixInput({ label: 'SCALE (S)',     rows: 3, cols: 3 });
    const rInput = UI.matrixInput({ label: 'ROTATE (R)',    rows: 3, cols: 3 });
    const tInput = UI.matrixInput({ label: 'TRANSLATE (T)', rows: 3, cols: 3 });

    const group = document.createElement('div');
    group.className = 'matrix-input-group';
    group.appendChild(sInput.el);
    group.appendChild(rInput.el);
    group.appendChild(tInput.el);
    container.appendChild(group);

    const apply = () => {
      if (anim.stage !== 'idle' && anim.stage !== 'done') return; // ignore mid-anim
      const S = sInput.read();
      const R = rInput.read();
      const T = tInput.read();

      if (!isValid3x3(S) || !isValid3x3(R) || !isValid3x3(T)) {
        Console.error('Matrix entries must all be numbers. Each matrix is 3×3.');
        return;
      }
      runSequence(S, R, T, () => evaluate(S, R, T));
    };

    const reset = () => {
      anim.stage = 'idle';
      currentTransform = Mat.identity(3);
      if (p5Instance) { p5Instance.noLoop(); p5Instance.redraw(); }
      setButtonsEnabled(true);
      Console.note('Transform reset to identity.');
    };

    const btnApply = UI.button('APPLY T·R·S', apply);
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

  function isValid3x3(M) {
    return M.length === 3 && M.every(row => row.length === 3) &&
           M.flat().every(v => Number.isFinite(v));
  }

  /* ---------- animation ---------- */

  // Build the 3-step sequence. Each step carries enough info to
  // produce the cumulative transform at parameter u in [0,1].
  function runSequence(S, R, T, onComplete) {
    setButtonsEnabled(false);

    // Step descriptors. `factor` is the matrix applied in this step;
    // `kind` tells the interpolator how to tween it.
    anim.order = [
      { label: 'APPLYING S', factor: S, kind: classify(S) },
      { label: 'APPLYING R', factor: R, kind: classify(R) },
      { label: 'APPLYING T', factor: T, kind: classify(T) },
    ];
    anim.stepIndex = 0;
    anim.base = Mat.identity(3);
    anim.stage = 's1';
    anim.t = 0;
    anim.elapsed = 0;
    anim.stageMs = STEP_MS;
    anim.onDone = onComplete;

    if (p5Instance) p5Instance.loop();
  }

  // Decide how a 3×3 homogeneous matrix should be interpolated.
  // Rotations must tween by angle; everything else tweens entrywise.
  function classify(M) {
    // A rotation has the form [c -s 0; s c 0; 0 0 1] with c²+s²≈1
    // and the translation column zero.
    const c = M[0][0], s = M[1][0];
    const looksRotation =
      Math.abs(M[0][1] + s) < 1e-6 &&
      Math.abs(M[1][1] - c) < 1e-6 &&
      Math.abs(c * c + s * s - 1) < 1e-3 &&
      Math.abs(M[0][2]) < 1e-9 && Math.abs(M[1][2]) < 1e-9 &&
      !(Math.abs(c - 1) < 1e-9 && Math.abs(s) < 1e-9); // exclude identity
    if (looksRotation) {
      return { type: 'rotation', angle: Math.atan2(s, c) };
    }
    return { type: 'entrywise' };
  }

  // The factor matrix partially applied at parameter u in [0,1]:
  // u=0 → identity, u=1 → full factor.
  function partialFactor(step, u) {
    if (step.kind.type === 'rotation') {
      const a = step.kind.angle * u;
      const c = Math.cos(a), s = Math.sin(a);
      return [
        [c, -s, 0],
        [s,  c, 0],
        [0,  0, 1],
      ];
    }
    // entrywise lerp from identity to factor
    return lerpMat(Mat.identity(3), step.factor, u);
  }

  function tickAnimation(dtMs) {
    anim.elapsed += dtMs;
    anim.t = Math.min(1, anim.elapsed / anim.stageMs);

    const isStep  = anim.stage === 's1' || anim.stage === 's2' || anim.stage === 's3';
    const isPause = anim.stage === 'p1' || anim.stage === 'p2';

    if (isStep) {
      const step = anim.order[anim.stepIndex];
      const e = easeInOutCubic(anim.t);
      currentTransform = Mat.mul(partialFactor(step, e), anim.base);

      if (anim.t >= 1) {
        // Lock in this step's full result as the new base.
        anim.base = Mat.mul(step.factor, anim.base);
        currentTransform = anim.base;

        if (anim.stage === 's1')      { anim.stage = 'p1'; anim.stageMs = PAUSE_MS; }
        else if (anim.stage === 's2') { anim.stage = 'p2'; anim.stageMs = PAUSE_MS; }
        else { // s3 finished
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
        anim.stepIndex += 1;
        anim.stage = anim.stage === 'p1' ? 's2' : 's3';
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

  function evaluate(S, R, T) {
    const sOk = Mat.equals(S, TARGET_S);
    const rOk = Mat.equals(R, TARGET_R);
    const tOk = Mat.equals(T, TARGET_T);
    const wrong = [];
    if (!sOk) wrong.push('scaling matrix S');
    if (!rOk) wrong.push('rotation matrix R');
    if (!tOk) wrong.push('translation matrix T');

    if (wrong.length === 0) {
      Console.success('All three matrices are correct. The composite T·R·S lands the wireframe on the goal.');
      Progress.markComplete(2);
      document.dispatchEvent(new CustomEvent('wfr:progress-changed'));
    } else if (wrong.length === 1) {
      Console.warning(`Two matrices are correct, but the ${wrong[0]} is not. Check that one.`);
    } else {
      Console.error(`You have not correctly input the ${joinList(wrong)}.`);
    }
  }

  function joinList(items) {
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return `${items[0]} or ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
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
    drawGrid(p);
    drawAxes(p);

    // Goal silhouette — dashed warning-yellow
    drawShape(p, Mat.mul(GOAL, D), {
      stroke: [255, 255, 51, 130], dashed: true, fill: null, dots: false,
    });

    // Ghost of the starting shape — faint, shows "before"
    if (anim.stage !== 'idle') {
      drawShape(p, D, {
        stroke: [0, 253, 0, 55], dashed: true, fill: null, dots: false,
      });
    }

    // Current (animated) render — solid primary green
    drawShape(p, Mat.mul(currentTransform, D), {
      stroke: [0, 253, 0, 240], dashed: false, fill: [0, 253, 0, 28], dots: true,
    });

    drawOrigin(p);
    drawCaption(p);
  }

  /* ---------- grid + axes ---------- */

  function drawGrid(p) {
    p.stroke(0, 253, 0, 26);
    p.strokeWeight(1);
    for (let x = ORIGIN_X % UNIT; x <= W; x += UNIT) p.line(x, 0, x, H);
    for (let y = ORIGIN_Y % UNIT; y <= H; y += UNIT) p.line(0, y, W, y);
  }

  function drawAxes(p) {
    p.stroke(0, 253, 0, 105);
    p.strokeWeight(1.5);
    p.line(0, ORIGIN_Y, W, ORIGIN_Y);
    p.line(ORIGIN_X, 0, ORIGIN_X, H);

    p.noStroke();
    p.fill(0, 253, 0, 150);
    p.textSize(12);
    p.textAlign(p.CENTER, p.TOP);
    const xMax = Math.floor((W - ORIGIN_X) / UNIT);
    const xMin = -Math.floor(ORIGIN_X / UNIT);
    for (let u = xMin; u <= xMax; u++) {
      if (u === 0) continue;
      p.text(String(u), ORIGIN_X + u * UNIT, ORIGIN_Y + 4);
    }
    p.textAlign(p.RIGHT, p.CENTER);
    const yMax = Math.floor(ORIGIN_Y / UNIT);
    const yMin = -Math.floor((H - ORIGIN_Y) / UNIT);
    for (let u = yMin; u <= yMax; u++) {
      if (u === 0) continue;
      p.text(String(u), ORIGIN_X - 5, ORIGIN_Y - u * UNIT);
    }
    p.textAlign(p.RIGHT, p.TOP);
    p.text('0', ORIGIN_X - 5, ORIGIN_Y + 4);
  }

  function drawOrigin(p) {
    p.noStroke();
    p.fill(255, 255, 51, 220);
    p.circle(ORIGIN_X, ORIGIN_Y, 5);
  }

  /* ---------- shape drawing ---------- */

  // points is a 3xN homogeneous matrix; row 2 is the (x,y,1) w-coord.
  function drawShape(p, points, style) {
    const n = points[0].length;
    const px = (i) => ORIGIN_X + points[0][i] * UNIT;
    const py = (i) => ORIGIN_Y - points[1][i] * UNIT;

    if (style.fill) {
      p.noStroke();
      p.fill(...style.fill);
      p.beginShape();
      for (let i = 0; i < n; i++) p.vertex(px(i), py(i));
      p.endShape(p.CLOSE);
    }

    p.stroke(...style.stroke);
    p.strokeWeight(style.dashed ? 1.5 : 2);
    p.noFill();

    if (style.dashed) {
      for (let i = 0; i < n; i++) {
        const a = i, b = (i + 1) % n;
        dashedLine(p, px(a), py(a), px(b), py(b), 6, 4);
      }
    } else {
      p.beginShape();
      for (let i = 0; i < n; i++) p.vertex(px(i), py(i));
      p.endShape(p.CLOSE);
    }

    if (style.dots) {
      p.noStroke();
      p.fill(style.stroke[0], style.stroke[1], style.stroke[2], 220);
      for (let i = 0; i < n; i++) p.circle(px(i), py(i), 5);
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

    const boxW = 200, boxH = 138;
    const boxX = W - boxW - 14, boxY = 14;

    p.fill(0, 0, 0, 205);
    p.stroke(0, 253, 0, 180);
    p.strokeWeight(2);
    p.rect(boxX, boxY, boxW, boxH, 6);
    p.noStroke();

    // Which matrix to show, and at what interpolation.
    let label, mat;
    const isStep  = anim.stage === 's1' || anim.stage === 's2' || anim.stage === 's3';
    const isPause = anim.stage === 'p1' || anim.stage === 'p2';

    if (isStep) {
      const step = anim.order[anim.stepIndex];
      label = step.label;
      mat = partialFactor(step, easeInOutCubic(anim.t));
    } else if (isPause) {
      const step = anim.order[anim.stepIndex];
      label = step.label;
      mat = step.factor;
    } else { // done
      label = 'RESULT T·R·S';
      mat = GOAL;
    }

    // label
    p.fill(255, 255, 51, 240);
    p.textSize(15);
    p.textAlign(p.LEFT, p.TOP);
    p.text(label, boxX + 12, boxY + 9);

    // 3×3 matrix in big numbers
    p.fill(0, 253, 0, 240);
    p.textSize(17);
    const colX = [boxX + 44, boxX + 96, boxX + 148];
    const rowY = [boxY + 34, boxY + 58, boxY + 82];
    // brackets
    p.textAlign(p.LEFT, p.TOP);
    for (const y of rowY) {
      p.text('[', boxX + 14, y);
      p.text(']', boxX + boxW - 22, y);
    }
    p.textAlign(p.CENTER, p.TOP);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        p.text(fmt(mat[r][c]), colX[c], rowY[r]);
      }
    }

    // progress bar across the 3 steps
    const segDone = isStep ? anim.stepIndex : (isPause ? anim.stepIndex + 1 : 3);
    const within  = isStep ? anim.t : 0;
    const progress = Math.min(1, (segDone + within) / 3);
    const barX = boxX + 12, barY = boxY + boxH - 16, barW = boxW - 24, barH = 5;
    p.noStroke();
    p.fill(0, 253, 0, 50);
    p.rect(barX, barY, barW, barH, 2);
    p.fill(0, 253, 0, 230);
    p.rect(barX, barY, barW * progress, barH, 2);
  }

  function fmt(v) {
    if (Math.abs(v) < 1e-9) return '0';
    const s = v.toFixed(2);
    return s.replace(/\.?0+$/, '') || '0';
  }

  /* ---------- lifecycle ---------- */

  function mount() {
    renderTutorial(document.getElementById('tutorial-content'));
    renderControls(document.getElementById('controls'));
    Console.clear();
    Console.info('Level 2 initialized. Build S, R, and T as 3×3 homogeneous matrices.');
    Console.note('Tip: transforms apply right-to-left — S first, then R, then T.');

    currentTransform = Mat.identity(3);
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
    p5Instance = new p5(makeSketch());
  }

  function unmount() {
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
  }

  return {
    id: 2,
    slug: 'level2',
    title: 'HOMOGENEOUS COORDS',
    mount,
    unmount,
  };
})();
