import cv2

camera = cv2.VideoCapture(0)

if not camera.isOpened():
    print("Could not open camera")
    exit()

print("Camera started. Press Q to quit.")

while True:

    ret, frame = camera.read()

    if not ret:
        print("Could not read camera")
        break

    cv2.imshow("Laptop Camera", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

camera.release()
cv2.destroyAllWindows()