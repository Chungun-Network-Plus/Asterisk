import matplotlib.pyplot as plt
import matplotlib.animation as animation
import serial, time
import threading
import pyautogui
import serial.tools.list_ports

ports = serial.tools.list_ports.comports()
for port in ports:
    print(f"Device: {port.device}, Description: {port.description}")

MAX_LEN = 100
x_data = []
y_data = [[], [], []]
lines = []
labels = ['X chook gaksokdo', 'Y chook gaksokdo', 'Z chook gaksokdo']
output = ""  
last_motion_time = 0 
continuous_zero = 0
current_state = ""
current_updown = 0
the_time = 0
after_current_state = 0


def ARDUINO():
    global output
    port = 'COM8'  
    try:
        ser = serial.Serial(port, 9600, timeout=1)
        time.sleep(2)
        print(f"✅ Connected to {port}")
        while True:
            if ser.in_waiting:
                data = ser.readline().decode(errors='ignore').strip()
                if data:
                    output = data
    except Exception as e:
        print(f"❌ {port} failed: {e}")

fig, axes = plt.subplots(3, 1, figsize=(8, 8))
for i, ax in enumerate(axes):
    line, = ax.plot([], [], lw=2)
    lines.append(line)
    ax.set_xlim(0, MAX_LEN)
    ax.set_ylim(-600, 600)
    ax.set_title(labels[i])
    ax.grid(True)

def update(frame):
    global output, last_motion_time, continuous_zero, current_state, the_time, after_current_state

    if not output or not lines:
        return lines

    try:
        avs = list(map(float, output.split(",")))
    except:
        return lines

    while len(avs) < 3:
        avs.append(0.0)

    x_data.append(frame)
    if len(x_data) > MAX_LEN:
        x_data.pop(0)

    if abs(avs[2]) < 50:
        continuous_zero += 0.05
        # print(f"continuous_zero : {continuous_zero}, current_state : {current_state}")
    else:
        continuous_zero = 0
    if continuous_zero >= 0.5 and current_state != "":
      if the_time >= 0.3:
        the_time = 0
      elif the_time == 0:
        if current_state == "page front":
          print("right")
          pyautogui.press("right")
        if current_state == "page back":
          print("left")
          pyautogui.press("left")
  
      else:
        the_time += 0.05
      # print("go!!!")
    # print(avs[2])

    if after_current_state  > 0.2:
        if current_state == "page front" and avs[2] < -50:
          current_state = ""
        if current_state == "page back" and avs[2] > 50:
          current_state = ""
    else:
      after_current_state += 0.05
    if current_state == "":
      after_current_state = 0



    for i in range(3):
        y_data[i].append(avs[i])
        if len(y_data[i]) > MAX_LEN:
            y_data[i].pop(0)

        if abs(avs[i]) > 450 and time.time() - last_motion_time > 0.5:
            last_motion_time = time.time()
            if avs[i] > 0:
              print("page front")
              pyautogui.press("right")                
              current_state = "page front"
              
            else:
              print("page down")
              pyautogui.press("left")
              current_state = "page back"


        lines[i].set_data(range(len(y_data[i])), y_data[i])

    return lines

t = threading.Thread(target=ARDUINO, daemon=True)
t.start()
ani = animation.FuncAnimation(
    fig,
    update,
    interval=50,  
    blit=True, 
    cache_frame_data=False   
)

plt.tight_layout()
plt.show()
