# Wiring

This document describes the basic wiring used in the IoT Smart Irrigation System.

## Pin Configuration

```text
DHT Sensor             -> GPIO 4
LDR Sensor             -> GPIO 32
Soil Moisture Sensor   -> GPIO 34
Water Level Sensor     -> GPIO 35
Water Level LED        -> GPIO 22
Signal LED             -> GPIO 23
```

## Wiring Table

```text
Component                  ESP32 Pin
-------------------------------------
DHT Sensor DATA            GPIO 4
LDR Sensor AO              GPIO 32
Soil Moisture Sensor AO    GPIO 34
Water Level Sensor AO      GPIO 35
Water Level LED            GPIO 22
Signal LED                 GPIO 23
VCC                        3.3V / 5V
GND                        GND
```

## Notes

```text
Analog sensors should be connected to ESP32 analog-capable pins.

GPIO 34 and GPIO 35 are input-only pins on ESP32, which makes them suitable for analog sensor readings.

The relay or pump control pin can be adjusted depending on the final hardware setup.

External power should be used for the pump if the pump requires more current than the ESP32 can safely provide.
```

## Safety Reminder

```text
Do not power a water pump directly from an ESP32 pin.

Use a relay module, transistor module, or a proper motor driver depending on the pump type and power requirements.
```