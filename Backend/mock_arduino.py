import time
import random
import json

# This simulates the data we will eventually get via USB Serial
def get_mock_sensor_data():
    data = {
        "temperature": random.uniform(22.0, 30.0),
        "humidity": random.uniform(40.0, 60.0),
        "motion_detected": random.choice([True, False])
    }
    return json.dumps(data)

if __name__ == "__main__":
    print("Starting Mock Arduino. Press Ctrl+C to stop.")
    while True:
        sensor_json = get_mock_sensor_data()
        print(f"Mock Data: {sensor_json}")
        # In step 4, we will send this data to the logic script
        time.sleep(5) # Send data every 2 seconds