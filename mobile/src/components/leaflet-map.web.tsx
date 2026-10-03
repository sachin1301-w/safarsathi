/**
 * Website version of LeafletMap: the same Leaflet map, drawn straight into the page (the phone
 * app runs it inside a WebView). Same props, pins, labels, routes, user dot and light/dark tiles,
 * plus hover effects on pins.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useColorScheme, View } from 'react-native';

import { PinDropScene } from '@/components/scenes';
import { useT } from '@/lib/i18n';

import type { LeafletMapProps } from './leaflet-map';

export type { LeafletMapProps, MapMarker, MapPolyline } from './leaflet-map';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet';
const CARTO_KEY = process.env.EXPO_PUBLIC_CARTO_KEY;

function tileUrl(dark: boolean) {
  if (!CARTO_KEY) return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const style = dark ? 'dark_all' : 'rastertiles/voyager';
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`;
}

// Minimal typing for the bits of Leaflet used here.
type L = any;

let leafletPromise: Promise<L> | null = null;
/** Loads Leaflet's CSS and script once per page. */
function loadLeaflet(): Promise<L> {
  const w = window as unknown as { L?: L };
  if (w.L) return Promise.resolve(w.L);
  leafletPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${LEAFLET}.css`;
    document.head.appendChild(css);
    const style = document.createElement('style');
    style.textContent = `
.ss-pin{box-sizing:border-box;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;
  justify-content:center;color:#fff;font:800 13px system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);
  transition:transform .15s ease, box-shadow .15s ease;cursor:pointer}
.ss-pin:hover{transform:scale(1.18);box-shadow:0 4px 14px rgba(0,0,0,.35)}
.ss-pin.sel{border-width:3px;font-size:17px}
.ss-lbl{position:absolute;left:50%;transform:translateX(-50%);background:#fff;border:1.5px solid;border-radius:8px;
  padding:0 5px;font:800 11px system-ui,sans-serif;color:#111;white-space:nowrap}
.ss-me{width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-sizing:border-box;
  box-shadow:0 0 0 6px rgba(37,99,235,.25);animation:ss-pulse 1.8s ease-out infinite}
@keyframes ss-pulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,.45)}100%{box-shadow:0 0 0 14px rgba(37,99,235,0)}}
.leaflet-container{font-family:system-ui,sans-serif}`;
    document.head.appendChild(style);
    const script = document.createElement('script');
    script.src = `${LEAFLET}.js`;
    script.onload = () => resolve(w.L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error('Leaflet failed to load'));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const BOLT =
  '<svg viewBox="0 0 24 24" width="62%" height="62%"><path fill="#fff" d="M13 2 4 14h7l-1 8 10-12h-7z"/></svg>';
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  polylines = [],
  user,
  fit,
  focus,
  onMarkerPress,
  onMapPress,
  style,
}: LeafletMapProps) {
  const dark = useColorScheme() === 'dark';
  const t = useT();
  const host = useRef<View>(null);
  const map = useRef<{ L: L; map: L; tiles: L; layer: L } | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cover] = useState(() => new Animated.Value(1));
  // Latest callbacks, read by Leaflet's event handlers.
  const handlers = useRef({ onMarkerPress, onMapPress });
  useEffect(() => {
    handlers.current = { onMarkerPress, onMapPress };
  });

  // Create the map once.
  const [initial] = useState({ center, zoom, dark });
  useEffect(() => {
    let disposed = false;
    loadLeaflet()
      .then((L) => {
        const el = host.current as unknown as HTMLElement | null;
        if (disposed || !el) return;
        const m = L.map(el, { zoomControl: true, attributionControl: true }).setView(
          [initial.center.lat, initial.center.lng],
          initial.zoom,
        );
        const tiles = L.tileLayer(tileUrl(initial.dark), {
          maxZoom: 19,
          subdomains: 'abcd',
          attribution: CARTO_KEY ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap',
        })
          .once('load', () => {
            setLoaded(true);
            Animated.timing(cover, { toValue: 0, duration: 300, useNativeDriver: false }).start();
          })
          .addTo(m);
        m.on('click', () => handlers.current.onMapPress?.());
        // Layouts (e.g. the side-by-side Parking view) can size the map after it's created;
        // Leaflet only draws tiles for the size it knows about, so tell it when that changes.
        const resize = new ResizeObserver(() => m.invalidateSize());
        resize.observe(el);
        m.on('unload', () => resize.disconnect());
        map.current = { L, map: m, tiles, layer: L.layerGroup().addTo(m) };
        setReady(true);
      })
      .catch(() => {
        setLoaded(true);
        cover.setValue(0);
      });
    return () => {
      disposed = true;
      map.current?.map.remove();
      map.current = null;
    };
  }, [initial, cover]);

  // Pins, labels, routes and the user's dot.
  const state = JSON.stringify({ markers, polylines, user: user ?? null, fit: !!fit });
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const s = JSON.parse(state) as {
      markers: NonNullable<LeafletMapProps['markers']>;
      polylines: NonNullable<LeafletMapProps['polylines']>;
      user: { lat: number; lng: number } | null;
      fit: boolean;
    };
    const { L } = m;
    m.layer.clearLayers();
    const pts: [number, number][] = [];
    for (const p of s.polylines) {
      L.polyline(p.coords, {
        color: p.color,
        weight: 5,
        opacity: 0.9,
        dashArray: p.dashed ? '2 9' : null,
        lineCap: 'round',
      }).addTo(m.layer);
      pts.push(...p.coords);
    }
    for (const mk of s.markers) {
      const size = mk.selected ? 38 : 28;
      const glyph = mk.glyph === 'ev' ? BOLT : mk.glyph === 'parking' ? 'P' : '';
      const html =
        `<div class="ss-pin${mk.selected ? ' sel' : ''}" style="width:${size}px;height:${size}px;background:${mk.color}">${glyph}</div>` +
        (mk.label
          ? `<div class="ss-lbl" style="top:${size + 2}px;border-color:${mk.color}">${esc(mk.label)}</div>`
          : '');
      const icon = L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([mk.lat, mk.lng], { icon, zIndexOffset: mk.selected ? 1000 : 0 })
        .on('click', (e: L) => {
          L.DomEvent.stopPropagation(e);
          handlers.current.onMarkerPress?.(mk.id);
        })
        .addTo(m.layer);
      pts.push([mk.lat, mk.lng]);
    }
    if (s.user) {
      L.marker([s.user.lat, s.user.lng], {
        icon: L.divIcon({
          html: '<div class="ss-me"></div>',
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: false,
        zIndexOffset: 2000,
      }).addTo(m.layer);
    }
    if (s.fit && pts.length) m.map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
  }, [ready, state]);

  // Centre, or zoom to the given points.
  const focusPts = focus?.length ? JSON.stringify(focus.map((p) => [p.lat, p.lng])) : null;
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || fit) return;
    if (focusPts) {
      const pts = JSON.parse(focusPts) as [number, number][];
      if (pts.length === 1) m.map.setView(pts[0], 15);
      else m.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    } else m.map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [ready, fit, focusPts, center.lat, center.lng, zoom]);

  // Follow the light/dark switch.
  useEffect(() => {
    if (ready) map.current?.tiles.setUrl(tileUrl(dark));
  }, [ready, dark]);

  return (
    <View style={[styles.wrap, { backgroundColor: dark ? '#0B0E0F' : '#E8EEEE' }, style]}>
      <View ref={host} style={StyleSheet.absoluteFill} />
      <Animated.View
        pointerEvents={loaded ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          styles.cover,
          { opacity: cover, backgroundColor: dark ? '#0B0E0F' : '#E8EEEE' },
        ]}>
        <PinDropScene label={t('map.loading')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  cover: { alignItems: 'center', justifyContent: 'center', zIndex: 500 },
});
