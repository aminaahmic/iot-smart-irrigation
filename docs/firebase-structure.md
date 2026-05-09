# Firebase Structure

This document describes the Firebase Realtime Database structure used in the IoT Smart Irrigation System.

## Root Structure

```text
devices
└── esp32-001
    ├── commands
    ├── live
    └── state
        └── latest
```

## Commands

```json
"commands": {
  "blink10": false,
  "blink10Stop": false,
  "sos": false,
  "sosStop": false,
  "waterNow": false
}
```

## Purpose of Commands

```text
blink10       -> triggers LED blinking sequence
blink10Stop   -> stops blinking sequence
sos           -> triggers SOS LED signal
sosStop       -> stops SOS LED signal
waterNow      -> triggers manual watering
```

## Live Data

```json
"live": {
  "hasWater": true,
  "humPct": 55.7,
  "isDark": true,
  "ldrRaw": 863,
  "shouldWater": false,
  "soilDry": true,
  "soilRaw": 3091,
  "tempC": 28.2,
  "ts": 950570,
  "waterRaw": 709
}
```

## Latest State

```json
"state": {
  "latest": {
    "hasWater": true,
    "humPct": 37.4,
    "isDark": false,
    "ldrRaw": 626,
    "manualWatering": false,
    "shouldWater": true,
    "soilDry": true,
    "soilRaw": 3226,
    "tempC": 20.2,
    "tsEpochMs": 1774694499000,
    "tsText": "28/03/2026 10:41:39",
    "uptimeMs": 306938,
    "waterRaw": 895
  }
}
```

## Field Meaning

```text
hasWater        -> indicates whether there is enough water in the reservoir
humPct          -> air humidity percentage
isDark          -> indicates whether the environment is dark
ldrRaw          -> raw light sensor value
shouldWater     -> indicates whether the system should activate watering
soilDry         -> indicates whether the soil is dry
soilRaw         -> raw soil moisture sensor value
tempC           -> temperature in Celsius
ts / tsEpochMs  -> timestamp
tsText          -> formatted date and time string
uptimeMs        -> ESP32 uptime in milliseconds
waterRaw        -> raw water level sensor value
manualWatering  -> indicates whether manual watering is active
```

## Data Flow

```text
ESP32 reads sensors
        ↓
ESP32 writes live data to Firebase Realtime Database
        ↓
Dashboard reads live data and shows current status
        ↓
User sends command from dashboard
        ↓
Command is written into /commands
        ↓
ESP32 reads command and performs the requested action
```