#!/usr/bin/env node
/**
 * Data-visualisation palette validator.
 *
 * Two questions, both of which a chart palette has to answer "yes" to:
 *
 *   1. Is every slot visible against the surface it is drawn on?
 *      (WCAG non-text contrast, >= 3:1 for a graphical object.)
 *   2. Can the slots still be told apart by someone with a colour-vision
 *      deficiency? Each pair is simulated for protanopia, deuteranopia and
 *      tritanopia and compared with CIEDE2000.
 *
 * Usage:
 *   node scripts/validate_palette.js "#2f5d50,#b8643c,..." --surface "#ffffff"
 *   node scripts/validate_palette.js --mode dark --surface "#1e1a17" "<slots>"
 *
 * Options:
 *   --surface <hex>   background the marks sit on (default #ffffff)
 *   --mode <name>     label only, printed in the report
 *   --min-de <n>      minimum CIEDE2000 between any two slots (default 18)
 *   --min-contrast <n> minimum contrast vs the surface (default 3)
 */

"use strict";

// ---------------------------------------------------------------- colour maths

function parseHex(hex) {
  const clean = String(hex).trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a colour: "${hex}"`);
  }
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb) =>
  "#" +
  rgb
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("");

const srgbToLinear = (c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (c) => {
  const x = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, x)) * 255;
};

function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ------------------------------------------------------- CIELAB + CIEDE2000

function rgbToLab(hex) {
  const [lr, lg, lb] = parseHex(hex).map(srgbToLinear);
  // linear sRGB -> XYZ (D65)
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;
  // normalise to D65 white
  const xr = x / 0.95047;
  const yr = y / 1.0;
  const zr = z / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference. */
function deltaE2000(labA, labB) {
  const [L1, a1, b1] = labA;
  const [L2, a2, b2] = labB;
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const deg = (rad) => (rad * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;
  const hp = (ap, bp) => {
    if (ap === 0 && bp === 0) return 0;
    const h = deg(Math.atan2(bp, ap));
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    (dLp / (kL * Sl)) ** 2 +
      (dCp / (kC * Sc)) ** 2 +
      (dHp / (kH * Sh)) ** 2 +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

// ------------------------------------------------ colour-vision deficiency sim

/**
 * Machado, Oliveira & Fernandes (2009) severity-1.0 matrices, applied in
 * linear RGB.
 */
const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(hex, kind) {
  const m = CVD_MATRICES[kind];
  const [r, g, b] = parseHex(hex).map(srgbToLinear);
  const out = m.map((row) => row[0] * r + row[1] * g + row[2] * b);
  return toHex(out.map(linearToSrgb));
}

// ------------------------------------------------------------------- the check

function parseArgs(argv) {
  const opts = {
    surface: "#ffffff",
    mode: "light",
    minDe: 18,
    minContrast: 3,
    slots: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--surface") opts.surface = argv[++i];
    else if (a === "--mode") opts.mode = argv[++i];
    else if (a === "--min-de") opts.minDe = Number(argv[++i]);
    else if (a === "--min-contrast") opts.minContrast = Number(argv[++i]);
    else if (a.startsWith("--")) throw new Error(`Unknown option ${a}`);
    else opts.slots.push(...a.split(/[,\s]+/).filter(Boolean));
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.slots.length < 2) {
    console.error(
      'Usage: node scripts/validate_palette.js "#aabbcc,#ddeeff" --surface "#ffffff" [--mode dark]',
    );
    process.exit(2);
  }

  const slots = opts.slots.map((s) => (s.startsWith("#") ? s : `#${s}`));
  let failures = 0;

  console.log(
    `\nPalette check — mode ${opts.mode}, surface ${opts.surface}, ` +
      `${slots.length} slots (min ΔE2000 ${opts.minDe}, min contrast ${opts.minContrast}:1)\n`,
  );

  console.log("Contrast against the surface");
  for (const slot of slots) {
    const c = contrast(slot, opts.surface);
    const ok = c >= opts.minContrast;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "pass" : "FAIL"}  ${c.toFixed(2).padStart(5)}:1  ${slot}`,
    );
  }

  const views = ["normal", ...Object.keys(CVD_MATRICES)];
  for (const view of views) {
    console.log(`\nPairwise separation — ${view}`);
    let worst = { de: Infinity, pair: null };
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = view === "normal" ? slots[i] : simulate(slots[i], view);
        const b = view === "normal" ? slots[j] : simulate(slots[j], view);
        const de = deltaE2000(rgbToLab(a), rgbToLab(b));
        if (de < worst.de) worst = { de, pair: [slots[i], slots[j]] };
        if (de < opts.minDe) {
          failures++;
          console.log(
            `  FAIL  ΔE ${de.toFixed(1).padStart(5)}  ${slots[i]} vs ${slots[j]}` +
              (view === "normal" ? "" : `  (seen as ${a} vs ${b})`),
          );
        }
      }
    }
    console.log(
      `  worst pair ΔE ${worst.de.toFixed(1)}  ${worst.pair[0]} vs ${worst.pair[1]}`,
    );
  }

  console.log(
    `\n${failures === 0 ? "OK" : failures + " problem(s)"} — ${slots.length} slots checked\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
