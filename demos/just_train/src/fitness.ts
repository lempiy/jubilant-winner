import * as PIXI from "pixi.js";
import { FitnessViewModel } from "./fitness_model";
import { Figure } from "./figure";
import { FitnessPoseAnimator } from "./fitness_pose_animator";
import { Slowbro } from "slowbro";
declare global {
  interface Window {
      Hls: any,
  }
}

const THRESHOLD = 0.3;
const videoSrc = 'https://meta.vcdn.biz/b8a99c92b7f0915d7eff03db6e53b382_combi603fb633c15830b2c2a8d0a1/vod/hls/u/5531/o/135002291/playlist.m3u8';

export async function fitness(slowbro: Slowbro, host: HTMLDivElement, isTwoPlayers: boolean) {
  document.body.style.overflow = 'hidden';
  document.body.style.fontFamily = "'Maven Pro', sans-serif"
  host.innerHTML = "";
  window.document.body.style.backgroundColor = '#333';

  const app = new PIXI.Application({ antialias: true, backgroundAlpha: 0 });
  const data = await loadTutorPoses('assets/final.json');
  const size = app.view.width * .25;
  const vm = new FitnessViewModel({
    animationIntervalSec: 0.75,
    seriesRawData: data,
    threshold: THRESHOLD,
    bodySize: size,
    isTwoPlayers: false,
  });
  const players = slowbro.linkIds;
  players.forEach((k, i) => {
    const d = slowbro.devices[k];
    d.onMoveChange((keypoints) => {
      i == 0 ? vm.setPlayerOneCurrentPose(keypoints) : vm.setPlayerTwoCurrentPose(keypoints);
    })
  })
  app.resizeTo = host;
  const video = document.createElement('video');
  video.style.position = 'absolute';
  video.style.zIndex = '-2';
  video.style.left = "50%";
  video.style.top = "50%";
  video.style.transform = "translate(-50%, -50%)";
  video.style.maxWidth = "100%";
  video.style.maxHeight = "100%";
  video.style.width = "auto";
  video.style.height = "auto";
  video.style.backgroundSize = "cover";
  video.controls = false;
  host.appendChild(video);
  host.appendChild(app.view);
  app.resize();
  video.onplaying = () => {

  }
  video.muted = false;

  players.forEach((p) => {
    const device = slowbro.devices[p];
    device.onTouchTap
  })

  const hls = new window.Hls({ autoStartLoad: true, enableWorker: false, maxBufferLength: 15, maxBufferSize: 30 * 1000 * 1000 });
  hls.loadSource(videoSrc);
  hls.loadLevel = 5;
  hls.attachMedia(video);

  hls.on(window.Hls.Events.MEDIA_ATTACHED, function () {
    console.log('video and hls.js are now bound together !');
    hls.on(window.Hls.Events.MANIFEST_PARSED, async function (event: any, data: any) {
      console.log(
        'manifest loaded, found ' + data.levels.length + ' quality level'
      );
      const reply = await slowbro.setConfig({
        touch: {
          aspectRatio: host.clientHeight / host.clientWidth,
        },
        move: {
          ok: true,
        }
      })
      drawApp(isTwoPlayers, app, vm, video, host);
    });
  });

  video.oncanplay = async () => {

  }
}

async function loadTutorPoses(url: string): Promise<[number, number, number][][]> {
  const response = await fetch(url)
  const body: [number, number, number][][] = await response.json();
  return body;
}

function addTutorOverlay(host: HTMLDivElement, size: number, x: number, y: number) {
  const overlay = document.createElement('div');
  overlay.style.width = `${size * 2}px`;
  overlay.style.height = `${size}px`;
  overlay.style.position = 'absolute';
  overlay.style.left = `${x}px`;
  overlay.style.top = `${y}px`;
  overlay.style.border = `8px solid rgb(0, 178, 178, 0.5)`;
  overlay.style.borderRadius = '10px';
  overlay.style.backgroundColor = 'rgba(20,20,20,0.5)';
  overlay.style.zIndex = '-1';
  overlay.style.boxSizing = 'border-box';
  host.appendChild(overlay);
}

function addUserOverlay(host: HTMLDivElement, size: number, x: number, y: number, color: string): HTMLDivElement {
  const overlay = document.createElement('div');
  const dataDiv = document.createElement('div');
  overlay.style.position = 'relative';
  overlay.style.width = `${size}px`;
  overlay.style.height = `${size + size * .3}px`;
  overlay.style.position = 'absolute';
  overlay.style.left = `${x}px`;
  overlay.style.top = `${y}px`;
  overlay.style.borderLeft = `4px solid ${color}`;
  overlay.style.borderRight = `4px solid ${color}`;
  overlay.style.borderBottom = `4px solid ${color}`;
  overlay.style.borderBottomLeftRadius = '10px';
  overlay.style.borderBottomRightRadius = '10px';
  overlay.style.backgroundColor = 'rgba(20,20,20,0.5)';
  overlay.style.zIndex = '-1';
  overlay.style.boxSizing = 'border-box';
  dataDiv.style.padding = '10px';
  dataDiv.style.width = "100%";
  dataDiv.style.height = `${size * 0.3}px`;
  dataDiv.style.position = 'absolute';
  dataDiv.style.bottom = '0px';
  dataDiv.style.left = '0px';
  dataDiv.style.display = 'flex';
  dataDiv.style.justifyContent = 'center';
  dataDiv.style.flexDirection = 'column';
  dataDiv.style.alignItems = 'center';
  dataDiv.style.color = '#ffffff';
  dataDiv.style.fontSize = '20px';
  dataDiv.style.boxSizing = 'border-box';
  dataDiv.innerHTML = `
    <div style="width: 100%; font-size: 20px; display: flex; align-items: center; justify-content: space-between">
      <div>Score:</div>
      <div></div>
    </div>
    <div style="width: 100%; font-size: 14px; display: flex; align-items: center; justify-content: space-between">
      <div>Similarity:</div>
      <div></div>
    </div>
  `
  overlay.appendChild(dataDiv);
  host.appendChild(overlay);
  return dataDiv;
}

function drawApp(isTwoPlayers: boolean, app: PIXI.Application, vm: FitnessViewModel, video: HTMLVideoElement, host: HTMLDivElement) {
  const padding = app.view.width * 0.05;
  const poseSize = app.view.width * 0.12;
  video.currentTime = 1;
  const playerOneFigure = new Figure({
    size: poseSize,
    x: padding,
    y: 0,
    threshold: THRESHOLD,
  });
  playerOneFigure.color = 0xfc9003;
  const playerOneDataDiv = addUserOverlay(host, poseSize, padding, 0, "rgb(252, 144, 3, 0.5)");

  const playerTwoFigure = isTwoPlayers ? new Figure({
    size: poseSize,
    x: app.view.width - poseSize - padding,
    y: 0,
    threshold: THRESHOLD,
  }) : null;
  if (playerTwoFigure) {
    playerTwoFigure.color = 0xC0C0C0;
  }
  const playerTwoDataDiv = isTwoPlayers ? addUserOverlay(host, poseSize, app.view.width - poseSize - padding, 0, "rgb(192,192,192,0.5)") : null;


  const poseTutorSize = app.view.width * 0.14;
  const tutorAnimator = new FitnessPoseAnimator({
    vm,
    poseSize: poseTutorSize,
    x: app.view.width - poseTutorSize * 1.5 - 20,
    y: app.view.height - poseTutorSize - 20,
    threshold: THRESHOLD,
  })

  let interval: number = NaN;
  let started = false;
  let count = 0;

  const begin = document.createElement('div') as HTMLDivElement;
  begin.style.width = '100%'
  begin.style.height = '100%'
  begin.style.position = 'absolute';
  begin.style.top = '0px';
  begin.style.left = '0px';
  begin.style.display = 'flex';
  begin.style.justifyContent = 'center';
  begin.style.flexDirection = 'column';
  begin.style.alignItems = 'center';
  begin.style.fontSize = '50px';
  begin.style.zIndex = '3';
  begin.style.color = '#ffffff'
  begin.style.textShadow = '0 0 10px #333333';
  begin.innerHTML = isTwoPlayers ? 'Щоб почати тренування обидва<br>станьте перед камерою' : 'Щоб почати тренування<br>станьте перед камерою';
  host.appendChild(begin)

  addTutorOverlay(host, poseTutorSize, app.view.width - poseTutorSize * 1.5 - 20, app.view.height - poseTutorSize - 20);
  app.ticker.add(() => {
    if (!started) {
      console.log('isFull', playerOneFigure.isFull());
      if (playerOneFigure.isFull() && (playerTwoFigure ? playerTwoFigure.isFull() : true)) {
        if (interval) return;
        console.log("START INTERVAL");
        interval = window.setInterval(() => {
          if (count == 3) {
            clearInterval(interval)
            started = true;
            video.play();
            host.removeChild(begin);
          } else {
            console.log("COUNT", count)
            count++
            begin.style.fontSize = '100px'
            begin.innerHTML = `${4 - count}`

          }
        }, 1000);
      } else {
        console.log("CLEAR INTERVAL");
        interval && clearInterval(interval)
      }
    }
    tutorAnimator.apply(video.currentTime);

    const playerOnePose = vm.playerOneCurrentPose();
    if (playerOnePose) {
      playerOneFigure.apply(playerOnePose.pose);
    }
    const sim1 = vm.closestSimilarityValueAt(false, video.currentTime);
    if (!Number.isNaN(sim1)) {
      playerOneDataDiv.children[0].children[1].textContent = `${vm.playerOneScore}`;
      playerOneDataDiv.children[1].children[1].textContent = `${sim1.toFixed(4)}`;
    }
    if (playerTwoFigure) {
      const playerTwoPose = vm.playerTwoCurrentPose();
      if (playerTwoPose) {
        playerTwoFigure.apply(playerTwoPose.pose);
      }
      const sim2 = vm.closestSimilarityValueAt(true, video.currentTime);
      if (!Number.isNaN(sim2)) {
        playerTwoDataDiv!.children[0].children[1].textContent = `${vm.playerTwoScore}`;
        playerTwoDataDiv!.children[1].children[1].textContent = `${sim2.toFixed(4)}`;
      }
    }
  });
  app.stage.addChild(playerOneFigure.container, tutorAnimator.container);
  if (playerTwoFigure) {
    app.stage.addChild(playerTwoFigure.container);
  }
}

