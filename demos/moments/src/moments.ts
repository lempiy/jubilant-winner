import * as PIXI from "pixi.js";
import { simulate } from "./simulate";
import Hls, { Fragment } from 'hls.js';
import { MEMORY, XhrLoader } from "./moments_loader";
import { encodeShareChunk, ShareRequestAnswerPayload, ShareRequestPayload, ShareRequestStopAnswerPayload } from "./moments_data";
import { ControlEvent, Device, Link, Slowbro } from "slowbro";

declare global {
    interface Window {
        Hls: any,
    }
}

export function moments(slowbro: Slowbro, host: HTMLElement) {
    host.innerHTML = "";
    host.innerHTML = `
  <div
      id="content-holder"
      style="margin: 0; width: 100%; height: 100%; position: relative"
    >
    <video id="video" 
        style='
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            background-size: cover;
            '
        ></video>
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
    setTimeout(() => {
        run(slowbro);
    })
}

interface State {
    capturing: boolean,
    fragment: null | Fragment,
    fragmentTime: number,
    playbackQueue: Fragment[],
    fragmentsCollected: number,
    fragmentsTransferred: number,
}

const run = async (
    slowbro: Slowbro
) => {

    const state: State = {
        capturing: false,
        fragment: null,
        fragmentTime: 0,
        playbackQueue: [],
        fragmentsCollected: 0,
        fragmentsTransferred: 0,
    }
    const contentDiv = document.getElementById('content-holder') as HTMLDivElement;
    const inputLayer = document.getElementById('input-layer') as HTMLDivElement;
    const video = document.getElementById('video') as HTMLVideoElement;
    const cursorPosition = {
        x: 0,
        y: 0,
    };
    const cursorG = new PIXI.Graphics();
    const onMouseMove = (player: string, xRatio: number, yRatio: number) => {
        cursorG.clear();
        cursorG.lineStyle(2, 0xffffff, 1);
        cursorG.drawCircle(
            contentDiv.clientWidth * xRatio,
            contentDiv.clientHeight * yRatio,
            contentDiv.clientHeight * 0.05
        );
        cursorPosition.x = xRatio;
        cursorPosition.y = yRatio;
    };

    const onMouseTap = (player: string, xRatio: number, yRatio: number) => {
        cursorG.clear();
        cursorG.lineStyle(2, 0xffffff, 1);
        cursorG.drawCircle(
            contentDiv.clientWidth * cursorPosition.x,
            contentDiv.clientHeight * cursorPosition.y,
            contentDiv.clientHeight * 0.05
        );
        const rect = contentDiv.getBoundingClientRect();
        simulate(
            contentDiv,
            "mousedown",
            {
                pointerX: rect.left + contentDiv.clientWidth * cursorPosition.x,
                pointerY: rect.top + contentDiv.clientHeight * cursorPosition.y,
            },
            window
        );
        simulate(
            contentDiv,
            "mouseup",
            {
                pointerX: rect.left + contentDiv.clientWidth * cursorPosition.x,
                pointerY: rect.top + contentDiv.clientHeight * cursorPosition.y,
            },
            window
        );
    };
    const listenEventsForPlayer = (device: Device) => {
        device.onTouchMove((xRatio: number, yRatio: number) => onMouseMove(device.id, xRatio, yRatio))
        device.onTouchTap((xRatio: number, yRatio: number) => onMouseTap(device.id, xRatio, yRatio))
    };


    const videoSrc = 'https://meta.vcdn.biz/2b71a4e765f7bd1aa7338cf950c58398_cm61824b79a1ef54145d17fc76/vod/hls/u/6161/o/133227041/playlist.m3u8';
    const app = new PIXI.Application({
        antialias: true,
        backgroundAlpha: 0,
        resizeTo: contentDiv,
    });
    setTimeout(() => app.resize(), 300);
    window.addEventListener("resize", () => {
        setTimeout(() => app.resize(), 300);
    });
    app.renderer;
    app.stage.addChild(cursorG);
    inputLayer.appendChild(app.view);
    const players = slowbro.linkIds;
    console.log(players);
    players.forEach((k, i) => {
        const d = slowbro.devices[k];
        listenEventsForPlayer(d);
    })


    video.controls = true;
    video.muted = true;
    console.log(XhrLoader, window.Hls);
    const hls = new window.Hls({ fLoader: XhrLoader, enableWorker: false, maxBufferLength: 15, maxBufferSize: 30 * 1000 * 1000 });
    hls.loadSource(videoSrc);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MEDIA_ATTACHED, function () {
        console.log('video and hls.js are now bound together !');
        hls.on(window.Hls.Events.MANIFEST_PARSED, async function (event: any, data: any) {
            console.log(
                'manifest loaded, found ' + data.levels.length + ' quality level'
            );
            const reply = await slowbro.setConfig({
                touch: {
                    aspectRatio: contentDiv?.clientHeight / contentDiv?.clientWidth,
                },
                media_share: {
                    type: "hls",
                }
            })
            waitShareRequest(Object.values(slowbro.devices)[0]);
            video.play();
        });
    });
    hls.on(window.Hls.Events.FRAG_CHANGED, function (data: any, e: any) {
        state.fragment = e.frag;
        state.fragmentTime = video.currentTime;
        if (state.capturing) {
            state.playbackQueue.push(e.frag);
            state.fragmentsCollected++;
        }
    });
    const waitShareRequest = async (device: Device) => {
        console.log('waiting share request...')
        const event = await device.once<ControlEvent<ShareRequestPayload>>(
            "share-request"
        );
        const data = MEMORY.get(state.fragment!.url)!;
        const v = new Uint8Array(data);
        if (video.paused) {
            video.play();
        }
        const answer: ShareRequestAnswerPayload = state.capturing || !state.fragment ? {
            ok: false,
            offset: 0,
            reason: 'fragments are not ready or busy',
            length: 0,
            duration: 0,
        } : {
                ok: true,
                offset: video.currentTime - state.fragmentTime,
                length: MEMORY.get(state.fragment.url)!.byteLength,
                duration: state.fragment.duration,
            };
        console.log(answer);
        if (answer.ok) {
            state.capturing = true;
            waitShareStopRequest(device);
            sharePlayback(device);
        }
        device.sendText(
            JSON.stringify({
                type: "share-request-reply",
                payload: answer,
            })
        );
    }
    const waitShareStopRequest = async (device: Device) => {
        console.log('waiting share stop request...')
        const event = await device.once<ControlEvent<ShareRequestPayload>>(
            "share-request-stop"
        );
        const answer: ShareRequestStopAnswerPayload = !state.capturing || !state.fragment ? {
            ok: false,
            keep: 0,
            keep_id: 0,
            reason: 'no capturing',
            keep_full_length: 0,
            keep_full_duration: 0,
        } : {
                ok: true,
                keep: video.currentTime - state.fragmentTime,
                keep_id: state.fragmentsCollected - 1,
                keep_full_length: MEMORY.get(state.fragment.url)!.byteLength,
                keep_full_duration: state.fragment.duration,
            };
        if (answer.ok) {
            state.capturing = false;
        }
        device.sendText(
            JSON.stringify({
                type: "share-request-stop-reply",
                payload: answer,
            })
        );
        waitShareRequest(device);
    }
    const sharePlayback = async (device: Device) => {
        if (!state.fragment) {
            console.error('no fragment')
        }
        const transferred = new Set<number>();
        state.playbackQueue = [state.fragment!];
        state.fragmentsCollected = 1;
        state.fragmentsTransferred = 0;
        while (state.capturing || state.fragmentsCollected != state.fragmentsTransferred) {
            console.log(state.fragmentsTransferred, state.playbackQueue[state.fragmentsTransferred])
            const f = state.playbackQueue[state.fragmentsTransferred];
            if (!transferred.has(state.fragmentsTransferred) && f) {
                console.log(f.url);
                await shareFragment(device, state.fragmentsTransferred, f, MEMORY.get(f.url)!);
                transferred.add(state.fragmentsTransferred)
                state.fragmentsTransferred++
            } else {
                await sleep(100);
            }
        }
    }

};


const shareFragment = async (provider: Device, id: number, fragment: Fragment, data: ArrayBuffer) => {
    let offset = 0;
    const maxChunkSize = provider.maxMessageSize() - 1024;
    while (offset !== data.byteLength) {
        const bytesLeft = data.byteLength - offset;
        const sliceSize = Math.min(bytesLeft, maxChunkSize);
        const buffer = encodeShareChunk(id, offset, offset + sliceSize, fragment.duration, new Uint8Array(data));
        console.log(id, buffer);
        await provider.sendBuffer(buffer);
        offset = offset + sliceSize;
    }
}



const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
