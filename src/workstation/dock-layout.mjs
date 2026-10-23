// Reserve a useful canvas even when a tool is expanded. This is temporary
// geometry: never overwrite the user's preferred panel widths or collapsed state.
export function fitToolDock(viewportWidth, preferred=580, expanded=false){
 const viewport=Math.max(360,Number(viewportWidth)||1080);
 const maximum=Math.max(280,viewport-360);
 const minimum=Math.min(420,maximum);
 const requested=expanded?maximum:(Number(preferred)||580);
 return {width:Math.round(Math.min(maximum,Math.max(minimum,requested))),minimum,maximum};
}
