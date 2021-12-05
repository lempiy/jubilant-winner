import * as PIXI from "pixi.js";
import { Device, Slowbro } from "slowbro";
import { degreesToButtonsNoCross, Direction } from "./joystick_utils";
import { simulate, simulateKeyBoard } from "./simulate";

const rollThreshold = 0.25;
const pitchForwardThreshold = 0.9;





export function cars(slowbro: Slowbro, host: HTMLElement) {
    host.innerHTML = "";

    host.innerHTML = `
  <div
      id="content-holder"
      style="margin: 0; width: 100%; height: 100%; position: relative"
    >
      <iframe
        id="game-iframe"
        src="/slowbro_web_sdk/demos/gyroscope/cars/"
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

const run = async (
    slowbro: Slowbro,
    iframe: HTMLIFrameElement,
    inputLayer: HTMLDivElement
) => {


    const canvasDiv = iframe.contentDocument?.getElementById(
        "gameContainer"
    ) as HTMLDivElement;
  
    const cursorPosition = {
        x: 0,
        y: 0,
    };
    const sensor = {
        direction: Direction.none,
        movement: Direction.none
    };
    const gameCanvas = canvasDiv?.getElementsByTagName("canvas")[0] as HTMLCanvasElement;
    const cursorG = new PIXI.Graphics();
    const onGyroscopeChange = (azimuth: number, pitch: number, roll: number) => {
        console.log([azimuth, pitch, roll]);
        const currentDirection = Math.abs(roll) >= rollThreshold
            ? (roll > 0 ? Direction.right : Direction.left)
            : Direction.none;

        const currentMovement = Math.abs(pitch) <= pitchForwardThreshold
            ? Direction.up
            : Direction.none;

        if (
            sensor.direction != currentDirection &&
            sensor.direction != Direction.none
        ) {
            const [code, which] = playerOneDirectionKeys(sensor.direction);
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
            const [code, which] = playerOneDirectionKeys(currentDirection);
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

        if (
            sensor.movement != currentMovement &&
            sensor.movement != Direction.none
        ) {
            const [code, which] = playerOneDirectionKeys(sensor.movement);
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
        if (currentMovement != Direction.none) {
            const [code, which] = playerOneDirectionKeys(currentMovement);
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

        sensor.direction = currentDirection;
        sensor.movement = currentMovement;


    };

    const onPadInput = (player: string, index: number, gesture: number) => {
        const [code, which] = playerOneHitKeys(index);
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
        const rect = gameCanvas.getBoundingClientRect();
        cursorG.clear();
        cursorG.lineStyle(2, 0xffffff, 1);
        cursorG.drawCircle(
            rect.left + gameCanvas.clientWidth * xRatio,
            rect.top + gameCanvas.clientHeight * yRatio,
            gameCanvas.clientHeight * 0.05
        );
        simulate(
            gameCanvas,
            "mousemove",
            {
                pointerX: rect.left + gameCanvas.clientWidth * cursorPosition.x,
                pointerY: rect.top + gameCanvas.clientHeight * cursorPosition.y,
            },
            window
        );
        cursorPosition.x = xRatio;
        cursorPosition.y = yRatio;
    };

    const onMouseTap = (player: string, xRatio: number, yRatio: number) => {
        cursorG.clear();
        cursorG.lineStyle(2, 0xffffff, 1);
        cursorG.drawCircle(
            gameCanvas.clientWidth * cursorPosition.x,
            gameCanvas.clientHeight * cursorPosition.y,
            gameCanvas.clientHeight * 0.05
        );
        const rect = gameCanvas.getBoundingClientRect();
        simulate(
            gameCanvas,
            "mousedown",
            {
                pointerX: rect.left + gameCanvas.clientWidth * cursorPosition.x,
                pointerY: rect.top + gameCanvas.clientHeight * cursorPosition.y,
            },
            window
        );
        simulate(
            gameCanvas,
            "mouseup",
            {
                pointerX: rect.left + gameCanvas.clientWidth * cursorPosition.x,
                pointerY: rect.top + gameCanvas.clientHeight * cursorPosition.y,
            },
            window
        );
    };
    const listenEventsForPlayer = (device: Device) => {
        device.onGyroscopeChange((a, p, r) => onGyroscopeChange(a, p, r))
        device.onTouchMove((xRatio: number, yRatio: number) => onMouseMove(device.id, xRatio, yRatio))
        device.onTouchTap((xRatio: number, yRatio: number) => onMouseTap(device.id, xRatio, yRatio))
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
    const players = slowbro.linkIds;
    Object.values(slowbro.devices).forEach((provider) => {
        listenEventsForPlayer(provider);
    })
    const reply = await slowbro.setConfig({
        touch: {
            aspectRatio: canvasDiv?.clientHeight / canvasDiv?.clientWidth,
        },
        gyroscope_gamepad: {
            ok: true,
        }
    })
};

function playerOneDirectionKeys(d: Direction): [string, number] {
    if (d == Direction.up) return ["ArrowUp", 38];
    if (d == Direction.down) return ["ArrowDown", 40];
    if (d == Direction.right) return ["ArrowRight", 39];
    if (d == Direction.left) return ["ArrowLeft", 37];
    throw `wrong direction: ${d}`;
}

function playerOneHitKeys(index: number): [string, number] {
    if (index == 0) return ["Space", 32];
    return ["Space", 32];
}
