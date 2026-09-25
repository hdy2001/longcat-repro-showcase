const fs = require('fs');
function convert(src) {
  const i = src.lastIndexOf('export{');
  const j = src.indexOf('};', i);
  if (i < 0 || j < 0) throw new Error('no export found');
  const body = src.slice(i + 8, j).replace(/(\w+) as (\w+)/g, '$2: $1');
  return src.slice(0, i) + 'mod.exports={' + body + '};' + src.slice(j + 2);
}
(async () => {
  let src = fs.readFileSync(__dirname + '/../libs/rapier3d-compat.js', 'utf8');
  const wasm = fs.readFileSync(__dirname + '/../libs/rapier_wasm3d_bg.wasm').toString('base64');
  src = src.replace('void 0===I&&(I=new URL("rapier_wasm3d_bg.wasm","<deleted>"))',
    'void 0===I&&(I="data:application/wasm;base64,' + wasm + '")');
  const mod = { exports: {} };
  new Function('mod', convert(src))(mod);
  const RAPIER = mod.exports;
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const gb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50), gb);
  const ray = new RAPIER.Ray({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 });
  const hit = world.castRayAndGetNormal(ray, 100, true, undefined, undefined, undefined);
  console.log('hit:', hit ? ('toi=' + hit.timeOfImpact + ' normal=' + JSON.stringify(hit.normal) + ' colHandle=' + hit.collider.handle) : 'null');
  const cc = world.createCharacterController(0.01);
  cc.enableAutostep(0.4, 0.2, true);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0));
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.35), body);
  cc.computeColliderMovement(col, { x: 0.1, y: -0.01, z: 0 });
  const mv = cc.computedMovement();
  console.log('char move ok:', JSON.stringify(mv), 'grounded:', cc.computedGrounded());
  console.log('World ok, version:', RAPIER.version());
  console.log('KinematicCharacterController:', !!RAPIER.KinematicCharacterController);
  // stairs autostep test: 5 steps of 0.18
  let x = 0, y = 0;
  for (let s = 0; s < 5; s++) {
    const sb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x - s * 1.0 + 0.5, y + 0.09, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.09, 2), sb);
  }
  const body2 = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.75, 0));
  const col2 = world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.35), body2);
  cc.computeColliderMovement(col2, { x: 2.0, y: 0, z: 0 });
  console.log('stairs climb:', JSON.stringify(cc.computedMovement()), 'grounded:', cc.computedGrounded());
})().catch(e => { console.error('FAIL', e); process.exit(1); });
