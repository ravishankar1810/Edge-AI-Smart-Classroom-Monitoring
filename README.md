## 🔌 Arduino Circuit & Wiring

The Arduino Uno collects environmental and classroom activity data using
multiple sensors. The sensor readings are sent to the Edge AI backend
through the Arduino's serial communication.

### Circuit Diagram

![Arduino Smart Classroom Circuit Diagram](docs/circuit-diagram.png)

> **Note:** Place the circuit diagram image at:
> `docs/circuit-diagram.png`

### Sensor Wiring

| Component | Arduino Pin | Purpose |
|---|---|---|
| 🌡️ DHT11 Temperature & Humidity Sensor | D2 | Measures temperature and humidity |
| 🔥 Flame Sensor | D3 | Detects fire/flame |
| 🚶 PIR Motion Sensor | D4 | Detects motion |
| 💡 LDR Light Sensor | A0 | Measures light intensity |

### Power Connections

| Component | VCC | GND |
|---|---|---|
| DHT11 | 5V | GND |
| Flame Sensor | 5V | GND |
| PIR Sensor | 5V | GND |
| LDR Module | 5V | GND |

### Arduino Pin Configuration

```text
                 Arduino UNO
              ┌───────────────┐
              │               │
 DHT11 DATA ──┤ D2            │
 Flame OUT ───┤ D3            │
 PIR OUT ─────┤ D4            │
 LDR OUT ─────┤ A0            │
              │               │
 VCC ─────────┤ 5V            │
 GND ─────────┤ GND           │
              │               │
              └───────────────┘

###Sensor Data Flow

┌───────────────┐
│   DHT11       │
│ Temp/Humidity │
└───────┬───────┘
        │ D2
        ▼
┌────────────────┐
│                │
│   Arduino UNO  │◄──── PIR Motion Sensor (D4)
│                │
│                │◄──── Flame Sensor (D3)
│                │
│                │◄──── LDR Sensor (A0)
└───────┬────────┘
        │
        │ Serial Communication
        ▼
┌─────────────────────┐
│    Python Edge AI   │
│                     │
│ Sensor Processing   │
│ + Camera Detection  │
└──────────┬──────────┘
           │
           │ MQTT
           ▼
┌─────────────────────┐
│   React Dashboard   │
└─────────────────────┘

###Arduino Serial Data
The Arduino sends the sensor readings to the Python backend through
serial communication.
Example:
Temperature,Humidity,Motion,Light,Fire
24.00,57.90,1,96,0
24.10,57.70,1,96,0

Where:
- Temperature → Temperature measured by DHT11
- Humidity → Humidity measured by DHT11
- Motion → PIR motion status
- Light → LDR light level
- Fire → Flame sensor status

###⚠️ Safety
For demonstration purposes, use low-voltage loads when testing relay
control. Do not connect AC mains directly to the Arduino or relay
module unless the electrical installation is performed by a qualified
person.

### 📁 Recommended GitHub structure

I recommend keeping the diagram like this:

```text
Edge-AI-Smart-Classroom-Monitoring/
│
├── Arduino/
│   └── student_monitering_system.ino
│
├── Backend/
│   ├── ...
│
├── Frontend/
│   ├── ...
│
├── docs/
│   └── circuit-diagram.png
│
├── README.md
└── .gitignore
