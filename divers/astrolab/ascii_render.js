// ASCII chart rendering for the terminal UI.
// Returns flat arrays of lines, ready to feed into TERM print/appendLines.

(function (global) {
  "use strict";

  const E = HelleEngine;

  const WIDTH = 78;

  function pad(s, n)   { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
  function lpad(s, n)  { s = String(s); return s.length >= n ? s : " ".repeat(n - s.length) + s; }
  function rule(ch)    { return (ch || "─").repeat(WIDTH); }
  function center(s)   { const pad = Math.max(0, Math.floor((WIDTH - s.length) / 2)); return " ".repeat(pad) + s; }

  function fmtTzOffset(h) {
    const sign = h >= 0 ? "+" : "-";
    const abs = Math.abs(h);
    const wholeH = Math.floor(abs);
    const min = Math.round((abs - wholeH) * 60);
    return sign + String(wholeH).padStart(2, "0") + ":" + String(min).padStart(2, "0");
  }

  function header(meta) {
    const lines = [];
    lines.push(rule("═"));
    lines.push(center("NATAL CHART"));
    lines.push(rule("═"));
    if (meta.dateStr || meta.timeStr) {
      const t = meta.timeUnknown ? "time unknown (noon used)" : meta.timeStr;
      lines.push(`  Birth: ${meta.dateStr || "?"}  ${t || ""}  (UTC${fmtTzOffset(meta.tzOffsetHours)})`);
    }
    if (meta.placeName) lines.push(`  Place: ${meta.placeName}`);
    if (meta.latitude != null && meta.longitude != null) {
      lines.push(`         ${meta.latitude.toFixed(4)}°, ${meta.longitude.toFixed(4)}°`);
    }
    if (meta.timeUnknown) {
      lines.push("");
      lines.push("  ! Time of birth is unknown. The Ascendant, houses, and Lots are");
      lines.push("    therefore unreliable; only the planet–sign placements are meaningful.");
    }
    return lines;
  }

  function angles(chart) {
    return [
      "",
      "ANGLES",
      `  ASC  ${pad(E.formatDegreeInSign(chart.ascendant.longitude), 8)}  ${chart.ascendant.sign} ${E.SIGN_GLYPHS[chart.ascendant.sign]}`,
      `  MC   ${pad(E.formatDegreeInSign(chart.mc.longitude), 8)}  ${chart.mc.sign} ${E.SIGN_GLYPHS[chart.mc.sign]}`,
    ];
  }

  function sectLine(chart) {
    return [
      "",
      `SECT  ${chart.sect}`,
    ];
  }

  function placements(chart) {
    const lines = [];
    lines.push("");
    lines.push("PLACEMENTS");
    lines.push("    body         longitude    sign            house  dignity");
    lines.push("    " + "-".repeat(58));
    for (const p of E.PLANETS) {
      const pl = chart.planets[p];
      const retro = pl.retrograde ? " ℞" : "  ";
      lines.push(
        "  " + E.PLANET_GLYPHS[p] + " " +
        pad(E.PLANET_NAMES[p] + retro, 12) + " " +
        pad(E.formatDegreeInSign(pl.longitude), 11) + "  " +
        pad(pl.sign + " " + E.SIGN_GLYPHS[pl.sign], 14) + "  " +
        lpad(pl.house, 3) + "    " +
        (pl.dignity === "peregrine" ? "—" : pl.dignity)
      );
    }
    return lines;
  }

  function lots(chart) {
    return [
      "",
      "LOTS",
      `  ⊗︎ Fortune  ${pad(E.formatDegreeInSign(chart.lots.fortune.longitude), 8)}  ${pad(chart.lots.fortune.sign + " " + E.SIGN_GLYPHS[chart.lots.fortune.sign], 14)}  House ${chart.lots.fortune.house}`,
      `  ⊕︎ Spirit   ${pad(E.formatDegreeInSign(chart.lots.spirit.longitude), 8)}  ${pad(chart.lots.spirit.sign + " " + E.SIGN_GLYPHS[chart.lots.spirit.sign], 14)}  House ${chart.lots.spirit.house}`,
    ];
  }

  function aspects(chart) {
    if (!chart.aspects.length) return [];
    const lines = ["", "ASPECTS"];
    for (const a of chart.aspects) {
      lines.push(
        "  " + E.PLANET_GLYPHS[a.planet_a] + " " +
        pad(E.PLANET_NAMES[a.planet_a], 8) + "  " +
        pad(a.type, 11) + " " +
        E.PLANET_GLYPHS[a.planet_b] + " " + E.PLANET_NAMES[a.planet_b]
      );
    }
    return lines;
  }

  function profection(chart) {
    if (!chart.profection) return [];
    const pr = chart.profection;
    return [
      "",
      "PROFECTION",
      `  Age ${pr.age}: House ${pr.house} (${pr.sign} ${E.SIGN_GLYPHS[pr.sign]}). ` +
      `Lord of the Year: ${E.PLANET_NAMES[pr.lord_of_year]} ${E.PLANET_GLYPHS[pr.lord_of_year]}.`,
    ];
  }

  function renderChart(chart, meta) {
    return [
      ...header(meta),
      ...sectLine(chart),
      ...angles(chart),
      ...placements(chart),
      ...aspects(chart),
      ...lots(chart),
      ...profection(chart),
    ];
  }

  global.HelleAscii = { renderChart, WIDTH };

})(typeof window !== "undefined" ? window : globalThis);
