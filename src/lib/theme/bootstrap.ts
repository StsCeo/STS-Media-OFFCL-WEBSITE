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
  d.setAttribute("data-palette","midnight-navy");
  var v={
    "--obsidian":"#0B1020","--forest":"#121A2F","--forest-hover":"#0E1528","--emerald":"#3B82F6",
    "--gold":"#D7B56D","--ivory":"#F7F2E8","--soft-gray":"#D5CDBF","--canvas":"#0B1020",
    "--card":"#121A2F","--ink":"#F7F2E8","--muted":"#D6CFC0","--line":"#3A4460",
    "--focus":"#C9B8FF","--lavender":"#C9B8FF","--violet":"#6D4AFF","--electric":"#3B82F6",
    "--primary":"#6D4AFF","--primary-hover":"#5B3DE8","--primary-ink":"#F7F2E8",
    "--background":"#0B1020","--foreground":"#F7F2E8","--surface":"#121A2F","--border":"#3A4460",
    "--accent":"#3B82F6","--brand-accent":"#3B82F6","--gold-ink":"#D7B56D"
  };
  for(var k in v) d.style.setProperty(k,v[k]);
}catch(e){}})();`;
