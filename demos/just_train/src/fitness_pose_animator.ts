import * as PIXI from "pixi.js";
import { Figure } from "./figure";
import { FitnessViewModel, PoseModelOutput } from "./fitness_model";

export interface FitnessPoseAnimatorInput {
    vm: FitnessViewModel;
    poseSize: number;
    x: number;
    y: number;
    threshold: number;
}

export class FitnessPoseAnimator {
    private vm: FitnessViewModel;
    private poseId: number | null = null;
    private figures: Figure[];
    private currentStamps: (number | null)[];
    private lastChangeStamp: number = 0;
    container: PIXI.Container;
    poseSize: number;
    constructor(input: FitnessPoseAnimatorInput) {
        this.vm = input.vm;
        this.poseSize = input.poseSize;
        this.container = new PIXI.Container();
        this.container.x = input.x;
        this.container.y = input.y;
        this.figures = [
            new Figure({
                size: this.poseSize,
                x: this.poseSize * .5,
                y: this.poseSize * .5,
                threshold: input.threshold,
            }),
            new Figure({
                size: this.poseSize,
                x: this.poseSize * 1.5,
                y: this.poseSize * .5,
                threshold: input.threshold,
            }),
            new Figure({
                size: this.poseSize,
                x: this.poseSize * 2.5,
                y: this.poseSize * .5,
                threshold: input.threshold,
            })
        ]
        this.figures.forEach(f => f.container.pivot.set(0.5, 0.5));
        this.figures[1].container.pivot.set(this.poseSize * .5, this.poseSize * .5);
        this.figures[1].container.scale.set(0.5);
        this.figures[2].container.scale.set(0.5);
        this.figures[2].container.pivot.set(this.poseSize * .5, this.poseSize * .5);
        this.figures[0].container.visible = true;
        this.figures[0].container.pivot.set(this.poseSize * .5, this.poseSize * .5);
        this.currentStamps = this.figures.map(() => null);
        this.figures.forEach((f) => {
            this.container.addChild(f.container);
        })
    }
    apply(timestamp: number) {
        const poses = [
            this.vm.tutorAnimationPosePeekAt(timestamp, -1),
            this.vm.tutorAnimationPoseAt(timestamp),
            this.vm.tutorAnimationPosePeekAt(timestamp, 1),
        ];
        poses.forEach((p, i) => {
            if (p) {
                this.figures[i]?.apply(p.pose);
            }
        })
        const newPoseId = poses[1] ? poses[1].poseID : null;
        if (newPoseId !== this.poseId) {
            this.poseId = newPoseId;
            this.resetAnimation();
            this.currentStamps = poses.map(pose => pose ? pose.stamp : null);
        }
        if (this.lastChangeStamp != timestamp) {
            this.runAnimation(timestamp);
            this.lastChangeStamp = timestamp;
        }
        this.poseId = newPoseId;
    }

    runAnimation(timestamp: number) {
        const startStamp = this.currentStamps[0];
        const endStamp = this.currentStamps[1];
        const step = !startStamp || !endStamp ? 0 : (timestamp - startStamp) / (endStamp - startStamp);
        for (let i = 1; i < this.figures.length; i++) {
            this.figures[i].container.x = this.poseSize * .5 + (i * this.poseSize - (this.poseSize * step));
        }
        this.figures[0].color = 0x00b2b2;
        this.figures[1].color = 0x00b2b2;
        this.figures[2].color = 0x00b2b2;
        this.figures[1].container.scale.set(0.5 + (0.5 * step));
        this.figures[2].alpha = easeInExpo(0 + step);
        this.figures[0].alpha = easeInExpo(1 - step);
    }

    resetAnimation() {
        this.figures.forEach((f, i) => {
            f.container.x = this.poseSize * .5 + (i * this.poseSize);
        })
        this.figures[1].container.scale.set(0.5);
        this.figures[2].container.scale.set(0.5);
        this.figures[0].alpha = 0;
    }
}

function easeInExpo(x: number): number {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeInElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;
    return x === 0
        ? 0
        : x === 1
            ? 1
            : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);
}

function easeInQuart(x: number): number {
    return x * x * x * x;
}

