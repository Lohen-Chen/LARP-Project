/* ============================================================
   matrix.js — minimal matrix utilities shared across levels.
   Matrices are 2D arrays: M[row][col]. Vectors are 1D arrays.
   ============================================================ */

const Mat = {

  /** Multiply matrix A (m×n) by matrix B (n×p). Returns m×p. */
  mul(A, B) {
    const m = A.length;
    const n = A[0].length;
    const p = B[0].length;
    if (B.length !== n) {
      throw new Error(`mul: dim mismatch (${m}x${n}) * (${B.length}x${p})`);
    }
    const out = Array.from({ length: m }, () => new Array(p).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < p; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += A[i][k] * B[k][j];
        out[i][j] = s;
      }
    }
    return out;
  },

  /** Element-wise approximate equality between two matrices. */
  equals(A, B, eps = 1e-3) {
    if (A.length !== B.length) return false;
    for (let i = 0; i < A.length; i++) {
      if (A[i].length !== B[i].length) return false;
      for (let j = 0; j < A[i].length; j++) {
        if (Math.abs(A[i][j] - B[i][j]) > eps) return false;
      }
    }
    return true;
  },

  /** Identity matrix of size n. */
  identity(n) {
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) M[i][i] = 1;
    return M;
  },

  /** Pretty-print a matrix (for debugging). */
  toString(M, prec = 2) {
    return M.map(row => row.map(v => v.toFixed(prec).padStart(7)).join(' ')).join('\n');
  },

  /** Apply a 2x2 transform to a 2xN point-set matrix (cols = points). */
  apply2D(T, points) {
    return Mat.mul(T, points);
  },

  /** Convert a 2xN point-set to homogeneous 3xN by appending a row of 1s. */
  toHomogeneous2D(points) {
    const n = points[0].length;
    return [points[0].slice(), points[1].slice(), new Array(n).fill(1)];
  },

  /** Drop the homogeneous coordinate row, returning a 2xN matrix. */
  fromHomogeneous2D(points) {
    return [points[0].slice(), points[1].slice()];
  },
};
