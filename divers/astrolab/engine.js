// Hellenistic astrological logic — pure tables and arithmetic on longitudes.
// No dependencies on astronomy-engine; given longitudes in [0,360), this layer
// produces signs, houses, dignities, sect, lots, aspects, profections.

(function (global) {
  "use strict";

  const SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];

  // U+FE0E (text variation selector) forces monochrome / text-style rendering
  // for dual-presentation codepoints; without it many platforms fall back to
  // their colour emoji font for these symbols.
  const VS = "︎";

  const SIGN_GLYPHS = {
    Aries: "♈"+VS, Taurus: "♉"+VS, Gemini: "♊"+VS, Cancer: "♋"+VS,
    Leo: "♌"+VS, Virgo: "♍"+VS, Libra: "♎"+VS, Scorpio: "♏"+VS,
    Sagittarius: "♐"+VS, Capricorn: "♑"+VS, Aquarius: "♒"+VS, Pisces: "♓"+VS
  };

  const PLANET_GLYPHS = {
    sun: "☉"+VS, moon: "☽"+VS, mercury: "☿"+VS, venus: "♀"+VS,
    mars: "♂"+VS, jupiter: "♃"+VS, saturn: "♄"+VS
  };

  const PLANETS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"];

  const PLANET_NAMES = {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturn"
  };

  // Domicile rulerships (traditional, two domiciles per planet except luminaries).
  const DOMICILE_RULERS = {
    Aries: "mars", Taurus: "venus", Gemini: "mercury", Cancer: "moon",
    Leo: "sun", Virgo: "mercury", Libra: "venus", Scorpio: "mars",
    Sagittarius: "jupiter", Capricorn: "saturn", Aquarius: "saturn", Pisces: "jupiter"
  };

  const PLANET_DOMICILES = {
    sun: ["Leo"],
    moon: ["Cancer"],
    mercury: ["Gemini", "Virgo"],
    venus: ["Taurus", "Libra"],
    mars: ["Aries", "Scorpio"],
    jupiter: ["Sagittarius", "Pisces"],
    saturn: ["Capricorn", "Aquarius"]
  };

  const PLANET_EXALTATIONS = {
    sun: "Aries", moon: "Taurus", mercury: "Virgo", venus: "Pisces",
    mars: "Capricorn", jupiter: "Cancer", saturn: "Libra"
  };

  const OPPOSITE_SIGN = {
    Aries: "Libra", Taurus: "Scorpio", Gemini: "Sagittarius",
    Cancer: "Capricorn", Leo: "Aquarius", Virgo: "Pisces",
    Libra: "Aries", Scorpio: "Taurus", Sagittarius: "Gemini",
    Capricorn: "Cancer", Aquarius: "Leo", Pisces: "Virgo"
  };

  const PLANET_SECT = {
    sun: "diurnal", jupiter: "diurnal", saturn: "diurnal",
    moon: "nocturnal", venus: "nocturnal", mars: "nocturnal",
    mercury: "neutral"
  };

  const BENEFICS = new Set(["venus", "jupiter"]);
  const MALEFICS = new Set(["mars", "saturn"]);

  const HOUSE_GREEK_NAMES = {
    1: "Horoskopos", 2: "Gate of Hades", 3: "Goddess", 4: "Subterranean",
    5: "Good Fortune", 6: "Bad Fortune", 7: "Setting", 8: "Idle Place",
    9: "God", 10: "Midheaven", 11: "Good Daimon", 12: "Bad Daimon"
  };

  const HOUSE_TOPICS = {
    1: "life, body, appearance, self",
    2: "livelihood, resources, money",
    3: "siblings, short travel, messages",
    4: "parents, home, land, endings",
    5: "children, pleasure, creativity",
    6: "illness, servants, minor enemies",
    7: "marriage, partners, open enemies",
    8: "death, legacies, fear",
    9: "long travel, philosophy, divinity",
    10: "career, reputation, authority",
    11: "friends, benefactors, hopes",
    12: "hidden enemies, exile, grief"
  };

  const ASPECT_INTERVALS = { 0: "conjunction", 2: "sextile", 3: "square", 4: "trine", 6: "opposition" };

  function signOfLongitude(longitude) {
    const idx = Math.floor(mod360(longitude) / 30);
    return SIGNS[idx];
  }

  function signIndex(sign) { return SIGNS.indexOf(sign); }

  function signDegree(longitude) {
    return mod360(longitude) - Math.floor(mod360(longitude) / 30) * 30;
  }

  function mod360(x) {
    const v = x % 360;
    return v < 0 ? v + 360 : v;
  }

  function formatDegreeInSign(longitude) {
    const deg = signDegree(longitude);
    const whole = Math.floor(deg);
    const minutes = Math.round((deg - whole) * 60);
    if (minutes === 60) return `${whole + 1}°00'`;
    return `${whole}°${String(minutes).padStart(2, "0")}'`;
  }

  function wholeSignHouses(ascendantLongitude) {
    const ascSignIdx = Math.floor(mod360(ascendantLongitude) / 30);
    const houses = {};
    for (let h = 1; h <= 12; h++) {
      houses[h] = SIGNS[(ascSignIdx + h - 1) % 12];
    }
    return houses;
  }

  function houseOfPlanet(planetLongitude, ascendantLongitude) {
    const ascSignIdx = Math.floor(mod360(ascendantLongitude) / 30);
    const planetSignIdx = Math.floor(mod360(planetLongitude) / 30);
    return ((planetSignIdx - ascSignIdx) % 12 + 12) % 12 + 1;
  }

  // Essential dignity (domicile/exaltation/detriment/fall/peregrine).
  function getDignity(planet, sign) {
    if (PLANET_DOMICILES[planet] && PLANET_DOMICILES[planet].includes(sign)) return "domicile";
    if (PLANET_EXALTATIONS[planet] === sign) return "exaltation";
    // Detriment: opposite of any domicile
    if (PLANET_DOMICILES[planet].some(d => OPPOSITE_SIGN[d] === sign)) return "detriment";
    if (OPPOSITE_SIGN[PLANET_EXALTATIONS[planet]] === sign) return "fall";
    return "peregrine";
  }

  // Sect: day chart if Sun is above the horizon (houses 7–12 in Whole Sign).
  function isDayChart(sunLongitude, ascendantLongitude) {
    const diff = mod360(sunLongitude - ascendantLongitude);
    return diff >= 180;
  }

  // Lots.
  function lotOfFortune(asc, sun, moon, isDay) {
    return isDay ? mod360(asc + moon - sun) : mod360(asc + sun - moon);
  }

  function lotOfSpirit(asc, sun, moon, isDay) {
    return isDay ? mod360(asc + sun - moon) : mod360(asc + moon - sun);
  }

  // Sign-based aspects — Hellenistic convention.
  function getAspect(signA, signB) {
    const a = signIndex(signA);
    const b = signIndex(signB);
    if (a < 0 || b < 0) return null;
    let d = Math.abs(a - b);
    d = Math.min(d, 12 - d);
    return ASPECT_INTERVALS[d] || null;
  }

  // All aspects between all pairs of planets.
  function computeAspects(planetData) {
    const aspects = [];
    for (let i = 0; i < PLANETS.length; i++) {
      for (let j = i + 1; j < PLANETS.length; j++) {
        const pa = PLANETS[i], pb = PLANETS[j];
        const asp = getAspect(planetData[pa].sign, planetData[pb].sign);
        if (asp) {
          aspects.push({ planet_a: pa, planet_b: pb, type: asp });
        }
      }
    }
    return aspects;
  }

  // Bonification / maltreatment — simplified V1 rule.
  function bonificationState(planet, aspects) {
    let bonified = false, maltreated = false;
    for (const a of aspects) {
      let other = null;
      if (a.planet_a === planet) other = a.planet_b;
      else if (a.planet_b === planet) other = a.planet_a;
      if (!other) continue;
      if (BENEFICS.has(other)) {
        if (a.type === "conjunction" || a.type === "trine" || a.type === "sextile") bonified = true;
      }
      if (MALEFICS.has(other)) {
        if (a.type === "conjunction" || a.type === "square" || a.type === "opposition") maltreated = true;
      }
    }
    return { bonified, maltreated };
  }

  // Annual profection (twelve-year cycle; simplest Hellenistic time-lord method).
  function annualProfection(birthHouses, currentAge) {
    const profectedHouse = (currentAge % 12) + 1;
    const profectedSign = birthHouses[profectedHouse];
    const lord = DOMICILE_RULERS[profectedSign];
    return { age: currentAge, house: profectedHouse, sign: profectedSign, lord_of_year: lord };
  }

  function ageFromDates(birthDate, onDate) {
    // Precise date-based age (ignoring time of day).
    let age = onDate.getUTCFullYear() - birthDate.getUTCFullYear();
    const m = onDate.getUTCMonth() - birthDate.getUTCMonth();
    if (m < 0 || (m === 0 && onDate.getUTCDate() < birthDate.getUTCDate())) age--;
    return Math.max(age, 0);
  }

  // Compose the raw astronomical output (ecliptic longitudes) into a full Chart.
  function buildChart(rawLongitudes, meta) {
    const ascLon = rawLongitudes.ascendant;
    const mcLon = rawLongitudes.mc;
    const houses = wholeSignHouses(ascLon);
    const isDay = isDayChart(rawLongitudes.sun, ascLon);

    const planets = {};
    for (const p of PLANETS) {
      const lon = rawLongitudes[p];
      const sign = signOfLongitude(lon);
      const h = houseOfPlanet(lon, ascLon);
      const dignity = getDignity(p, sign);
      const planetSect = PLANET_SECT[p];
      let sect_status = "neutral";
      if (planetSect === "diurnal") sect_status = isDay ? "of sect" : "contrary to sect";
      else if (planetSect === "nocturnal") sect_status = isDay ? "contrary to sect" : "of sect";
      planets[p] = {
        longitude: round4(mod360(lon)),
        sign,
        sign_degree: round4(signDegree(lon)),
        house: h,
        dignity,
        sect_status,
        retrograde: rawLongitudes[p + "_retrograde"] || false
      };
    }

    const aspects = computeAspects(planets);
    for (const p of PLANETS) {
      const b = bonificationState(p, aspects);
      planets[p].bonified = b.bonified;
      planets[p].maltreated = b.maltreated;
    }

    const fortuneLon = lotOfFortune(ascLon, rawLongitudes.sun, rawLongitudes.moon, isDay);
    const spiritLon = lotOfSpirit(ascLon, rawLongitudes.sun, rawLongitudes.moon, isDay);

    const ascendant = {
      longitude: round4(mod360(ascLon)),
      sign: signOfLongitude(ascLon),
      sign_degree: round4(signDegree(ascLon))
    };
    const mc = {
      longitude: round4(mod360(mcLon)),
      sign: signOfLongitude(mcLon),
      sign_degree: round4(signDegree(mcLon))
    };

    const lots = {
      fortune: {
        longitude: round4(fortuneLon),
        sign: signOfLongitude(fortuneLon),
        sign_degree: round4(signDegree(fortuneLon)),
        house: houseOfPlanet(fortuneLon, ascLon)
      },
      spirit: {
        longitude: round4(spiritLon),
        sign: signOfLongitude(spiritLon),
        sign_degree: round4(signDegree(spiritLon)),
        house: houseOfPlanet(spiritLon, ascLon)
      }
    };

    let profection = null;
    if (meta && meta.birthDate) {
      const now = meta.asOf || new Date();
      const age = ageFromDates(meta.birthDate, now);
      profection = annualProfection(houses, age);
    }

    return {
      meta: meta || {},
      ascendant,
      mc,
      houses,
      planets,
      aspects,
      lots,
      sect: isDay ? "diurnal" : "nocturnal",
      profection
    };
  }

  function round4(x) { return Math.round(x * 10000) / 10000; }

  // ASCII chart (useful for debugging without SVG).
  function asciiChart(chart) {
    const lines = [];
    lines.push(`Sect: ${chart.sect}`);
    lines.push(`ASC: ${formatDegreeInSign(chart.ascendant.longitude)} ${chart.ascendant.sign}`);
    lines.push(`MC:  ${formatDegreeInSign(chart.mc.longitude)} ${chart.mc.sign}`);
    for (const p of PLANETS) {
      const pl = chart.planets[p];
      lines.push(`${PLANET_GLYPHS[p]} ${PLANET_NAMES[p].padEnd(8)} ${formatDegreeInSign(pl.longitude).padEnd(8)} ${pl.sign.padEnd(12)} House ${String(pl.house).padStart(2)}  ${pl.dignity}`);
    }
    lines.push(`Lot of Fortune: ${formatDegreeInSign(chart.lots.fortune.longitude)} ${chart.lots.fortune.sign}  House ${chart.lots.fortune.house}`);
    lines.push(`Lot of Spirit:  ${formatDegreeInSign(chart.lots.spirit.longitude)} ${chart.lots.spirit.sign}  House ${chart.lots.spirit.house}`);
    if (chart.profection) {
      lines.push(`Profection (age ${chart.profection.age}): House ${chart.profection.house} (${chart.profection.sign}), Lord of the Year: ${PLANET_NAMES[chart.profection.lord_of_year]}`);
    }
    return lines.join("\n");
  }

  global.HelleEngine = {
    SIGNS, SIGN_GLYPHS, PLANET_GLYPHS, PLANETS, PLANET_NAMES,
    DOMICILE_RULERS, PLANET_DOMICILES, PLANET_EXALTATIONS, OPPOSITE_SIGN,
    PLANET_SECT, BENEFICS, MALEFICS, HOUSE_GREEK_NAMES, HOUSE_TOPICS,
    mod360, signOfLongitude, signIndex, signDegree, formatDegreeInSign,
    wholeSignHouses, houseOfPlanet, getDignity, isDayChart,
    lotOfFortune, lotOfSpirit, getAspect, computeAspects,
    bonificationState, annualProfection, ageFromDates,
    buildChart, asciiChart, round4
  };

})(typeof window !== "undefined" ? window : globalThis);
