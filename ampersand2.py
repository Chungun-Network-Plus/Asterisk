import serial
import matplotlib.pyplot as plt
import pyautogui
import math

moving_x = 0
moving_y = 0
padding = 10


PORT = "COM8"   
BAUD = 9600
ser = serial.Serial(PORT, BAUD, timeout=1)


THRESHOLD = 50.0    
DEADZONE = 5.0        
STEP = 0.5    
scale = 0.5    

screen_width, screen_height = pyautogui.size()
mouse_x, mouse_y = pyautogui.position()

pyautogui.PAUSE = 0


try:
    while True:
        
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        if not line or ',' not in line:
            continue

        try:
            gx, gy, gz = map(float, line.split(','))
        except ValueError:
            continue

    

        acceleration = math.sqrt(gx ** 2 + gy ** 2);
        mouse_x += -gx * math.log(acceleration + 1) * scale;
        mouse_y += -gy * math.log(acceleration + 1) * scale;
        

        mouse_x = max(padding, min(screen_width - padding, mouse_x))
        mouse_y = max(padding, min(screen_height - padding, mouse_y))
        #mouse_x += moving_x * scale
        #mouse_y += moving_y * scale

        #pyautogui.moveRel(moving_x * scale, moving_y * scale, duration=0)
        pyautogui.moveTo(mouse_x, mouse_y, duration=0) 


except KeyboardInterrupt:
    print("\n 종료")
    ser.close()
    plt.ioff()
    plt.show()
