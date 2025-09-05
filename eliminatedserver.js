const express = require('express');
const os = require('os');
const https = require('https');
const selfsigned = require('selfsigned');
const WebSocket = require('ws');
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

const attrs = [{ name: 'commonName', value: ip }];
const pems = selfsigned.generate(attrs, { days: 365 });

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0'); // 0~11이므로 +1
  const dd = String(date.getDate()).padStart(2, '0');

  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${yyyy}.${mm}.${dd}. ${hh}:${min}:${ss}`;
}

function sendFromGitHub(url, res) {
  https
    .get(url, (response) => {
      // Content-Type을 그대로 전달
      res.setHeader(
        'Content-Type',
        response.headers['content-type'] || 'application/octet-stream'
      );
      response.pipe(res);
    })
    .on('error', (err) => {
      res.status(500).send('Error fetching file');
    });
}

// Express 라우트
app.use((req, res, next) => {
  if (req.url !== '/favicon.ico' && req.url !== '/Asterisk_Logo.png')
    console.log(`[${formatDate(new Date())}] '${req.url}'`);
  next();
});

// GitHub Pages URL
const baseUrl = 'https://Chungun-Network-Plus.github.io/Asterisk/public/pages/';

// 홈 페이지
app.get('/', (req, res) => {
  sendFromGitHub(baseUrl + 'home.html', res);
});
app.get('/presenter', (req, res) => {
  sendFromGitHub(baseUrl + 'presenter.html', res);
});
app.get('/trackpad', (req, res) => {
  sendFromGitHub(baseUrl + 'trackpad.html', res);
});
app.get('/mouse', (req, res) => {
  sendFromGitHub(baseUrl + 'mouse.html', res);
});
app.get('/pointer', (req, res) => {
  sendFromGitHub(baseUrl + 'pointer.html', res);
});
app.get('/favicon.ico', (req, res) => {
  sendFromGitHub(
    'https://Chungun-Network-Plus.github.io/Asterisk/public/images/favicon.ico',
    res
  );
});
app.get('/Asterisk_Logo.png', (req, res) => {
  sendFromGitHub(
    'https://Chungun-Network-Plus.github.io/Asterisk/public/images/Asterisk_Logo.png',
    res
  );
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

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const [mode, command, x, y] = separateCommand(message.toString());

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
