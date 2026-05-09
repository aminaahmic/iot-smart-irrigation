# Library Folder

This folder is reserved for custom PlatformIO libraries.

## Purpose

```text
If the project grows, reusable firmware logic can be moved into custom libraries.

Examples:

- sensor reading logic
- Firebase communication logic
- pump control logic
- utility functions
```

## Current Status

```text
The project currently keeps the main firmware logic inside src/main.cpp.

Custom libraries can be added later if the firmware becomes larger.
```

## PlatformIO Notes

```text
PlatformIO automatically detects libraries placed inside this folder.
```