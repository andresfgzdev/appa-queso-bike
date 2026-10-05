# Spec 04: Edge AI Computer Vision & Gesture Steering

## Status: Draft
## Feature: `features/ai-companion` (Vision Subsystem)

### 1. Overview & User Stories
<!-- As a player, I want to use my webcam to steer the bike by holding my hands up or tilting my head. -->
<!-- As an AI engineer, I want to implement on-device edge AI using MediaPipe with 30+ FPS and 0 cloud API cost. -->

### 2. Functional Requirements
<!-- MediaPipe Hand Landmarker / Face Landmarker integration in Web Worker or WebGL -->
<!-- Mapping detected hand positions / head angle to left/right steering float (-1.0 to 1.0) -->
<!-- Webcam toggle and privacy permission handling -->
<!-- Fallback to keyboard/touch when webcam is disabled -->

### 3. Performance & Latency Budgets
<!-- Max inference latency: <30ms per frame -->
<!-- Low CPU overhead so 60 FPS Three.js render loop does not drop frames -->

### 4. Technical Contracts & Interfaces
<!-- TypeScript interfaces for VisionTrackingState, GestureType, VisionController -->
