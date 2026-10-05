# Spec 01: Core Gameplay, Endless Road & Chase Camera

## Status: Draft
## Feature: `features/game`

### 1. Overview & User Stories
<!-- As a player, I want the cat to ride infinitely forward so that I experience seamless endless movement. -->
<!-- As a player, I want a smooth 3rd-person chase camera behind the cat. -->
<!-- As a player, I want to steer left and right with realistic bike banking/leaning. -->

### 2. Functional Requirements
<!-- Endless conveyor road recycling mechanism -->
<!-- Constant forward speed and acceleration curves -->
<!-- Lateral steering boundaries and smoothing (lerp) -->
<!-- Chase camera position, look-at target, damping/lag -->

### 3. Non-Functional Requirements
<!-- Target 60 FPS on standard modern browser WebGL -->
<!-- Zero memory leaks during endless road chunk recycling -->

### 4. Technical Contracts & Interfaces
<!-- TypeScript interfaces for GameState, RoadChunk, InputState, CameraSettings -->
