// astrolab page glue — terminal-prompt driven.
//
// Exposes:
//   window.handleLookup(city, ctx)   — quick "lookup <city>" geocode helper
//   window.astrolabNatal(args, ctx)  — full natal chart prompt sequence
//
// Loaded once per visit. Defers astronomy-engine + rules until the natal
// command is actually invoked.

(function () {
  "use strict";

  const RULES_URL = "/divers/astrolab/rules.json";

  // -------------------------------------------------------------------------
  // Geocoding (Nominatim) — reused by `lookup` and the natal place prompt.
  // -------------------------------------------------------------------------
  async function geocodeCity(name) {
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(name);
    const r   = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error("Geocoding service unavailable: " + r.status);
    const data = await r.json();
    if (!data || data.length === 0) throw new Error('No location found for "' + name + '".');
    return {
      latitude:    parseFloat(data[0].lat),
      longitude:   parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  }

  async function handleLookup(city, { print, printError }) {
    const name = (city || "").trim();
    if (!name) return printError("lookup: empty place.");
    print("> looking up " + name + "…");
    try {
      const g = await geocodeCity(name);
      print("> " + g.displayName + " — " + g.latitude.toFixed(4) + "°, " + g.longitude.toFixed(4) + "°");
    } catch (e) {
      printError(e.message);
    }
  }
  window.handleLookup = handleLookup;

  // -------------------------------------------------------------------------
  // Timezone estimation. We only auto-estimate; the user does not type an
  // offset. Rule: try the browser's IANA tz on the birth instant (correct
  // for DST if user is in their birth region); else fall back to 15°/hour.
  // -------------------------------------------------------------------------
  function estimateTzOffsetHours(utcDateAtLocalClock, longitude) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        const offsetMin = tzOffsetMinutesFor(tz, utcDateAtLocalClock);
        if (offsetMin != null) return offsetMin / 60;
      }
    } catch (_) { /* fall through */ }
    return Math.round(longitude / 15);
  }

  function tzOffsetMinutesFor(tzName, date) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tzName,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    });
    const parts = fmt.formatToParts(date).reduce((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const asTzUtcMs = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour === "24" ? 0 : parts.hour),
      Number(parts.minute), Number(parts.second)
    );
    return Math.round((asTzUtcMs - date.getTime()) / 60000);
  }

  function localToUtc(dateStr, timeStr, tzOffsetHours) {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [h, m]    = timeStr.split(":").map(Number);
    return new Date(Date.UTC(Y, M - 1, D, h, m, 0, 0) - tzOffsetHours * 3600 * 1000);
  }

  // -------------------------------------------------------------------------
  // Place input parsing — accept either "lat,lon" (signed decimals) or a
  // free-form city name to be geocoded.
  // -------------------------------------------------------------------------
  const LATLON_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

  async function resolvePlace(input) {
    const m = input.match(LATLON_RE);
    if (m) {
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new Error("Coordinates out of range. Expected lat in [-90, 90], lon in [-180, 180].");
      }
      return { latitude: lat, longitude: lon, displayName: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°` };
    }
    return await geocodeCity(input);
  }

  // -------------------------------------------------------------------------
  // Rules cache.
  // -------------------------------------------------------------------------
  let rulesPromise = null;
  function getRules() {
    if (!rulesPromise) rulesPromise = HelleInterpreter.loadRules(RULES_URL);
    return rulesPromise;
  }

  // -------------------------------------------------------------------------
  // Natal chart command.
  // -------------------------------------------------------------------------
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^(\d{2}:\d{2}|unknown)$/i;

  function astrolabNatal(_args, _ctx) {
    if (!window.TERM || !window.TERM.prompt) {
      console.error("TERM.prompt not available");
      return;
    }
    window.TERM.prompt(
      [
        { key: 'date (yyyy-mm-dd)',          validate: s => DATE_RE.test(s) },
        { key: 'time (hh:mm or "unknown")',  validate: s => TIME_RE.test(s) },
        { key: 'place (city or "lat,lon")',  validate: s => s.trim().length > 0 },
      ],
      (answers, ctx) => runNatal(answers, ctx)
    );
  }
  window.astrolabNatal = astrolabNatal;

  async function runNatal(answers, ctx) {
    const dateStr     = answers['date (yyyy-mm-dd)'];
    const timeRaw     = answers['time (hh:mm or "unknown")'];
    const placeInput  = answers['place (city or "lat,lon")'];
    const timeUnknown = timeRaw.toLowerCase() === "unknown";
    const timeStr     = timeUnknown ? "12:00" : timeRaw;

    if (typeof Astronomy === "undefined") {
      ctx.printError("astronomy library failed to load. Check your connection (jsDelivr).");
      return;
    }

    try {
      ctx.print("> resolving place…");
      const place = await resolvePlace(placeInput);
      ctx.print("> " + place.displayName);

      if (Math.abs(place.latitude) >= 65) {
        ctx.printError("latitude must be within ±65°. The Ascendant formula is unreliable near the poles.");
        return;
      }

      const [Y, M, D] = dateStr.split("-").map(Number);
      const [h, m]    = timeStr.split(":").map(Number);
      const probe     = new Date(Date.UTC(Y, M - 1, D, h, m));
      const tzOffsetHours = estimateTzOffsetHours(probe, place.longitude);

      const utcDate = localToUtc(dateStr, timeStr, tzOffsetHours);
      if (isNaN(utcDate.getTime())) {
        ctx.printError("could not parse date/time.");
        return;
      }

      ctx.print("> computing chart…");
      const raw = HelleAstronomy.computeLongitudes(utcDate, place.latitude, place.longitude);
      const birthDate = new Date(Date.UTC(Y, M - 1, D));
      const chart = HelleEngine.buildChart(raw, {
        birthDate, utcDate,
        latitude: place.latitude, longitude: place.longitude,
        tzOffsetHours, timeUnknown,
        asOf: new Date(),
      });

      const meta = {
        dateStr, timeStr: timeRaw, timeUnknown, tzOffsetHours,
        latitude: place.latitude, longitude: place.longitude,
        placeName: place.displayName,
      };

      const chartLines = HelleAscii.renderChart(chart, meta);
      ctx.print(chartLines);

      const rules  = await getRules();
      const interp = HelleInterpreter.interpret(chart, rules);
      const interpLines = HelleInterpreter.formatInterpretation(interp, HelleAscii.WIDTH);
      ctx.print(interpLines);

      window.__lastChart = chart;
      window.__lastRaw   = raw;
    } catch (e) {
      console.error(e);
      ctx.printError(e.message || String(e));
    }
  }

})();
