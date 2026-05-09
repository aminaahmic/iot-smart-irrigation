# Hardware Components

This document describes the hardware components used in the IoT Smart Irrigation System.

## Main Components

```text
- ESP32 development board
- DHT temperature and humidity sensor
- Soil moisture sensor
- LDR light sensor
- Water level sensor
- Relay module
- Mini water pump
- LED indicators
- Jumper wires
- Breadboard
- USB cable
- External power supply
```

## Component Purpose

```text
ESP32:
Main microcontroller used for reading sensor data, connecting to WiFi, sending data to Firebase, and controlling output devices.

DHT Sensor:
Measures temperature and humidity.

Soil Moisture Sensor:
Measures the moisture level of the soil and helps determine when watering is needed.

LDR Sensor:
Measures the light level around the plant.

Water Level Sensor:
Detects whether there is enough water available in the tank.

Relay Module:
Controls the water pump safely using the ESP32 signal.

Water Pump:
Used to water the plant automatically or manually.

LED Indicators:
Used for visual signals and system status feedback.
```

## Notes

```text
The exact wiring and pin configuration can be changed depending on the hardware setup.
All real configuration values should be stored locally in include/config.h and should not be committed to GitHub.
```