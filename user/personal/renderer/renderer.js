// Single-file ASCII / colored-block raytracer.
// All state lives on window.RENDERER. Functions are prefixed renderer_.
// Output is written via window.RENDER_OUTPUT(text), defined by the page.

(function () {

  // ── State ────────────────────────────────────────────────────────────────
  window.RENDERER = {
    W: 60,
    H: 30,
    mode: 'ascii',            // 'ascii' | 'color'
    fps: 100,                 // frame interval in ms
    animate: false,
    animSpeed: 2,             // degrees per frame around Y
    scene: [],
    camera: { pos: [0, 0, -5], target: [0, 0, 0], fov: 60 },

    // Extras (state knobs, not commands)
    charAspect: 2,            // terminal chars are ~2x taller than wide
    ambient: 0.5,             // small floor so unlit side isn't pitch black; set 0 for strict
    // Brightness ramp. ASCII default because VT323 (the site's terminal font)
    // doesn't ship glyphs for the Unicode block characters and the browser
    // falls back to a font with a different width, breaking row alignment.
    // Call window.RENDERER.useBlocks(true) (defined by the page) to opt in to
    // ' ░▒▓█' along with a font override on #render-out.
    ramp: ' .:-=+*#%@',
    rampAscii:  ' .:-=+*#%@',
    rampBlocks: ' ░▒▓█',

    // Defaults per primitive type (used when user omits a color)
    defaultColors: {
      sphere: '#ff6600',
      plane:  '#3366aa',
      box:    '#22cc88',
      mesh:   '#cccccc',
    },

    // Internal animation state
    _angle: 0,                // current Y rotation in radians
    _interval: null,
  };

  const R = window.RENDERER;

  // ── Vector math ──────────────────────────────────────────────────────────
  const renderer_v_add  = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const renderer_v_sub  = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const renderer_v_mul  = (a, k) => [a[0]*k,    a[1]*k,    a[2]*k];
  const renderer_v_dot  = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const renderer_v_cross = (a, b) => [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0],
  ];
  const renderer_v_len  = (a) => Math.hypot(a[0], a[1], a[2]);
  function renderer_v_norm(a) {
    const l = renderer_v_len(a) || 1;
    return [a[0]/l, a[1]/l, a[2]/l];
  }

  // Rotate vector around Y by angle (radians).
  function renderer_rotY(v, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return [c*v[0] + s*v[2], v[1], -s*v[0] + c*v[2]];
  }

  // Fixed directional light (world-space).
  const LIGHT = renderer_v_norm([1, 1, -1]);

  // ── Intersections ────────────────────────────────────────────────────────
  // Each returns either null or { t, normal } in world space.
  // Ray is { o, d } with d normalised. We always require t > EPS.
  const EPS = 1e-4;

  function renderer_hit_sphere(ray, obj) {
    const oc = renderer_v_sub(ray.o, obj.center);
    const b  = renderer_v_dot(oc, ray.d);
    const c  = renderer_v_dot(oc, oc) - obj.radius * obj.radius;
    const disc = b*b - c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    let t = -b - sq;
    if (t < EPS) t = -b + sq;
    if (t < EPS) return null;
    const p = renderer_v_add(ray.o, renderer_v_mul(ray.d, t));
    const normal = renderer_v_norm(renderer_v_sub(p, obj.center));
    return { t, normal };
  }

  function renderer_hit_plane(ray, obj) {
    const denom = renderer_v_dot(obj.normal, ray.d);
    if (Math.abs(denom) < EPS) return null;
    const t = (obj.d - renderer_v_dot(obj.normal, ray.o)) / denom;
    if (t < EPS) return null;
    // Face the normal toward the ray for consistent shading.
    const n = denom < 0 ? obj.normal : renderer_v_mul(obj.normal, -1);
    return { t, normal: n };
  }

  function renderer_hit_box(ray, obj) {
    // Axis-aligned slab method around obj.center with half-extents obj.half.
    let tmin = -Infinity, tmax = Infinity;
    let axis = 0, sign = 1;
    for (let i = 0; i < 3; i++) {
      const o = ray.o[i] - obj.center[i];
      const d = ray.d[i];
      if (Math.abs(d) < EPS) {
        if (o < -obj.half[i] || o > obj.half[i]) return null;
        continue;
      }
      let t1 = (-obj.half[i] - o) / d;
      let t2 = ( obj.half[i] - o) / d;
      let s1 = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s1 = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s1; }
      if (t2 < tmax) { tmax = t2; }
      if (tmin > tmax) return null;
    }
    const t = tmin > EPS ? tmin : (tmax > EPS ? tmax : -1);
    if (t < EPS) return null;
    const normal = [0, 0, 0];
    normal[axis] = sign;
    return { t, normal };
  }

  function renderer_hit_triangle(ray, v0, v1, v2) {
    // Möller–Trumbore.
    const e1 = renderer_v_sub(v1, v0);
    const e2 = renderer_v_sub(v2, v0);
    const p  = renderer_v_cross(ray.d, e2);
    const det = renderer_v_dot(e1, p);
    if (Math.abs(det) < EPS) return null;
    const invDet = 1 / det;
    const s = renderer_v_sub(ray.o, v0);
    const u = renderer_v_dot(s, p) * invDet;
    if (u < 0 || u > 1) return null;
    const q = renderer_v_cross(s, e1);
    const v = renderer_v_dot(ray.d, q) * invDet;
    if (v < 0 || u + v > 1) return null;
    const t = renderer_v_dot(e2, q) * invDet;
    if (t < EPS) return null;
    let normal = renderer_v_norm(renderer_v_cross(e1, e2));
    if (renderer_v_dot(normal, ray.d) > 0) normal = renderer_v_mul(normal, -1);
    return { t, normal };
  }

  function renderer_hit_mesh(ray, obj) {
    let best = null;
    for (const tri of obj.tris) {
      const h = renderer_hit_triangle(ray, tri[0], tri[1], tri[2]);
      if (h && (!best || h.t < best.t)) best = h;
    }
    return best;
  }

  function renderer_intersect(ray, obj) {
    switch (obj.type) {
      case 'sphere':   return renderer_hit_sphere(ray, obj);
      case 'plane':    return renderer_hit_plane(ray, obj);
      case 'box':      return renderer_hit_box(ray, obj);
      case 'mesh':     return renderer_hit_mesh(ray, obj);
      default:         return null;
    }
  }

  // ── Shading ──────────────────────────────────────────────────────────────
  // Lambertian against fixed directional light, plus a small ambient floor.
  function renderer_shade(normal) {
    const d = Math.max(0, renderer_v_dot(normal, LIGHT));
    return Math.min(1, R.ambient + (1 - R.ambient) * d);
  }

  function renderer_ramp_char(intensity) {
    const ramp = R.ramp;
    const i = Math.max(0, Math.min(ramp.length - 1,
                                   Math.floor(intensity * ramp.length)));
    return ramp[i];
  }

  // Multiply a hex color toward black by factor k in [0,1].
  function renderer_tint(hex, k) {
    const m = hex.match(/^#?([0-9a-f]{6})$/i);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.round(((n >> 16) & 0xff) * k);
    const g = Math.round(((n >>  8) & 0xff) * k);
    const b = Math.round(( n        & 0xff) * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // ── Camera ───────────────────────────────────────────────────────────────
  function renderer_camera_basis() {
    const cam = R.camera;
    const forward = renderer_v_norm(renderer_v_sub(cam.target, cam.pos));
    let up = [0, 1, 0];
    if (Math.abs(renderer_v_dot(forward, up)) > 0.999) up = [0, 0, 1];
    // Right-handed basis: +x of screen maps to world +x when looking down +z.
    const right  = renderer_v_norm(renderer_v_cross(up, forward));
    const trueUp = renderer_v_cross(forward, right);
    return { forward, right, up: trueUp };
  }

  // Y-rotation of the scene is implemented by rotating the ray by -angle.
  function renderer_make_ray(x, y, basis, halfW, halfH) {
    const sx = (2 * (x + 0.5) / R.W - 1) * halfW;
    const sy = -(2 * (y + 0.5) / R.H - 1) * halfH;
    let dir = renderer_v_add(
      basis.forward,
      renderer_v_add(renderer_v_mul(basis.right, sx),
                     renderer_v_mul(basis.up, sy)),
    );
    dir = renderer_v_norm(dir);
    let o = R.camera.pos.slice();
    if (R._angle !== 0) {
      o   = renderer_rotY(o,   -R._angle);
      dir = renderer_rotY(dir, -R._angle);
    }
    return { o, d: dir };
  }

  // ── Frame ────────────────────────────────────────────────────────────────
  function renderer_renderFrame() {
    const basis = renderer_camera_basis();
    const halfW = Math.tan(R.camera.fov * Math.PI / 360);
    const halfH = halfW * (R.H / R.W) * R.charAspect;

    const ascii = R.mode !== 'color';
    let out = '';

    for (let y = 0; y < R.H; y++) {
      for (let x = 0; x < R.W; x++) {
        const ray = renderer_make_ray(x, y, basis, halfW, halfH);

        let bestHit = null;
        let bestObj = null;
        for (const obj of R.scene) {
          const h = renderer_intersect(ray, obj);
          if (h && (!bestHit || h.t < bestHit.t)) { bestHit = h; bestObj = obj; }
        }

        if (!bestHit) {
          out += ascii ? ' ' : '<span> </span>';
          continue;
        }

        const intensity = renderer_shade(bestHit.normal);
        const ch = renderer_ramp_char(intensity);

        if (ascii) {
          out += ch;
        } else {
          const tinted = renderer_tint(bestObj.color, intensity);
          out += '<span style="color:' + tinted + '">' + ch + '</span>';
        }
      }
      out += '\n';
    }

    if (typeof window.RENDER_OUTPUT === 'function') window.RENDER_OUTPUT(out);
    return out;
  }

  // ── Animation loop ───────────────────────────────────────────────────────
  function renderer_start() {
    if (R._interval) clearInterval(R._interval);
    R.animate = true;
    renderer_renderFrame();
    R._interval = setInterval(() => {
      if (!R.animate) { renderer_stop(); return; }
      R._angle += R.animSpeed * Math.PI / 180;
      renderer_renderFrame();
    }, R.fps);
  }

  function renderer_stop() {
    R.animate = false;
    if (R._interval) { clearInterval(R._interval); R._interval = null; }
  }

  // ── OBJ loading ──────────────────────────────────────────────────────────
  // Parses v and f lines only. Faces may be n-gons; fan-triangulated.
  // Vertex tokens accept "1", "1/2", "1//3", "1/2/3".
  function renderer_loadOBJ(text, color) {
    const verts = [];
    const tris  = [];
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      const parts = line.split(/\s+/);
      const tag = parts[0];
      if (tag === 'v' && parts.length >= 4) {
        verts.push([+parts[1], +parts[2], +parts[3]]);
      } else if (tag === 'f' && parts.length >= 4) {
        const idx = [];
        for (let i = 1; i < parts.length; i++) {
          const n = parseInt(parts[i].split('/')[0], 10);
          if (!Number.isFinite(n)) { idx.length = 0; break; }
          // OBJ supports negative (relative) indices.
          idx.push(n > 0 ? n - 1 : verts.length + n);
        }
        if (idx.length < 3) continue;
        for (let i = 1; i < idx.length - 1; i++) {
          const a = verts[idx[0]];
          const b = verts[idx[i]];
          const c = verts[idx[i + 1]];
          if (a && b && c) tris.push([a, b, c]);
        }
      }
    }
    R.scene.push({ type: 'mesh', tris, color: color || R.defaultColors.mesh });
    return tris.length;
  }

  // ── Public API ───────────────────────────────────────────────────────────
  R.renderFrame = renderer_renderFrame;
  R.start       = renderer_start;
  R.stop        = renderer_stop;
  R.loadOBJ     = renderer_loadOBJ;

  // Single-line description used by the `render scene` command.
  R._describe = function (obj, i) {
    const fmt = (v) => '(' + v.map(n => +n.toFixed(3)).join(',') + ')';
    switch (obj.type) {
      case 'sphere':
        return '[' + i + '] sphere pos=' + fmt(obj.center) +
               ' r=' + obj.radius + ' color=' + obj.color;
      case 'plane':
        return '[' + i + '] plane normal=' + fmt(obj.normal) +
               ' d=' + obj.d + ' color=' + obj.color;
      case 'box':
        return '[' + i + '] box pos=' + fmt(obj.center) +
               ' half=' + fmt(obj.half) + ' color=' + obj.color;
      case 'mesh':
        return '[' + i + '] mesh tris=' + obj.tris.length +
               ' color=' + obj.color;
      default:
        return '[' + i + '] ' + obj.type;
    }
  };

  // Default scene so the first `render run` shows something.
  if (R.scene.length === 0) {
    R.scene.push({
      type: 'sphere',
      center: [0, 0, 0],
      radius: 1,
      color: R.defaultColors.sphere,
    });
    R.scene.push({
      type: 'plane',
      normal: [0, 1, 0],
      d: -1,
      color: R.defaultColors.plane,
    });
  }

})();
