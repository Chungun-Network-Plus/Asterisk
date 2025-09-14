import pyautogui
import time
import matplotlib.pyplot as plt

dt = 0.05

times = []
speeds = []

x_prev, y_prev = pyautogui.position()
t_prev = time.time()

plt.ion()
fig, ax = plt.subplots()
line, = ax.plot([], [], 'b-')
ax.set_xlabel("Time")
ax.set_ylabel("Speed")
ax.set_title("Mouse Pointer Speed")

start_time = t_prev

while True:
    time.sleep(dt)
    x, y = pyautogui.position()
    t = time.time()
    
    dx = x - x_prev
    dy = y - y_prev
    dist = (dx**2 + dy**2) ** 0.5
    
    v = dist / (t - t_prev)
    
    times.append(t - start_time)
    speeds.append(v)
    
    line.set_xdata(times)
    line.set_ydata(speeds)
    ax.relim()
    ax.autoscale_view()
    plt.draw()
    plt.pause(0.01)
    
    x_prev, y_prev = x, y
    t_prev = t
