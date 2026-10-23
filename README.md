# 🏃 Motion Capture Animation Studio

An interactive, real-time webcam motion capture web application built with **HTML5**, **Vanilla CSS**, and **JavaScript** using **Google MediaPipe BlazePose** and **Three.js**.

The application tracks human body movements in real time using a standard webcam and maps them onto a 3D digital skeleton and volumetric humanoid character, with recording, playback, and export options.

---

## ✨ Features

- **Real-Time Webcam Body Tracking**: Tracks 33 3D full-body landmarks using MediaPipe BlazePose directly in the browser via client-side WebAssembly & WebGL.
- **Interactive 3D Stage & Characters**:
  - **3D Robot Mannequin**: A fully articulated 3D volumetric character with metallic armor segments and glowing cyber visor that mirrors human movement.
  - **Cyber Skeleton**: Glowing holographic 3D neon joints and dynamic bone connectors.
  - **Neon Wire**: Stylized laser line avatar.
- **Camera Orbit Controls**: Orbit, pan, and zoom around the character in full 3D space, with quick angle presets (*Perspective*, *Front*, *Side*, *Close-up*).
- **Motion Recording & Playback**:
  - Record motion capture sequences with a single click.
  - Full playback controls with a timeline scrubber bar, loop toggle, and variable playback speeds (0.5x, 1.0x, 1.5x, 2.0x).
  - Export motion data to standard JSON format and import previously saved recordings.
- **Built-in Demonstration Clips**:
  - Four pre-recorded procedural kinematic clips (*Wave & Welcome*, *Jumping Jacks*, *Boxing Combo*, *Dance Groove*) to showcase the 3D character and motion capture system instantly even without a webcam.
- **Live Vision HUD & Kinematics Telemetry**:
  - Live webcam preview with 2D skeleton overlay, horizontal mirror toggle, and minimize option.
  - Real-time calculation of key kinematic joint angles (Left/Right Elbow, Left/Right Knee) in degrees.
  - Real-time FPS counter and tracking confidence meter.
- **Cyberpunk / Glassmorphic UI**: High-fidelity dark mode design with neon cyan and electric violet accents, smooth animations, and Web Audio API synthesized sound effects.
- **Graceful Error Handling**: Handles camera permission rejections, busy webcams, and unsupported devices with informative guidance.

---

## 🚀 How to Run the Application

Web browsers require `http://localhost` or `https://` to permit webcam access through the `navigator.mediaDevices.getUserMedia` API.

### Option 1: Double-Click the Windows Batch File (Recommended)
Simply double-click:
```
run.bat
```
This starts the local Python web server and automatically opens `http://localhost:8000/index.html` in your default browser.

### Option 2: Using Python in Terminal
Open your terminal / command prompt in this directory and run:
```bash
python run_server.py
```

### Option 3: Using Node.js or VS Code Live Server
If you have Node.js installed:
```bash
npx serve .
```
Or open the folder in VS Code and click **"Go Live"** using the Live Server extension.

---

## 🎓 College Demonstration & Viva Presentation Guide

When demonstrating this project to professors, evaluators, or classmates, highlight these core technical concepts:

1. **Computer Vision & Machine Learning**:
   - The application does not rely on a bulky backend server. It executes Google's **BlazePose** neural network entirely on the client side using **WebAssembly (WASM)** and **WebGL acceleration**.
   - It performs top-down pose estimation, detecting 33 anatomical landmarks (head, shoulders, elbows, wrists, hips, knees, ankles) in 3D coordinate space ($x, y, z$).

2. **Exponential Moving Average (EMA) Jitter Reduction**:
   - Raw optical pose estimates often suffer from high-frequency sensor noise.
   - The application filters coordinates using an EMA formula:
     $$\mathbf{S}_t = \alpha \cdot \mathbf{X}_t + (1 - \alpha) \cdot \mathbf{S}_{t-1}$$
     providing smooth, fluid animations while maintaining real-time responsiveness.

3. **Kinematics & 3D Character Rigging**:
   - Joint angles are computed dynamically using 3D vector dot products and trigonometry:
     $$\theta = \arccos\left(\frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}\right)$$
   - These angles drive the articulated meshes in Three.js, aligning limb segments via quaternion and matrix transformations.

4. **Instant Offline Demo Preset Mode**:
   - If showcasing in an auditorium or presentation booth without adequate lighting or camera space, click any of the **Demo Clips** at the bottom (*Wave & Welcome*, *Jumping Jacks*, *Boxing Combo*, *Dance Groove*) to immediately demonstrate real-time 3D character animation.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Space`** | Start/Stop Playback or Toggle Webcam Capture |
| **`R`** | Start / Stop Motion Recording |
| **`M`** | Mute / Unmute Audio Sound Effects |
| **`Esc`** | Close Guide Modal |

---

## 📁 Project Structure

```
motion-capture-app/
├── index.html           # Main HTML5 application structure & UI HUD
├── css/
│   └── style.css        # Modern glassmorphism & responsive cyber styling
├── js/
│   ├── audio.js         # Web Audio API sound synthesizer
│   ├── mocap-recorder.js# Recording buffer, timeline playback & demo clips
│   ├── three-scene.js   # Three.js 3D WebGL viewport & character avatars
│   ├── pose-tracker.js  # MediaPipe BlazePose tracker & kinematics calculator
│   └── app.js           # Main application coordinator & event bindings
├── run_server.py        # Lightweight local Python HTTP server
├── run.bat              # One-click Windows launch script
└── README.md            # Documentation & presentation guide
```
