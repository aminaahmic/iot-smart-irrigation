# Include Folder

This folder contains header files and configuration examples for the ESP32 firmware.

## Purpose

```text
The include folder is used for shared configuration and reusable declarations.

For this project, it contains config.example.h, which shows the required configuration values without exposing real secrets.
```

## Configuration

```text
Use config.example.h as a template.

Create a local config.h file based on config.example.h.

The config.h file should contain real WiFi and Firebase values and should not be committed to GitHub.
```

## Example

```text
include/
├── config.example.h
└── config.h
```

## Git Ignore

```text
config.h should be ignored by Git because it can contain sensitive local configuration.
```