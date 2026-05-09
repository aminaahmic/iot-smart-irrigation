# System Architecture

This document explains the architecture of the IoT Smart Irrigation System.

## Overview

```text
The system consists of three main parts:

1. ESP32 firmware
2. Firebase backend
3. Web dashboard
```

## Architecture Flow

```text
Sensors
  ↓
ESP32 Firmware
  ↓
Firebase Realtime Database
  ↓
Web Dashboard

Firebase Realtime Database
  ↓
Firebase Cloud Functions
  ↓
Firestore Readings History
```

## ESP32 Firmware

```text
The ESP32 is responsible for:

- Connecting to WiFi
- Reading sensor values
- Processing irrigation logic
- Sending live data to Firebase Realtime Database
- Reading manual commands from Firebase
- Controlling output devices such as LEDs and watering logic
```

## Firebase Backend

```text
Firebase is used for real-time communication between the ESP32 and the dashboard.

Firebase Realtime Database stores the latest device state and live sensor values.

Firestore can be used for storing historical readings.

Firebase Cloud Functions can mirror the latest sensor data from Realtime Database into Firestore history.
```

## Web Dashboard

```text
The dashboard is responsible for:

- Displaying live sensor values
- Showing irrigation status
- Showing water level status
- Displaying charts and history
- Sending manual commands to the ESP32
```

## Command Flow

```text
User clicks command button on dashboard
        ↓
Command is written to Firebase
        ↓
ESP32 reads the command
        ↓
ESP32 performs the action
        ↓
ESP32 updates the device state
        ↓
Dashboard displays the updated status
```

## Data Flow

```text
ESP32 reads sensors
        ↓
ESP32 sends values to Firebase
        ↓
Dashboard receives live updates
        ↓
Cloud Function stores history in Firestore
```