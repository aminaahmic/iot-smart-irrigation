#include <Arduino.h>
#include <DHT.h>
#include <WiFi.h>
#include <time.h>

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#include "config.h"

// ================= WIFI =================
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// ================= FIREBASE =================
#define API_KEY FIREBASE_API_KEY
#define FIREBASE_PROJECT_ID FIREBASE_PROJECT_ID_VALUE
#define DATABASE_URL FIREBASE_DATABASE_URL

String DEVICE_ID = DEVICE_ID_VALUE;

// ================= PINOVI =================
#define PIN_DHT    4
#define DHTTYPE    DHT22
#define PIN_LDR    32
#define PIN_SOIL   34
#define PIN_WATER  35
#define PIN_LED 22
#define PIN_SIGNAL_LED 23

DHT dht(PIN_DHT, DHTTYPE);

// ================= PRAGOVI =================
int SOIL_DRY_THRESHOLD = 2400;
int LDR_DARK_THRESHOLD = 650;

int WATER_OK_THRESHOLD  = 500;
int WATER_LOW_THRESHOLD = 300;

bool hasWater = false;

// ================= FIREBASE OBJECTS =================
FirebaseData fbdo;
FirebaseData fbdoCmd;
FirebaseAuth auth;
FirebaseConfig config;

static uint32_t lastSend = 0;
const uint32_t SEND_MS = 5000;
// ===== RUČNE KOMANDE =====
bool manualWatering = false;
uint32_t manualStartMs = 0;
const uint32_t MANUAL_MAX_MS = 180000; // 3 minute max (sigurnost)

// ===== LED SIGNAL MODES =====
enum LedMode {
  LED_MODE_NONE,
  LED_MODE_SOS,
  LED_MODE_BLINK10
};

LedMode ledMode = LED_MODE_NONE;

bool patternLedState = false;
uint32_t patternLastMs = 0;
uint8_t sosBlinkCount = 0;      // 0..3
uint8_t blink10Count = 0;       // 0..10
/////blinkanje 
const uint32_t BLINK_ON_MS = 250;
const uint32_t BLINK_OFF_MS = 250;
const uint32_t LONG_PAUSE_MS = 1500;

uint32_t forceHasWaterUntilMs = 0;
const uint32_t FORCE_HASWATER_MS = 600000; // 10 minuta



// ================= HELPERS =================
int readAnalogAvg(int pin, int n = 20) {
  long sum = 0;
  for (int i = 0; i < n; i++) {
    sum += analogRead(pin);
    delayMicroseconds(200);
  }
  return (int)(sum / n);
}

void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Spajam se na WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi spojen!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

// ===== NTP (pravo vrijeme, sa automatskim DST za BiH/CET) =====
void syncTimeNTP() {
  
  setenv("TZ", "CET-1CEST,M3.5.0/2,M10.5.0/3", 1);
  tzset();

  // NTP serveri
  configTime(0, 0, "pool.ntp.org", "time.nist.gov", "europe.pool.ntp.org");

  Serial.print("Sync vremena (NTP)...");
  time_t now = time(nullptr);

  
  int tries = 0;
  while (now < 1700000000 && tries < 40) {
    delay(250);
    Serial.print(".");
    now = time(nullptr);
    tries++;
  }
  Serial.println();

  if (now < 1700000000) {
    Serial.println("NTP sync nije uspio (nastavljam, ali datum na webu mozda nece biti tacan).");
  } else {
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);
    char buf[32];
    strftime(buf, sizeof(buf), "%d/%m/%Y %H:%M:%S", &timeinfo);
    Serial.print("Vrijeme OK: ");
    Serial.println(buf);
  }
}

uint64_t nowEpochMs() {
  time_t now = time(nullptr);
  if (now < 1700000000) return 0; // nije sync-ovano
  return (uint64_t)now * 1000ULL;
}

String nowLocalText() {
  time_t now = time(nullptr);
  if (now < 1700000000) return String("—");
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  char buf[32];
  strftime(buf, sizeof(buf), "%d/%m/%Y %H:%M:%S", &timeinfo);
  return String(buf);
}

void firebaseInit() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  Firebase.signUp(&config, &auth, "", "");
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase spreman.");
}
void stopLedPattern() {
  ledMode = LED_MODE_NONE;
  patternLedState = false;
  sosBlinkCount = 0;
  blink10Count = 0;
  digitalWrite(PIN_SIGNAL_LED, LOW);
}

void startSOSPattern() {
  ledMode = LED_MODE_SOS;
  patternLedState = false;
  sosBlinkCount = 0;
  blink10Count = 0;
  patternLastMs = millis() - BLINK_OFF_MS; // da krene odmah
  digitalWrite(PIN_SIGNAL_LED, LOW);
  Serial.println("LED MODE: SOS START");
}

void startBlink10Pattern() {
  ledMode = LED_MODE_BLINK10;
  patternLedState = false;
  sosBlinkCount = 0;
  blink10Count = 0;
  patternLastMs = millis() - BLINK_OFF_MS; // da krene odmah
  digitalWrite(PIN_SIGNAL_LED, LOW);
  Serial.println("LED MODE: BLINK10 START");
}

void updateLedPattern() {
  if (ledMode == LED_MODE_NONE) return;

  uint32_t now = millis();

  // ===== SOS: 3 blinka pa duža pauza pa opet =====
  if (ledMode == LED_MODE_SOS) {
    if (patternLedState) {
      if (now - patternLastMs >= BLINK_ON_MS) {
        patternLedState = false;
        digitalWrite(PIN_SIGNAL_LED, LOW);
        patternLastMs = now;
        sosBlinkCount++;
      }
    } else {
      uint32_t waitMs = (sosBlinkCount >= 3) ? LONG_PAUSE_MS : BLINK_OFF_MS;

      if (now - patternLastMs >= waitMs) {
        if (sosBlinkCount >= 3) sosBlinkCount = 0;

        patternLedState = true;
        digitalWrite(PIN_SIGNAL_LED, HIGH);
        patternLastMs = now;
      }
    }
  }

  // ===== 10 blinkova pa duža pauza pa opet =====
  if (ledMode == LED_MODE_BLINK10) {
    if (patternLedState) {
      if (now - patternLastMs >= BLINK_ON_MS) {
        patternLedState = false;
        digitalWrite(PIN_SIGNAL_LED, LOW);
        patternLastMs = now;
        blink10Count++;
      }
    } else {
      uint32_t waitMs = (blink10Count >= 10) ? LONG_PAUSE_MS : BLINK_OFF_MS;

      if (now - patternLastMs >= waitMs) {
        if (blink10Count >= 10) blink10Count = 0;

        patternLedState = true;
        digitalWrite(PIN_SIGNAL_LED, HIGH);
        patternLastMs = now;
      }
    }
  }
}
// ================= FIREBASE UPIS =================
void sendToFirebase(float t, float h,
                    int lightRaw, int soilRaw, int waterRaw,
                    bool isDark, bool soilDry,
                    bool hasWater, bool shouldWater) {

  FirebaseJson json;
  json.set("tempC", t);
  json.set("humPct", h);
  json.set("ldrRaw", lightRaw);
  json.set("soilRaw", soilRaw);
  json.set("waterRaw", waterRaw);
  json.set("isDark", isDark);
  json.set("soilDry", soilDry);
  json.set("hasWater", hasWater);
  json.set("shouldWater", shouldWater);
  json.set("manualWatering", manualWatering);
  


 uint64_t ms = nowEpochMs();
if (ms > 0) json.set("tsEpochMs", (double)ms);
json.set("tsText", nowLocalText());
json.set("uptimeMs", (int)millis());


  String path = "/devices/" + DEVICE_ID + "/state/latest";

  if (!Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
    Serial.print("Firebase error: ");
    Serial.println(fbdo.errorReason());
  } else {
    Serial.println("Firebase LIVE OK");
  }
}
void checkCommandsAndApply(int soilRaw) {
  // WATER NOW (one-shot)
  String pWater = "/devices/" + DEVICE_ID + "/commands/waterNow";
  if (Firebase.RTDB.getBool(&fbdoCmd, pWater.c_str())) {
    bool cmd = fbdoCmd.boolData();
    if (cmd) {
      manualWatering = true;
      manualStartMs = millis();
      Firebase.RTDB.setBool(&fbdoCmd, pWater.c_str(), false);
      Serial.println("CMD: waterNow -> manualWatering ON");
    }
  }

  // REFILL (one-shot)
  String pRefill = "/devices/" + DEVICE_ID + "/commands/refill";
  if (Firebase.RTDB.getBool(&fbdoCmd, pRefill.c_str())) {
    bool cmd = fbdoCmd.boolData();
    if (cmd) {
      forceHasWaterUntilMs = millis() + FORCE_HASWATER_MS;
      hasWater = true;
      Firebase.RTDB.setBool(&fbdoCmd, pRefill.c_str(), false);
      Serial.println("CMD: refill -> force hasWater 10min");
    }
  }

  // stop ručnog zalijevanja: kad zemlja više nije suha ili timeout
  if (manualWatering) {
    bool soilDryNow = (soilRaw > SOIL_DRY_THRESHOLD);
    if (!soilDryNow) {
      manualWatering = false;
      Serial.println("MANUAL: stop (soil wet enough)");
    } else if (millis() - manualStartMs > MANUAL_MAX_MS) {
      manualWatering = false;
      Serial.println("MANUAL: stop (timeout)");
    }
  }
    // SOS START
  String pSOS = "/devices/" + DEVICE_ID + "/commands/sos";
  if (Firebase.RTDB.getBool(&fbdoCmd, pSOS.c_str())) {
    bool cmd = fbdoCmd.boolData();
    if (cmd) {
      startSOSPattern();
      Firebase.RTDB.setBool(&fbdoCmd, pSOS.c_str(), false);
      Firebase.RTDB.setBool(&fbdoCmd, ("/devices/" + DEVICE_ID + "/commands/sosStop").c_str(), false);
    }
  }

  // SOS STOP
  String pSOSStop = "/devices/" + DEVICE_ID + "/commands/sosStop";
  if (Firebase.RTDB.getBool(&fbdoCmd, pSOSStop.c_str())) {
    bool cmd = fbdoCmd.boolData();
    if (cmd) {
      if (ledMode == LED_MODE_SOS) stopLedPattern();
      Firebase.RTDB.setBool(&fbdoCmd, pSOSStop.c_str(), false);
      Serial.println("CMD: sosStop -> SOS OFF");
    }
  }

  // BLINK10 START
  String pBlink10 = "/devices/" + DEVICE_ID + "/commands/blink10";
  if (Firebase.RTDB.getBool(&fbdoCmd, pBlink10.c_str())) {
    bool cmd = fbdoCmd.boolData();
    if (cmd) {
      startBlink10Pattern();
      Firebase.RTDB.setBool(&fbdoCmd, pBlink10.c_str(), false);
      Firebase.RTDB.setBool(&fbdoCmd, ("/devices/" + DEVICE_ID + "/commands/blink10Stop").c_str(), false);
    }
  }

  // BLINK10 STOP
  String pBlink10Stop = "/devices/" + DEVICE_ID + "/commands/blink10Stop";
  if (Firebase.RTDB.getBool(&fbdoCmd, pBlink10Stop.c_str())) {
    bool cmd = fbdoCmd.boolData();
    if (cmd) {
      if (ledMode == LED_MODE_BLINK10) stopLedPattern();
      Firebase.RTDB.setBool(&fbdoCmd, pBlink10Stop.c_str(), false);
      Serial.println("CMD: blink10Stop -> BLINK10 OFF");
    }
  }
}
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  
pinMode(PIN_SIGNAL_LED, OUTPUT);
digitalWrite(PIN_SIGNAL_LED, LOW);

  dht.begin();

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_LDR, ADC_11db);
  analogSetPinAttenuation(PIN_SOIL, ADC_11db);
  analogSetPinAttenuation(PIN_WATER, ADC_11db);

  connectWiFi();
  syncTimeNTP();      
  firebaseInit();
}

void loop() {

  int lightRaw = readAnalogAvg(PIN_LDR);
  int soilRaw  = readAnalogAvg(PIN_SOIL);
  int waterRaw = readAnalogAvg(PIN_WATER);
checkCommandsAndApply(soilRaw);

  float t = dht.readTemperature();
  float h = dht.readHumidity();
  bool dhtOk = !(isnan(t) || isnan(h));

  bool soilDry = (soilRaw > SOIL_DRY_THRESHOLD);
  bool isDark  = (lightRaw > LDR_DARK_THRESHOLD);
bool sensorHasWater = hasWater;
if (!sensorHasWater && waterRaw > WATER_OK_THRESHOLD) sensorHasWater = true;
if (sensorHasWater && waterRaw < WATER_LOW_THRESHOLD) sensorHasWater = false;

if (forceHasWaterUntilMs > millis()) hasWater = true;
else hasWater = sensorHasWater;


bool shouldWaterAuto = soilDry && hasWater && !isDark;
bool shouldWater = manualWatering ? true : shouldWaterAuto;

// LED za zalijevanje
digitalWrite(PIN_LED, shouldWater ? HIGH : LOW);

// LED za signal
updateLedPattern();

  // ===== SERIAL =====
  Serial.println("==========");
  Serial.print("LDR: "); Serial.print(lightRaw);
  Serial.print(" | Dark: "); Serial.println(isDark ? "YES" : "NO");

  Serial.print("SOIL: "); Serial.print(soilRaw);
  Serial.print(" | Dry: "); Serial.println(soilDry ? "YES" : "NO");

  Serial.print("WATER: "); Serial.print(waterRaw);
  Serial.print(" | Has water: "); Serial.println(hasWater ? "YES" : "NO");

  Serial.print("Vrijeme: ");
  Serial.println(nowLocalText());

  if (dhtOk) {
    Serial.print("Temp: "); Serial.print(t); Serial.print(" C | Hum: ");
    Serial.print(h); Serial.println(" %");
  } else {
    Serial.println("DHT read failed!");
  }

  Serial.print("LED (pin 22) / Watering: ");
  Serial.println(shouldWater ? "ON" : "OFF");

  // ===== SLANJE U RTDB =====
  if (Firebase.ready() && millis() - lastSend > SEND_MS) {
    lastSend = millis();
    sendToFirebase(t, h, lightRaw, soilRaw, waterRaw,
                   isDark, soilDry, hasWater, shouldWater);
  }

  delay(20);
}
