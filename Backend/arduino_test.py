import serial
import time

arduino = serial.Serial("COM5", 9600, timeout=1)

time.sleep(2)

while True:

    line = arduino.readline().decode("utf-8").strip()

    if line:
        print("Arduino:", line)