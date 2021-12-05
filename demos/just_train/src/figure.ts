
import * as PIXI from "pixi.js";
import { bodyParts } from "./fitness_constants";


const edges: string[][] = [
    // torso
    // ["leftShoulder", "rightShoulder"],
    // ["rightShoulder", "rightHip"],
    // ["rightHip", "leftHip"],
    // ["leftShoulder", "leftHip"],
    // arms
    ["leftWrist", "leftElbow", "leftShoulder", "rightShoulder", "rightElbow", "rightWrist"],
    // legs
    ["leftAnkle", "leftKnee", "leftHip", "rightHip", "rightKnee", "rightAnkle"],
];

const markers = [
    "leftWrist",
    "rightWrist",
    "leftAnkle",
    "rightAnkle"
]

const getPointBetweenPoints = (p1: [number, number], p2: [number, number], fractionOfTotal: number) => {
    const xDist = p2[0] - p1[0];
    const yDist = p2[1] - p1[1];
    return [p1[0] + xDist * fractionOfTotal, p1[1] + yDist * fractionOfTotal]
}

export function getBody(list: Float32Array, size: number, threshold = 0.1): { [key: string]: [number, number] } {
    const body: { [key: string]: [number, number] } = {};
    for (let i = 0, j = 0; i < list.length; i += 3) {
        const partName = bodyParts[j];
        if (list[i + 2] >= threshold) {
            const y = list[i] * size;
            const x = list[i + 1] * size;
            body[partName] = [x, y];
        }
        j++;
    }
    return body
}

export interface FigureInput {
    size: number;
    x: number;
    y: number;
    threshold?: number;
}

export class Figure {
    size: number = 0;
    container: PIXI.Container = new PIXI.Container();
    threshold?: number;
    private graphics: { [key: string]: PIXI.Graphics } = {};
    private body: { [key: string]: [number, number] } | null = null;
    private keypoints: Float32Array | null = null;
    color: number = 0;
    alpha: number = 1;
    constructor(input: FigureInput) {
        Object.assign(this, input)
        this.container.width = this.size;
        this.container.height = this.size;
        this.container.x = input.x;
        this.container.y = input.y;
    }

    apply(keypoints: Float32Array) {
        this.keypoints = keypoints;
        this.body = getBody(cropToBody(this.keypoints, 0.1), this.size, this.threshold);
        this.draw();
    }

    isFull(): boolean {
        return bodyParts.every((p) => {
            return this.body && this.body[p];
        });
    }

    private draw(): PIXI.Container {
        if (!this.body) return this.container;
        this.drawEdges();
        this.drawTorso();
        this.drawHead();
        this.drawMarkers();
        return this.container;
    }

    private drawEdges() {
        edges.forEach((arr, i) => {
            const g = this.graphics[`${i}`] || new PIXI.Graphics();
            if (!this.graphics[`${i}`]) {
                this.graphics[`${i}`] = g;
                this.container.addChild(g);
            }
            g.clear();
            g.lineStyle({
                width: 3,
                color: this.color,
                alignment: 0.5,
                alpha: this.alpha,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            // const startKey = arr.find((p) => !!this.body![p]);
            // if (!startKey) return;
            // const start = this.body![startKey];
            // g.moveTo(start[0], start[1]);
            for (let i = 0; i < arr.length; i++) {
                const start = arr[i];
                const end = arr[i + 1];
                if (!end) break;
                const s = this.body![start];
                const e = this.body![end];
                if (s) {
                    g.moveTo(s[0], s[1]);
                }
                if (e && s) {
                    g.lineTo(e[0], e[1]);
                }
                if (e) {
                    g.moveTo(e[0], e[1]);
                }
            }
            g.closePath();
        });
    }

    private drawMarkers() {
        markers.forEach((marker) => {
            const point = this.body![marker];
            const g = this.graphics[`${marker}Marker`] || new PIXI.Graphics();
            if (!point) {
                g.visible = false;
                return;
            }
            g.visible = true;
            g.clear();
            g.lineStyle({
                width: 1,
                color: this.color,
                alignment: 0.5,
                alpha: this.alpha,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });
            g.beginFill(this.color, this.alpha);
            g.drawCircle(point[0], point[1], this.size * 0.02)
            g.endFill();
            if (!this.graphics[`${marker}Marker`]) {
                this.graphics[`${marker}Marker`] = g;
                this.container.addChild(g);
            }
        })
    }

    private drawTorso() {
        const leftShoulder = this.body!["leftShoulder"];
        const rightShoulder = this.body!["rightShoulder"];
        const leftHip = this.body!["leftHip"];
        const rightHip = this.body!["rightHip"];
        const nose = this.body!["nose"];
        const neckBack = this.graphics[`neckBack`] || new PIXI.Graphics();
        if (!leftHip || !rightHip || !leftShoulder || !rightShoulder || !nose) {
            neckBack.visible = false;
            return;
        } else {
            neckBack.visible = true;
        }
        const sc = getPointBetweenPoints(leftShoulder, rightShoulder, 0.5);
        const hc = getPointBetweenPoints(leftHip, rightHip, 0.5);

        neckBack.clear();
        neckBack.lineStyle({
            width: 3,
            color: this.color,
            alignment: 0.5,
            alpha: this.alpha,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        neckBack.beginFill(this.color, this.alpha);
        neckBack.moveTo(hc[0], hc[1]);
        neckBack.lineTo(sc[0], sc[1]);
        neckBack.moveTo(sc[0], sc[1]);
        neckBack.lineTo(nose[0], nose[1]);
        neckBack.endFill();
        neckBack.closePath();

        if (!this.graphics[`neckBack`]) {
            this.graphics[`neckBack`] = neckBack;
            this.container.addChild(neckBack);
        }
    }

    private drawHead() {
        const nose = this.body!["nose"];
        const leftEye = this.body!["leftEye"];
        const rightEye = this.body!["rightEye"];
        let pointA, pointB;
        let isWide = false;
        const g: PIXI.Graphics = this.graphics[`head`] || new PIXI.Graphics();
        if (nose && leftEye) {
            pointA = nose;
            pointB = leftEye;
        } else if (nose && rightEye) {
            pointA = nose;
            pointB = rightEye;
        } else if (leftEye && rightEye) {
            pointA = leftEye;
            pointB = rightEye;
            isWide = true;
        } else {
            g.visible = false;
            return;
        }
        g.visible = true;
        const center: [number, number] = isWide
            ? [
                Math.abs(pointA[0] - pointB[0]) * 0.5,
                Math.abs(pointA[1] - pointB[1]) * 0.5,
            ]
            : pointA;
        const dist =
            Math.sqrt(
                Math.pow(pointA[0] - pointB[0], 2) + Math.pow(pointA[1] - pointB[1], 2)
            ) * 1.4;
        const halfWidth = isWide ? dist * 0.5 : dist;

        if (!this.graphics[`head`]) {
            this.graphics[`head`] = g;
            this.container.addChild(g);
        }
        g.clear();
        g.beginFill(this.color, this.alpha);
        g.lineStyle({
            width: 3,
            color: this.color,
            alignment: 0.5,
            alpha: this.alpha,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        g.drawEllipse(center[0], center[1], this.size * 0.04, this.size * 0.04);
        g.endFill();
    }
}

/*
 * Calculates the angle ABC (in radians)
 *
 * A first point, ex: [0, 0]
 * C second point
 * B center point
 */
function findAngle(
    A: [number, number],
    B: [number, number],
    C: [number, number]
) {
    var AB = Math.sqrt(Math.pow(B[0] - A[0], 2) + Math.pow(B[1] - A[1], 2));
    var BC = Math.sqrt(Math.pow(B[0] - C[0], 2) + Math.pow(B[1] - C[1], 2));
    var AC = Math.sqrt(Math.pow(C[0] - A[0], 2) + Math.pow(C[1] - A[1], 2));
    return Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB));
}

export function getBoundingBodyRect(body: Float32Array): { top: number, left: number, bottom: number, right: number } {
    const rect = {
        top: 1,
        left: 1,
        bottom: 0,
        right: 0,
    }
    for (let i = 0; i < body.length; i += 3) {
        const x = body[i + 1];
        const y = body[i];
        rect.top = y < rect.top ? y : rect.top;
        rect.bottom = y > rect.bottom ? y : rect.bottom;
        rect.left = x < rect.left ? x : rect.left;
        rect.right = x > rect.right ? x : rect.right;
    }
    return rect;
}

export function cropToBody(body: Float32Array, padding: number): Float32Array {
    const arr = new Float32Array(body.length);
    let { top, left, bottom, right } = getBoundingBodyRect(body);
    top -= padding;
    left -= padding;
    bottom += padding;
    right += padding;
    let offsetX = top;
    let offsetY = left;
    const w = right - left;
    const h = bottom - top;
    const factor = Math.min(1 / w, 1 / h);
    const isHorizontalOffset = 1 / w > 1 / h;
    const newWidth = w * factor;
    const newHeight = h * factor;
    const wOffset = w > h ? 0 : 0.5 - (newWidth / 2);
    const hOffset = h > w ? 0 : 0.5 - (newHeight / 2);
    for (let i = 0; i < body.length; i += 3) {
        arr[i + 1] = ((body[i + 1] - left) * factor) + wOffset;
        arr[i] = ((body[i] - top) * factor) + hOffset;
        arr[i + 2] = body[i + 2];
    }
    return arr
}
