/**
 * 3D globe for the website's Home hero (three.js): a sphere of glowing dots turned towards India,
 * pulsing city markers, and travel arcs out of Pune with a light running along each one. It sways
 * gently and leans towards the mouse. Rebuilt when the light/dark theme changes.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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

const CITIES: [string, number, number][] = [
  ['Pune', 18.52, 73.86],
  ['Mumbai', 19.08, 72.88],
  ['Delhi', 28.61, 77.21],
  ['Bengaluru', 12.97, 77.59],
  ['Hyderabad', 17.39, 78.49],
  ['Chennai', 13.08, 80.27],
  ['Kolkata', 22.57, 88.36],
  ['Jaipur', 26.91, 75.79],
  ['Ahmedabad', 23.02, 72.57],
  ['Goa', 15.49, 73.83],
  ['Bikaner', 28.02, 73.31],
];

export function HeroGlobe({ style }: { style?: StyleProp<ViewStyle> }) {
  const host = useRef<View>(null);
  const dark = useAppColorScheme() === 'dark';

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    loadThree()
      .then((THREE) => {
        const el = host.current as unknown as HTMLElement | null;
        if (disposed || !el) return;
        cleanup = buildGlobe(THREE, el, dark);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      cleanup();
    };
  }, [dark]);

  return <View ref={host} style={[styles.host, style]} />;
}

function buildGlobe(THREE: Three, el: HTMLElement, dark: boolean) {
  const W = () => el.clientWidth || 400;
  const H = () => el.clientHeight || 400;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 100);
  // Close enough that India and its routes fill the view.
  camera.position.set(0, 0, 3.05);

  const teal = new THREE.Color('#00BFA6');
  const violet = new THREE.Color('#6366F1');
  const pink = new THREE.Color('#EC4899');
  const globe = new THREE.Group();
  scene.add(globe);

  // Solid core (hides the far side), dotted shell, atmosphere.
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.985, 64, 64),
      new THREE.MeshBasicMaterial({
        color: dark ? 0x081214 : 0xe8f6f3,
        transparent: true,
        opacity: 0.92,
      }),
    ),
  );
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = Math.PI * (3 - Math.sqrt(5)) * i;
    pos.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
    const c = teal.clone().lerp(violet, (y + 1) / 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dotsGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  globe.add(
    new THREE.Points(
      dotsGeo,
      new THREE.PointsMaterial({
        size: 0.018,
        vertexColors: true,
        transparent: true,
        opacity: dark ? 0.9 : 0.75,
      }),
    ),
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 48),
    new THREE.MeshBasicMaterial({
      color: teal,
      transparent: true,
      opacity: dark ? 0.1 : 0.08,
      side: THREE.BackSide,
    }),
  );
  atmosphere.scale.setScalar(1.07);
  scene.add(atmosphere);

  const toVec = (lat: number, lng: number, r = 1) => {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lng + 180) * Math.PI) / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  };

  // City markers with pulsing rings.
  const rings: Three[] = [];
  for (const [, lat, lng] of CITIES) {
    const p = toVec(lat, lng, 1.005);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      new THREE.MeshBasicMaterial({ color: pink }),
    );
    dot.position.copy(p);
    globe.add(dot);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.025, 0.034, 32),
      new THREE.MeshBasicMaterial({ color: teal, transparent: true, side: THREE.DoubleSide }),
    );
    ring.position.copy(p);
    ring.lookAt(p.clone().multiplyScalar(2));
    ring.userData.phase = Math.random() * Math.PI * 2;
    globe.add(ring);
    rings.push(ring);
  }

  // Arcs from Pune, each with a light travelling along it.
  const from = toVec(CITIES[0][1], CITIES[0][2]);
  const travellers: { curve: Three; dot: Three; speed: number; t: number }[] = [];
  for (const [, lat, lng] of CITIES.slice(1)) {
    const to = toVec(lat, lng);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(1 + from.distanceTo(to) * 0.9 + 0.08);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),
      new THREE.LineBasicMaterial({ color: teal, transparent: true, opacity: 0.55 }),
    );
    globe.add(line);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    globe.add(dot);
    travellers.push({ curve, dot, speed: 0.12 + Math.random() * 0.12, t: Math.random() });
  }

  // Face India, tilted a little so it sits in the upper half.
  const india = toVec(22, 79);
  const baseY = -Math.atan2(india.x, india.z);
  globe.rotation.set(0.32, baseY, 0);

  let mx = 0;
  let my = 0;
  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  const resize = new ResizeObserver(() => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  });
  resize.observe(el);

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    const t = clock.getElapsedTime();
    const sway = reduceMotion ? 0 : Math.sin(t * 0.25) * 0.35;
    globe.rotation.y += (baseY + sway + mx * 0.25 - globe.rotation.y) * 0.04;
    globe.rotation.x += (0.32 + my * 0.12 - globe.rotation.x) * 0.04;
    for (const r of rings) {
      const k = (Math.sin(t * 2 + r.userData.phase) + 1) / 2;
      r.scale.setScalar(1 + k * 0.9);
      r.material.opacity = 0.9 - k * 0.8;
    }
    for (const tr of travellers) {
      tr.t = (tr.t + tr.speed * 0.016) % 1;
      tr.dot.position.copy(tr.curve.getPoint(tr.t));
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    resize.disconnect();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

const styles = StyleSheet.create({
  host: { width: '100%', aspectRatio: 1, maxWidth: 460 },
});
