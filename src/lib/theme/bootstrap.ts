import { THEME_COOKIE, PALETTE_COOKIE } from "@/lib/config";

/** Blocking first-paint script. Reads the theme cookie; lookbook preview is left to SSR. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
  var c=document.cookie.split("; ");
  var theme="light";
  var preview=false;
  for(var i=0;i<c.length;i++){
    if(c[i].indexOf("${THEME_COOKIE}=")==0) theme=decodeURIComponent(c[i].slice(${THEME_COOKIE.length + 1}));
    if(c[i].indexOf("${PALETTE_COOKIE}=")==0) preview=true;
  }
  if(preview||theme!=="dark") return;
  var d=document.documentElement;
  d.classList.add("dark");
  d.setAttribute("data-theme","dark");
  d.setAttribute("data-atmosphere","night-luxury");
  d.setAttribute("data-palette","sts-night");
  var v={
    "--obsidian":"#101722","--forest":"#8EACFF","--forest-hover":"#A9C0FF","--emerald":"#8EACFF",
    "--gold":"#B99146","--ivory":"#F3F4EF","--soft-gray":"#C4CBD6","--canvas":"#101722",
    "--card":"#182231","--ink":"#F3F4EF","--muted":"#C4CBD6","--line":"#40516A",
    "--focus":"#A9C0FF","--lavender":"#A9C0FF","--violet":"#8EACFF","--electric":"#A9C0FF",
    "--primary":"#8EACFF","--primary-hover":"#A9C0FF","--primary-ink":"#101722",
    "--background":"#101722","--foreground":"#F3F4EF","--surface":"#182231","--border":"#40516A",
    "--accent":"#8EACFF","--brand-accent":"#8EACFF","--gold-ink":"#B99146",
    "--sage-dark":"#A9C0FF","--sage-light":"#213047","--background-soft":"#213047"
  };
  for(var k in v) d.style.setProperty(k,v[k]);
}catch(e){}})();`;
