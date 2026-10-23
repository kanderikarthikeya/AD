/**
 * MediaPipe Pose Tracking, Webcam Stream Handling, 2D Vision Overlay & Kinematics Calculations
 */

class PoseTracker {
  constructor(videoElementId, canvasElementId) {
    this.video = document.getElementById(videoElementId);
    this.canvas = document.getElementById(canvasElementId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.pose = null;
    this.cameraStream = null;
    this.isActive = false;
    this.isProcessing = false;
    this.isMirrored = true;
    this.showOverlay = true;

    // Processing & FPS tracking
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    // Callbacks
    this.onPoseUpdate = null; // ({ landmarks2D, landmarks3D, isWorldCoords, angles, fps, confidence, hasBody }) => {}
    this.onError = null; // (errorMessage) => {}
    this.onStatusChange = null; // (statusText, isActive) => {}

    // BlazePose connections for 2D overlay
    this.connections = [
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left Arm
      [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
      // Right Arm
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
      // Left Leg
      [23, 25], [25, 27], [27, 29], [27, 31],
      // Right Leg
      [24, 26], [26, 28], [28, 30], [28, 32],
      // Face
      [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10]
    ];
  }

  async initMediaPipe() {
    if (typeof window.Pose === 'undefined') {
      throw new Error('MediaPipe Pose library is not loaded. Please verify your internet connection.');
    }

    this.pose = new window.Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1, // Balanced real-time tracking
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results) => this.handlePoseResults(results));
  }

  async startCamera() {
    try {
      if (this.onStatusChange) this.onStatusChange('Starting Webcam & AI Vision...', false);

      // Verify mediaDevices API support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam access requires a secure local context (http://localhost or https) or is unsupported by your browser.');
      }

      if (!this.pose) {
        await this.initMediaPipe();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      this.cameraStream = stream;
      this.video.srcObject = stream;

      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(resolve);
        };
      });

      // Match canvas dimensions to video feed
      if (this.canvas) {
        this.canvas.width = this.video.videoWidth || 640;
        this.canvas.height = this.video.videoHeight || 480;
      }

      this.isActive = true;
      this.isProcessing = false;
      if (this.onStatusChange) this.onStatusChange('Live Tracking Active', true);

      // Launch detection processing loop
      this.processLoop();
    } catch (err) {
      this.isActive = false;
      this.isProcessing = false;
      let userFriendlyMsg = 'Could not access webcam: ' + err.message;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyMsg = 'Webcam permission was blocked. Please click the camera icon in your browser address bar and choose "Allow".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendlyMsg = 'No webcam hardware detected on this machine.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userFriendlyMsg = 'Webcam is currently occupied by another program (e.g., Zoom, Teams, or another browser window).';
      }

      if (this.onError) this.onError(userFriendlyMsg);
      if (this.onStatusChange) this.onStatusChange('Camera Inactive', false);
    }
  }

  stopCamera() {
    this.isActive = false;
    this.isProcessing = false;

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      this.cameraStream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.onStatusChange) this.onStatusChange('Tracking Paused', false);
  }

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    return this.isMirrored;
  }

  toggleOverlay() {
    this.showOverlay = !this.showOverlay;
    return this.showOverlay;
  }

  async processLoop() {
    if (!this.isActive) return;

    if (this.video.readyState >= 2 && this.pose && !this.isProcessing) {
      this.isProcessing = true;
      try {
        await this.pose.send({ image: this.video });
      } catch (err) {
        console.warn('MediaPipe frame inference dropped:', err);
      } finally {
        this.isProcessing = false;
      }
    }

    if (this.isActive) {
      requestAnimationFrame(() => this.processLoop());
    }
  }

  handlePoseResults(results) {
    if (!this.isActive) return;

    // Calculate real-time FPS
    const now = performance.now();
    this.frameCount++;
    if (now - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;
    }

    const landmarks2D = results.poseLandmarks;
    const landmarks3D = results.poseWorldLandmarks;

    let overallConfidence = 0;
    let angles = { leftElbow: 0, rightElbow: 0, leftKnee: 0, rightKnee: 0 };
    const hasBody = !!(landmarks2D && landmarks2D.length >= 33);

    if (hasBody) {
      let sumVis = 0;
      landmarks2D.forEach(lm => sumVis += (lm.visibility !== undefined ? lm.visibility : 0.8));
      overallConfidence = Math.min(100, Math.round((sumVis / landmarks2D.length) * 100));

      angles = this.calculateKinematicAngles(landmarks2D);
    }

    // Draw Live Vision HUD with 2D skeleton overlay
    this.draw2DOverlay(results.image, landmarks2D);

    // Send pose data to 3D character scene & telemetry
    if (this.onPoseUpdate) {
      this.onPoseUpdate({
        landmarks2D,
        landmarks3D: (landmarks3D && landmarks3D.length >= 33) ? landmarks3D : landmarks2D,
        isWorldCoords: !!(landmarks3D && landmarks3D.length >= 33),
        angles,
        fps: this.fps,
        confidence: overallConfidence,
        hasBody
      });
    }
  }

  draw2DOverlay(image, landmarks) {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;

    this.ctx.save();
    this.ctx.clearRect(0, 0, width, height);

    // Apply mirror transformation if enabled
    if (this.isMirrored) {
      this.ctx.translate(width, 0);
      this.ctx.scale(-1, 1);
    }

    // Draw video feed frame
    if (image) {
      this.ctx.drawImage(image, 0, 0, width, height);
    }

    // Draw 2D Skeleton overlay
    if (landmarks && this.showOverlay) {
      // Draw Bones
      this.ctx.lineWidth = 3.5;
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 8;

      for (const [startIdx, endIdx] of this.connections) {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        if (p1 && p2 && (p1.visibility || 1) > 0.35 && (p2.visibility || 1) > 0.35) {
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x * width, p1.y * height);
          this.ctx.lineTo(p2.x * width, p2.y * height);
          this.ctx.stroke();
        }
      }

      // Draw Keypoint Joint Spheres
      this.ctx.shadowBlur = 10;
      landmarks.forEach((p, idx) => {
        if ((p.visibility || 1) > 0.35) {
          this.ctx.beginPath();
          this.ctx.arc(p.x * width, p.y * height, idx === 0 ? 5.5 : 4, 0, Math.PI * 2);
          this.ctx.fillStyle = (idx === 15 || idx === 16) ? '#ff2a85' : (idx === 0 ? '#ff3366' : '#00f59b');
          this.ctx.shadowColor = this.ctx.fillStyle;
          this.ctx.fill();
        }
      });
    }

    this.ctx.restore();
  }

  // =========================================================================
  // Kinematics: 3-Point Angle Calculation (degrees between 3 joint points)
  // =========================================================================
  calculateAngle(a, b, c) {
    if (!a || !b || !c) return 0;
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return Math.round(angle);
  }

  calculateKinematicAngles(lm) {
    return {
      // Left Arm: Shoulder (11) - Elbow (13) - Wrist (15)
      leftElbow: this.calculateAngle(lm[11], lm[13], lm[15]),
      // Right Arm: Shoulder (12) - Elbow (14) - Wrist (16)
      rightElbow: this.calculateAngle(lm[12], lm[14], lm[16]),
      // Left Leg: Hip (23) - Knee (25) - Ankle (27)
      leftKnee: this.calculateAngle(lm[23], lm[25], lm[27]),
      // Right Leg: Hip (24) - Knee (26) - Ankle (28)
      rightKnee: this.calculateAngle(lm[24], lm[26], lm[28])
    };
  }
}

window.PoseTracker = PoseTracker;
