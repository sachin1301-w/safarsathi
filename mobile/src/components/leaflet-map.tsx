/**
 * Map rendered with Leaflet + OpenStreetMap/CARTO tiles inside a WebView.
 * react-native-maps shows a black map in Expo Go SDK 57 on Android (expo/expo#49323);
 * this works in Expo Go, needs no API key, and supports pins, labels, routes and dark mode.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { TravelLoaderCard } from '@/components/travel-loader';
import { useT } from '@/lib/i18n';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  glyph?: 'ev' | 'parking' | 'start' | 'end';
  label?: string;
  selected?: boolean;
}

export interface MapPolyline {
  id: string;
  coords: [number, number][];
  color: string;
  dashed?: boolean;
}

export interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  /** The user's live position, drawn as a blue dot. */
  user?: { lat: number; lng: number } | null;
  /** Zoom to show every marker and line whenever they change. */
  fit?: boolean;
  /** Zoom to show these points (e.g. the nearest results) whenever they change; overrides center. */
  focus?: { lat: number; lng: number }[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// CARTO basemaps need a key (tiles say "API KEY REQUIRED" without one). With no key,
// fall back to OpenStreetMap's own tiles, which have no dark style.
const CARTO_KEY = process.env.EXPO_PUBLIC_CARTO_KEY;

function tileUrl(dark: boolean) {
  if (!CARTO_KEY) return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const style = dark ? 'dark_all' : 'rastertiles/voyager';
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`;
}

function buildHtml(center: { lat: number; lng: number }, zoom: number, dark: boolean) {
  const tiles = tileUrl(dark);
  const bg = dark ? '#0B0E0F' : '#E8EEEE';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;height:100%;background:${bg}}
.pin{box-sizing:border-box;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;
  color:#fff;font:800 13px sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.pin.sel{border-width:3px;font-size:17px}
.lbl{position:absolute;left:50%;transform:translateX(-50%);background:#fff;border:1.5px solid;border-radius:8px;
  padding:0 5px;font:800 11px sans-serif;color:#111;white-space:nowrap}
.me{width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-sizing:border-box;
  box-shadow:0 0 0 6px rgba(37,99,235,.25)}
.msg{font:14px sans-serif;color:#555;padding:24px;text-align:center}
</style></head><body><div id="map"></div><script>
var send=function(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))};
if(!window.L){document.body.innerHTML='<div class="msg">The map needs an internet connection.</div>';send({type:'tiles'});}
else{
var map=L.map('map',{zoomControl:false}).setView([${center.lat},${center.lng}],${zoom});
L.tileLayer('${tiles}',{maxZoom:19,subdomains:'abcd',attribution:'${CARTO_KEY ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap'}'}).on('load',function(){send({type:'tiles'})}).addTo(map);
map.on('click',function(){send({type:'map'})});
var layer=L.layerGroup().addTo(map);
var BOLT='<svg viewBox="0 0 24 24" width="62%" height="62%"><path fill="#fff" d="M13 2 4 14h7l-1 8 10-12h-7z"/></svg>';
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
window.render=function(s){
  layer.clearLayers();var pts=[];
  (s.polylines||[]).forEach(function(p){L.polyline(p.coords,{color:p.color,weight:5,opacity:.9,dashArray:p.dashed?'2 9':null,lineCap:'round'}).addTo(layer);p.coords.forEach(function(c){pts.push(c)})});
  (s.markers||[]).forEach(function(m){
    var size=m.selected?38:28;
    var glyph=m.glyph==='ev'?BOLT:m.glyph==='parking'?'P':'';
    var html='<div class="pin'+(m.selected?' sel':'')+'" style="width:'+size+'px;height:'+size+'px;background:'+m.color+'">'+glyph+'</div>'
      +(m.label?'<div class="lbl" style="top:'+(size+2)+'px;border-color:'+m.color+'">'+esc(m.label)+'</div>':'');
    var icon=L.divIcon({html:html,className:'',iconSize:[size,size],iconAnchor:[size/2,size/2]});
    var mk=L.marker([m.lat,m.lng],{icon:icon,zIndexOffset:m.selected?1000:0}).addTo(layer);
    mk.on('click',function(e){L.DomEvent.stopPropagation(e);send({type:'marker',id:m.id})});
    pts.push([m.lat,m.lng]);
  });
  if(s.user){L.marker([s.user.lat,s.user.lng],{icon:L.divIcon({html:'<div class="me"></div>',className:'',iconSize:[16,16],iconAnchor:[8,8]}),interactive:false,zIndexOffset:2000}).addTo(layer);}
  if(s.fit&&pts.length){map.fitBounds(pts,{padding:[36,36],maxZoom:15});}
};
window.recenter=function(lat,lng,zoom){map.setView([lat,lng],zoom||map.getZoom(),{animate:true})};
window.focusOn=function(pts){if(pts.length===1){map.setView(pts[0],15)}else if(pts.length){map.fitBounds(pts,{padding:[40,40],maxZoom:15})}};
send({type:'ready'});
}
</script></body></html>`;
}

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
  const ref = useRef<WebView>(null);
  const dark = useColorScheme() === 'dark';
  const t = useT();
  const [ready, setReady] = useState(false);
  // Covers the map until the first tiles arrive, then fades out.
  const [cover] = useState(() => new Animated.Value(1));
  const [loaded, setLoaded] = useState(false);
  // The page is built once (per colour scheme); later changes are pushed into it.
  const [html] = useState(() => buildHtml(center, zoom, dark));

  const state = JSON.stringify({ markers, polylines, user: user ?? null, fit: !!fit });
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.render(${state});true;`);
  }, [ready, state]);

  const focusPts = focus?.length ? JSON.stringify(focus.map((p) => [p.lat, p.lng])) : null;
  useEffect(() => {
    if (!ready || fit) return;
    ref.current?.injectJavaScript(
      focusPts
        ? `window.focusOn(${focusPts});true;`
        : `window.recenter(${center.lat},${center.lng},${zoom});true;`,
    );
  }, [ready, fit, focusPts, center.lat, center.lng, zoom]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string };
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'tiles' && !loaded) {
        setLoaded(true);
        Animated.timing(cover, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      } else if (msg.type === 'marker' && msg.id) onMarkerPress?.(msg.id);
      else if (msg.type === 'map') onMapPress?.();
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: dark ? '#0B0E0F' : '#E8EEEE' }, style]}>
      <WebView
        ref={ref}
        source={{ html, baseUrl: 'https://safarsathi.local/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={styles.web}
        // Let the map own pan gestures inside scroll views.
        nestedScrollEnabled
      />
      <Animated.View
        pointerEvents={loaded ? 'none' : 'auto'}
        style={[
          StyleSheet.absoluteFill,
          styles.cover,
          { opacity: cover, backgroundColor: dark ? '#0B0E0F' : '#E8EEEE' },
        ]}>
        <TravelLoaderCard vehicle="car" label={t('map.loading')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  cover: { alignItems: 'center', justifyContent: 'center' },
});
