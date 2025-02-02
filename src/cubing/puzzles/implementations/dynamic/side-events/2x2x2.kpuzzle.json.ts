import type { KPuzzleDefinition } from "../../../../kpuzzle";

export const cube2x2x2JSON: KPuzzleDefinition = {
  name: "2x2x2",
  orbits: {
    CORNERS: { numPieces: 8, numOrientations: 3 },
  },
  startStateData: {
    CORNERS: {
      pieces: [0, 1, 2, 3, 4, 5, 6, 7],
      orientation: [0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
  moves: {
    U: {
      CORNERS: {
        permutation: [1, 2, 3, 0, 4, 5, 6, 7],
        orientation: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
    x: {
      CORNERS: {
        permutation: [4, 0, 3, 5, 7, 6, 2, 1],
        orientation: [2, 1, 2, 1, 1, 2, 1, 2],
      },
    },
    y: {
      CORNERS: {
        permutation: [1, 2, 3, 0, 7, 4, 5, 6],
        orientation: [0, 0, 0, 0, 0, 0, 0, 0],
      },
    },
  },
  experimentalDerivedMoves: {
    z: "[x: y]",
    L: "[z: U]",
    F: "[x: U]",
    R: "[z': U]",
    B: "[x': U]",
    D: "[x2: U]",
    Uv: "y",
    Lv: "x'",
    Fv: "z",
    Rv: "x",
    Bv: "z'",
    Dv: "y'",
  },
};
