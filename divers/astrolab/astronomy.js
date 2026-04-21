// Wrapper around astronomy-engine to produce tropical (equinox-of-date) geocentric
// ecliptic longitudes for the seven classical planets, plus Ascendant and Midheaven.
//
// Depends on the global `Astronomy` object injected by astronomy.browser.min.js.

(function (global) {
  "use strict";

  const PLANET_BODIES = {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturn"
  };

  const DEG = Math.PI / 180;

  function normalize360(x) {
    const v = x % 360;
    return v < 0 ? v + 360 : v;
  }

  // Mean obliquity of the ecliptic (Meeus ch. 22, simplified polynomial).
  // Returns radians.
  function meanObliquity(date) {
    // Julian centuries from J2000.0
    const JD = julianDay(date);
    const T = (JD - 2451545.0) / 36525.0;
    // Seconds of arc
    const eps_arcsec = 84381.448
      - 46.8150 * T
      - 0.00059 * T * T
      + 0.001813 * T * T * T;
    return (eps_arcsec / 3600.0) * DEG;
  }

  function julianDay(date) {
    // Uses UT1 ≈ UTC; accuracy required here (arc-minute level on planet positions)
    // is far looser than the UT1–UTC difference (<0.9 s).
    return date.getTime() / 86400000 + 2440587.5;
  }

  // Convert an equatorial (RA, Dec) of-date pair to ecliptic longitude of-date.
  function equatorialToEclipticLon(raHours, decDeg, obliquityRad) {
    const ra = raHours * 15 * DEG;
    const dec = decDeg * DEG;
    const sinLon = Math.sin(ra) * Math.cos(obliquityRad) + Math.tan(dec) * Math.sin(obliquityRad);
    const cosLon = Math.cos(ra);
    return normalize360(Math.atan2(sinLon, cosLon) / DEG);
  }

  function equatorialToEclipticLat(raHours, decDeg, obliquityRad) {
    const ra = raHours * 15 * DEG;
    const dec = decDeg * DEG;
    const sinLat = Math.sin(dec) * Math.cos(obliquityRad) - Math.cos(dec) * Math.sin(obliquityRad) * Math.sin(ra);
    return Math.asin(Math.max(-1, Math.min(1, sinLat))) / DEG;
  }

  // Geocentric apparent ecliptic longitude of date for a body.
  // We use Astronomy.Equator with ofdate=true, aberration=true, at the Earth-center observer
  // (an observer at lat=0, lon=0 and elevation=-6371000 would be ~Earth's center, but simpler:
  // use a geocentric position by setting the observer to sea level and accepting the tiny
  // parallax error which is <1° even for Moon and far less for outer planets).
  // For historical-astrology precision requirements, topocentric is fine.
  function eclipticOfDate(bodyName, date, observer) {
    const body = Astronomy.Body[bodyName];
    const equ = Astronomy.Equator(body, date, observer, /*ofdate=*/true, /*aberration=*/true);
    const obl = meanObliquity(date);
    return {
      longitude: equatorialToEclipticLon(equ.ra, equ.dec, obl),
      latitude: equatorialToEclipticLat(equ.ra, equ.dec, obl)
    };
  }

  // Ascendant and Midheaven via standard spherical astronomy.
  // Uses Greenwich Apparent Sidereal Time from astronomy-engine.
  function ascendantAndMc(date, latDeg, lonDeg) {
    const gst = Astronomy.SiderealTime(date); // Greenwich Apparent Sidereal Time, hours
    let lstHours = gst + lonDeg / 15.0;
    lstHours = ((lstHours % 24) + 24) % 24;
    const ramc = lstHours * 15;       // Right Ascension of the Meridian, degrees
    const obl = meanObliquity(date);  // radians
    const phi = latDeg * DEG;
    const theta = ramc * DEG;

    // Midheaven (ecliptic longitude)
    // tan(MC) = tan(RAMC) / cos(ε)
    // But more robust form:
    // MC = atan2( sin(RAMC), cos(RAMC) * cos(ε) )
    let mc = Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(obl)) / DEG;
    mc = normalize360(mc);

    // Ascendant:
    // ASC = atan2( -cos(RAMC),  sin(RAMC)*cos(ε) + tan(φ)*sin(ε) )
    let asc = Math.atan2(
      -Math.cos(theta),
      Math.sin(theta) * Math.cos(obl) + Math.tan(phi) * Math.sin(obl)
    ) / DEG;
    asc = normalize360(asc);

    // Quadrant check: Ascendant must be in the eastern hemisphere of the ecliptic,
    // i.e., ~90° "ahead" of the MC in ecliptic order. If the difference is <0 or >180,
    // the solution is in the opposite quadrant — flip by 180°.
    const diff = normalize360(asc - mc);
    if (diff < 0 || diff > 180) {
      asc = normalize360(asc + 180);
    }

    return { ascendant: asc, mc: mc };
  }

  // Top-level: given a JS Date (UTC) and geographic location, return raw longitudes
  // for all seven planets plus ASC/MC.
  function computeLongitudes(utcDate, latDeg, lonDeg) {
    if (Math.abs(latDeg) >= 65) {
      throw new Error(
        "Latitude outside ±65°. The Ascendant formula is unreliable at extreme latitudes; " +
        "this tribute site restricts input to ±65° following the Hellenistic convention " +
        "of using Whole Sign Houses for climes near the Mediterranean."
      );
    }

    const observer = new Astronomy.Observer(latDeg, lonDeg, 0);
    const result = {};

    for (const [key, bodyName] of Object.entries(PLANET_BODIES)) {
      const { longitude, latitude } = eclipticOfDate(bodyName, utcDate, observer);
      result[key] = longitude;
      result[key + "_latitude"] = latitude;

      // Retrograde: sample 1 day later and compare.
      if (key !== "sun" && key !== "moon") {
        const tomorrow = new Date(utcDate.getTime() + 86400000);
        const later = eclipticOfDate(bodyName, tomorrow, observer);
        const delta = ((later.longitude - longitude + 540) % 360) - 180;
        result[key + "_retrograde"] = delta < 0;
      } else {
        result[key + "_retrograde"] = false;
      }
    }

    const { ascendant, mc } = ascendantAndMc(utcDate, latDeg, lonDeg);
    result.ascendant = ascendant;
    result.mc = mc;

    return result;
  }

  global.HelleAstronomy = {
    computeLongitudes,
    eclipticOfDate,
    ascendantAndMc,
    meanObliquity,
    julianDay
  };

})(typeof window !== "undefined" ? window : globalThis);
