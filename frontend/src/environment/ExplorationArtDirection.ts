import { Color3, DynamicTexture, Mesh, PBRMaterial, ShadowGenerator, StandardMaterial, Texture, TransformNode, VertexData } from '@babylonjs/core';
import type { Material, Observer, Scene } from '@babylonjs/core';
import { contourPanel, finishArt, loftShell, mergeArt, ovalOutline, roundedPath, sweepTube, transformArt } from '../art/ArtGeometry';
import type { ArtMeshData, Point3 } from '../art/ArtGeometry';
import type { WorldTheme } from '../ui/ScenarioPresentation';
import type { GuideQuality } from '../guides/GuideSceneConfiguration';

/** Art-directed, reversible geometry. Owns every new resource; never modifies a trial anchor. */
export class ExplorationArtDirection {
  private readonly root: TransformNode;
  private readonly hidden = new Map<Mesh, boolean>();
  private readonly replacedMaterials = new Map<Mesh, Material | null>();
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly batches = new Map<Material, ArtMeshData[]>();
  private readonly meshes: Mesh[] = [];
  private readonly generators: ShadowGenerator[];
  private observer: Observer<Scene> | null = null;
  private disposed = false;
  private readonly scene: Scene;
  private readonly sides: number;
  private readonly texturesEnabled: boolean;

  constructor(scene: Scene, theme: WorldTheme, quality: GuideQuality) {
    this.scene = scene; this.sides = quality === 'low' ? 16 : quality === 'high' ? 40 : 28; this.texturesEnabled=quality!=='low';
    this.root = new TransformNode(`exploration-art-v2-${theme}`, scene);
    this.generators = scene.lights.map(light => light.getShadowGenerator()).filter((generator): generator is ShadowGenerator => generator instanceof ShadowGenerator);
    if (theme === 'classroom') this.classroom(); else if (theme === 'space') this.space(); else this.museum();
    this.floor(theme);
    if(theme === 'space' && this.texturesEnabled) this.planetMaterials();
    this.batches.forEach((parts, material) => this.mesh(`artV2-${theme}-${material.name}`, mergeArt(parts), material));
    this.batches.clear();
  }
  private material(name: string, hex: string, roughness = .65, metallic = 0): PBRMaterial {
    const material = new PBRMaterial(`art-${name}`, this.scene);
    material.albedoColor = Color3.FromHexString(hex).toLinearSpace(); material.roughness = roughness; material.metallic = metallic;
    material.environmentIntensity = .45; material.maxSimultaneousLights = 4;
    const detailName = /oak|wood/.test(name) ? 'original-wood-micro-normal' : /station|brass/.test(name) ? 'original-brushed-micro-normal' : 'original-plaster-micro-normal';
    material.bumpTexture = this.scene.textures.find(texture=>texture.name===detailName) ?? null;
    this.materials.push(material); return material;
  }
  private mesh(name: string, data: ArtMeshData, material: Material, dynamic = false): Mesh {
    const mesh = new Mesh(name, this.scene), vertices = new VertexData();
    vertices.positions = data.positions; vertices.normals = data.normals; vertices.uvs = data.uvs; vertices.indices = data.indices; vertices.applyToMesh(mesh);
    mesh.parent = this.root; mesh.material = material; mesh.isPickable = false; mesh.checkCollisions = false; mesh.receiveShadows = true;
    mesh.metadata = { role: 'exploration-art-v2', ignoreSightline: true, dynamic };
    if (!dynamic) mesh.freezeWorldMatrix();
    if (!material.name.includes('floor-finish') && material.name !== 'art-contact-AO') this.generators.forEach(generator => generator.addShadowCaster(mesh));
    this.meshes.push(mesh); return mesh;
  }
  private add(data: ArtMeshData, material: Material, position: Point3 = [0,0,0], rotationY = 0): void {
    const transformed = transformArt(data, position);
    if (rotationY) for (let i = 0; i < transformed.positions.length; i += 3) {
      const x = transformed.positions[i]! - position[0], z = transformed.positions[i + 2]! - position[2];
      transformed.positions[i] = x * Math.cos(rotationY) + z * Math.sin(rotationY) + position[0];
      transformed.positions[i + 2] = z * Math.cos(rotationY) - x * Math.sin(rotationY) + position[2];
    }
    const parts = this.batches.get(material) ?? []; parts.push(finishArt(transformed.positions, transformed.indices, transformed.uvs)); this.batches.set(material, parts);
  }
  private hide(pattern: RegExp): void {
    this.scene.meshes.slice().forEach(mesh => { if (mesh instanceof Mesh && pattern.test(mesh.name)) { this.hidden.set(mesh, mesh.isVisible); mesh.isVisible = false; } });
  }
  private panel(width: number, height: number, depth: number, material: Material, position: Point3, rotationY = 0): void {
    this.add(contourPanel(ovalOutline(width, height, 5, this.sides), depth, Math.min(.05, depth / 4)), material, position, rotationY);
  }
  private line(points: Point3[], radius: number, material: Material): void { this.add(sweepTube(points, radius, 8), material); }
  private label(text: string, subtitle: string, width: number, height: number, position: Point3, accent: string, rotationY = 0): void {
    if(!this.texturesEnabled)return;
    const texture = new DynamicTexture(`art-label-${text}`, { width: 768, height: 192 }, this.scene, true);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.fillStyle = '#f4efe1'; context.fillRect(0,0,768,192); context.fillStyle = accent;
    context.fillRect(0,0,13,192); context.font = 'bold 46px Trebuchet MS'; context.textAlign = 'center'; context.fillText(text,384,83);
    context.fillStyle = '#475c5c'; context.font = '24px Trebuchet MS'; context.fillText(subtitle,384,132); texture.update();
    const material = new PBRMaterial(`art-label-${text}`, this.scene); material.albedoTexture = texture; material.unlit = true; material.roughness = 1;
    this.materials.push(material); this.textures.push(texture); this.panel(width,height,.025,material,position,rotationY);
  }
  private contactShadows(positions: Point3[], sx = 1, sz = .7): void {
    if(!this.texturesEnabled)return;
    const texture = new DynamicTexture('art-baked-contact',128,this.scene,false), context = texture.getContext() as unknown as CanvasRenderingContext2D;
    context.clearRect(0,0,128,128); const gradient = context.createRadialGradient(64,64,3,64,64,62);
    gradient.addColorStop(0,'rgba(12,25,30,.22)'); gradient.addColorStop(.35,'rgba(12,25,30,.13)'); gradient.addColorStop(1,'rgba(12,25,30,0)'); context.fillStyle = gradient; context.fillRect(0,0,128,128); texture.hasAlpha = true; texture.update();
    const material = new StandardMaterial('art-contact-AO',this.scene); material.diffuseTexture = texture; material.useAlphaFromDiffuseTexture = true; material.disableLighting = true; material.emissiveColor = Color3.White(); material.backFaceCulling = false;
    this.materials.push(material); this.textures.push(texture);
    for (const [x,,z] of positions) this.add(finishArt([-sx,.026,-sz,sx,.026,-sz,sx,.026,sz,-sx,.026,sz],[0,1,2,0,2,3],[0,0,1,0,1,1,0,1]),material,[x,0,z]);
  }
  private floor(theme: WorldTheme): void {
    const material=this.material('floor-finish',theme==='classroom'?'#c4b398':theme==='space'?'#3e5662':'#b9b5a7',theme==='space'?.56:.76,theme==='space'?.28:0);
    if(this.texturesEnabled){
    const texture=new DynamicTexture('art-floor-detail',256,this.scene,true),context=texture.getContext() as unknown as CanvasRenderingContext2D;
    const image=context.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const seam=theme==='classroom'?(y%64<2?-.14:0):theme==='space'?(x<3||y<3?-.15:0):0;
      const grain=theme==='classroom'?Math.sin(y*.85+Math.sin(x*.04)*1.8)*.025:Math.sin(x*1.9+y*2.7)*.012;
      const value=Math.round((.95+grain+seam)*255),offset=(y*256+x)*4;image.data.set([value,value,value,255],offset);
    }
    context.putImageData(image,0,0);texture.update();texture.uScale=theme==='classroom'?5:4;texture.vScale=theme==='classroom'?5:5;material.albedoTexture=texture;this.textures.push(texture);
    }
    const width=theme==='classroom'?17.6:theme==='space'?11.6:14.6,depth=theme==='classroom'?15.6:13.6,z=theme==='classroom'?-2:theme==='space'?-.7:-1;
    this.add(finishArt([-width/2,.021,-depth/2,width/2,.021,-depth/2,width/2,.021,depth/2,-width/2,.021,depth/2],[0,1,2,0,2,3],[0,0,1,0,1,1,0,1]),material,[0,0,z]);
    this.hide(theme==='classroom'?/^(floorJoint|classroomFloorJoint)/:theme==='space'?/^spaceFloor(RaisedPanel|CrossLine|LongLine)/:/^museumSubtleFloorJoint/);
  }
  private planetMaterials(): void {
    this.scene.meshes.filter(mesh=>mesh instanceof Mesh&&mesh.metadata?.role==='space-planet').forEach((abstractMesh,index)=>{
      const mesh=abstractMesh as Mesh,texture=new DynamicTexture(`art-planet-surface-${index}`,{width:512,height:256},this.scene,true),context=texture.getContext() as unknown as CanvasRenderingContext2D;
      const image=context.createImageData(512,256);
      const gas=index%3===1;
      for(let y=0;y<256;y++)for(let x=0;x<512;x++){
        const longitude=x/512*Math.PI*2,latitude=y/256*Math.PI,px=Math.cos(longitude)*Math.sin(latitude),py=Math.cos(latitude),pz=Math.sin(longitude)*Math.sin(latitude);
        const noise=Math.sin(px*6+Math.sin(pz*4))*Math.cos(py*5+pz*2)+.35*Math.sin(px*17+py*13+pz*9)+.16*Math.sin(px*39-pz*27+py*23);
        let color:number[];
        if(gas){const band=Math.sin(py*31+noise*.6)*.13+Math.sin(py*11)*.1;color=[166+band*100,120+band*100,83+band*90];}
        else if(Math.abs(py)>.91+noise*.04)color=[210,224,213];
        else if(noise>.1)color=[91+noise*20,135+noise*18,107+noise*10];
        else color=[31+noise*5,91+noise*12,127+noise*9];
        const cloud=Math.max(0,Math.sin(px*10+py*13+Math.sin(pz*8))-.75)*.28;
        const offset=(y*512+x)*4;image.data.set([...color.map(value=>Math.round(value*(1-cloud)+235*cloud)),255],offset);
      }
      context.putImageData(image,0,0);texture.update();texture.wrapU=Texture.WRAP_ADDRESSMODE;texture.wrapV=Texture.CLAMP_ADDRESSMODE;
      const material=this.material(`planet-${index}`,'#ffffff',.85);material.albedoTexture=texture;material.emissiveColor=new Color3(.015,.025,.035);material.environmentIntensity=.16;
      this.textures.push(texture);this.replacedMaterials.set(mesh,mesh.material);mesh.material=material;
    });
  }
  private classroom(): void {
    const wood = this.material('oak','#be9967',.66), edge = this.material('wood-edge','#816443',.7), metal = this.material('ivory-frame','#d7ded7',.48,.32), dark = this.material('rubber','#364e50',.86);
    const colors = ['#54968b','#bd7f63','#6d88a8','#9985ad'].map((color,i)=>this.material(`chair-${i}`,color,.68));
    const desks: [number,number,number][] = [[-3.1,1.45,.045],[3.1,1.55,-.018],[-3.45,-.75,-.035],[3.45,-.72,.024],[-3.55,-2.9,.032],[3.55,-2.85,-.028],[-3.25,-5.05,-.032],[3.25,-5,.04]];
    this.hide(/^studentChair\d+(Seat|Back|BackAccent|Leg\d)$/);
    this.hide(/^studentDesk\d+(Top|FrontPanel|BookTray|Leg\d)$/);
    desks.forEach(([x,z,rotation], index) => {
      const desktop = transformArt(contourPanel(ovalOutline(1.85,1.06,5,40),.11,.024),[0,.77,0],[1,1,1],Math.PI/2);
      this.add(desktop,wood,[x,0,z],rotation);
      this.add(transformArt(contourPanel(ovalOutline(1.82,1.03,5,40),.025,.005),[0,.715,0],[1,1,1],Math.PI/2),edge,[x,0,z],rotation);
      for(const side of [-1,1]) {
        this.add(sweepTube([[side*.73,.05,-.4],[side*.73,.07,.4],[side*.73,.6,.36],[side*.73,.7,.27]],.044,10),metal,[x,0,z],rotation);
        this.add(sweepTube([[side*.72,.66,-.3],[side*.72,.68,.3]],.04,10),metal,[x,0,z],rotation);
        this.add(sweepTube([[side*.7,.045,-.39],[side*.7,.045,-.16]],.055,8),dark,[x,0,z],rotation);
      }
      const seat = chairScoop(); this.add(seat,colors[index%colors.length]!,[x,0,z-.88],rotation);
      for(const side of [-1,1])this.add(sweepTube([[side*.34,.035,-.34],[side*.34,.035,.24],[side*.34,.07,.3],[side*.34,.41,.18],[side*.34,.45,-.25],[side*.34,.84,-.42]],.035,10),metal,[x,0,z-.88],rotation);
      const seams = roundedPath(1.71,.94,.17,0,5).map(([px,py])=>[px,.83,py] as Point3); this.add(sweepTube(seams,.008,6),edge,[x,0,z],rotation);
    });
    this.contactShadows(desks.map(([x,z])=>[x,0,z]),1.2,.85);
    // Acoustic ceiling rafts and curved pendants instead of more flat square lights.
    const felt = this.material('acoustic-felt','#d4cead',.95), green = this.material('wall-millwork','#347b70',.74);
    for(const z of [-5.8,-1,3.4]) {
      this.add(transformArt(contourPanel(ovalOutline(12,1.8,6,48),.09,.02),[0,4.65,z],[1,1,1],Math.PI/2),felt);
      for(const x of [-4.2,4.2]) {
        const points = Array.from({length:41},(_,i)=>[x+Math.cos(i/40*Math.PI*2)*.65,4.27,z+Math.sin(i/40*Math.PI*2)*.38] as Point3);
        this.line(points,.042,metal);
      }
    }
    // Architectural board surround, fluted lower wall and window blinds remain outside task time.
    this.line(roundedPath(10.4,3.7,.5,5.59,10).map(([x,y,z])=>[x,y+2.5,z]),.07,green);
    for(let x=-8.1;x<8.5;x+=.2)this.panel(.065,1.05,.045,wood,[x,.58,5.83]);
    for(const x of [-8.74])for(const z of [-6,-2,2]) {
      for(let slat=0;slat<5;slat++)this.line([[x,3.7+slat*.1,z-1],[x,3.7+slat*.1,z+1]],.027,metal);
    }
    this.label('AULA DE DESCUBRIMIENTOS','Imagina · Aprende · Descubre',5.8,.52,[0,4.6,5.52],'#287969');
    // Detailed backpacks: shaped body, zipper piping, handle and shoulder straps.
    ([[-6.95,0,-7.62],[.26,0,-8],[6.88,0,-7.42]] as Point3[]).forEach((position,index)=>{
      this.hide(new RegExp(`^${['backLeftBackpack','backMiddleBackpack','backRightBackpack'][index]}`));
      this.add(loftShell([[.04,.15,.08],[.08,.24,.14],[.42,.245,.14],[.6,.19,.12],[.65,.1,.07]],24),colors[index]!,position);
      this.panel(.3,.25,.065,wood,[position[0]!,.27,position[2]!-.15]);
      this.line([[position[0]!-.08,.59,position[2]!],[position[0]!-.07,.75,position[2]!],[position[0]!+.07,.75,position[2]!],[position[0]!+.08,.59,position[2]!]],.022,edge);
    });
  }
  private space(): void {
    const shell = this.material('station-ceramic','#8fa9b3',.63,.18), graphite = this.material('station-graphite','#203a4a',.6,.46), orange = this.material('station-orange','#d98543',.55,.25), teal = this.material('station-teal','#359ca1',.48,.32), silver = this.material('station-silver','#bccdcc',.44,.52);
    const glow = this.material('station-light','#8de0d2',.6); glow.emissiveColor=Color3.FromHexString('#57a798').scale(.35);
    this.hide(/^(ceilingLongBeam|ceilingCrossBeam|leftWallVerticalRib|rightWallVerticalRib|frontWallSupportColumn|backWallSupportColumn)/);
    for(const z of [-4.6,-.4,3.8]) {
      const path: Point3[]=[[-5.45,.12,z],[-5.45,2.95,z]];
      for(let i=0;i<=10;i++){const a=Math.PI-i/10*Math.PI/2;path.push([-4.55+Math.cos(a)*.9,2.95+Math.sin(a)*.9,z]);}
      path.push([4.55,3.85,z]);
      for(let i=0;i<=10;i++){const a=Math.PI/2-i/10*Math.PI/2;path.push([4.55+Math.cos(a)*.9,2.95+Math.sin(a)*.9,z]);}
      path.push([5.45,.12,z]);
      this.line(path,.18,graphite); this.line(path.map(([x,y,pz])=>[x,y,pz-.15]),.045,orange);
      for(const side of [-1,1])this.panel(.5,.65,.13,teal,[side*5.35,2.6,z-.1]);
      this.line([[-3.8,3.98,z-.2],[3.8,3.98,z-.2]],.035,glow);
    }
    for(const z of [-5,-1.6,2]) {
      this.panel(2.3,2.85,.08,graphite,[5.84,1.8,z],Math.PI/2);
      this.panel(1.95,2.53,.11,shell,[5.75,1.8,z],Math.PI/2);
      for(let i=0;i<5;i++)this.panel(.12,.54,.08,graphite,[5.67,1.01+i*.14,z-.5],Math.PI/2);
      this.line([[5.62,.22,z+.84],[5.62,2.9,z+.84],[5.25,3.27,z+.84]],.065,teal);
    }
    this.hide(/^cptConsole(Body|BackModule|Top)$/);
    this.add(loftShell([[.17,1.85,.42,0,1.05,5],[.28,2,.55,0,1.05,5],[.85,2.22,.6,0,1.05,5],[1,2.3,.68,0,1.05,5]],40),graphite);
    this.add(loftShell([[.96,2.24,.65,0,1.05,5],[1.02,2.34,.73,0,1.05,5],[1.08,2.25,.68,0,1.05,5]],40),silver);
    this.line([[-1.9,.68,.43],[-.7,.68,.36],[.7,.68,.36],[1.9,.68,.43]],.034,teal);
    for(const x of [-1.7,1.7])for(let i=0;i<4;i++)this.panel(.28,.035,.02,silver,[x,.35+i*.06,.455]);
    this.line(roundedPath(7,3.5,.55,5.9,10).map(([x,y,z])=>[x,y+2.2,z]),.09,orange);
    this.line(roundedPath(6.72,3.24,.48,5.79,10).map(([x,y,z])=>[x,y+2.2,z]),.035,glow);
    this.label('ESTACIÓN NOVA','Observatorio de pequeños exploradores',3.7,.4,[0,4,5.72],'#30757e');
    // Technical hatch with inset window and radial bolts, inspired by the reference's construction.
    this.panel(1.5,2.3,.12,orange,[4.65,1.55,6.04]); this.panel(1.18,1.96,.09,graphite,[4.65,1.55,5.94]);
    this.panel(.75,.66,.065,teal,[4.65,1.9,5.87]);
    this.line([[4.25,.8,5.87],[4.25,1.3,5.87]],.035,silver);
    // Static holographic orbits: one mesh, no rapid flashes and no trial-time observer.
    const holo = this.material('hologram','#72cfc3',.8); holo.unlit=true; holo.alpha=.42;
    const rings: ArtMeshData[]=[];
    for(let ring=0;ring<6;ring++)rings.push(sweepTube(Array.from({length:49},(_,i)=>{const angle=i/48*Math.PI*2;return [Math.cos(angle)*(.35+ring*.04),1.6+ring*.045,Math.sin(angle)*(.35+ring*.04)] as Point3;}),.007,6));
    this.add(mergeArt(rings),holo,[3.7,0,3.3]);
    this.add(loftShell([[.04,.46,.46],[.1,.56,.56],[.2,.5,.5],[.8,.28,.28],[.9,.49,.49],[.97,.5,.5]],32),teal,[3.7,0,3.3]);
    this.contactShadows([[0,0,1.05],[3.7,0,3.3]],1.4,.85);
  }
  private museum(): void {
    const plaster=this.material('museum-plaster','#dfd2b8',.88), oak=this.material('museum-oak','#a98257',.7), brass=this.material('museum-brass','#b5945b',.5,.5), petrol=this.material('museum-petrol','#285e64',.68), dark=this.material('museum-dark','#354349',.7);
    // Gallery arches, cornices and wainscot establish a designed interior.
    for(const z of [-4.8,1.2]) {
      const arc: Point3[]=[[-6.85,.12,z],[-6.85,2.7,z]];
      for(let i=0;i<=18;i++){const angle=Math.PI-i/18*Math.PI;arc.push([Math.cos(angle)*6.85,2.7+Math.sin(angle)*1.35,z]);}
      arc.push([6.85,.12,z]); this.line(arc,.16,oak);
      this.line(arc.map(([x,y,pz])=>[x,y,pz-.13]),.035,brass);
    }
    this.line([[-7.22,3.85,-7.4],[-7.22,3.85,5.55],[7.22,3.85,5.55],[7.22,3.85,-7.4]],.09,plaster);
    for(const side of [-1,1])for(let z=-6.8;z<5;z+=.24)this.panel(.075,1.1,.05,oak,[side*7.25,.62,z],Math.PI/2);
    this.label('MUSEO DE LAS MARAVILLAS','Observa · Imagina · Descubre',4.8,.43,[0,4.3,5.58],'#8056a4');
    // Relief-bearing plinths wrap the existing exhibits at their original floor positions.
    const plinths=this.scene.meshes.filter(mesh=>/Pedestal$/.test(mesh.name)&&!mesh.name.startsWith('artV2')).slice();
    plinths.forEach(mesh=>{
      mesh.computeWorldMatrix(true); const box=mesh.getBoundingInfo().boundingBox;
      const center=box.centerWorld, half=box.extendSizeWorld, height=Math.max(.35,box.maximumWorld.y);
      this.hidden.set(mesh as Mesh,mesh.isVisible);mesh.isVisible=false;
      this.add(loftShell([[.025,half.x*.96,half.z*.96],[.08,half.x*1.05,half.z*1.05],[.15,half.x,half.z],[height-.1,half.x*.86,half.z*.86],[height-.05,half.x,half.z],[height,half.x*1.02,half.z*1.02]],32),petrol,[center.x,0,center.z]);
      this.add(loftShell([[height-.09,half.x*1.01,half.z*1.01],[height-.055,half.x*1.03,half.z*1.03]],32),brass,[center.x,0,center.z]);
    });
    this.contactShadows(plinths.map(mesh=>[mesh.position.x,0,mesh.position.z]),1.1,.85);
    // Curved optical sculpture, one designed ribbon instead of a stack of spheres.
    this.hide(/^abstractSphereSculpture/);
    const ribbon: ArtMeshData[]=[];
    for(const offset of [-.11,.11])ribbon.push(sweepTube(Array.from({length:97},(_,i)=>{const t=i/96*Math.PI*2;return [Math.sin(t)*.52,1.12+Math.cos(t)*.44,Math.sin(t*2)*.24+offset] as Point3;}),.065,10,.5));
    const original=this.scene.getMeshByName('abstractSpherePedestal');
    if(original)this.add(mergeArt(ribbon),brass,[original.position.x,.3,original.position.z]);
    // Display case corner hardware and gallery lighting fixtures use the same material family.
    for(const side of [-1,1])for(const z of [-4.5,-.5,3.3]){
      this.line([[side*5.7,3.9,z],[side*5.7,4.25,z]],.025,dark);
      this.add(loftShell([[0,.13,.13],[.04,.15,.15],[.25,.12,.12]],24),brass,[side*5.7,3.68,z]);
    }
  }
  dispose(): void {
    if(this.disposed)return;this.disposed=true;
    if(this.observer)this.scene.onBeforeRenderObservable.remove(this.observer);
    this.hidden.forEach((visible,mesh)=>{if(!mesh.isDisposed())mesh.isVisible=visible;});this.hidden.clear();
    this.replacedMaterials.forEach((material,mesh)=>{if(!mesh.isDisposed())mesh.material=material;});this.replacedMaterials.clear();
    this.generators.forEach(generator=>this.meshes.forEach(mesh=>generator.removeShadowCaster(mesh)));
    this.root.dispose(false);this.materials.forEach(material=>material.dispose(false,false));this.textures.forEach(texture=>texture.dispose());
  }
}

/** Continuous molded plywood seat/back with a scooped cross-section and closed thickness. */
function chairScoop(): ArtMeshData {
  const path=[[.34,.48,.45],[.2,.46,.46],[-.18,.46,.45],[-.33,.5,.43],[-.4,.62,.41],[-.44,.86,.43],[-.43,1.12,.45],[-.4,1.28,.42]];
  const positions:number[]=[],indices:number[]=[],uvs:number[]=[];const across=16,rows=path.length;
  for(const layer of [0,1])for(let row=0;row<rows;row++)for(let column=0;column<=across;column++){
    const [z,y,width]=path[row]!,u=column/across*2-1;
    positions.push(u*width!,y!+u*u*.045-layer*.035,z!+layer*.02);uvs.push(column/across,row/(rows-1));
    if(row&&column<across){const a=layer*rows*(across+1)+(row-1)*(across+1)+column,c=a+across+1;if(layer===0)indices.push(a,c,a+1,a+1,c,c+1);else indices.push(a,a+1,c,a+1,c+1,c);}
  }
  const offset=rows*(across+1);for(let row=0;row<rows-1;row++)for(const column of [0,across]){const a=row*(across+1)+column,c=a+across+1;indices.push(a,a+offset,c,c,c+offset,a+offset);}
  return finishArt(positions,indices,uvs);
}
