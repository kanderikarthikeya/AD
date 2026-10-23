/**
 * Main Application Orchestrator: UI Bindings, Telemetry HUD, & Lifecycle Management
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Subsystems
  const threeScene = new ThreeMocapScene('viewport-3d-wrapper');
  const poseTracker = new PoseTracker('webcam-video', 'overlay-canvas');
  const mocapRecorder = new MocapRecorder();
  const audio = window.soundFx;

  // 2. DOM Elements
  const btnToggleCapture = document.getElementById('btn-toggle-capture');
  const btnRecordMocap = document.getElementById('btn-record-mocap');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const timelineSlider = document.getElementById('timeline-slider');
  const timelineCurrentTime = document.getElementById('timeline-current-time');
  const timelineTotalTime = document.getElementById('timeline-total-time');
  const playbackSpeedSelect = document.getElementById('playback-speed');
  const btnLoopToggle = document.getElementById('btn-loop-toggle');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import-input');

  // Telemetry HUD Elements
  const trackingPill = document.getElementById('tracking-pill');
  const pulseDot = trackingPill.querySelector('.pulse-dot');
  const trackingStatusText = document.getElementById('tracking-status-text');
  const fpsValue = document.getElementById('val-fps');
  const confidenceValue = document.getElementById('val-confidence');
  const jointsValue = document.getElementById('val-joints');
  const angleLeftElbow = document.getElementById('angle-l-elbow');
  const angleRightElbow = document.getElementById('angle-r-elbow');
  const angleLeftKnee = document.getElementById('angle-l-knee');
  const angleRightKnee = document.getElementById('angle-r-knee');
  const webcamPlaceholder = document.getElementById('webcam-placeholder');
  const webcamResolutionBadge = document.getElementById('cam-resolution-badge');

  // Viewport & Settings Buttons
  const avatarButtons = document.querySelectorAll('.avatar-mode-btn');
  const viewPresetButtons = document.querySelectorAll('.view-preset-btn');
  const btnToggleGrid = document.getElementById('btn-toggle-grid');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const btnToggleMirror = document.getElementById('btn-toggle-mirror');
  const btnToggleOverlay = document.getElementById('btn-toggle-overlay');
  const btnMinimizeHud = document.getElementById('btn-minimize-hud');
  const webcamHudPanel = document.getElementById('webcam-hud-panel');

  // Modals & Toasts
  const btnOpenHelp = document.getElementById('btn-open-help');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const modalHelp = document.getElementById('modal-help');
  const toastContainer = document.getElementById('toast-container');

  // Demo Chips
  const demoChips = document.querySelectorAll('.demo-chip');

  // 3. Toast Notification Helper
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-triangle';
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 20);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // 4. Hook Real-Time Webcam Pose Tracking
  poseTracker.onPoseUpdate = (data) => {
    // If playback was explicitly triggered by user, don't override playback
    if (mocapRecorder.isPlaying) return;

    if (data.hasBody && data.landmarks3D) {
      // Map detected real-time body landmarks to the 3D character
      threeScene.updatePose(data.landmarks3D, data.isWorldCoords);

      // Record real motion if recording mode is active
      if (mocapRecorder.isRecording) {
        mocapRecorder.recordFrame(data.landmarks3D, data.isWorldCoords, data.angles);
      }
    }

    // Telemetry updates
    fpsValue.textContent = data.fps || '--';
    confidenceValue.textContent = data.confidence ? `${data.confidence}%` : '--%';
    jointsValue.textContent = data.hasBody ? '33 / 33' : '0 / 33';

    if (data.angles) {
      angleLeftElbow.textContent = `${data.angles.leftElbow}°`;
      angleRightElbow.textContent = `${data.angles.rightElbow}°`;
      angleLeftKnee.textContent = `${data.angles.leftKnee}°`;
      angleRightKnee.textContent = `${data.angles.rightKnee}°`;
    }
  };

  poseTracker.onStatusChange = (statusText, isActive) => {
    trackingStatusText.textContent = statusText;
    if (isActive) {
      pulseDot.className = 'pulse-dot active';
      webcamPlaceholder.style.display = 'none';
      btnToggleCapture.innerHTML = '<i class="fas fa-video-slash"></i> <span>Stop Capture</span>';
      btnToggleCapture.className = 'btn btn-danger';
      webcamResolutionBadge.textContent = 'Live (640x480)';
    } else {
      pulseDot.className = 'pulse-dot';
      webcamPlaceholder.style.display = 'flex';
      btnToggleCapture.innerHTML = '<i class="fas fa-video"></i> <span>Start Capture</span>';
      btnToggleCapture.className = 'btn btn-primary';
      webcamResolutionBadge.textContent = 'Offline';
    }
  };

  poseTracker.onError = (errMsg) => {
    audio.error();
    showToast(errMsg, 'error');
  };

  // 5. Hook Playback Engine
  mocapRecorder.onFrameUpdate = (frame, frameIndex, totalFrames) => {
    if (frame && frame.landmarks) {
      threeScene.updatePose(frame.landmarks, frame.isWorldCoords !== false);

      if (frame.angles) {
        angleLeftElbow.textContent = `${frame.angles.leftElbow}°`;
        angleRightElbow.textContent = `${frame.angles.rightElbow}°`;
        angleLeftKnee.textContent = `${frame.angles.leftKnee}°`;
        angleRightKnee.textContent = `${frame.angles.rightKnee}°`;
      }
    }

    // Scrubber update
    if (totalFrames > 0) {
      timelineSlider.value = (frameIndex / (totalFrames - 1)) * 100;
      const currentSec = (frame.time / 1000).toFixed(1);
      timelineCurrentTime.textContent = `${currentSec}s`;
    }
  };

  mocapRecorder.onStateChange = (state) => {
    // Record Button Status
    if (state.isRecording) {
      pulseDot.className = 'pulse-dot recording';
      btnRecordMocap.innerHTML = '<i class="fas fa-stop"></i> <span>Stop Rec</span>';
      btnRecordMocap.className = 'btn btn-danger';
      trackingStatusText.textContent = `REC: ${state.frameCount} frames`;
    } else {
      btnRecordMocap.innerHTML = '<i class="fas fa-circle"></i> <span>Record</span>';
      btnRecordMocap.className = 'btn btn-secondary';
      if (!poseTracker.isActive) {
        pulseDot.className = 'pulse-dot';
      }
    }

    // Playback Buttons
    btnPlayPause.disabled = !state.hasRecording;
    btnExportJson.disabled = !state.hasRecording;
    timelineSlider.disabled = !state.hasRecording;

    if (state.isPlaying) {
      btnPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
      btnPlayPause.title = 'Pause Playback';
      trackingStatusText.textContent = `Playing [${state.currentFrame + 1}/${state.frameCount}]`;
    } else {
      btnPlayPause.innerHTML = '<i class="fas fa-play"></i>';
      btnPlayPause.title = 'Start Playback';
    }

    timelineTotalTime.textContent = `${state.duration}s`;
  };

  // 6. UI Event Listeners
  // Start / Stop Capture
  btnToggleCapture.addEventListener('click', () => {
    audio.click();
    if (poseTracker.isActive) {
      audio.stopCapture();
      poseTracker.stopCamera();
      showToast('Webcam tracking stopped', 'info');
    } else {
      // If a playback or demo clip is running, stop it and give 100% priority to live tracking
      if (mocapRecorder.isPlaying) {
        mocapRecorder.stopPlayback();
      }
      audio.startCapture();
      poseTracker.startCamera();
      showToast('Starting webcam & AI pose tracking...', 'info');
    }
  });

  // Record Button
  btnRecordMocap.addEventListener('click', () => {
    audio.click();
    if (mocapRecorder.isRecording) {
      audio.recordStop();
      const count = mocapRecorder.stopRecording();
      showToast(`Captured ${count} frames from webcam! Click Play to review.`, 'success');
    } else {
      if (!poseTracker.isActive) {
        showToast('Please click "Start Capture" first to record real body movements!', 'error');
        audio.error();
        return;
      }
      audio.recordStart();
      mocapRecorder.startRecording();
      showToast('Recording webcam motion in real time...', 'info');
    }
  });

  // Play / Pause Playback
  btnPlayPause.addEventListener('click', () => {
    audio.click();
    if (mocapRecorder.isPlaying) {
      mocapRecorder.pausePlayback();
    } else {
      mocapRecorder.startPlayback();
      showToast('Playing recorded motion', 'info');
    }
  });

  // Timeline Slider Scrubbing
  timelineSlider.addEventListener('input', (e) => {
    const pct = parseFloat(e.target.value) / 100;
    const targetFrame = Math.round(pct * (mocapRecorder.getFrameCount() - 1));
    mocapRecorder.seek(targetFrame);
  });

  // Playback Speed
  playbackSpeedSelect.addEventListener('change', (e) => {
    audio.click();
    mocapRecorder.setSpeed(e.target.value);
    showToast(`Speed set to ${e.target.value}x`, 'info');
  });

  // Loop Toggle
  btnLoopToggle.addEventListener('click', () => {
    audio.click();
    btnLoopToggle.classList.toggle('active');
    const isLoop = btnLoopToggle.classList.contains('active');
    mocapRecorder.setLoop(isLoop);
    showToast(`Playback Loop: ${isLoop ? 'ON' : 'OFF'}`, 'info');
  });

  // Export JSON
  btnExportJson.addEventListener('click', () => {
    audio.click();
    const jsonStr = mocapRecorder.exportJSON();
    if (!jsonStr) {
      showToast('No motion data recorded to export', 'error');
      return;
    }
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mocap_data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Motion capture data exported to JSON!', 'success');
  });

  // Import JSON
  btnImportJson.addEventListener('click', () => {
    audio.click();
    fileImportInput.click();
  });

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = mocapRecorder.importJSON(event.target.result);
      if (result.success) {
        showToast(`Loaded ${result.count} motion frames from file!`, 'success');
        mocapRecorder.startPlayback();
      } else {
        showToast(result.error || 'Failed to parse file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Demo Clips (Manual Trigger Only)
  demoChips.forEach(chip => {
    chip.addEventListener('click', () => {
      audio.click();
      const demoKey = chip.getAttribute('data-demo');
      mocapRecorder.loadDemo(demoKey);
      showToast(`Loaded demo: "${chip.textContent.trim()}"`, 'info');
    });
  });

  // Avatar Mode Selection
  avatarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      audio.click();
      avatarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-avatar');
      threeScene.setAvatarMode(mode);
      showToast(`Avatar mode: ${mode.toUpperCase()}`, 'info');
    });
  });

  // Camera View Presets
  viewPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      audio.click();
      viewPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.getAttribute('data-view');
      threeScene.setCameraPreset(preset);
    });
  });

  // Toggle Grid
  btnToggleGrid.addEventListener('click', () => {
    audio.click();
    const isVisible = threeScene.toggleGrid();
    btnToggleGrid.classList.toggle('active', isVisible);
    showToast(`Ground Grid: ${isVisible ? 'ON' : 'OFF'}`, 'info');
  });

  // Toggle Sound FX
  btnToggleSound.addEventListener('click', () => {
    const isMuted = audio.toggleMute();
    btnToggleSound.classList.toggle('active', !isMuted);
    btnToggleSound.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    showToast(`Sound FX: ${isMuted ? 'Muted' : 'Unmuted'}`, 'info');
  });

  // Toggle Mirroring
  btnToggleMirror.addEventListener('click', () => {
    audio.click();
    const isMirrored = poseTracker.toggleMirror();
    btnToggleMirror.classList.toggle('active', isMirrored);
    showToast(`Camera Mirror: ${isMirrored ? 'ON' : 'OFF'}`, 'info');
  });

  // Toggle 2D Skeleton Overlay
  btnToggleOverlay.addEventListener('click', () => {
    audio.click();
    const isOverlay = poseTracker.toggleOverlay();
    btnToggleOverlay.classList.toggle('active', isOverlay);
    showToast(`2D Skeleton Overlay: ${isOverlay ? 'ON' : 'OFF'}`, 'info');
  });

  // Minimize Webcam HUD
  btnMinimizeHud.addEventListener('click', () => {
    audio.click();
    webcamHudPanel.classList.toggle('minimized');
    const isMin = webcamHudPanel.classList.contains('minimized');
    btnMinimizeHud.innerHTML = isMin ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
  });

  // Help Modal
  const openHelpModal = () => {
    audio.click();
    modalHelp.classList.add('active');
  };
  const closeHelpModal = () => {
    audio.click();
    modalHelp.classList.remove('active');
  };

  btnOpenHelp.addEventListener('click', openHelpModal);
  btnCloseHelp.addEventListener('click', closeHelpModal);
  modalHelp.addEventListener('click', (e) => {
    if (e.target === modalHelp) closeHelpModal();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (mocapRecorder.hasRecording() && !poseTracker.isActive) {
        btnPlayPause.click();
      } else {
        btnToggleCapture.click();
      }
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      btnRecordMocap.click();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      btnToggleSound.click();
    } else if (e.code === 'Escape') {
      closeHelpModal();
    }
  });

  // Initial welcome toast (NO automatic demo clip playback)
  setTimeout(() => {
    showToast('Ready! Click "Start Capture" to begin live motion tracking with your webcam.', 'info');
  }, 400);
});
