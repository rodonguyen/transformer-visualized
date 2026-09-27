import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';

export class Stage {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.prepend(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 40);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener('start', () => {
      this.camTween?.kill();
      this.userMoved = true;
    });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3350, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(5, 8, 12);
    this.scene.add(key);

    this.view = null;
    this.userMoved = false;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.view && !this.userMoved) this.jumpTo(this.fit(this.view));
  }

  tick() {
    this.controls.update();
    this.beforeRender?.();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  // Camera placement that fits `box` on screen when looking along -dir.
  fit({ box, dir, pad = 1.1 }) {
    const d = dir.clone().normalize();
    const cam = this.camera.clone();
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    let dist = Math.max(size.x / cam.aspect, size.y, 2) / (2 * tanHalf) + size.z;
    const right = new THREE.Vector3(), up = new THREE.Vector3(), p = new THREE.Vector3();
    for (let k = 0; k < 6; k++) {
      cam.position.copy(center).addScaledVector(d, dist);
      cam.lookAt(center);
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        p.copy(c).project(cam);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      const halfH = tanHalf * dist, halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      center.addScaledVector(right, ((x0 + x1) / 2) * halfW).addScaledVector(up, ((y0 + y1) / 2) * halfH);
      dist *= Math.max((x1 - x0) / 2, (y1 - y0) / 2) * pad;
    }
    return { position: center.clone().addScaledVector(d, dist), target: center };
  }

  flyTo(view, duration = 1.3) {
    this.view = view;
    this.userMoved = false;
    const goal = this.fit(view);
    this.camTween?.kill();
    const cam = this.camera, tgt = this.controls.target;
    const t0 = tgt.clone();
    const off0 = cam.position.clone().sub(t0);
    const off1 = goal.position.clone().sub(goal.target);
    const r0 = off0.length(), r1 = off1.length();
    const q = new THREE.Quaternion().setFromUnitVectors(off0.clone().normalize(), off1.clone().normalize());
    const qi = new THREE.Quaternion();
    const s = { t: 0 };
    // Interpolate orbit direction on the sphere so the camera swings rather than cutting through the scene.
    this.camTween = gsap.to(s, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        tgt.lerpVectors(t0, goal.target, s.t);
        qi.identity().slerp(q, s.t);
        const dir = off0.clone().normalize().applyQuaternion(qi);
        cam.position.copy(tgt).addScaledVector(dir, r0 + (r1 - r0) * s.t);
      },
    });
  }

  jumpTo(goal) {
    this.camTween?.kill();
    this.camera.position.copy(goal.position);
    this.controls.target.copy(goal.target);
  }
}
