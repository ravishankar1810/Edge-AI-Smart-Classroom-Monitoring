import paho.mqtt.client as mqtt
import json
import time
import cv2
import serial


# ============================================================
# MQTT SETTINGS
# ============================================================

BROKER = "localhost"
PORT = 1883
TOPIC = "classroom/energy_commands"


# ============================================================
# ARDUINO SETTINGS
# ============================================================

# Change this to the COM port that worked with arduino_test.py
ARDUINO_PORT = "COM5"

ARDUINO_BAUDRATE = 9600


# ============================================================
# MQTT CONNECTION
# ============================================================

client = mqtt.Client()

try:
    client.connect(BROKER, PORT, 60)
    print("MQTT connected!")

except Exception as e:
    print("ERROR: Could not connect to MQTT broker.")
    print("Make sure Mosquitto is running.")
    print("Error:", e)
    exit()


# ============================================================
# ARDUINO CONNECTION
# ============================================================

try:

    arduino = serial.Serial(
        ARDUINO_PORT,
        ARDUINO_BAUDRATE,
        timeout=1
    )

    # Arduino usually resets when serial connection opens.
    # Give it some time to start.
    time.sleep(2)

    # Clear old data that may be waiting in the serial buffer.
    arduino.reset_input_buffer()

    print("Arduino connected!")

except Exception as e:

    print("ERROR: Could not connect to Arduino.")
    print("Check your Arduino COM port.")
    print("Error:", e)
    exit()


# ============================================================
# CAMERA INITIALIZATION
# ============================================================

print("Initializing camera...")

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("Warning: Could not open camera.")
    print("Continuing without camera.")

    camera_available = False

else:

    camera_available = True

    # Load OpenCV Haar Cascade face detector
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades +
        "haarcascade_frontalface_default.xml"
    )

    print("Camera ready!")


# ============================================================
# EDGE ENGINE START
# ============================================================

print()
print("==============================================")
print("     EDGE AI SMART CLASSROOM SYSTEM")
print("==============================================")
print("Reading Arduino + Camera data...")
print()


# ============================================================
# MAIN LOOP
# ============================================================

try:

    while True:

        # ====================================================
        # 1. READ DATA FROM ARDUINO
        # ====================================================

        raw_data = arduino.readline().decode(
            "utf-8",
            errors="ignore"
        ).strip()


        # ----------------------------------------------------
        # Ignore blank lines
        # ----------------------------------------------------

        if not raw_data:
            continue


        # ----------------------------------------------------
        # Arduino sends sensor data like:
        #
        # 24.10,57.70,1,96,0
        #
        # But it may also send:
        #
        # Arduino Sensor System Started
        #
        # We ignore anything that is not sensor data.
        # ----------------------------------------------------

        values = raw_data.split(",")


        # We need exactly 5 sensor values
        if len(values) != 5:

            print(
                "Ignoring Arduino message:",
                raw_data
            )

            continue


        # ====================================================
        # 2. CONVERT SENSOR VALUES
        # ====================================================

        try:

            temperature = float(values[0])

            humidity = float(values[1])

            flame_status = int(values[2])

            light_level = int(values[3])

            motion_status = int(values[4])


        except ValueError:

            print(
                "Ignoring non-sensor Arduino message:",
                raw_data
            )

            continue


        # ====================================================
        # 3. PROCESS PIR MOTION
        # ====================================================

        if motion_status == 1:

            motion = True

        else:

            motion = False


        # ====================================================
        # 4. PROCESS FLAME SENSOR
        # ====================================================
        #
        # Based on your Arduino code:
        #
        # 0 = Flame detected
        # 1 = Safe
        #
        # ====================================================

        if flame_status == 0:

            fire_detected = True

        else:

            fire_detected = False


        # ====================================================
        # 5. CAMERA / OCCUPANCY DETECTION
        # ====================================================

        occupancy_detected = False


        if camera_available:

            ret, frame = cap.read()


            if ret:

                # Convert image to grayscale
                gray = cv2.cvtColor(
                    frame,
                    cv2.COLOR_BGR2GRAY
                )


                # Detect faces
                faces = face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=4
                )


                # Determine occupancy
                occupancy_detected = len(faces) > 0


                # ------------------------------------------------
                # Draw rectangles around detected faces
                # ------------------------------------------------

                for (x, y, w, h) in faces:

                    cv2.rectangle(
                        frame,
                        (x, y),
                        (x + w, y + h),
                        (0, 255, 0),
                        2
                    )


                # ------------------------------------------------
                # Display occupancy status
                # ------------------------------------------------

                if occupancy_detected:

                    status_text = "Person Detected"

                else:

                    status_text = "No Person"


                cv2.putText(
                    frame,
                    status_text,
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 255, 0),
                    2
                )


                # ------------------------------------------------
                # Show camera window
                # ------------------------------------------------

                cv2.imshow(
                    "Smart Classroom Camera",
                    frame
                )


                # ------------------------------------------------
                # Press Q to stop
                # ------------------------------------------------

                if cv2.waitKey(1) & 0xFF == ord("q"):

                    break


        # ====================================================
        # 6. EDGE AI DECISION LOGIC
        # ====================================================

        # ----------------------------------------------------
        # Priority 1: Fire
        # ----------------------------------------------------

        if fire_detected:

            command = "FIRE ALERT"


        # ----------------------------------------------------
        # Priority 2: Room empty
        # ----------------------------------------------------

        elif not motion and not occupancy_detected:

            command = (
                "TURN OFF AC & LIGHTS "
                "(Room Empty)"
            )


        # ----------------------------------------------------
        # Priority 3:
        # Person present + temperature > 25°C
        # ----------------------------------------------------

        elif (
            (motion or occupancy_detected)
            and temperature > 25
        ):

            if occupancy_detected:

                command = (
                    "TURN ON AC "
                    "(Camera Detected Person & Hot)"
                )

            else:

                command = (
                    "TURN ON AC "
                    "(Motion Sensor & Hot)"
                )


        # ----------------------------------------------------
        # Priority 4:
        # Person present but temperature comfortable
        # ----------------------------------------------------

        elif motion or occupancy_detected:

            command = (
                "DO NOTHING "
                "(Occupied but Comfortable)"
            )


        # ----------------------------------------------------
        # Default
        # ----------------------------------------------------

        else:

            command = "DO NOTHING"


        # ====================================================
        # 7. CREATE JSON DATA
        # ====================================================

        payload = {

            "command": command,

            "temperature": round(
                temperature,
                1
            ),

            "humidity": round(
                humidity,
                1
            ),

            "light": light_level,

            "fire": fire_detected,

            "motion": motion,

            "camera": occupancy_detected

        }


        # Convert Python dictionary → JSON
        payload_json = json.dumps(payload)


        # ====================================================
        # 8. SEND DATA THROUGH MQTT
        # ====================================================

        result = client.publish(
            TOPIC,
            payload_json
        )


        # ====================================================
        # 9. DISPLAY INFORMATION IN TERMINAL
        # ====================================================

        print("------------------------------------------")

        print(
            "Temperature :",
            temperature,
            "°C"
        )

        print(
            "Humidity    :",
            humidity,
            "%"
        )

        print(
            "Light       :",
            light_level,
            "%"
        )

        print(
            "Motion      :",
            "Detected"
            if motion
            else "No Motion"
        )

        print(
            "Fire        :",
            "FIRE DETECTED"
            if fire_detected
            else "SAFE"
        )

        print(
            "Camera      :",
            "Person Detected"
            if occupancy_detected
            else "No Person"
        )

        print(
            "Decision    :",
            command
        )

        print(
            "MQTT        :",
            payload_json
        )

        print("------------------------------------------")


        # ====================================================
        # 10. WAIT BEFORE NEXT READING
        # ====================================================

        time.sleep(2)


# ============================================================
# STOP PROGRAM WITH CTRL + C
# ============================================================

except KeyboardInterrupt:

    print()
    print("Stopping Edge AI system...")


# ============================================================
# CLEANUP
# ============================================================

finally:

    # Close Arduino
    try:

        if arduino.is_open:

            arduino.close()

            print("Arduino connection closed.")

    except Exception:
        pass


    # Close camera
    try:

        if camera_available:

            cap.release()

            cv2.destroyAllWindows()

    except Exception:
        pass


    # Disconnect MQTT
    try:

        client.disconnect()

        print("MQTT disconnected.")

    except Exception:
        pass


    print("Edge AI system stopped.")