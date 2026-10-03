/**
 * The website's HTML page (Expo Router web only). Adds the look that React Native styles can't
 * express: a slowly drifting aurora background, frosted glass, 3D cards that tilt towards the
 * mouse with a moving light reflection, gradient headline text and gentle floating, plus the
 * HUD look (cut-corner framed panels, angled top nav, side docks, scroll cue, robot mascot) and
 * fade-in-on-scroll. Components opt in with data attributes: data-tilt, data-glass, data-hud,
 * data-gradient-text, data-float, data-display, data-reveal, data-spin, data-mascot, data-bubble,
 * data-scroll-cue, data-hud-nav.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const CSS = `
:root{--page:#F3F7F7;--a1:rgba(0,191,166,.38);--a2:rgba(99,102,241,.26);--a3:rgba(236,72,153,.16);--grid:rgba(10,20,20,.05)}
html[data-theme=dark]{--page:#06090A;--a1:rgba(0,191,166,.24);--a2:rgba(99,102,241,.22);--a3:rgba(236,72,153,.12);--grid:rgba(255,255,255,.035)}
html{background:var(--page);transition:background .4s ease}
/* The body stays see-through so the aurora layers (below) show behind the app. */
body{background:transparent}
body::before,body::after{content:'';position:fixed;inset:-25%;z-index:-1;pointer-events:none;filter:blur(70px)}
body::before{background:radial-gradient(38% 34% at 18% 22%,var(--a1),transparent 70%),radial-gradient(34% 30% at 82% 18%,var(--a2),transparent 70%);animation:ss-drift 20s ease-in-out infinite alternate}
body::after{background:radial-gradient(34% 34% at 64% 86%,var(--a3),transparent 70%),radial-gradient(30% 30% at 8% 88%,var(--a2),transparent 70%),linear-gradient(var(--grid) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/48px 48px;animation:ss-drift2 26s ease-in-out infinite alternate}
@keyframes ss-drift{0%{transform:translate3d(0,0,0) rotate(0deg) scale(1)}100%{transform:translate3d(6%,5%,0) rotate(10deg) scale(1.08)}}
@keyframes ss-drift2{0%{transform:translate3d(0,0,0) rotate(0deg)}100%{transform:translate3d(-5%,-4%,0) rotate(-8deg)}}

[data-tilt]{transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateY(var(--lift,0px)) !important;transform-style:preserve-3d;transition:transform .2s ease,box-shadow .3s ease,border-color .3s ease !important;backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);position:relative;will-change:transform}
[data-tilt]:hover{--lift:-5px;box-shadow:0 22px 45px -16px rgba(0,0,0,.38),0 0 0 1px rgba(0,191,166,.45),0 0 28px -6px rgba(0,191,166,.35) !important}
[data-tilt]::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.16),transparent 42%);opacity:0;transition:opacity .3s ease}
[data-tilt]:hover::after{opacity:1}
[data-glass]{backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%)}
[data-gradient-text]{background:linear-gradient(92deg,#00BFA6 0%,#22D3EE 35%,#6366F1 70%,#EC4899 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent !important;animation:ss-shine 6s linear infinite}
@keyframes ss-shine{to{background-position:200% center}}
[data-float]{animation:ss-float 7s ease-in-out infinite}
@keyframes ss-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
[data-glow-button]{box-shadow:0 10px 30px -10px rgba(0,191,166,.7) !important}
::selection{background:rgba(0,191,166,.35)}
*{scrollbar-width:thin;scrollbar-color:rgba(0,191,166,.45) transparent}
::-webkit-scrollbar{width:9px;height:9px}::-webkit-scrollbar-thumb{background:rgba(0,191,166,.4);border-radius:9px}
#root [dir=auto],#root input,#root textarea{font-family:'Space Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif}
[data-display]{font-family:'Orbitron','Space Grotesk',sans-serif !important;letter-spacing:.08em}
:root{--panel:rgba(255,255,255,.62);--hud-edge:linear-gradient(135deg,#E9B949,#00BFA6 40%,#6366F1 75%,#E9B949)}
html[data-theme=dark]{--panel:rgba(10,13,20,.58)}
[data-hud]{--cut:16px;clip-path:polygon(var(--cut) 0,calc(100% - var(--cut)) 0,100% var(--cut),100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,var(--cut) 100%,0 calc(100% - var(--cut)),0 var(--cut));background:var(--panel) !important;border-color:transparent !important}
[data-hud]::before{content:'';position:absolute;inset:0;padding:1.6px;background:var(--hud-edge);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.85}
[data-hud]:hover::before{opacity:1;filter:drop-shadow(0 0 6px rgba(0,191,166,.8))}
[data-hud-nav]{clip-path:polygon(0 0,100% 0,calc(100% - 34px) 100%,34px 100%);background:var(--panel) !important;backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);border-bottom:1.5px solid rgba(0,191,166,.65) !important}
[data-hud-link]{transition:color .2s ease,text-shadow .2s ease}
[data-hud-link]:hover{color:#00BFA6 !important;text-shadow:0 0 12px rgba(0,191,166,.8)}
[data-reveal]{opacity:0;transform:translateY(42px) scale(.97);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
[data-reveal][data-shown]{opacity:1;transform:none}
[data-reveal-delay='1']{transition-delay:.12s}[data-reveal-delay='2']{transition-delay:.24s}[data-reveal-delay='3']{transition-delay:.36s}
[data-spin]{animation:ss-spin .35s linear infinite}
@keyframes ss-spin{to{transform:rotateY(360deg)}}
[data-mascot]{animation:ss-hover 3.2s ease-in-out infinite;cursor:pointer}
@keyframes ss-hover{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-14px) rotate(2deg)}}
[data-bubble]{opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s;pointer-events:none}
[data-mascot]:hover [data-bubble]{opacity:1;transform:none}
[data-scroll-cue]{animation:ss-cue 1.8s ease-in-out infinite}
@keyframes ss-cue{0%{transform:translateY(-8px);opacity:0}40%{opacity:1}100%{transform:translateY(26px);opacity:0}}
[data-title-glow]{text-shadow:0 0 18px rgba(0,191,166,.55),0 0 42px rgba(99,102,241,.35)}
@media (prefers-reduced-motion:reduce){[data-reveal]{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important}[data-tilt]{transform:none !important}}
`;

// Tilt [data-tilt] elements towards the pointer and move their light reflection with it.
const TILT = `
(function(){
  var active=null;
  function reset(el){el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');}
  document.addEventListener('pointermove',function(e){
    var el=e.target&&e.target.closest?e.target.closest('[data-tilt]'):null;
    if(active&&active!==el){reset(active);}
    active=el;
    if(!el)return;
    var r=el.getBoundingClientRect();
    var px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
    var max=r.width>500?3:7;
    el.style.setProperty('--ry',((px-.5)*max).toFixed(2)+'deg');
    el.style.setProperty('--rx',((.5-py)*max).toFixed(2)+'deg');
    el.style.setProperty('--mx',(px*100).toFixed(1)+'%');
    el.style.setProperty('--my',(py*100).toFixed(1)+'%');
  },{passive:true});
  document.addEventListener('pointerleave',function(){if(active){reset(active);active=null;}});
  // Fade [data-reveal] elements in as they scroll into view (they can appear at any time).
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.setAttribute('data-shown','');io.unobserve(en.target);}});},{threshold:.15});
    var scan=function(){document.querySelectorAll('[data-reveal]:not([data-shown]):not([data-watched])').forEach(function(el){el.setAttribute('data-watched','');io.observe(el);});};
    new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan();
  } else { document.querySelectorAll('[data-reveal]').forEach(function(el){el.setAttribute('data-shown','');}); }
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#00BFA6" />
        <meta
          name="description"
          content="SafarSathi: one AI copilot for your whole journey across India: metro, bus, train, flight, cab and EV."
        />
        <title>SafarSathi · AI travel copilot</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: TILT }} />
      </body>
    </html>
  );
}
