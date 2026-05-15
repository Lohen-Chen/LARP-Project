/* ============================================================
   level1.js — 2D Transformations & Composites
   ------------------------------------------------------------
   Pedagogical goals:
     - Show that matrix multiplication is non-commutative by
       *animating* the application order. A·S squishes then leans;
       S·A leans then squishes. Final shapes differ visibly.
     - Grid-aligned wireframe so every integer coordinate lands on
       a visible grid line. Axes are labeled with unit numbers.
     - Caption overlay narrates which matrix is currently being
       applied during the animation.

   Reference: Project Plan Level 1, lesson PDF (letter N).
   The PDF gives the N at vertices with y up to 16; here we
   halve those so the letter fits a ~6×8 bounding box, keeping
   the math identical and the visual proportions readable on a
   640×420 canvas.
   ============================================================ */

const Level1 = (() => {

  /* ---------- geometry & targets ---------- */

  // Letter "N" — 2x8, columns are vertices, drawn as closed polygon.
  // Y-coordinates halved from the PDF (which had y up to 16) so the
  // letter fits a tidy ~6x8 grid space.
  const D = [
    [0, 1, 1,    6, 6, 5.5, 5.5, 0  ],
    [0, 0, 6.42, 0, 4, 4,   1.58, 8 ],
  ];

  const TARGET_S = [[0.75, 0], [0, 1]];
  const TARGET_A = [[1, 0.25], [0, 1]];
  const GOAL     = Mat.mul(TARGET_A, TARGET_S);

  /* ---------- canvas + grid params ---------- */

  const W = 640, H = 420;
  const UNIT  = 32;                  // pixels per object-space unit
  const ORIGIN_X = 96;               // multiple of UNIT → snaps to grid
  const ORIGIN_Y = 352;              // multiple of UNIT → snaps to grid (H=420 → 352 leaves room below)

  /* ---------- module state ---------- */

  let p5Instance = null;
  let currentTransform = Mat.identity(2);

  // Animation state machine. Stages: 'idle' | 'step1' | 'pause' | 'step2' | 'done'
  // During step1 we tween from `fromA` to `toA`. During step2 we tween
  // from `fromB` to `toB` (which equals the final composite).
  const anim = {
    stage: 'idle',
    t: 0,                   // 0..1 progress within current stage
    stageMs: 0,             // duration of current stage
    elapsed: 0,             // ms into current stage
    fromA: Mat.identity(2),
    toA:   Mat.identity(2),
    fromB: Mat.identity(2),
    toB:   Mat.identity(2),
    label1: '',
    label2: '',
    order: '',              // 'AS' or 'SA' — for caption display
    onDone: null,           // callback after animation completes
  };

  const STEP_MS  = 650;
  const PAUSE_MS = 280;

  /* ---------- tutorial ---------- */

  function renderTutorial(container) {
    container.innerHTML = `
      <h3>// BRIEFING</h3>
      <p>The wireframe <span class="inline">D</span> is a <span class="inline">2&times;8</span> matrix &mdash; each column is a vertex of the letter <b>N</b>.</p>
      <p>To match the obstacle gate, the rendered shape must be <b>scaled</b> horizontally and <b>sheared</b> to lean right.</p>

      <h3>// CONCEPT</h3>
      <p>A <b>scaling matrix</b> stretches each axis:</p>
      <div class="matrix-block">S = [ sx 0 ; 0 sy ]</div>
      <p>A <b>horizontal shear</b> slides points sideways in proportion to y:</p>
      <div class="matrix-block">A = [ 1 k ; 0 1 ]</div>
      <p>Matrix multiplication is <b>not commutative</b> &mdash; the order matters. Watch what happens when you apply A&middot;S vs S&middot;A.</p>

      <h3>// OBJECTIVE</h3>
      <ul>
        <li>S: scale x by <b>0.75</b>, y by <b>1</b>.</li>
        <li>A: shear horizontally by <b>k = 0.25</b>.</li>
        <li>Apply A&middot;S to the wireframe.</li>
      </ul>

      <h3>// READING THE VIEWPORT</h3>
      <ul>
        <li>Solid green: your current render.</li>
        <li>Dashed yellow: the goal silhouette.</li>
        <li>Grid step = 1 unit. The origin is where the axes meet.</li>
      </ul>
    `;
  }

  /* ---------- controls ---------- */

  let applyButtons = [];

  function renderControls(container) {
    container.innerHTML = '';

    const sInput = UI.matrixInput({ label: 'SCALING (S)', rows: 2, cols: 2 });
    const aInput = UI.matrixInput({ label: 'SHEAR (A)',   rows: 2, cols: 2 });

    const group = document.createElement('div');
    group.className = 'matrix-input-group';
    group.appendChild(sInput.el);
    group.appendChild(aInput.el);
    container.appendChild(group);

    const apply = (order) => {
      if (anim.stage !== 'idle' && anim.stage !== 'done') return; // ignore mid-anim
      const S = sInput.read();
      const A = aInput.read();

      if (!isValid2x2(S) || !isValid2x2(A)) {
        Console.error('Matrix entries must all be numbers.');
        return;
      }

      // Run the sequenced animation, then evaluate.
      runSequence(order, S, A, () => evaluate(order, S, A));
    };

    const reset = () => {
      // Cancel anim, snap back to identity.
      anim.stage = 'idle';
      currentTransform = Mat.identity(2);
      if (p5Instance) {
        p5Instance.noLoop();
        p5Instance.redraw();
      }
      setButtonsEnabled(true);
      Console.note('Transform reset to identity.');
    };

    const btnAS = UI.button('APPLY A·S', () => apply('AS'));
    const btnSA = UI.button('APPLY S·A', () => apply('SA'), 'secondary');
    const btnRE = UI.button('RESET', reset, 'secondary');
    applyButtons = [btnAS, btnSA];
    container.appendChild(UI.actionRow(btnAS, btnSA, btnRE));
  }

  function setButtonsEnabled(on) {
    applyButtons.forEach(b => {
      b.disabled = !on;
      b.style.opacity = on ? '1' : '0.4';
      b.style.cursor = on ? 'pointer' : 'not-allowed';
    });
  }

  function isValid2x2(M) {
    return M.length === 2 && M[0].length === 2 && M[1].length === 2 &&
           M.flat().every(v => Number.isFinite(v));
  }

  /* ---------- animation control ---------- */

  function runSequence(order, S, A, onComplete) {
    setButtonsEnabled(false);
    const composite = order === 'AS' ? Mat.mul(A, S) : Mat.mul(S, A);

    if (order === 'AS') {
      // A·S applied to a vector means: scale first, then shear.
      anim.fromA = Mat.identity(2);
      anim.toA   = S;
      anim.fromB = S;
      anim.toB   = composite;
      anim.label1 = 'APPLYING S';
      anim.label2 = 'APPLYING A';
      // Caption shows the factor being applied in each step (not the composite).
      anim.captionA = S;
      anim.captionB = A;
    } else {
      // S·A: shear first, then scale.
      anim.fromA = Mat.identity(2);
      anim.toA   = A;
      anim.fromB = A;
      anim.toB   = composite;
      anim.label1 = 'APPLYING A';
      anim.label2 = 'APPLYING S';
      anim.captionA = A;
      anim.captionB = S;
    }
    anim.order = order;
    anim.stage = 'step1';
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

    if (anim.stage === 'step1') {
      currentTransform = lerpMat(anim.fromA, anim.toA, e);
      if (anim.t >= 1) {
        currentTransform = anim.toA;
        anim.stage = 'pause';
        anim.stageMs = PAUSE_MS;
        anim.elapsed = 0;
      }
    } else if (anim.stage === 'pause') {
      // hold position
      if (anim.t >= 1) {
        anim.stage = 'step2';
        anim.stageMs = STEP_MS;
        anim.elapsed = 0;
        anim.t = 0;
      }
    } else if (anim.stage === 'step2') {
      currentTransform = lerpMat(anim.fromB, anim.toB, e);
      if (anim.t >= 1) {
        currentTransform = anim.toB;
        anim.stage = 'done';
        if (p5Instance) p5Instance.noLoop();
        setButtonsEnabled(true);
        if (anim.onDone) anim.onDone();
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

  /* ---------- evaluation (console output) ---------- */

  function evaluate(order, S, A) {
    const sCorrect = Mat.equals(S, TARGET_S);
    const aCorrect = Mat.equals(A, TARGET_A);

    if (sCorrect && aCorrect) {
      if (order === 'AS') {
        Console.success('You have correctly input both matrices, and the composite A·S matches the goal.');
        Progress.markComplete(1);
        document.dispatchEvent(new CustomEvent('wfr:progress-changed'));
      } else {
        Console.warning('Both matrices are correct, but you applied S·A. The goal uses A·S — order matters.');
      }
    } else if (!sCorrect && !aCorrect) {
      Console.error('You have not correctly input the correct shear or scaling matrix.');
    } else if (sCorrect && !aCorrect) {
      Console.warning('You have put in the correct scaling matrix, but not the correct shear matrix.');
    } else {
      Console.warning('You have put in the correct shear matrix, but not the correct scaling matrix.');
    }
  }

  /* ---------- p5 sketch ---------- */

  function makeSketch() {
    return (p) => {
      let lastFrameMs = 0;

      p.setup = () => {
        const c = p.createCanvas(W, H);
        c.parent('p5-host');
        p.noLoop();
        p.textFont('VT323');
        lastFrameMs = p.millis();
      };

      p.draw = () => {
        const now = p.millis();
        const dt = now - lastFrameMs;
        lastFrameMs = now;

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
    drawWireframe(p, Mat.apply2D(GOAL, D), {
      stroke: [255, 255, 51, 130], dashed: true, fill: null, dots: false,
    });

    // Trail / ghost: during step1, the faint outline is the identity N
    // (so the player sees "where it started"). During step2/pause/done,
    // the ghost is the post-step1 shape — i.e., what we're applying the
    // second matrix on top of. This makes composite buildup visible.
    if (anim.stage !== 'idle') {
      const ghostMat =
        anim.stage === 'step1' ? Mat.identity(2) : anim.toA;
      drawWireframe(p, Mat.apply2D(ghostMat, D), {
        stroke: [0, 253, 0, 60], dashed: true, fill: null, dots: false,
      });
    }

    // Current (animated) render — solid primary green
    drawWireframe(p, Mat.apply2D(currentTransform, D), {
      stroke: [0, 253, 0, 240], dashed: false,
      fill: [0, 253, 0, 28], dots: true,
    });

    drawOrigin(p);
    drawCaption(p);
  }

  /* ---------- grid + axes ---------- */

  function drawGrid(p) {
    // minor grid
    p.stroke(0, 253, 0, 28);
    p.strokeWeight(1);
    for (let x = ORIGIN_X % UNIT; x <= W; x += UNIT) p.line(x, 0, x, H);
    for (let y = ORIGIN_Y % UNIT; y <= H; y += UNIT) p.line(0, y, W, y);
  }

  function drawAxes(p) {
    // brighter axis lines
    p.stroke(0, 253, 0, 110);
    p.strokeWeight(1.5);
    p.line(0, ORIGIN_Y, W, ORIGIN_Y);   // x-axis
    p.line(ORIGIN_X, 0, ORIGIN_X, H);   // y-axis

    // axis labels
    p.noStroke();
    p.fill(0, 253, 0, 160);
    p.textSize(13);
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
    // origin "0"
    p.textAlign(p.RIGHT, p.TOP);
    p.text('0', ORIGIN_X - 5, ORIGIN_Y + 4);
  }

  function drawOrigin(p) {
    p.noStroke();
    p.fill(255, 255, 51, 220);
    p.circle(ORIGIN_X, ORIGIN_Y, 5);
  }

  /* ---------- wireframe drawing ---------- */

  function drawWireframe(p, points, style) {
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

    const boxX = W - 200, boxY = 14;
    const boxW = 186, boxH = 110;

    // background panel
    p.fill(0, 0, 0, 200);
    p.stroke(0, 253, 0, 180);
    p.strokeWeight(2);
    p.rect(boxX, boxY, boxW, boxH, 6);

    p.noStroke();
    p.textAlign(p.LEFT, p.TOP);

    // What to show: lerp from identity to the factor being applied,
    // so the matrix entries visually morph into shape during the tween.
    let label, currentMat;
    const I = Mat.identity(2);
    if (anim.stage === 'step1') {
      label = anim.label1;
      currentMat = lerpMat(I, anim.captionA, easeInOutCubic(anim.t));
    } else if (anim.stage === 'pause') {
      // First half of pause: still showing step1's result. Second half: preview step2.
      if (anim.elapsed < PAUSE_MS / 2) {
        label = anim.label1;
        currentMat = anim.captionA;
      } else {
        label = anim.label2;
        currentMat = I;
      }
    } else if (anim.stage === 'step2') {
      label = anim.label2;
      currentMat = lerpMat(I, anim.captionB, easeInOutCubic(anim.t));
    } else { // done
      label = `RESULT ${anim.order === 'AS' ? 'A·S' : 'S·A'}`;
      currentMat = anim.toB;
    }

    p.fill(255, 255, 51, 240);
    p.textSize(15);
    p.text(label, boxX + 12, boxY + 10);

    // matrix block in big numbers
    p.fill(0, 253, 0, 240);
    p.textSize(20);
    p.text('[', boxX + 12, boxY + 36);
    p.text(']', boxX + boxW - 22, boxY + 36);
    p.text('[', boxX + 12, boxY + 60);
    p.text(']', boxX + boxW - 22, boxY + 60);

    p.textAlign(p.CENTER, p.TOP);
    p.text(fmt(currentMat[0][0]), boxX + 60,  boxY + 36);
    p.text(fmt(currentMat[0][1]), boxX + 120, boxY + 36);
    p.text(fmt(currentMat[1][0]), boxX + 60,  boxY + 60);
    p.text(fmt(currentMat[1][1]), boxX + 120, boxY + 60);

    // progress dots / bar
    p.noStroke();
    const barX = boxX + 12, barY = boxY + 92, barW = boxW - 24, barH = 4;
    p.fill(0, 253, 0, 50);
    p.rect(barX, barY, barW, barH, 2);
    let progress;
    if (anim.stage === 'step1')      progress = 0.5 * anim.t;
    else if (anim.stage === 'pause') progress = 0.5;
    else if (anim.stage === 'step2') progress = 0.5 + 0.5 * anim.t;
    else                              progress = 1;
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
    Console.info('Level 1 initialized. Construct S and A, then apply a composite.');
    Console.note('Tip: try A·S first, then RESET and try S·A. Watch the order.');

    currentTransform = Mat.identity(2);
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
    p5Instance = new p5(makeSketch());
  }

  function unmount() {
    anim.stage = 'idle';
    if (p5Instance) { p5Instance.remove(); p5Instance = null; }
  }

  return {
    id: 1,
    slug: 'level1',
    title: '2D TRANSFORMATIONS',
    mount,
    unmount,
  };
})();
