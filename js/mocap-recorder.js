/**
 * Motion Capture Recorder, Playback Engine, and Procedural Demo Clip Generator
 */

class MocapRecorder {
  constructor() {
    this.recordedFrames = [];
    this.isRecording = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.isLooping = true;
    this.playbackSpeed = 1.0;
    this.currentFrameIndex = 0;
    this.playbackTimer = null;
    this.recordStartTime = 0;

    // Callbacks
    this.onFrameUpdate = null; // (frameData, frameIndex, totalFrames) => {}
    this.onStateChange = null; // (stateObj) => {}

    // Pre-generate demo clips
    this.demoClips = {
      wave: this.generateWaveClip(),
      jacks: this.generateJacksClip(),
      fight: this.generateBoxingClip(),
      dance: this.generateDanceClip()
    };
  }

  startRecording() {
    this.stopPlayback();
    this.recordedFrames = [];
    this.isRecording = true;
    this.recordStartTime = performance.now();
    this.notifyState();
  }

  recordFrame(landmarks, isWorldCoords = true, angles = {}) {
    if (!this.isRecording || !landmarks || landmarks.length === 0) return;

    const frameLandmarks = landmarks.map(pt => ({
      x: pt.x,
      y: pt.y,
      z: pt.z || 0,
      visibility: pt.visibility !== undefined ? pt.visibility : 1.0
    }));

    this.recordedFrames.push({
      time: performance.now() - this.recordStartTime,
      landmarks: frameLandmarks,
      isWorldCoords,
      angles: { ...angles }
    });

    this.notifyState();
  }

  stopRecording() {
    if (!this.isRecording) return 0;
    this.isRecording = false;
    this.notifyState();
    return this.recordedFrames.length;
  }

  hasRecording() {
    return this.recordedFrames.length > 0;
  }

  getFrameCount() {
    return this.recordedFrames.length;
  }

  getDurationSec() {
    if (this.recordedFrames.length === 0) return 0;
    const last = this.recordedFrames[this.recordedFrames.length - 1];
    return (last.time / 1000).toFixed(1);
  }

  startPlayback() {
    if (this.recordedFrames.length === 0) return;
    this.isPlaying = true;
    this.isPaused = false;
    if (this.currentFrameIndex >= this.recordedFrames.length - 1) {
      this.currentFrameIndex = 0;
    }
    this.notifyState();
    this.playLoop();
  }

  pausePlayback() {
    this.isPlaying = false;
    this.isPaused = true;
    if (this.playbackTimer) {
      cancelAnimationFrame(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.notifyState();
  }

  stopPlayback() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentFrameIndex = 0;
    if (this.playbackTimer) {
      cancelAnimationFrame(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.notifyState();
  }

  seek(frameIndex) {
    if (this.recordedFrames.length === 0) return;
    this.currentFrameIndex = Math.max(0, Math.min(frameIndex, this.recordedFrames.length - 1));
    const frame = this.recordedFrames[this.currentFrameIndex];
    if (this.onFrameUpdate) {
      this.onFrameUpdate(frame, this.currentFrameIndex, this.recordedFrames.length);
    }
    this.notifyState();
  }

  setSpeed(speed) {
    this.playbackSpeed = parseFloat(speed) || 1.0;
  }

  setLoop(loop) {
    this.isLooping = !!loop;
  }

  playLoop() {
    let lastTimestamp = performance.now();

    const step = (now) => {
      if (!this.isPlaying) return;

      const delta = (now - lastTimestamp) * this.playbackSpeed;
      if (delta >= 33) { // ~30 fps tick
        lastTimestamp = now;
        this.currentFrameIndex++;

        if (this.currentFrameIndex >= this.recordedFrames.length) {
          if (this.isLooping) {
            this.currentFrameIndex = 0;
          } else {
            this.stopPlayback();
            return;
          }
        }

        const frame = this.recordedFrames[this.currentFrameIndex];
        if (this.onFrameUpdate && frame) {
          this.onFrameUpdate(frame, this.currentFrameIndex, this.recordedFrames.length);
        }
        this.notifyState();
      }

      this.playbackTimer = requestAnimationFrame(step);
    };

    this.playbackTimer = requestAnimationFrame(step);
  }

  loadDemo(demoKey) {
    if (!this.demoClips[demoKey]) return;
    this.stopPlayback();
    this.isRecording = false;
    this.recordedFrames = JSON.parse(JSON.stringify(this.demoClips[demoKey]));
    this.currentFrameIndex = 0;
    this.startPlayback();
  }

  exportJSON() {
    if (this.recordedFrames.length === 0) return null;
    const exportData = {
      app: 'MotionCaptureStudio',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      frameCount: this.recordedFrames.length,
      durationSec: this.getDurationSec(),
      frames: this.recordedFrames
    };
    return JSON.stringify(exportData, null, 2);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data && Array.isArray(data.frames) && data.frames.length > 0) {
        this.stopPlayback();
        this.isRecording = false;
        this.recordedFrames = data.frames;
        this.currentFrameIndex = 0;
        this.notifyState();
        return { success: true, count: data.frames.length };
      }
      return { success: false, error: 'Invalid frame format in JSON file.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        isRecording: this.isRecording,
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        hasRecording: this.hasRecording(),
        frameCount: this.recordedFrames.length,
        currentFrame: this.currentFrameIndex,
        duration: this.getDurationSec()
      });
    }
  }

  // =========================================================================
  // Standard Upright Metric Pose Base (MediaPipe World Coordinates: Hips = 0, Head = -Y, Feet = +Y)
  // =========================================================================
  getBasePose() {
    const lm = [];
    for (let i = 0; i < 33; i++) {
      lm.push({ x: 0, y: 0, z: 0, visibility: 1.0 });
    }

    // Head (Y is negative for points above hips)
    lm[0] = { x: 0, y: -0.62, z: -0.06 }; // Nose
    lm[1] = { x: 0.02, y: -0.65, z: -0.04 };
    lm[2] = { x: 0.04, y: -0.65, z: -0.04 };
    lm[3] = { x: 0.06, y: -0.65, z: -0.04 };
    lm[4] = { x: -0.02, y: -0.65, z: -0.04 };
    lm[5] = { x: -0.04, y: -0.65, z: -0.04 };
    lm[6] = { x: -0.06, y: -0.65, z: -0.04 };
    lm[7] = { x: 0.08, y: -0.62, z: 0.02 }; // Left ear
    lm[8] = { x: -0.08, y: -0.62, z: 0.02 }; // Right ear
    lm[9] = { x: 0.03, y: -0.58, z: -0.05 };
    lm[10] = { x: -0.03, y: -0.58, z: -0.05 };

    // Shoulders
    lm[11] = { x: 0.18, y: -0.42, z: 0 }; // Left shoulder
    lm[12] = { x: -0.18, y: -0.42, z: 0 }; // Right shoulder

    // Arms
    lm[13] = { x: 0.24, y: -0.16, z: 0.02 }; // Left elbow
    lm[14] = { x: -0.24, y: -0.16, z: 0.02 }; // Right elbow
    lm[15] = { x: 0.26, y: 0.10, z: 0.04 }; // Left wrist
    lm[16] = { x: -0.26, y: 0.10, z: 0.04 }; // Right wrist
    lm[17] = { x: 0.28, y: 0.15, z: 0.04 };
    lm[18] = { x: -0.28, y: 0.15, z: 0.04 };
    lm[19] = { x: 0.27, y: 0.16, z: 0.03 };
    lm[20] = { x: -0.27, y: 0.16, z: 0.03 };
    lm[21] = { x: 0.25, y: 0.14, z: 0.02 };
    lm[22] = { x: -0.25, y: 0.14, z: 0.02 };

    // Hips
    lm[23] = { x: 0.10, y: 0.0, z: 0 }; // Left hip
    lm[24] = { x: -0.10, y: 0.0, z: 0 }; // Right hip

    // Legs
    lm[25] = { x: 0.10, y: 0.40, z: 0 }; // Left knee
    lm[26] = { x: -0.10, y: 0.40, z: 0 }; // Right knee
    lm[27] = { x: 0.10, y: 0.78, z: 0 }; // Left ankle
    lm[28] = { x: -0.10, y: 0.78, z: 0 }; // Right ankle
    lm[29] = { x: 0.10, y: 0.82, z: 0.04 };
    lm[30] = { x: -0.10, y: 0.82, z: 0.04 };
    lm[31] = { x: 0.10, y: 0.83, z: -0.10 };
    lm[32] = { x: -0.10, y: 0.83, z: -0.10 };

    return lm;
  }

  generateWaveClip() {
    const frames = [];
    const totalFrames = 80;
    for (let f = 0; f < totalFrames; f++) {
      const t = f / totalFrames;
      const angle = t * Math.PI * 2;
      const lm = this.getBasePose();

      // Breathing subtle torso bob
      const breath = Math.sin(angle * 2) * 0.015;
      lm[0].y += breath;
      lm[11].y += breath;
      lm[12].y += breath;

      // Raise right arm (index 12, 14, 16) and wave hand
      const wavePhase = Math.sin(t * Math.PI * 8);
      lm[14].x = -0.28;
      lm[14].y = -0.42; // Elbow level with shoulder
      lm[14].z = -0.06;

      lm[16].x = -0.32 + wavePhase * 0.10;
      lm[16].y = -0.68; // Hand high above shoulder
      lm[16].z = -0.08 + Math.cos(t * Math.PI * 8) * 0.03;
      lm[18].x = lm[16].x - 0.03;
      lm[20].x = lm[16].x;
      lm[22].x = lm[16].x + 0.03;
      lm[18].y = lm[16].y - 0.06;
      lm[20].y = lm[16].y - 0.07;
      lm[22].y = lm[16].y - 0.05;

      // Left arm has gentle idle sway
      lm[13].x += Math.sin(angle) * 0.015;
      lm[15].x += Math.sin(angle) * 0.015;

      frames.push({
        time: f * 33.3,
        landmarks: lm,
        isWorldCoords: true,
        angles: { leftElbow: 168, rightElbow: 85, leftKnee: 178, rightKnee: 178 }
      });
    }
    return frames;
  }

  generateJacksClip() {
    const frames = [];
    const totalFrames = 60;
    for (let f = 0; f < totalFrames; f++) {
      const phase = Math.sin((f / totalFrames) * Math.PI * 4); // 2 jumping jacks
      const jump = Math.max(0, phase); // 0 (closed) to 1 (extended)
      const lm = this.getBasePose();

      // Vertical bounce
      const bounce = Math.abs(Math.sin((f / totalFrames) * Math.PI * 4)) * 0.06;
      for (let i = 0; i < 33; i++) {
        lm[i].y -= bounce; // UP is negative Y
      }

      // Arms arc from sides to above head
      const armAngle = jump * Math.PI * 0.72; // 0 to 130 deg
      const armRadius = 0.50;

      // Right arm
      lm[14].x = -0.18 - Math.sin(armAngle * 0.5) * 0.25;
      lm[14].y = -0.42 - Math.sin(armAngle * 0.7) * 0.20;
      lm[16].x = -0.18 - Math.sin(armAngle) * armRadius;
      lm[16].y = -0.42 + Math.cos(armAngle) * armRadius * (jump > 0.5 ? -1 : 1) - (jump * 0.45);

      // Left arm mirror
      lm[13].x = 0.18 + Math.sin(armAngle * 0.5) * 0.25;
      lm[13].y = lm[14].y;
      lm[15].x = 0.18 + Math.sin(armAngle) * armRadius;
      lm[15].y = lm[16].y;

      // Legs jump apart
      const legSpread = jump * 0.18;
      lm[25].x += legSpread * 0.5;
      lm[27].x += legSpread;
      lm[29].x += legSpread;
      lm[31].x += legSpread;

      lm[26].x -= legSpread * 0.5;
      lm[28].x -= legSpread;
      lm[30].x -= legSpread;
      lm[32].x -= legSpread;

      frames.push({
        time: f * 33.3,
        landmarks: lm,
        isWorldCoords: true,
        angles: {
          leftElbow: Math.round(170 - jump * 18),
          rightElbow: Math.round(170 - jump * 18),
          leftKnee: Math.round(178 - jump * 14),
          rightKnee: Math.round(178 - jump * 14)
        }
      });
    }
    return frames;
  }

  generateBoxingClip() {
    const frames = [];
    const totalFrames = 90;
    for (let f = 0; f < totalFrames; f++) {
      const lm = this.getBasePose();

      // Guard position hands near chin
      let lHandX = 0.14, lHandY = -0.52, lHandZ = -0.18;
      let rHandX = -0.12, rHandY = -0.54, rHandZ = -0.16;
      let lElbowX = 0.18, lElbowY = -0.32, lElbowZ = -0.10;
      let rElbowX = -0.16, rElbowY = -0.34, rElbowZ = -0.08;

      // Left Jab (f: 15 to 35)
      if (f >= 15 && f <= 35) {
        const jab = Math.sin(((f - 15) / 20) * Math.PI);
        lHandZ = -0.18 - jab * 0.38;
        lHandY = -0.52 - jab * 0.02;
        lHandX = 0.14 - jab * 0.06;
        lElbowZ = -0.10 - jab * 0.22;
      }

      // Right Cross (f: 45 to 65)
      if (f >= 45 && f <= 65) {
        const cross = Math.sin(((f - 45) / 20) * Math.PI);
        rHandZ = -0.16 - cross * 0.42;
        rHandY = -0.54 + cross * 0.01;
        rHandX = -0.12 + cross * 0.08;
        rElbowZ = -0.08 - cross * 0.26;
        lm[12].z -= cross * 0.08;
        lm[11].z += cross * 0.08;
      }

      // Duck / Weave (f: 70 to 88)
      if (f >= 70 && f <= 88) {
        const duck = Math.sin(((f - 70) / 18) * Math.PI);
        for (let i = 0; i <= 24; i++) {
          lm[i].y += duck * 0.12; // Duck down (+Y)
        }
      }

      lm[13] = { x: lElbowX, y: lElbowY, z: lElbowZ, visibility: 1 };
      lm[15] = { x: lHandX, y: lHandY, z: lHandZ, visibility: 1 };
      lm[14] = { x: rElbowX, y: rElbowY, z: rElbowZ, visibility: 1 };
      lm[16] = { x: rHandX, y: rHandY, z: rHandZ, visibility: 1 };

      frames.push({
        time: f * 33.3,
        landmarks: lm,
        isWorldCoords: true,
        angles: { leftElbow: 75, rightElbow: 70, leftKnee: 165, rightKnee: 160 }
      });
    }
    return frames;
  }

  generateDanceClip() {
    const frames = [];
    const totalFrames = 80;
    for (let f = 0; f < totalFrames; f++) {
      const t = (f / totalFrames) * Math.PI * 4;
      const lm = this.getBasePose();

      const hipSway = Math.sin(t) * 0.06;
      lm[23].x += hipSway;
      lm[24].x += hipSway;
      lm[0].x += Math.sin(t + 0.5) * 0.03;

      lm[13].x = 0.26 + Math.cos(t) * 0.12;
      lm[13].y = -0.32 + Math.sin(t) * 0.12;
      lm[15].x = 0.30 + Math.cos(t + 0.5) * 0.18;
      lm[15].y = -0.42 + Math.sin(t + 0.5) * 0.18;

      lm[14].x = -0.26 - Math.sin(t) * 0.12;
      lm[14].y = -0.32 + Math.cos(t) * 0.12;
      lm[16].x = -0.30 - Math.sin(t + 0.5) * 0.18;
      lm[16].y = -0.42 + Math.cos(t + 0.5) * 0.18;

      frames.push({
        time: f * 33.3,
        landmarks: lm,
        isWorldCoords: true,
        angles: {
          leftElbow: Math.round(110 + Math.sin(t) * 35),
          rightElbow: Math.round(110 + Math.cos(t) * 35),
          leftKnee: 172,
          rightKnee: 172
        }
      });
    }
    return frames;
  }
}

window.MocapRecorder = MocapRecorder;
