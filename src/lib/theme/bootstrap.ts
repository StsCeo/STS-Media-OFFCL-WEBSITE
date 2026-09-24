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
    "--obsidian":"#050706","--forest":"#07130F","--forest-hover":"#020403","--emerald":"#1F6F5C",
    "--gold":"#9CF0D1","--ivory":"#FAF8F2","--soft-gray":"#A8BFAE","--canvas":"#050706",
    "--card":"#07130F","--ink":"#FAF8F2","--muted":"#A8BFAE","--line":"#1A332C",
    "--focus":"#9CF0D1","--lavender":"#12372A","--violet":"#1F6F5C","--electric":"#9CF0D1",
    "--primary":"#1F6F5C","--primary-hover":"#2A8A74","--primary-ink":"#FAF8F2",
    "--background":"#050706","--foreground":"#FAF8F2","--surface":"#07130F","--border":"#1A332C",
    "--accent":"#1F6F5C","--brand-accent":"#1F6F5C","--gold-ink":"#9CF0D1",
    "--sage-dark":"#1F6F5C","--sage-light":"#12372A","--background-soft":"#07130F"
  };
  for(var k in v) d.style.setProperty(k,v[k]);
}catch(e){}})();`;
