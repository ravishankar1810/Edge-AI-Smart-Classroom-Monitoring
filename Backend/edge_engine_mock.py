import paho.mqtt.client as mqtt
import json
from mock_arduino import get_mock_sensor_data
import time
import cv2

# MQTT Settings
BROKER = "localhost"
PORT = 1883
TOPIC = "classroom/energy_commands"

# Setup MQTT Client
client = mqtt.Client()
client.connect(BROKER, PORT, 60)

print("Edge Engine Started. Listening for sensor data...")

# --- Initialize Camera ONCE outside the loop ---
print("Initializing camera...")
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Warning: Could not open camera. Continuing without video.")
    camera_available = False
else:
    camera_available = True
    # Load face detection model (once)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    print("Camera ready!")

while True:
    # Get Arduino sensor data
    raw_data = get_mock_sensor_data()
    
    try:
        sensors = json.loads(raw_data)
        temp = sensors['temperature']
        motion = sensors['motion_detected']
        
        # --- Get Camera Data ---
        occupancy_detected = False
        if camera_available:
            ret, frame = cap.read()
            if ret:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                occupancy_detected = len(faces) > 0
                
                # Optional: Show camera feed in a window (for debugging)
                # cv2.imshow('Camera Feed', frame)
                # if cv2.waitKey(1) & 0xFF == ord('q'):
                #     break
        
        # --- COMBINED EDGE AI LOGIC ---
        if not motion and not occupancy_detected:
            command = "TURN OFF AC & LIGHTS (Room Empty)"
        elif (motion or occupancy_detected) and temp > 25:
            if occupancy_detected:
                command = "TURN ON AC (Camera Detected Person & Hot)"
            else:
                command = "TURN ON AC (Motion Sensor & Hot)"
        elif motion or occupancy_detected:
            command = "DO NOTHING (Occupied but comfortable)"
        else:
            command = "DO NOTHING"
        
        # Prepare payload with separate variables for React to read easily
        payload = json.dumps({
            "command": command,
            "temperature": round(temp, 1),
            "motion": motion,
            "camera": occupancy_detected
        })
        
        # Publish to MQTT
        client.publish(TOPIC, payload)
        print(f"Published: {payload}")
        
    except json.JSONDecodeError:
        print("Error parsing data")
    
    time.sleep(2)

# Clean up
cap.release()
cv2.destroyAllWindows()