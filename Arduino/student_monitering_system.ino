#include <DHT.h>

// Pin Definitions
#define DHTPIN 2          // Temp & Humidity Sensor
#define FLAME_PIN 3       // Fire/Flame Sensor (Digital output)
#define LDR_PIN A0        // LDR Light Sensor (Analog input)
#define PIR_PIN 4         // PIR Motion Sensor (Digital input)

#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  
  // Initialize DHT
  dht.begin();
  
  // Pin Modes
  pinMode(FLAME_PIN, INPUT);
  pinMode(PIR_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);

  Serial.println("=========================================");
  Serial.println(" Multi-Sensor Monitoring System Started ");
  Serial.println("=========================================\n");
}

void loop() {
  // 1. Read Temperature & Humidity
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // 2. Read Fire Sensor (Active LOW on most flame sensor modules)
  int flameStatus = digitalRead(FLAME_PIN); 

  // 3. Read LDR Sensor Value (0 to 1023)
  int ldrRaw = analogRead(LDR_PIN);
  int lightPercent = map(ldrRaw, 1023, 0, 0, 100); // Map to percentage
  lightPercent = constrain(lightPercent, 0, 100);

  // 4. Read PIR Motion Sensor
  int motionStatus = digitalRead(PIR_PIN);

  // --- Display Monitor Output ---
  Serial.println("--- [ENVIRONMENT STATUS] ---");
  
  // Temperature & Humidity Output
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Temp/Humidity : Reading Error!");
  } else {
    Serial.print("Temperature   : ");
    Serial.print(temp);
    Serial.print(" C  |  Humidity: ");
    Serial.print(hum);
    Serial.println("%");
  }

  // Light Level Output
  Serial.print("Light Level   : ");
  Serial.print(lightPercent);
  Serial.println("%");

  // Flame Output (LOW = Flame Detected on standard digital flame modules)
  Serial.print("Fire Status   : ");
  if (flameStatus == LOW) {
    Serial.println("🔥 FIRE DETECTED! ALARM!");
  } else {
    Serial.println("SAFE ✅");
  }

  // Motion Output
  Serial.print("Motion Status : ");
  if (motionStatus == HIGH) {
    Serial.println("🚶 Motion Detected!");
  } else {
    Serial.println("No Motion 🧘");
  }

  Serial.println("----------------------------\n");

  delay(2000); // Refresh interval
}