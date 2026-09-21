#!/usr/bin/env node
/* Sanity checks for the range logic in preflop-ranges.html. Run after editing any table:

     node check-ranges.js

   It pulls the script out of the page (everything above the "state & UI" marker, which needs
   no browser), builds every combination of stack, seat, raiser, open size, callers, limpers,
   table size and GTO/live, and fails if:

     1. a range string contains a token the parser does not understand (a typo is otherwise silent)
     2. a first-in range is not at least as wide as the seat before it
     3. a stronger hand does less than a weaker hand of the same shape, e.g. JJ folds while TT calls

   Wheel aces (A5s-A2s) are added to calling ranges on purpose for their straights, so
   "A6s-A8s fold while A5s calls" is allowed. */
"use strict";
var fs=require("fs"), path=require("path");
var MARK="/* ---------- state & UI ---------- */";
var html=fs.readFileSync(path.join(__dirname,"preflop-ranges.html"),"utf8");
var src=html.split("<script>")[1].split("</script>")[0];
if(src.indexOf(MARK)<0){ console.error("Marker not found: "+MARK); process.exit(2); }
src=src.split(MARK)[0].replace("(function(){","");
var TABLES=["RFI","HU","HUDEF","VR100","VAL","BLUFF","CALL20","CALL10","PREMIUM","LIVEADD","EXTRA","LIMP","ISO3","SPEC"];
var M=new Function(src+"\nreturn {tok:tok,parse:parse,combos:combos,R:R,P:P,buildRFI:buildRFI,buildVS:buildVS,buildLIMP:buildLIMP,tables:{"+TABLES.map(function(t){return t+":"+t;}).join(",")+"}};")();

var failures=[];
function fail(kind,msg){ failures.push(kind+": "+msg); }

/* 1. every token parses */
(function walk(o,where){
  if(typeof o==="string") o.split(/[,\s]+/).filter(Boolean).forEach(function(t){ if(!M.tok(t).length) fail("bad token",where+" -> \""+t+"\""); });
  else if(o&&typeof o==="object") Object.keys(o).forEach(function(k){ walk(o[k],where+"."+k); });
})(M.tables,"tables");

/* 2. first-in ranges widen from UTG to the button */
Object.keys(M.tables.RFI).forEach(function(tier){
  var prev=null;
  M.P.slice(0,7).forEach(function(seat){
    var cur=M.parse(M.tables.RFI[tier][seat]);
    if(prev) prev.forEach(function(h){ if(!cur.has(h)) fail("first in",tier+"bb "+seat+" drops "+h+" that the seat before opens"); });
    prev=cur;
  });
});

/* 3. no stronger hand does less than a weaker one of the same shape */
var R=M.R, PASSIVE={Fold:1,Check:1};
function holes(map){
  var out=[],i,j,k,k2,hi,h,w,pairs=R.split("").map(function(c){return c+c;});
  for(i=0;i<13;i++){ if(!PASSIVE[map[pairs[i]]]) continue;
    for(j=i+1;j<13;j++) if(!PASSIVE[map[pairs[j]]]){ out.push(pairs[i]+" "+map[pairs[i]]+" but "+pairs[j]+" "+map[pairs[j]]); break; } }
  ["s","o"].forEach(function(suf){
    for(hi=0;hi<12;hi++) for(k=hi+1;k<13;k++){
      h=R[hi]+R[k]+suf; if(!PASSIVE[map[h]]) continue;
      for(k2=k+1;k2<13;k2++){
        w=R[hi]+R[k2]+suf;
        if(map[w]!=="Call"&&map[w]!=="Limp") continue;
        if(suf==="s"&&R[hi]==="A"&&"5432".indexOf(R[k2])>=0) break; /* wheel aces, allowed */
        out.push(h+" "+map[h]+" but "+w+" "+map[w]); break;
      }
    }
  });
  return out;
}
var NAMES=M.P, TIERS=["100","50","30","20","10","sub10"], SIZES=["2","2.5","3","4"], count=0;
function check(desc,map){ count++; holes(map).forEach(function(x){ fail("hole",desc+": "+x); }); }
[false,true].forEach(function(live){ var mode=live?"live":"gto";
  TIERS.forEach(function(t){
    var hero,r,c,l;
    for(hero=0;hero<=7;hero++) check("first in "+mode+" "+t+"bb "+NAMES[hero],M.buildRFI(t,hero,live,9).map);
    check("first in heads up "+mode+" "+t+"bb",M.buildRFI(t,7,live,2).map);
    for(hero=1;hero<=8;hero++) for(r=0;r<hero;r++) SIZES.forEach(function(size){
      for(c=0;c<=Math.min(2,hero-r-1);c++) check("vs raise "+mode+" "+t+"bb "+NAMES[hero]+" vs "+NAMES[r]+" "+size+"x, "+c+" callers",M.buildVS(t,hero,r,size,c,live,9).map);
    });
    SIZES.forEach(function(size){ check("vs raise heads up "+mode+" "+t+"bb "+size+"x",M.buildVS(t,8,7,size,0,live,2).map); });
    for(hero=1;hero<=8;hero++) for(l=1;l<=Math.min(3,hero);l++) check("vs limp "+mode+" "+t+"bb "+NAMES[hero]+", "+l+" limpers",M.buildLIMP(t,hero,l,live,9).map);
    check("vs limp heads up "+mode+" "+t+"bb",M.buildLIMP(t,8,1,live,2).map);
  });
});

if(failures.length){
  console.log(failures.slice(0,40).join("\n"));
  if(failures.length>40) console.log("... and "+(failures.length-40)+" more");
  console.log("\nFAILED: "+failures.length+" problem(s) across "+count+" scenarios");
  process.exit(1);
}
console.log("OK: "+count+" scenarios, all tokens parse, first-in ranges widen by seat, no holes");
