// Hellenistic interpretive prose layer.
//
// `interpret(chart, rules)` produces structured prose objects.
// `formatInterpretation(interp, width)` flattens that into wrapped plain-text
// lines suitable for printing into the terminal output.

(function (global) {
  "use strict";

  const E = HelleEngine;

  async function loadRules(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Could not load interpretive rules: " + r.status);
    return await r.json();
  }

  function findSpecific(rules, planet, sign) {
    const list = rules.planet_in_sign_special || [];
    for (const r of list) if (r.planet === planet && r.sign === sign) return r.text;
    return null;
  }

  function findHouseRule(rules, planet, house) {
    const list = rules.planet_in_house || [];
    for (const r of list) if (r.planet === planet && r.house === house) return r.text;
    return null;
  }

  function findFortuneRule(rules, house) {
    const list = rules.fortune_in_house || [];
    for (const r of list) if (r.house === house) return r.text;
    return null;
  }

  function findLordOfYear(rules, planet) {
    const list = rules.lord_of_year || [];
    for (const r of list) if (r.lord === planet) return r.text;
    return null;
  }

  function sentence(s) {
    if (!s) return "";
    const trimmed = s.trim().replace(/\s+/g, " ");
    const first = trimmed[0].toUpperCase() + trimmed.slice(1);
    return first.endsWith(".") ? first : first + ".";
  }

  function dignityPhrase(planet, sign, dignity) {
    if (dignity === "domicile")   return `${E.PLANET_NAMES[planet]} stands here in his own house and so bears his full dignity`;
    if (dignity === "exaltation") return `${E.PLANET_NAMES[planet]} is exalted in this sign, dignified by honour though not by possession`;
    if (dignity === "detriment")  return `${E.PLANET_NAMES[planet]} lies in his detriment here, ill at ease and turned against his nature`;
    if (dignity === "fall")       return `${E.PLANET_NAMES[planet]} is in his fall in this sign, weakened and liable to be misjudged`;
    return null;
  }

  function sectPhrase(planet, sectStatus) {
    if (sectStatus === "of sect")          return `${E.PLANET_NAMES[planet]} is of the sect in favour, and thus more apt to act kindly`;
    if (sectStatus === "contrary to sect") return `${E.PLANET_NAMES[planet]} is contrary to the sect, and thus more apt to act harshly`;
    return null;
  }

  function bonifyPhrase(planet, chart) {
    const p = chart.planets[planet];
    const bits = [];
    if (p.bonified)   bits.push("bonified by benefic contact");
    if (p.maltreated) bits.push("maltreated by malefic contact");
    if (bits.length === 0) return null;
    return `${E.PLANET_NAMES[planet]} is ${bits.join(" and ")}`;
  }

  function ordinal(n) {
    const suffixes = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  }

  function buildPlanetParagraph(planet, chart, rules) {
    const p = chart.planets[planet];
    const signNature   = rules.sign_natures[p.sign];
    const planetNature = rules.planet_natures[planet];
    const houseGreek   = E.HOUSE_GREEK_NAMES[p.house];
    const houseTopics  = E.HOUSE_TOPICS[p.house];

    const opening = `${E.PLANET_NAMES[planet]} — ${planetNature} — is placed in ${p.sign} ` +
                    `(${signNature}), at ${E.formatDegreeInSign(p.longitude)}, ` +
                    `falling in the ${ordinal(p.house)} Place, called the ${houseGreek}, ` +
                    `which concerns ${houseTopics}`;

    const pieces = [sentence(opening)];

    const specific = findSpecific(rules, planet, p.sign);
    if (specific) pieces.push(specific);

    const houseRule = findHouseRule(rules, planet, p.house);
    if (houseRule) pieces.push(houseRule);

    const dig = dignityPhrase(planet, p.sign, p.dignity);
    if (dig) pieces.push(sentence(dig));

    const sec = sectPhrase(planet, p.sect_status);
    if (sec) pieces.push(sentence(sec));

    const bon = bonifyPhrase(planet, chart);
    if (bon) pieces.push(sentence(bon));

    if (p.retrograde) {
      pieces.push(sentence(`${E.PLANET_NAMES[planet]} is retrograde — his effects turn inward and his business is revisited more than once`));
    }

    return pieces.join(" ");
  }

  function buildLotParagraphs(chart, rules) {
    const out = [];
    const f = chart.lots.fortune;
    const s = chart.lots.spirit;

    let fText = `The Lot of Fortune, computed from the distance of Moon to Sun ` +
                `${chart.sect === "diurnal" ? "by day" : "by night"}, falls at ` +
                `${E.formatDegreeInSign(f.longitude)} ${f.sign}, in the ${ordinal(f.house)} Place ` +
                `(${E.HOUSE_GREEK_NAMES[f.house]}).`;
    const fSpecific = findFortuneRule(rules, f.house);
    if (fSpecific) fText += " " + fSpecific;
    out.push(fText);

    const sText = `The Lot of Spirit, its mirror about the Ascendant, falls at ` +
                  `${E.formatDegreeInSign(s.longitude)} ${s.sign}, in the ${ordinal(s.house)} Place ` +
                  `(${E.HOUSE_GREEK_NAMES[s.house]}). Where Fortune shows what happens to the body, ` +
                  `Spirit shows where the soul's deliberate action bears fruit.`;
    out.push(sText);

    return out;
  }

  function buildSectParagraph(chart) {
    if (chart.sect === "diurnal") {
      return "This is a diurnal chart: the Sun stands above the horizon at the moment of birth. " +
             "The diurnal sect — Sun, Jupiter, Saturn — is therefore the sect in favour. " +
             "When those planets act, they are said to act more in accord with their kindly natures; " +
             "when the nocturnal planets act, they are more apt to strain against the current of the day.";
    }
    return "This is a nocturnal chart: the Sun stands beneath the horizon at the moment of birth. " +
           "The nocturnal sect — Moon, Venus, Mars — is therefore the sect in favour. " +
           "When those planets act, they are said to act more in accord with their kindly natures; " +
           "when the diurnal planets act, they are more apt to strain against the current of the night.";
  }

  function buildProfectionParagraph(chart, rules) {
    if (!chart.profection) return null;
    const pr = chart.profection;
    const lordRule = findLordOfYear(rules, pr.lord_of_year);
    let text = `In the native's ${ordinal(pr.age)} year of life, the profection advances to the ` +
               `${ordinal(pr.house)} Place, ${pr.sign} (${E.HOUSE_GREEK_NAMES[pr.house]}). ` +
               `Its domicile-lord, ${E.PLANET_NAMES[pr.lord_of_year]}, becomes Lord of the Year.`;
    if (lordRule) text += " " + lordRule;

    const lord = chart.planets[pr.lord_of_year];
    text += ` In the nativity, ${E.PLANET_NAMES[pr.lord_of_year]} was placed in ${lord.sign}, ` +
            `in the ${ordinal(lord.house)} Place; the themes of that Place — ` +
            `${E.HOUSE_TOPICS[lord.house]} — are therefore brought forward this year.`;
    return text;
  }

  function interpret(chart, rules) {
    const out = { planets: [], lots: [], sect: "", profection: "" };
    for (const p of E.PLANETS) out.planets.push({
      planet: p,
      heading: `${E.PLANET_GLYPHS[p]} ${E.PLANET_NAMES[p]} in ${chart.planets[p].sign}, ${ordinal(chart.planets[p].house)} Place`,
      text: buildPlanetParagraph(p, chart, rules)
    });
    out.lots       = buildLotParagraphs(chart, rules);
    out.sect       = buildSectParagraph(chart);
    out.profection = buildProfectionParagraph(chart, rules);
    return out;
  }

  // Word-wrap a paragraph to `width` columns. Long words that exceed the
  // width are emitted on their own line rather than truncated.
  function wrap(text, width) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      if (!line.length) { line = w; continue; }
      if (line.length + 1 + w.length <= width) line += " " + w;
      else { lines.push(line); line = w; }
    }
    if (line.length) lines.push(line);
    return lines;
  }

  // Render the interpretation as a flat array of terminal lines.
  function formatInterpretation(interp, width) {
    width = width || 78;
    const lines = [];

    lines.push("");
    lines.push("─".repeat(width));
    lines.push("INTERPRETATION");
    lines.push("─".repeat(width));
    lines.push("");
    lines.push(...wrap("What follows is drawn from the method of Vettius Valens, " +
                       "Dorotheus, and Firmicus Maternus: the planet's nature is joined " +
                       "to the nature of its sign and to the topic of its Place.", width));
    lines.push("");

    lines.push("[ On the Sect of the Chart ]");
    lines.push(...wrap(interp.sect, width));
    lines.push("");

    for (const p of interp.planets) {
      lines.push("[ " + p.heading + " ]");
      lines.push(...wrap(p.text, width));
      lines.push("");
    }

    lines.push("[ The Lots of Fortune and Spirit ]");
    for (const para of interp.lots) {
      lines.push(...wrap(para, width));
      lines.push("");
    }

    if (interp.profection) {
      lines.push("[ Annual Profection ]");
      lines.push(...wrap(interp.profection, width));
      lines.push("");
    }

    return lines;
  }

  global.HelleInterpreter = { loadRules, interpret, formatInterpretation };

})(typeof window !== "undefined" ? window : globalThis);
