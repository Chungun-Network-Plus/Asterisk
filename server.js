const express = require('express');
const os = require('os');
const https = require('https');
const selfsigned = require('selfsigned');
const WebSocket = require('ws');
const path = require('path');
const {
  Key,
  keyboard,
  mouse,
  Point,
  screen,
  Button,
} = require('@nut-tree-fork/nut-js');

const app = express();
const port = 3000;

let [mousex, mousey] = [0, 0];
let [width, height] = [0, 0];

keyboard.config.autoDelayMs = 20;
mouse.config.autoDelayMs = 20;

(async () => {
  const position = await mouse.getPosition();
  mousex = position.x;
  mousey = position.y;

  width = await screen.width();
  height = await screen.height();
})();

function separateCommand(command) {
  const commandSlashCount = command.split('/').length - 1;
  let temporarycommand = command;
  for (let i = 0; i < 3 - commandSlashCount; i++) {
    temporarycommand = temporarycommand + '/';
  }
  return temporarycommand.split('/');
}

const ip = (() => {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
})();

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0'); // 0~11이므로 +1
  const dd = String(date.getDate()).padStart(2, '0');

  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${yyyy}.${mm}.${dd}. ${hh}:${min}:${ss}`;
}

const attrs = [{ name: 'commonName', value: ip }];
const pems = selfsigned.generate(attrs, { days: 365 });

// ── 핵심 변경 ──
// public 폴더 기준을 process.cwd()로 바꿈 (실행 위치 기준)
app.use(express.static(path.join(process.cwd(), 'public')));

app.use((req, res, next) => {
  if (
    req.url !== '/favicon.ico' &&
    req.url !== '/Asterisk_Logo.png' &&
    req.url !== '/left-arrow.png' &&
    req.url !== '/right-arrow.png'
  )
    console.log(`[${formatDate(new Date())}] '${req.url}'`);
  next();
});

// 홈 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pages/home.html'));
});

// 다른 페이지
app.get('/presenter', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pages/presenter.html'));
});

app.get('/trackpad', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pages/trackpad.html'));
});

app.get('/mouse', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pages/mouse.html'));
});

app.get('/pointer', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pages/pointer.html'));
});

app.get('/stylus', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/pages/stylus.html'));
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/images/favicon.ico'));
});

app.get('/Asterisk_Logo.png', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/images/Asterisk_Logo.png'));
});

app.get('/left-arrow.png', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/images/left-arrow.png'));
});

app.get('/right-arrow.png', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/images/right-arrow.png'));
});

// HTTPS 서버
const server = https.createServer(
  {
    key: pems.private,
    cert: pems.cert,
  },
  app
);

// WebSocket
const wss = new WebSocket.Server({ server });

let initfuck = [0, 0];
let initmousepos = [0, 0];
let currentMode = '';

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const [mode, command, x, y, x2, y2] = separateCommand(message.toString());

    // stylus
    if (mode === 'stylus') {
      try {
        const screenWidth = await screen.width();
        const screenHeight = await screen.height();

        // ===== 모드 전환 =====
        async function switchMode(targetMode, key) {
          if (currentMode === targetMode) return; // 이미 같은 모드면 스킵
          await Promise.all([
            keyboard.pressKey(Key.LeftControl),
            keyboard.pressKey(key),
          ]);
          await Promise.all([
            keyboard.releaseKey(key),
            keyboard.releaseKey(Key.LeftControl),
          ]);
          currentMode = targetMode;
        }

        // ===== 모드 시작 =====
        if (command === 'dotStart') {
          await switchMode('dot', Key.L);
          await mouse.pressButton(Button.LEFT);
        }
        if (command === 'lineStart') {
          await switchMode('line', Key.P);
          await mouse.pressButton(Button.LEFT);
        }
        if (command === 'eraserStart') {
          await switchMode('eraser', Key.E);
          await mouse.pressButton(Button.LEFT);
        }

        // ===== 좌표 이동 =====
        if (['dot', 'line', 'eraser'].includes(command) && x && y) {
          const posX = (x / 800) * screenWidth;
          const posY = (y / 600) * screenHeight;
          mouse.setPosition({ x: posX, y: posY }); // await 제거 → 더 빠름
        }

        // ===== 터치 종료 =====
        if (['dotEnd', 'lineEnd', 'eraserEnd'].includes(command)) {
          await mouse.releaseButton(Button.LEFT);
        }

        // ===== 페이지 이동 =====
        else if (command === 'before') {
          await keyboard.pressKey(Key.P);
          await keyboard.releaseKey(Key.P);
        } else if (command === 'after') {
          await keyboard.pressKey(Key.N);
          await keyboard.releaseKey(Key.N);
        }

        // ===== 전체 지우기 =====
        else if (command === 'clear') {
          await keyboard.pressKey(Key.E);
          await keyboard.releaseKey(Key.E);
        }

        // ===== 제스처 =====
        else if (command === 'gesture' && x && y && x2 && y2) {
          const dx = x - x2;
          const dy = y - y2;
          const minDistance = 30;

          if (Math.abs(dx) < minDistance && Math.abs(dy) < minDistance) return;

          let direction = '';
          const slope = Math.abs(dy / dx);

          if (dx > 0 && dy > 0) direction = slope > 1 ? 'up' : 'left';
          else if (dx < 0 && dy > 0) direction = slope > 1 ? 'up' : 'right';
          else if (dx < 0 && dy < 0) direction = slope > 1 ? 'down' : 'right';
          else if (dx > 0 && dy < 0) direction = slope > 1 ? 'down' : 'left';
          else if (dx === 0) direction = dy > 0 ? 'up' : 'down';
          else if (dy === 0) direction = dx > 0 ? 'right' : 'left';

          if (direction === 'right') {
            await keyboard.pressKey(Key.N);
            await keyboard.releaseKey(Key.N);
          } else if (direction === 'left') {
            await keyboard.pressKey(Key.P);
            await keyboard.releaseKey(Key.P);
          } else if (direction === 'up') {
            await keyboard.pressKey(Key.B);
            await keyboard.releaseKey(Key.B);
          } else if (direction === 'down') {
            await keyboard.pressKey(Key.W);
            await keyboard.releaseKey(Key.W);
          }
          currentMode = 'gesture';
        }
      } catch (err) {
        console.error('에러:', err);
      }
    }

    // presenter
    if (mode === 'presenter') {
      if (command === 'enter') {
        await keyboard.pressKey(Key.Right);
        await keyboard.releaseKey(Key.Right);
      }
      if (command === 'goback') {
        await keyboard.pressKey(Key.Left);
        await keyboard.releaseKey(Key.Left);
      }
    }

    // trackpad
    if (mode === 'trackpad') {
      if (command === 'move') {
        const acceleration = Math.sqrt(parseFloat(x) ** 2 + parseFloat(y) ** 2);
        mousex += parseFloat(x) * Math.log(acceleration + 1) * 2;
        mousey += parseFloat(y) * Math.log(acceleration + 1) * 2;

        if (mousex < 0) mousex = 0;
        if (mousey < 0) mousey = 0;
        if (mousex > width) mousex = width;
        if (mousey > height) mousey = height;

        await mouse.setPosition(new Point(mousex, mousey));
      }
      if (command === 'leftclick') {
        await mouse.pressButton(Button.LEFT);
        await mouse.releaseButton(Button.LEFT);
      }
      if (command === 'rightclick') {
        await mouse.click(Button.RIGHT);
      }
      if (command === 'vertscroll') {
        await mouse.scrollUp(y * 3);
      }
      if (command === 'horiscroll') {
        await mouse.scrollRight(x * 3);
      }
      if (command === 'clickmovestart') {
        await mouse.pressButton(Button.LEFT);
      }
      if (command === 'clickmoveend') {
        await mouse.releaseButton(Button.LEFT);
      }
    }

    // mouse
    if (mode === 'mouse') {
      if (command === 'leftclickstart') await mouse.pressButton(Button.LEFT);
      if (command === 'leftclickend') await mouse.releaseButton(Button.LEFT);
      if (command === 'rightclickstart') await mouse.pressButton(Button.RIGHT);
      if (command === 'rightclickend') await mouse.releaseButton(Button.RIGHT);
    }

    // pointer
    if (mode === 'pointer') {
      if (command === 'start') {
        initfuck = [parseFloat(x), parseFloat(y)];
        const pos = await mouse.getPosition();
        initmousepos = [pos.x, pos.y];
      }
      if (command === 'move') {
        await mouse.setPosition(
          new Point(
            initmousepos[0] + (parseFloat(x) - initfuck[0]) * 10,
            initmousepos[1] + (parseFloat(y) - initfuck[1]) * 10
          )
        );
      }
    }
  });
});

const message = `
 █████╗ ███████╗████████╗███████╗██████╗ ██╗███████╗██╗  ██╗      
██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗██║██╔════╝██║ ██╔╝▄ ██╗▄
███████║███████╗   ██║   █████╗  ██████╔╝██║███████╗█████╔╝  ████╗
██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗██║╚════██║██╔═██╗ ▀╚██╔▀
██║  ██║███████║   ██║   ███████╗██║  ██║██║███████║██║  ██╗  ╚═╝ 
╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝      
                                
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ Welcome to Asterisk*.                                                                 │
│                                                                                       │
│ Asterisk* is a presenter and remote input device using smartphone.                    │
│ In order to use all its fancy functions, you have to access to the below URL.         │
│ For perfect performance of Asterisk*, follow to guide precisely.                      │
│ WARNING : ONLY ONE MOBILE DEVICE ONLY! SAME WI-FI OR HOTSPOT ENVIRONMENT!             │
└───────────────────────────────────────────────────────────────────────────────────────┘
`;

server.listen(port, '0.0.0.0', () => {
  console.clear();
  console.log(message);
  console.log(`URL to connect : https://${ip}:${port}\n`);
  console.log('[Asterisk* Prompt Logs]');
});
