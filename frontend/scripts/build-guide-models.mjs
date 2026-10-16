import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlbAuthor } from './lib/write-glb.mjs';
import { loftShell, sweepTube, contourPanel, ovalOutline, transformArt, mergeArt, roundedPath } from '../src/art/ArtGeometry.ts';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/assets/models/guides-v2'); fs.mkdirSync(output, { recursive: true });
const names = { classroom: 'Luma', space: 'Nova', museum: 'Mica' };
const manifest = [];
for (const theme of ['classroom', 'space', 'museum']) for (const quality of ['low', 'balanced', 'high']) {
  const a = new GlbAuthor(), sides = quality === 'low' ? 16 : quality === 'high' ? 40 : 28;
  const palette = theme === 'classroom' ? ['#388b79', '#e8b75c', '#f4eee0'] : theme === 'space' ? ['#2399a9', '#e99049', '#dce6e5'] : ['#77629d', '#bca06a', '#f0e9da'];
  const [suit, accent, ceramic] = [a.material('enamel', palette[0], .46, .18), a.material('anodized-trim', palette[1], .4, .32), a.material('ceramic-shell', palette[2], .55, .04)];
  const dark = a.material('joint-rubber', '#253644', .74, .08), face = a.material('inset-display', '#122d3b', .6, .1, true), light = a.material('display-light', '#e1f5ed', .5, 0, true), iris = a.material('iris', '#62cdb5', .5, 0, true), blush = a.material('warm-detail', '#d98b74', .5, 0, true);
  const rig = a.node(names[theme]), torso = a.node('torso', rig), head = a.node('head', torso, [0, 1.27, 0]);
  const panel = (name, parent, x, y, z, width, height, depth, material, exponent = 3.3) => a.add(name, transformArt(contourPanel(ovalOutline(width, height, exponent, sides), depth, Math.min(.018, depth / 4)), [x, y, z]), material, parent);
  const shell = (name, parent, profile, material) => a.add(name, loftShell(profile, sides), material, parent);
  const tube = (name, parent, points, radius, material, flatten = 1) => a.add(name, sweepTube(points, radius, quality === 'low' ? 6 : 10, flatten), material, parent);
  // Tailored body panels: a lower skirt, recessed waist and widening shoulders, not an ellipsoid.
  shell('torso-enamel', torso, [[.49,.19,.13],[.52,.235,.16],[.66,.255,.19],[.86,.29,.2],[1.01,.33,.17],[1.09,.29,.14],[1.12,.2,.12]], suit);
  shell('lower-shell', torso, [[.48,.18,.13],[.5,.24,.165],[.55,.245,.17],[.57,.235,.16]], ceramic);
  shell('neck-collar', torso, [[1.1,.16,.115],[1.13,.18,.13],[1.18,.16,.115],[1.19,.12,.1]], dark);
  shell('collar-lip', torso, [[1.17,.17,.125],[1.19,.175,.13],[1.205,.16,.12]], accent);
  const chestOutline = [[-.17,-.13],[.16,-.13],[.2,-.07],[.18,.1],[.1,.15],[-.13,.14],[-.19,.05]];
  a.add('chest-inlay', transformArt(contourPanel(chestOutline,.035,.008),[0,.86,-.202]),ceramic,torso);
  panel('chest-screen',torso,0,.9,-.226,.22,.1,.009,face);
  for (let i=0;i<3;i++) panel(`charge-${i}`,torso,-.067+i*.067,.9,-.233,.047,.025,.006,iris);
  const ribParts = [];
  for (let i=0;i<4;i++) ribParts.push(transformArt(contourPanel(ovalOutline(.13,.012,3,12),.013,.003),[.11,.77-i*.028,-.205]));
  a.add('ventilation-slats',mergeArt(ribParts),dark,torso);
  for (const side of [-1,1]) {
    tube(`side-seam-${side}`,torso,[[side*.21,.58,-.135],[side*.255,.75,-.15],[side*.29,.98,-.11]],.011,accent);
  }
  // Sculpted, layered shell with recessed visor, bevel lip and cheek breaks.
  const headWidth = theme === 'space' ? .455 : theme === 'museum' ? .39 : .41;
  shell('head-hull',head,[[-.20,.23,.17],[-.16,.34,.235],[-.05,headWidth,.255],[.17,headWidth,.255],[.32,headWidth*.87,.22],[.39,.28,.16],[.405,.16,.11]],ceramic);
  panel('visor-gasket',head,0,.09,-.242,headWidth*1.93,.46,.046,dark,theme === 'space'?4:3);
  panel('visor-rim',head,0,.09,-.267,headWidth*1.85,.43,.027,accent);
  panel('face-display',head,0,.09,-.285,headWidth*1.73,.385,.023,face);
  for (const side of [-1,1]) {
    const eyeNode = a.node(`eye-${side}`,head,[side*.15,.13,-.303]);
    panel(`eye-white-${side}`,eyeNode,0,0,0,.145,.14,.01,light,2.7);
    panel(`pupil-${side}`,eyeNode,.012,0,-.009,.068,.085,.007,iris,2.5);
    panel(`pupil-core-${side}`,eyeNode,.014,-.002,-.014,.032,.051,.004,face,2);
    panel(`eye-glint-${side}`,eyeNode,-.009,.022,-.017,.019,.019,.003,light,2);
    tube(`brow-${side}`,head,[[side*.215,.25,-.304],[side*.15,.269,-.307],[side*.09,.253,-.305]],.012,light);
    panel(`cheek-${side}`,head,side*.25,-.002,-.302,.055,.018,.004,blush,2);
    const ear = loftShell([[-.08,.072,.075],[-.06,.09,.085],[.08,.09,.085],[.1,.07,.07]],sides/2);
    a.add(`ear-housing-${side}`,transformArt(ear,[side*(headWidth+.012),.08,.015]),suit,head);
    panel(`ear-indicator-${side}`,head,side*(headWidth+.01),.09,-.08,.055,.06,.02,accent);
  }
  const mouthBase=contourPanel(ovalOutline(.15,.017,2,24),.008,.001),mouthOpen=contourPanel(ovalOutline(.13,.095,2,24),.008,.001);
  const mouthRound=contourPanel(ovalOutline(.08,.083,2,24),.008,.001),mouthWide=contourPanel(ovalOutline(.2,.052,2.5,24),.008,.001);
  const mouthNode=a.node('mouth-pivot',head,[0,-.045,-.306]);a.add('mouth',mouthBase,light,mouthNode,[mouthOpen,mouthRound,mouthWide]);
  const shoulders=[];
  for (const side of [-1,1]) {
    const shoulder=a.node(side<0?'leftArm':'rightArm',torso,[side*.35,1.025,0]); shoulders.push(shoulder);
    shell(`shoulder-bearing-${side}`,shoulder,[[-.08,.105,.105],[0,.12,.115],[.045,.1,.1]],dark);
    shell(`shoulder-cap-${side}`,shoulder,[[-.06,.11,.11],[.015,.125,.12],[.075,.09,.09]],accent);
    shell(`upper-arm-${side}`,shoulder,[[-.25,.065,.065],[-.21,.08,.075],[-.08,.09,.08],[-.04,.085,.075]],suit);
    panel(`arm-inlay-${side}`,shoulder,0,-.14,-.082,.075,.125,.018,ceramic);
    const elbow=a.node(side<0?'leftForearm':'rightForearm',shoulder,[0,-.27,0]);
    shell(`elbow-${side}`,elbow,[[-.045,.074,.074],[.015,.08,.08],[.04,.064,.064]],dark);
    shell(`forearm-shell-${side}`,elbow,[[-.24,.068,.066],[-.22,.095,.086],[-.1,.091,.083],[-.05,.073,.065]],ceramic);
    panel(`forearm-enamel-${side}`,elbow,0,-.14,-.086,.11,.13,.025,suit);
    shell(`wrist-${side}`,elbow,[[-.275,.059,.055],[-.235,.065,.06]],dark);
    const hand=a.node(`hand-${side}`,elbow,[0,-.3,0]);
    panel(`palm-${side}`,hand,0,-.015,-.008,.14,.13,.08,accent);
    const fingers=[];
    for(let f=0;f<3;f++){const x=-.046+f*.046; fingers.push(sweepTube([[x,-.06,-.005],[x,-.103,-.015],[x,-.117,-.038]],.018,8));}
    fingers.push(sweepTube([[side*.068,.01,-.012],[side*.103,-.022,-.035],[side*.094,-.063,-.05]],.022,8));
    a.add(`articulated-fingers-${side}`,mergeArt(fingers),ceramic,hand);
    const hip=a.node(`hip-${side}`,torso,[side*.135,.5,0]);
    shell(`hip-bearing-${side}`,hip,[[-.06,.077,.08],[.015,.085,.09]],dark);
    shell(`leg-armor-${side}`,hip,[[-.28,.079,.074],[-.23,.091,.08],[-.09,.082,.076]],ceramic);
    panel(`knee-cap-${side}`,hip,0,-.19,-.08,.1,.1,.03,accent);
    shell(`ankle-${side}`,hip,[[-.35,.061,.062],[-.27,.064,.065]],dark);
    const shoe=loftShell([[.025,.108,.157,0,-.035,3],[.05,.13,.19,0,-.055,3],[.12,.13,.18,0,-.04,3],[.16,.094,.12,0,.005,3]],sides);
    a.add(`boot-${side}`,transformArt(shoe,[side*.135,0,0]),suit,torso);
    panel(`boot-toe-${side}`,torso,side*.135,.09,-.224,.14,.04,.02,ceramic);
  }
  if(theme==='classroom'){
    const ribbon=[[-.04,-.13],[.08,-.16],[.1,.13],[-.06,.16]];
    a.add('scarf-ribbon',transformArt(contourPanel(ribbon,.035,.006),[.19,1.03,-.18]),accent,torso);
    tube('education-headband',head,roundedPath(.66,.27,.11,-.02,5).map(([x,y,z])=>[x,y+.28,z]),.025,suit);
    panel('book-cover',torso,-.24,.7,.21,.27,.34,.07,accent);
    for(let i=0;i<3;i++)panel(`book-pages-${i}`,torso,-.24,.61+i*.08,.251,.2,.018,.008,ceramic);
  }else if(theme==='space'){
    tube('helmet-frame',head,roundedPath(.88,.65,.21,-.17,8).map(([x,y,z])=>[x,y+.09,z]),.027,suit);
    panel('mission-crest',head,0,.36,-.185,.22,.055,.022,accent);
    shell('mission-backpack',torso,[[.61,.19,.08,0,.23],[.66,.22,.12,0,.25],[.98,.2,.1,0,.23],[1.03,.14,.08,0,.22]],dark);
    for(const side of [-1,1]){tube(`aerial-${side}`,head,[[side*.29,.37,.06],[side*.31,.55,.07],[side*.35,.57,.07]],.015,accent);panel(`aerial-tip-${side}`,head,side*.35,.57,.06,.052,.043,.045,iris);}
  }else{
    shell('explorer-hat-brim',head,[[.34,.35,.22],[.36,.51,.32],[.395,.52,.33],[.41,.37,.23]],accent);
    shell('explorer-hat-crown',head,[[.4,.34,.21],[.51,.31,.19],[.56,.22,.15],[.565,.12,.09]],accent);
    shell('hat-band',head,[[.412,.343,.215],[.454,.33,.207]],suit);
    panel('museum-satchel',torso,.28,.64,-.04,.22,.29,.16,accent);
    tube('satchel-strap',torso,[[-.2,1.07,-.14],[0,.86,-.22],[.24,.63,-.13]],.022,accent,.5);
    panel('satchel-clasp',torso,.28,.68,-.127,.07,.055,.018,ceramic);
  }
  a.clip('Idle',[{node:head,poses:[[0,0,-.03,0],[.5,0,.03,.02],[1,0,-.03,0]]}],4);
  a.clip('Greeting',[{node:shoulders[1],poses:[[0,0,0,.1],[.25,-.1,0,2.2],[.55,-.1,.1,2.4],[.8,-.1,-.1,2.2],[1,0,0,.1]]}],2.4);
  a.clip('Pointing',[{node:shoulders[0],poses:[[0,0,0,-.1],[.4,-.15,0,-1.12],[.8,-.15,0,-1.12],[1,0,0,-.1]]}],2.5);
  a.json.extras={character:names[theme],theme,quality,rig:'articulated glTF node hierarchy; no skin or motion capture',source:'scripts/build-guide-models.mjs'};
  const filename=`${theme}-${quality}.glb`;a.write(path.join(output,filename));
  manifest.push({file:filename,bytes:fs.statSync(path.join(output,filename)).size,vertices:a.json.meshes.reduce((sum,mesh)=>sum+a.json.accessors[mesh.primitives[0].attributes.POSITION].count,0),triangles:a.json.meshes.reduce((sum,mesh)=>sum+a.json.accessors[mesh.primitives[0].indices].count/3,0),meshes:a.json.meshes.length,clips:a.json.animations.map(clip=>clip.name)});
}
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({version:'original-guides-v2',models:manifest},null,2));
console.log(manifest.map(item=>`${item.file}: ${(item.bytes/1024).toFixed(0)} KiB, ${item.meshes} mesh parts`).join('\n'));
