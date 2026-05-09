# Firebase Structure

This document describes the Firebase structure used by the IoT Smart Irrigation System.

## Firebase Services

```text
The project uses Firebase for:

- Realtime Database
- Firestore
- Firebase Hosting
- Firebase Cloud Functions
```

## Realtime Database Purpose

```text
Firebase Realtime Database stores the latest live state of the ESP32 device.

It is used for:

- Live sensor values
- Current irrigation status
- Manual commands from the dashboard
- Device state updates
```

## Example Realtime Database Structure

```json
{
  "devices": {
    "esp32-001": {
      "latest": {
        "temperature": 24.5,
        "humidity": 62,
        "soilMoisture": 1850,
        "lightLevel": 720,
        "waterLevel": 1,
        "watering": false,
        "updatedAt": "2026-05-09T12:00:00Z"
      },
      "commands": {
        "manualWatering": false,
        "signalLed": false,
        "blinkCommand": false
      }
    }
  }
}
```

## Firestore Purpose

```text
Firestore can be used for storing sensor readings history.

This allows the dashboard to display:

- Previous temperature readings
- Previous humidity readings
- Soil moisture history
- Irrigation history
- Chart data
```

## Example Firestore Collection

```text
readings/
  readingId/
    deviceId
    temperature
    humidity
    soilMoisture
    lightLevel
    waterLevel
    watering
    createdAt
```

## Cloud Functions Purpose

```text
Firebase Cloud Functions can be used to copy or mirror the latest reading from Realtime Database into Firestore.

This keeps the Realtime Database focused on live state, while Firestore stores historical data.
```

## Dashboard Connection

```text
The web dashboard connects to Firebase and listens for changes in the device state.

When the ESP32 sends new data, the dashboard updates automatically.

When the user sends a command, the command is stored in Firebase and then read by the ESP32.
```

## Security Notes

```text
Firebase keys and configuration values should not be treated the same as passwords, but sensitive configuration should still be handled carefully.

Real credentials and project-specific values should not be hardcoded in public source code when possible.

Rules should be configured in Firebase to prevent unauthorized access.
```