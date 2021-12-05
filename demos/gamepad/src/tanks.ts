import * as PIXI from "pixi.js";
import { Slowbro, Device } from "slowbro";
import { degreesToButtonsNoCross, Direction } from "./joystick_utils";
import { simulate, simulateKeyBoard } from "./simulate";

const joystickPressThreshold = 0.05;

export function tanks(slowbro: Slowbro, host: HTMLElement) {
  host.innerHTML = "";

  host.innerHTML = `
  <div
      id="content-holder"
      style="margin: 0; width: 100%; height: 100%; position: relative"
    >
      <iframe
        id="game-iframe"
        src="tanks/"
        style="border: 0; width: 100%; height: 100%; position: absolute"
        >Your browser doesn't support iFrames.</iframe
      >
      <div
        id="input-layer"
        style="
          pointer-events: none;
          border: 0;
          width: 100%;
          height: 100%;
          position: absolute;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
        "
      >
      </div>
    </div>
  `;
  const iframe: HTMLIFrameElement = document.getElementById(
    "game-iframe"
  ) as HTMLIFrameElement;
  const inputLayer: HTMLDivElement = document.getElementById(
    "input-layer"
  ) as HTMLDivElement;

  iframe.onload = () => run(slowbro, iframe, inputLayer);
}

interface CursorsPosition {
  [key: string]: { x: number, y: number }
}

interface KeyboardState {
  [key: string]: { direction: Direction }
}

const run = async (
  slowbro: Slowbro,
  iframe: HTMLIFrameElement,
  inputLayer: HTMLDivElement
) => {
  const canvasDiv = iframe.contentDocument?.getElementById(
    "c2canvasdiv"
  ) as HTMLDivElement;
  const players = slowbro.linkIds;
  const cursorPositions: CursorsPosition = players.reduce<CursorsPosition>((acc, k) => {
    acc[k] = {
      x: 0,
      y: 0,
    }; return acc
  }, {});

  const keyboards = players.reduce<KeyboardState>((acc, k) => {
    acc[k] = {
      direction: Direction.none,
    }; return acc
  }, {});
  const gameCanvas = canvasDiv?.querySelector("#c2canvas") as HTMLCanvasElement;
  const cursorG = new PIXI.Graphics();
  const onJoystickChange = (player: string, degree: number, distance: number) => {
    const idx = players.indexOf(player);
    const keyboard = keyboards[player];
    const currentDirection =
      distance > joystickPressThreshold
        ? degreesToButtonsNoCross(degree)
        : Direction.none;

    if (
      keyboard.direction != currentDirection &&
      keyboard.direction != Direction.none
    ) {
      const [code, which] = idx ? playerTwoDirectionKeys(keyboard.direction) : playerOneDirectionKeys(keyboard.direction);
      simulateKeyBoard(
        iframe.contentDocument!,
        "keyup",
        {
          code,
          which,
        },
        window
      );
    }
    if (currentDirection != Direction.none) {
      const [code, which] = idx ? playerTwoDirectionKeys(currentDirection) : playerOneDirectionKeys(currentDirection);
      simulateKeyBoard(
        iframe.contentDocument!,
        "keydown",
        {
          code,
          which,
        },
        iframe.contentWindow!
      );
    }
    keyboard.direction = currentDirection;
  };

  const onPadInput = (player: string, index: number, gesture: number) => {
    const idx = players.indexOf(player);
    const [code, which] = idx ? playerTwoHitKeys(index) : playerOneHitKeys(index);
    simulateKeyBoard(
      iframe.contentDocument!,
      "keydown",
      {
        code,
        which,
      },
      iframe.contentWindow!
    );
    simulateKeyBoard(
      iframe.contentDocument!,
      "keyup",
      {
        code,
        which,
      },
      iframe.contentWindow!
    );
  };

  const onMouseMove = (player: string, xRatio: number, yRatio: number) => {
    cursorG.clear();
    cursorG.lineStyle(2, 0xffffff, 1);
    cursorG.drawCircle(
      gameCanvas.clientWidth * xRatio,
      gameCanvas.clientHeight * yRatio,
      gameCanvas.clientHeight * 0.05
    );
    cursorPositions[players[0]].x = xRatio;
    cursorPositions[players[0]].y = yRatio;
  };

  const onMouseTap = (player: string, xRatio: number, yRatio: number) => {
    cursorG.clear();
    cursorG.lineStyle(2, 0xffffff, 1);
    cursorG.drawCircle(
      gameCanvas.clientWidth * cursorPositions[players[0]].x,
      gameCanvas.clientHeight * cursorPositions[players[0]].y,
      gameCanvas.clientHeight * 0.05
    );
    const rect = gameCanvas.getBoundingClientRect();
    simulate(
      gameCanvas,
      "mousedown",
      {
        pointerX: rect.left + gameCanvas.clientWidth * cursorPositions[players[0]].x,
        pointerY: rect.top + gameCanvas.clientHeight * cursorPositions[players[0]].y,
      },
      window
    );
    simulate(
      gameCanvas,
      "mouseup",
      {
        pointerX: rect.left + gameCanvas.clientWidth * cursorPositions[players[0]].x,
        pointerY: rect.top + gameCanvas.clientHeight * cursorPositions[players[0]].y,
      },
      window
    );
  };
  const listenEventsForPlayer = (device: Device) => {
    device.onTouchMove((xRatio: number, yRatio: number) => onMouseMove(device.id, xRatio, yRatio))
    device.onTouchTap((xRatio: number, yRatio: number) => onMouseTap(device.id, xRatio, yRatio))
    device.onJoystickChange((degree: number, distance: number) => onJoystickChange(device.id, degree, distance))
    device.onPadButtonTap((degree: number, distance: number) => onPadInput(device.id, degree, distance))
  };

  const app = new PIXI.Application({
    antialias: true,
    backgroundAlpha: 0,
    resizeTo: canvasDiv,
  });
  setTimeout(() => app.resize(), 300);
  window.addEventListener("resize", () => {
    setTimeout(() => app.resize(), 300);
  });
  app.renderer;
  app.stage.addChild(cursorG);
  inputLayer.appendChild(app.view);
  Object.values(slowbro.devices).forEach((provider) => {
    listenEventsForPlayer(provider);
  })
  const reply = await slowbro.setConfig({
    touch: {
      aspectRatio: canvasDiv?.clientHeight / canvasDiv?.clientWidth,
    },
    gamepad: {
      buttons: 4,
    }
  })
};

function playerOneDirectionKeys(d: Direction): [string, number] {
  if (d == Direction.up) return ["KeyW", 87];
  if (d == Direction.down) return ["KeyS", 83];
  if (d == Direction.right) return ["KeyD", 68];
  if (d == Direction.left) return ["KeyA", 65];
  throw `wrong direction: ${d}`;
}

function playerOneHitKeys(index: number): [string, number] {
  if (index == 0) return ["Space", 32];
  return ["Space", 32];
}


function playerTwoDirectionKeys(d: Direction): [string, number] {
  if (d == Direction.up) return ["ArrowUp", 38];
  if (d == Direction.down) return ["ArrowDown", 40];
  if (d == Direction.right) return ["ArrowRight", 39];
  if (d == Direction.left) return ["ArrowLeft", 37];
  throw `wrong direction: ${d}`;
}

function playerTwoHitKeys(index: number): [string, number] {
  if (index == 0) return ["Numpad0", 45];
  return ["Numpad0", 45];
}
