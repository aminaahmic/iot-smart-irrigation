# Screenshots

This folder contains screenshots and visual documentation for the IoT Smart Irrigation System.

The screenshots are used to present the dashboard interface, sensor data visualization, Firebase data structure, and irrigation logic.

## Included Screenshots

```text
dashboard-home.png
dashboard-history.png
dashboard-charts-log.png
firebase-realtime-database.png
fsm-diagram.png
```

## Screenshot Descriptions

### dashboard-home.png

Main dashboard screen showing the latest sensor readings and system status.

It includes values such as:

```text
- temperature
- air humidity
- soil moisture
- light level
- water level
- watering status
```

### dashboard-history.png

Dashboard screen showing the history of previous sensor readings.

This view helps users track previous measurements and compare changes over time.

### dashboard-charts-log.png

Dashboard screen showing charts and log-style visualization of sensor data.

This helps present the system as more than a simple live display, because it also includes historical data visualization.

### firebase-realtime-database.png

Image showing the Firebase Realtime Database structure used by the project.

The structure includes:

```text
devices
└── esp32-001
    ├── commands
    ├── live
    └── state
        └── latest
```

This shows how ESP32, Firebase, and the dashboard communicate.

### fsm-diagram.png

FSM diagram showing the irrigation logic and transitions between system states.

The diagram explains states such as:

```text
- IDLE
- AUTO_WATER
- MANUAL_WATER
- NO_WATER
```

## Hardware Note

The physical prototype was assembled and tested during development, but it was later disassembled before taking a final hardware photo.

Because of that, this repository focuses on:

```text
- dashboard screenshots
- Firebase data structure
- FSM logic diagram
- written hardware and wiring documentation
```

## Usage in Main README

Use these images in the main `README.md` file like this:

```md
## Screenshots

### Dashboard Home

![Dashboard Home](docs/screenshots/dashboard-home.png)

### Dashboard History

![Dashboard History](docs/screenshots/dashboard-history.png)

### Charts and Logs

![Charts and Logs](docs/screenshots/dashboard-charts-log.png)

### Firebase Realtime Database Structure

![Firebase Realtime Database Structure](docs/screenshots/firebase-realtime-database.png)

### FSM Diagram

![FSM Diagram](docs/screenshots/fsm-diagram.png)
```

## Notes

```text
All screenshots should be stored in this folder.

File names should be lowercase and descriptive.

Do not include screenshots that expose private Firebase keys, API keys, service accounts, passwords, or personal information.
```