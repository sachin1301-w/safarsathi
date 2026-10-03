/**
 * The website's HTML page (Expo Router web only). Adds the look that React Native styles can't
 * express: a slowly drifting aurora background, frosted glass, 3D cards that tilt towards the
 * mouse with a moving light reflection, gradient headline text and gentle floating. Components
 * opt in with data attributes: data-tilt, data-glass, data-gradient-text, data-float.
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
