/**
 * Three.js 3D WebGL Viewport, Connected Humanoid Mannequin, Cyber Skeleton, & Neon Avatar
 */

class ThreeMocapScene {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Avatar state
    this.currentMode = 'mannequin'; // 'mannequin', 'skeleton', 'neon'
    this.showGrid = true;

    // Avatar Groups
    this.skeletonGroup = new THREE.Group();
    this.mannequinGroup = new THREE.Group();
    this.neonGroup = new THREE.Group();

    // Data structures for meshes
    this.jointMeshes = [];
    this.boneMeshes = [];
    this.mannequinParts = {};
    this.neonLines = [];

    // Smoothing filter cache (EMA)
    this.smoothedPoints = null;
    this.smoothingAlpha = 0.65; // High responsiveness with smooth jitter filtering

    // MediaPipe 33 Connection topology
    this.connections = [
      // Face
      [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left Arm
      [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
      // Right Arm
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
      // Left Leg
      [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
      // Right Leg
      [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
    ];

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0d16, 0.06);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    this.setCameraPreset('perspective');

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'three-canvas';

    // 4. Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go below floor
      this.controls.minDistance = 1.0;
      this.controls.maxDistance = 8.0;
      this.controls.target.set(0, 0.95, 0); // Focus on character torso
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Environment & Podium
    this.setupEnvironment();

    // 7. Build Avatars
    this.buildSkeletonAvatar();
    this.buildMannequinAvatar();
    this.buildNeonAvatar();

    this.scene.add(this.skeletonGroup);
    this.scene.add(this.mannequinGroup);
    this.scene.add(this.neonGroup);

    this.setAvatarMode('mannequin');

    // Display initial clean natural standing stance
    this.applyNaturalStance();

    // Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Animation Loop
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x2a3b5c, 1.4);
    this.scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainKeyLight.position.set(2.5, 4.5, 3.5);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    mainKeyLight.shadow.camera.near = 0.5;
    mainKeyLight.shadow.camera.far = 15;
    mainKeyLight.shadow.bias = -0.001;
    this.scene.add(mainKeyLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
    rimLight.position.set(-3.0, 3.2, -3.0);
    this.scene.add(rimLight);

    const frontFill = new THREE.DirectionalLight(0x9d4edd, 0.9);
    frontFill.position.set(0, 2.0, 3.0);
    this.scene.add(frontFill);

    const underGlow = new THREE.PointLight(0x00f0ff, 1.2, 5);
    underGlow.position.set(0, 0.25, 0);
    this.scene.add(underGlow);
  }

  setupEnvironment() {
    // Holographic Grid Floor
    const gridSize = 12;
    const gridDivisions = 24;
    this.gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00f0ff, 0x162544);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);

    // Reflective circular podium
    const podiumGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.04, 48);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x0c1322,
      roughness: 0.25,
      metalness: 0.85
    });
    this.podium = new THREE.Mesh(podiumGeo, podiumMat);
    this.podium.position.y = -0.02;
    this.podium.receiveShadow = true;
    this.scene.add(this.podium);

    // Glowing podium ring
    const ringGeo = new THREE.RingGeometry(1.72, 1.78, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    });
    this.podiumRing = new THREE.Mesh(ringGeo, ringMat);
    this.podiumRing.rotation.x = -Math.PI / 2;
    this.podiumRing.position.y = 0.005;
    this.scene.add(this.podiumRing);
  }

  // =========================================================================
  // Math Connector: Connects Point A to Point B with a perfectly oriented segment
  // =========================================================================
  updateSegment(mesh, pA, pB, radiusX = 0.035, radiusZ = 0.035) {
    if (!mesh || !pA || !pB) return;
    const dir = new THREE.Vector3().subVectors(pB, pA);
    const len = dir.length();
    if (len < 0.0001) return;

    // Midpoint position
    mesh.position.addVectors(pA, pB).multiplyScalar(0.5);

    // Rotate unit Y vector to direction
    const unitDir = dir.normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);

    // Scale height to exact length and radii
    mesh.scale.set(radiusX, len, radiusZ);
    mesh.visible = true;
  }

  // =========================================================================
  // Avatar 1: Connected 3D Articulated Cyber Mannequin
  // =========================================================================
  buildMannequinAvatar() {
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0xd8e2f0,
      roughness: 0.25,
      metalness: 0.75
    });

    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x1b2434,
      roughness: 0.35,
      metalness: 0.9
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.6,
      roughness: 0.1,
      metalness: 0.8
    });

    // Helper: Standard Unit Cylinder (Height 1 along Y, centered at origin)
    const createUnitCylinder = (mat) => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 16);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    };

    // Helper: Joint Sphere
    const createJointSphere = (radius, mat) => {
      const geo = new THREE.SphereGeometry(radius, 16, 16);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    };

    // 1. Head & Visor
    const headGroup = new THREE.Group();
    const headCore = new THREE.Mesh(new THREE.SphereGeometry(0.10, 24, 24), armorMat);
    headCore.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.09), visorMat);
    visor.position.set(0, 0.015, 0.075);
    visor.castShadow = true;
    headGroup.add(headCore);
    headGroup.add(visor);
    this.mannequinParts.head = headGroup;

    // 2. Neck
    this.mannequinParts.neck = createUnitCylinder(darkJointMat);

    // 3. Torso Segments
    // Chest Plate
    const chestGroup = new THREE.Group();
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.16), armorMat);
    chestPlate.castShadow = true;
    // Glowing Arc Core
    const arcCore = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24), visorMat);
    arcCore.rotation.x = Math.PI / 2;
    arcCore.position.set(0, 0.02, 0.082);
    chestGroup.add(chestPlate);
    chestGroup.add(arcCore);
    this.mannequinParts.chest = chestGroup;

    // Spine / Abdomen
    this.mannequinParts.spine = createUnitCylinder(darkJointMat);

    // Pelvis / Hips
    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.15), armorMat);
    pelvisMesh.castShadow = true;
    this.mannequinParts.pelvis = pelvisMesh;

    // 4. Clavicles (Shoulder Bridges)
    this.mannequinParts.leftClavicle = createUnitCylinder(darkJointMat);
    this.mannequinParts.rightClavicle = createUnitCylinder(darkJointMat);

    // 5. Arms
    this.mannequinParts.leftUpperArm = createUnitCylinder(armorMat);
    this.mannequinParts.leftForearm = createUnitCylinder(armorMat);
    this.mannequinParts.rightUpperArm = createUnitCylinder(armorMat);
    this.mannequinParts.rightForearm = createUnitCylinder(armorMat);

    // Hands
    this.mannequinParts.leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), darkJointMat);
    this.mannequinParts.rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.03), darkJointMat);
    this.mannequinParts.leftHand.castShadow = true;
    this.mannequinParts.rightHand.castShadow = true;

    // 6. Legs
    this.mannequinParts.leftThigh = createUnitCylinder(armorMat);
    this.mannequinParts.leftShin = createUnitCylinder(armorMat);
    this.mannequinParts.rightThigh = createUnitCylinder(armorMat);
    this.mannequinParts.rightShin = createUnitCylinder(armorMat);

    // Feet
    this.mannequinParts.leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), darkJointMat);
    this.mannequinParts.rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.16), darkJointMat);
    this.mannequinParts.leftFoot.castShadow = true;
    this.mannequinParts.rightFoot.castShadow = true;

    // 7. Joint Spheres
    this.mannequinParts.lShoulder = createJointSphere(0.048, darkJointMat);
    this.mannequinParts.rShoulder = createJointSphere(0.048, darkJointMat);
    this.mannequinParts.lElbow = createJointSphere(0.038, darkJointMat);
    this.mannequinParts.rElbow = createJointSphere(0.038, darkJointMat);
    this.mannequinParts.lWrist = createJointSphere(0.030, visorMat);
    this.mannequinParts.rWrist = createJointSphere(0.030, visorMat);

    this.mannequinParts.lHip = createJointSphere(0.050, darkJointMat);
    this.mannequinParts.rHip = createJointSphere(0.050, darkJointMat);
    this.mannequinParts.lKnee = createJointSphere(0.042, darkJointMat);
    this.mannequinParts.rKnee = createJointSphere(0.042, darkJointMat);
    this.mannequinParts.lAnkle = createJointSphere(0.034, visorMat);
    this.mannequinParts.rAnkle = createJointSphere(0.034, visorMat);

    // Add all parts to mannequin group
    Object.values(this.mannequinParts).forEach(part => {
      this.mannequinGroup.add(part);
    });
  }

  // =========================================================================
  // Avatar 2: Cyber Holographic 3D Skeleton
  // =========================================================================
  buildSkeletonAvatar() {
    const jointGeo = new THREE.SphereGeometry(0.032, 16, 16);
    const headJointGeo = new THREE.SphereGeometry(0.06, 16, 16);

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00c4d6,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8
    });

    const boneMat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd,
      emissive: 0x7b2cbf,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.7
    });

    // 33 Joint Meshes
    for (let i = 0; i < 33; i++) {
      const isHead = (i === 0);
      const mesh = new THREE.Mesh(isHead ? headJointGeo : jointGeo, jointMat);
      mesh.castShadow = true;
      this.skeletonGroup.add(mesh);
      this.jointMeshes.push(mesh);
    }

    // Bone Unit Cylinders
    const unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
    for (let i = 0; i < this.connections.length; i++) {
      const mesh = new THREE.Mesh(unitCylinderGeo, boneMat);
      mesh.castShadow = true;
      this.skeletonGroup.add(mesh);
      this.boneMeshes.push(mesh);
    }
  }

  // =========================================================================
  // Avatar 3: Neon Wire Avatar
  // =========================================================================
  buildNeonAvatar() {
    const neonMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3
    });

    this.neonLines = [];
    for (let i = 0; i < this.connections.length; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
      ]);
      const line = new THREE.Line(geo, neonMat);
      this.neonGroup.add(line);
      this.neonLines.push(line);
    }
  }

  setAvatarMode(mode) {
    this.currentMode = mode;
    this.skeletonGroup.visible = (mode === 'skeleton');
    this.mannequinGroup.visible = (mode === 'mannequin');
    this.neonGroup.visible = (mode === 'neon');
  }

  toggleGrid(visible) {
    this.showGrid = (visible !== undefined) ? visible : !this.showGrid;
    if (this.gridHelper) this.gridHelper.visible = this.showGrid;
    if (this.podium) this.podium.visible = this.showGrid;
    if (this.podiumRing) this.podiumRing.visible = this.showGrid;
    return this.showGrid;
  }

  setCameraPreset(preset) {
    if (!this.camera) return;
    switch (preset) {
      case 'front':
        this.camera.position.set(0, 1.0, 2.6);
        if (this.controls) this.controls.target.set(0, 0.95, 0);
        break;
      case 'side':
        this.camera.position.set(2.6, 1.0, 0.0);
        if (this.controls) this.controls.target.set(0, 0.95, 0);
        break;
      case 'closeup':
        this.camera.position.set(0, 1.35, 1.3);
        if (this.controls) this.controls.target.set(0, 1.25, 0);
        break;
      case 'perspective':
      default:
        this.camera.position.set(1.2, 1.4, 2.4);
        if (this.controls) this.controls.target.set(0, 0.95, 0);
        break;
    }
    if (this.controls) this.controls.update();
  }

  // =========================================================================
  // Natural Upright Standing Stance (Default Pose)
  // =========================================================================
  getNaturalPose() {
    const pts = [];
    for (let i = 0; i < 33; i++) {
      pts.push(new THREE.Vector3(0, 0, 0));
    }

    // Head
    pts[0] = new THREE.Vector3(0, 1.62, 0.08); // Nose
    pts[7] = new THREE.Vector3(0.09, 1.62, -0.02); // Left ear
    pts[8] = new THREE.Vector3(-0.09, 1.62, -0.02); // Right ear

    // Shoulders
    pts[11] = new THREE.Vector3(0.22, 1.38, 0); // Left shoulder
    pts[12] = new THREE.Vector3(-0.22, 1.38, 0); // Right shoulder

    // Arms resting naturally
    pts[13] = new THREE.Vector3(0.27, 1.08, 0.03); // Left elbow
    pts[14] = new THREE.Vector3(-0.27, 1.08, 0.03); // Right elbow
    pts[15] = new THREE.Vector3(0.29, 0.78, 0.05); // Left wrist
    pts[16] = new THREE.Vector3(-0.29, 0.78, 0.05); // Right wrist
    pts[17] = new THREE.Vector3(0.30, 0.72, 0.05);
    pts[18] = new THREE.Vector3(-0.30, 0.72, 0.05);
    pts[19] = new THREE.Vector3(0.30, 0.71, 0.05);
    pts[20] = new THREE.Vector3(-0.30, 0.71, 0.05);

    // Hips
    pts[23] = new THREE.Vector3(0.12, 0.95, 0); // Left hip
    pts[24] = new THREE.Vector3(-0.12, 0.95, 0); // Right hip

    // Legs straight and planted on podium
    pts[25] = new THREE.Vector3(0.12, 0.52, 0); // Left knee
    pts[26] = new THREE.Vector3(-0.12, 0.52, 0); // Right knee
    pts[27] = new THREE.Vector3(0.12, 0.08, 0); // Left ankle
    pts[28] = new THREE.Vector3(-0.12, 0.08, 0); // Right ankle
    pts[29] = new THREE.Vector3(0.12, 0.05, -0.04);
    pts[30] = new THREE.Vector3(-0.12, 0.05, -0.04);
    pts[31] = new THREE.Vector3(0.12, 0.04, 0.12);
    pts[32] = new THREE.Vector3(-0.12, 0.04, 0.12);

    return pts;
  }

  applyNaturalStance() {
    const pts = this.getNaturalPose();
    this.updateSkeletonAvatar(pts);
    this.updateMannequinAvatar(pts);
    this.updateNeonAvatar(pts);
  }

  // =========================================================================
  // Real-time Motion Capture Update
  // =========================================================================
  updatePose(landmarks3D, isWorldCoords = false) {
    if (!landmarks3D || landmarks3D.length < 33) return;

    // 1. Exponential Moving Average (EMA) Jitter Reduction
    if (!this.smoothedPoints || this.smoothedPoints.length !== 33) {
      this.smoothedPoints = landmarks3D.map(p => ({
        x: p.x,
        y: p.y,
        z: p.z || 0,
        visibility: p.visibility !== undefined ? p.visibility : 1.0
      }));
    } else {
      const alpha = this.smoothingAlpha;
      for (let i = 0; i < 33; i++) {
        const cur = landmarks3D[i];
        const prev = this.smoothedPoints[i];
        prev.x = prev.x * (1 - alpha) + cur.x * alpha;
        prev.y = prev.y * (1 - alpha) + cur.y * alpha;
        prev.z = (prev.z || 0) * (1 - alpha) + (cur.z || 0) * alpha;
        prev.visibility = cur.visibility !== undefined ? cur.visibility : 1.0;
      }
    }

    const lm = this.smoothedPoints;

    // 2. Determine Coordinate Mode:
    // In MediaPipe World Landmarker: Head (lm[0]) is negative Y (e.g. -0.6m), hips around 0.
    // In Normalized Landmarker: Head is 0.1 - 0.3, hips are 0.5 - 0.8.
    const isWorld = isWorldCoords || (lm[0].y < lm[23].y);

    // Check if legs are visible (seated at desk vs standing)
    const legsVisible = (lm[25].visibility > 0.35 && lm[26].visibility > 0.35 && lm[27].visibility > 0.3);

    const hipBaseY = 0.95; // Base hip height on podium

    const points3D = [];
    for (let i = 0; i < 33; i++) {
      const p = lm[i];
      let x3d, y3d, z3d;

      if (isWorld) {
        // MediaPipe 3D Metric Coordinates:
        // x: positive is subject's left -> invert so user's right moves to screen right (mirror)
        x3d = -p.x * 1.25;
        // y: negative is UP -> invert so head is high up in Three.js
        y3d = hipBaseY - (p.y * 1.15);
        // z: negative is toward camera -> invert so moving toward camera is +Z
        z3d = -p.z * 1.15;
      } else {
        // Normalized 2D/3D Fallback:
        x3d = -(p.x - 0.5) * 1.8;
        y3d = hipBaseY - ((p.y - 0.55) * 1.85);
        z3d = -(p.z || 0) * 1.5;
      }

      // If seated at a desk, keep legs planted stably on the podium
      if (!legsVisible) {
        if (i === 25) { // Left Knee
          x3d = 0.12; y3d = 0.52; z3d = 0.01;
        } else if (i === 26) { // Right Knee
          x3d = -0.12; y3d = 0.52; z3d = 0.01;
        } else if (i === 27 || i === 29 || i === 31) { // Left Foot
          x3d = 0.12; y3d = 0.08; z3d = 0.04;
        } else if (i === 28 || i === 30 || i === 32) { // Right Foot
          x3d = -0.12; y3d = 0.08; z3d = 0.04;
        }
      }

      points3D.push(new THREE.Vector3(x3d, y3d, z3d));
    }

    // 3. Render active avatar
    if (this.currentMode === 'mannequin') {
      this.updateMannequinAvatar(points3D);
    } else if (this.currentMode === 'skeleton') {
      this.updateSkeletonAvatar(points3D);
    } else if (this.currentMode === 'neon') {
      this.updateNeonAvatar(points3D);
    }
  }

  // =========================================================================
  // Update Mannequin Humanoid Model
  // =========================================================================
  updateMannequinAvatar(points) {
    const p = this.mannequinParts;

    const nose = points[0];
    const leftEar = points[7];
    const rightEar = points[8];
    const lSh = points[11];
    const rSh = points[12];
    const lElb = points[13];
    const rElb = points[14];
    const lWr = points[15];
    const rWr = points[16];
    const lHip = points[23];
    const rHip = points[24];
    const lKn = points[25];
    const rKn = points[26];
    const lAnk = points[27];
    const rAnk = points[28];

    // Midpoints
    const shoulderMid = new THREE.Vector3().addVectors(lSh, rSh).multiplyScalar(0.5);
    const hipMid = new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5);

    // 1. Head
    const headCenter = new THREE.Vector3().addVectors(leftEar, rightEar).multiplyScalar(0.5);
    // If ears are too close, estimate head center from nose and shoulders
    if (headCenter.distanceTo(shoulderMid) < 0.15) {
      headCenter.copy(shoulderMid).add(new THREE.Vector3(0, 0.24, 0));
    }
    p.head.position.copy(headCenter);

    // Face look direction
    const faceForward = new THREE.Vector3().subVectors(nose, headCenter);
    faceForward.y = 0; // Keep head level
    if (faceForward.length() > 0.01) {
      p.head.lookAt(headCenter.clone().add(faceForward.normalize()));
    } else {
      p.head.rotation.set(0, 0, 0);
    }

    // 2. Neck: Connects shoulderMid to head base
    this.updateSegment(p.neck, shoulderMid, headCenter, 0.038, 0.038);

    // 3. Chest: Centered in upper torso
    const chestCenter = new THREE.Vector3().lerpVectors(shoulderMid, hipMid, 0.28);
    p.chest.position.copy(chestCenter);

    // Chest orientation facing forward
    const spineDir = new THREE.Vector3().subVectors(shoulderMid, hipMid).normalize();
    const shoulderDir = new THREE.Vector3().subVectors(lSh, rSh).normalize();
    const chestForward = new THREE.Vector3().crossVectors(spineDir, shoulderDir).normalize();
    if (chestForward.length() > 0.01) {
      p.chest.lookAt(chestCenter.clone().add(chestForward));
    }

    // 4. Spine: Connects chest to pelvis
    const pelvisCenter = new THREE.Vector3().lerpVectors(shoulderMid, hipMid, 0.85);
    this.updateSegment(p.spine, chestCenter, pelvisCenter, 0.045, 0.045);

    // 5. Pelvis
    p.pelvis.position.copy(pelvisCenter);
    if (chestForward.length() > 0.01) {
      p.pelvis.lookAt(pelvisCenter.clone().add(chestForward));
    }

    // 6. Clavicles (Shoulder Bridges)
    this.updateSegment(p.leftClavicle, shoulderMid, lSh, 0.032, 0.032);
    this.updateSegment(p.rightClavicle, shoulderMid, rSh, 0.032, 0.032);

    // 7. Arms
    this.updateSegment(p.leftUpperArm, lSh, lElb, 0.036, 0.036);
    this.updateSegment(p.leftForearm, lElb, lWr, 0.028, 0.028);
    this.updateSegment(p.rightUpperArm, rSh, rElb, 0.036, 0.036);
    this.updateSegment(p.rightForearm, rElb, rWr, 0.028, 0.028);

    // Hands
    p.leftHand.position.copy(lWr).add(new THREE.Vector3().subVectors(lWr, lElb).normalize().multiplyScalar(0.04));
    p.rightHand.position.copy(rWr).add(new THREE.Vector3().subVectors(rWr, rElb).normalize().multiplyScalar(0.04));

    // 8. Legs
    this.updateSegment(p.leftThigh, lHip, lKn, 0.048, 0.048);
    this.updateSegment(p.leftShin, lKn, lAnk, 0.038, 0.038);
    this.updateSegment(p.rightThigh, rHip, rKn, 0.048, 0.048);
    this.updateSegment(p.rightShin, rKn, rAnk, 0.038, 0.038);

    // Feet
    p.leftFoot.position.set(lAnk.x, Math.max(0.025, lAnk.y - 0.02), lAnk.z + 0.05);
    p.rightFoot.position.set(rAnk.x, Math.max(0.025, rAnk.y - 0.02), rAnk.z + 0.05);

    // 9. Joint Spheres
    p.lShoulder.position.copy(lSh);
    p.rShoulder.position.copy(rSh);
    p.lElbow.position.copy(lElb);
    p.rElbow.position.copy(rElb);
    p.lWrist.position.copy(lWr);
    p.rWrist.position.copy(rWr);

    p.lHip.position.copy(lHip);
    p.rHip.position.copy(rHip);
    p.lKnee.position.copy(lKn);
    p.rKnee.position.copy(rKn);
    p.lAnkle.position.copy(lAnk);
    p.rAnkle.position.copy(rAnk);
  }

  // =========================================================================
  // Update Skeleton Avatar
  // =========================================================================
  updateSkeletonAvatar(points) {
    // 33 Joint Spheres
    for (let i = 0; i < 33; i++) {
      this.jointMeshes[i].position.copy(points[i]);
    }

    // 32 Connected Bone Cylinders
    for (let i = 0; i < this.connections.length; i++) {
      const [startIdx, endIdx] = this.connections[i];
      const p1 = points[startIdx];
      const p2 = points[endIdx];
      this.updateSegment(this.boneMeshes[i], p1, p2, 0.015, 0.015);
    }
  }

  // =========================================================================
  // Update Neon Lines
  // =========================================================================
  updateNeonAvatar(points) {
    for (let i = 0; i < this.connections.length; i++) {
      const [startIdx, endIdx] = this.connections[i];
      const p1 = points[startIdx];
      const p2 = points[endIdx];
      const line = this.neonLines[i];
      const posAttr = line.geometry.attributes.position;

      posAttr.setXYZ(0, p1.x, p1.y, p1.z);
      posAttr.setXYZ(1, p2.x, p2.y, p2.z);
      posAttr.needsUpdate = true;
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

window.ThreeMocapScene = ThreeMocapScene;
