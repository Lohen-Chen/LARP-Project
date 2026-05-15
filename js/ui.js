/* ============================================================
   ui.js — shared UI builders.
   - UI.matrixInput(...) builds a styled matrix input grid.
   - UI.button / UI.actionRow build action buttons.
   - Console.log writes "Command Processor: ..." lines into the
     output console with the right color tag.
   ============================================================ */

const UI = {

  /**
   * Build a matrix input widget.
   * @param {object} opts
   * @param {string} opts.label       – text shown above the matrix
   * @param {number} opts.rows
   * @param {number} opts.cols
   * @param {number[][]} [opts.initial]
   * @returns {{el: HTMLElement, read: () => number[][]}}
   */
  matrixInput({ label, rows, cols, initial = null }) {
    const wrap = document.createElement('div');
    wrap.className = 'matrix-input';

    const lbl = document.createElement('div');
    lbl.className = 'matrix-input-label';
    lbl.textContent = label;
    wrap.appendChild(lbl);

    const grid = document.createElement('div');
    grid.className = 'matrix-input-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;

    const inputs = [];
    for (let r = 0; r < rows; r++) {
      inputs.push([]);
      for (let c = 0; c < cols; c++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.spellcheck = false;
        input.autocomplete = 'off';
        const seed = initial ? initial[r][c] : '';
        input.value = seed === '' ? '' : String(seed);
        grid.appendChild(input);
        inputs[r].push(input);
      }
    }
    wrap.appendChild(grid);

    return {
      el: wrap,
      read() {
        const out = [];
        for (let r = 0; r < rows; r++) {
          out.push([]);
          for (let c = 0; c < cols; c++) {
            const raw = inputs[r][c].value.trim();
            const v = raw === '' ? NaN : Number(raw);
            out[r].push(v);
          }
        }
        return out;
      },
    };
  },

  button(text, onClick, variant = 'primary') {
    const btn = document.createElement('button');
    btn.className = variant === 'secondary' ? 'btn-action secondary' : 'btn-action';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  },

  actionRow(...buttons) {
    const row = document.createElement('div');
    row.className = 'action-row';
    buttons.forEach(b => row.appendChild(b));
    return row;
  },
};

/* ============================================================
   Console — Command Processor output formatter.
   Severity: info | warning | error | success
   ============================================================ */

const Console = (() => {
  const PREFIX = 'Command Processor:';

  function el() { return document.getElementById('console'); }

  function append(kind, text) {
    const host = el();
    if (!host) return;
    const line = document.createElement('div');
    line.className = `console-line ${kind}`;
    line.textContent = text;
    host.appendChild(line);
    host.scrollTop = host.scrollHeight;
  }

  return {
    /** Just log a plain info line without the prefix. */
    note(msg) { append('info', `> ${msg}`); },

    /** Status-prefixed message. Kind drives both color and the label. */
    info(msg)    { append('info',    `${PREFIX} Info. ${msg}`); },
    warning(msg) { append('warning', `${PREFIX} Warning. ${msg}`); },
    error(msg)   { append('error',   `${PREFIX} Error. ${msg}`); },
    success(msg) { append('success', `${PREFIX} Success! ${msg}`); },

    clear() {
      const host = el();
      if (host) host.innerHTML = '';
    },
  };
})();
