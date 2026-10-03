/**
 * Full-screen 3D "journey" scene behind the website's Home (three.js): a sunset city with a neon
 * grid, a highway of headlight and tail-light streaks, a metro train on an elevated track, planes
 * blinking across the sky and glowing EV chargers. Scrolling (progress 0..1) flies the camera
 * forward; the mouse adds parallax. Rebuilt when the light/dark theme changes.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppColorScheme } from '@/lib/theme-preference';

type Three = any;

let threePromise: Promise<Three> | null = null;
function loadThree(): Promise<Three> {
  const w = window as unknown as { THREE?: Three };
  if (w.THREE) return Promise.resolve(w.THREE);
  threePromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => resolve(w.THREE);
    s.onerror = () => {
      threePromise = null;
      reject(new Error('three.js failed to load'));
    };
    document.head.appendChild(s);
  });
  return threePromise;
}

export function CinematicScene({ progress }: { progress: { current: number } }) {
  const host = useRef<View>(null);
  const dark = useAppColorScheme() === 'dark';

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    loadThree()
      .then((THREE) => {
        const el = host.current as unknown as HTMLElement | null;
        if (!disposed && el) cleanup = build(THREE, el, dark, progress);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      cleanup();
    };
  }, [dark, progress]);

  return (
    <View
      ref={host}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { position: 'fixed', zIndex: 0 } as unknown as ViewStyle]}
    />
  );
}

const PALETTE = {
  dark: {
    top: '#07051a',
    mid: '#3a1857',
    horizon: '#ff8a4c',
    fog: '#2a1338',
    ground: '#07060f',
    grid: '#00BFA6',
    building: '#120e24',
    window: ['#ffd27a', '#7ff7e6', '#ff9bd5'],
  },
  light: {
    top: '#3d84e0',
    mid: '#9cc8ff',
    horizon: '#ffd2a6',
    fog: '#cfdcef',
    ground: '#d9e2ec',
    grid: '#00A894',
    building: '#7f93ad',
    window: ['#fff4c2', '#bff8ef', '#ffd6ec'],
  },
};

function glowTexture(THREE: Three, inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function build(THREE: Three, el: HTMLElement, dark: boolean, progress: { current: number }) {
  const P = dark ? PALETTE.dark : PALETTE.light;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(P.fog, 70, 420);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

  // Sky dome with a sunset gradient.
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(P.top) },
          mid: { value: new THREE.Color(P.mid) },
          horizon: { value: new THREE.Color(P.horizon) },
        },
        vertexShader:
          'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 v;' +
          'void main(){ float h = v.y; vec3 c = mix(mid, top, smoothstep(0.05, 0.55, h));' +
          'c = mix(horizon, c, smoothstep(-0.02, 0.2, h)); gl_FragColor = vec4(c, 1.0); }',
      }),
    ),
  );
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(
        THREE,
        'rgba(255,255,240,1)',
        dark ? 'rgba(255,140,70,.75)' : 'rgba(255,200,140,.7)',
      ),
      ...additive,
      fog: false,
    }),
  );
  sun.scale.set(170, 170, 1);
  sun.position.set(0, 26, -520);
  scene.add(sun);

  // Ground and neon grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshBasicMaterial({ color: P.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(1400, 200, P.grid, P.grid);
  grid.material.transparent = true;
  grid.material.opacity = dark ? 0.22 : 0.18;
  grid.position.y = 0.02;
  scene.add(grid);

  // Highway with lane dashes.
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 1400),
    new THREE.MeshBasicMaterial({ color: dark ? 0x0b0b14 : 0x55606e }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.04, -400);
  scene.add(road);
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.25, 0.02, 3),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    140,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < 140; i++) {
    m.makeTranslation(i % 2 ? 3.5 : -3.5, 0.06, 40 - Math.floor(i / 2) * 12);
    dashes.setMatrixAt(i, m);
  }
  scene.add(dashes);

  // City: towers on both sides with twinkling windows.
  const B = 300;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: P.building }),
    B,
  );
  const base = new THREE.Color(P.building);
  const winPos: number[] = [];
  const winCol: number[] = [];
  for (let i = 0; i < B; i++) {
    const side = i % 2 ? 1 : -1;
    // Keep the road corridor open; near towers are lower so the view down the highway stays clear.
    const x = side * rand(26, 170);
    const z = rand(-700, 40);
    const w = rand(4, 13);
    const d = rand(4, 13);
    const h = rand(5, 16) + Math.max(0, -z - 60) * rand(0.04, 0.13);
    m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    towers.setMatrixAt(i, m);
    towers.setColorAt(i, base.clone().offsetHSL(0, 0, rand(-0.03, 0.05)));
    const faceX = x - side * (w / 2 + 0.05);
    for (let k = 0; k < Math.min(26, h); k++) {
      if (Math.random() < 0.45) continue;
      winPos.push(faceX, rand(1, h - 0.5), z + rand(-d / 2, d / 2));
      const c = new THREE.Color(P.window[Math.floor(Math.random() * P.window.length)]);
      winCol.push(c.r, c.g, c.b);
    }
  }
  scene.add(towers);
  const winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute('position', new THREE.Float32BufferAttribute(winPos, 3));
  winGeo.setAttribute('color', new THREE.Float32BufferAttribute(winCol, 3));
  const windows = new THREE.Points(
    winGeo,
    new THREE.PointsMaterial({ size: 0.55, vertexColors: true, ...additive, opacity: 0.9 }),
  );
  scene.add(windows);

  // Traffic: white headlights coming towards us, red tail lights going away.
  type Car = { x: number; z: number; v: number };
  const makeTraffic = (color: number, lanes: number[], dir: 1 | -1, n: number) => {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.45, 0.22, 4.2),
      new THREE.MeshBasicMaterial({ color, ...additive }),
      n,
    );
    const cars: Car[] = Array.from({ length: n }, (_, i) => ({
      x: lanes[i % lanes.length],
      z: rand(-700, 40),
      v: dir * rand(28, 60),
    }));
    scene.add(mesh);
    return { mesh, cars };
  };
  const traffic = [
    makeTraffic(dark ? 0xfff2cf : 0xffffff, [-1.8, -5.2], 1, 70),
    makeTraffic(0xff3b4f, [1.8, 5.2], -1, 70),
  ];

  // Elevated metro: track, pillars and a teal train.
  const trackX = -26;
  const track = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.6, 1400),
    new THREE.MeshBasicMaterial({ color: dark ? 0x1d1a33 : 0x9aa8b8 }),
  );
  track.position.set(trackX, 10, -400);
  scene.add(track);
  const pillars = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 10, 1),
    new THREE.MeshBasicMaterial({ color: dark ? 0x161329 : 0x8b9aac }),
    60,
  );
  for (let i = 0; i < 60; i++) {
    m.makeTranslation(trackX, 5, 40 - i * 24);
    pillars.setMatrixAt(i, m);
  }
  scene.add(pillars);
  const train = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const car = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.3, 8.6),
      new THREE.MeshBasicMaterial({ color: 0x00bfa6 }),
    );
    car.position.z = i * 9;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(2.46, 0.5, 7.6),
      new THREE.MeshBasicMaterial({ color: 0xe9fffb, ...additive }),
    );
    strip.position.set(0, 0.35, i * 9);
    train.add(car, strip);
  }
  train.position.set(trackX, 11.6, -500);
  scene.add(train);

  // EV chargers along the road, pulsing.
  const chargerGlow = glowTexture(THREE, 'rgba(160,255,240,1)', 'rgba(0,191,166,.6)');
  const chargers: Three[] = [];
  for (let i = 0; i < 18; i++) {
    const z = 20 - i * 40;
    for (const x of [-10.5, 10.5]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 2.4, 0.7),
        new THREE.MeshBasicMaterial({ color: dark ? 0x10131c : 0x3c4654 }),
      );
      post.position.set(x, 1.2, z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: chargerGlow, ...additive }));
      glow.position.set(x, 2.8, z);
      glow.scale.set(3.2, 3.2, 1);
      glow.userData.phase = Math.random() * 6;
      scene.add(post, glow);
      chargers.push(glow);
    }
  }

  // Planes blinking across the sky.
  const blink = glowTexture(THREE, 'rgba(255,255,255,1)', 'rgba(255,90,110,.7)');
  const planes = Array.from({ length: 4 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: blink, ...additive }));
    s.scale.set(5, 5, 1);
    s.position.set(rand(-400, 400), rand(70, 140), -250 - i * 90);
    s.userData.v = rand(18, 34) * (i % 2 ? 1 : -1);
    scene.add(s);
    return s;
  });

  let mx = 0;
  let my = 0;
  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('resize', onResize);

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const cam = { z: 40, y: 20 };
  let raf = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const p = Math.max(0, Math.min(1, progress.current));
    // Fly forward and down towards street level as the page scrolls.
    cam.z += (40 - p * 300 - cam.z) * 0.06;
    cam.y += (20 - p * 12 - cam.y) * 0.06;
    camera.position.set(
      mx * 4 + (reduceMotion ? 0 : Math.sin(t * 0.3) * 1.2),
      cam.y - my * 2,
      cam.z,
    );
    camera.lookAt(mx * 2, cam.y - 5 - p * 2, cam.z - 70);
    if (!reduceMotion) {
      for (const { mesh, cars } of traffic) {
        cars.forEach((c, i) => {
          c.z += c.v * dt;
          if (c.z > cam.z + 30) c.z -= 740;
          if (c.z < cam.z - 710) c.z += 740;
          m.makeTranslation(c.x, 0.35, c.z);
          mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
      train.position.z += 26 * dt;
      if (train.position.z > cam.z + 60) train.position.z = cam.z - 620;
      for (const g of chargers) {
        const k = (Math.sin(t * 2.4 + g.userData.phase) + 1) / 2;
        g.material.opacity = 0.45 + k * 0.55;
        g.scale.setScalar(2.6 + k * 1.4);
      }
      for (const pl of planes) {
        pl.position.x += pl.userData.v * dt;
        if (pl.position.x > 460) pl.position.x = -460;
        if (pl.position.x < -460) pl.position.x = 460;
        pl.material.opacity = Math.sin(t * 6 + pl.position.y) > 0.6 ? 1 : 0.35;
      }
      windows.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.15;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
