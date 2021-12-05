import { poseSimilarity } from "posenet-similarity";
import { Pose } from "posenet-similarity/dist/types";
import { getBody } from "./figure";
import { bodyParts } from "./fitness_constants";

interface PoseInfo {
    body: Float32Array,
    stamp: number
}

export class PoseSeries {
    private cursorIdx: number = -1;
    // @{timestamp} - float64 - requested time in seconds
    // Approximate provided timestamp to available in this.stamps
    // set result as cursor. Note: approximation works as Math.ceil to available stamp
    private applyCursor(timestamp: number) {
        for (let i = Math.max(this.cursorIdx, 0); i < this.stamps.length; i++) {
            if (this.stamps[i] >= timestamp) {
                this.cursorIdx = i;
                return
            }
        }
    }
    get i() { return this.cursorIdx };
    extractPose(timestamp: number): PoseInfo | null {
        this.applyCursor(timestamp);
        return this.cursorIdx == -1 ? null : { body: this.series[this.cursorIdx], stamp: this.stamps[this.cursorIdx] };
    }
    peekPose(timestamp: number, step: number): PoseInfo | null {
        this.applyCursor(timestamp);
        return this.cursorIdx > 0 ? { body: this.series[this.cursorIdx + step], stamp: this.stamps[this.cursorIdx + step] } || null : null;
    }

    constructor(private series: Float32Array[], private stamps: number[]) {
        if (this.series.length != this.series.length) throw "wrong pose series input";
    }
}

interface FitnessModelInput {
    isTwoPlayers: boolean;
    animatedPoseSeries: Float32Array[],
    animatedStamps: number[],
    tutorSeries: Float32Array[],
    tutorStamps: number[],
    threshold: number,
    bodySize: number,
}

export interface FitnessViewModelInput {
    isTwoPlayers: boolean;
    animationIntervalSec: number,
    seriesRawData: [number, number, number][][],
    threshold: number,
    bodySize: number
}

export interface PoseModelOutput {
    poseID: number;
    stamp: number;
    pose: Float32Array;
}

export class FitnessModel {
    playerOneScore: number = 0;
    playerTwoScore: number = 0;
    isPlaying = false;
    threshold = NaN;
    public isTwoPlayers: boolean;
    protected tutorPoseSeries: PoseSeries;
    protected animatedPoseSeries: PoseSeries;
    protected currentPlayerOnePose: Float32Array | null = null;
    protected currentPlayerOnePoseID: number = 0;
    protected lastPlayerOneClosestSimilarityValue = NaN;
    protected currentPlayerTwoPose: Float32Array | null = null;
    protected currentPlayerTwoPoseID: number = 0;
    protected lastPlayerTwoClosestSimilarityValue = NaN;
    protected tutorPoseID: number = NaN;
    protected tutorAnimatedPoseID: number = NaN;
    protected playerOnePoseGetter: (id: number, list: Float32Array, size: number, threshold?: number) => Pose = getBodyWithMemo();
    protected playerTwoPoseGetter: (id: number, list: Float32Array, size: number, threshold?: number) => Pose = getBodyWithMemo();
    protected tutorPoseGetter: (id: number, list: Float32Array, size: number, threshold?: number) => Pose = getBodyWithMemo();
    protected bodySize: number;
    constructor(input: FitnessModelInput) {
        this.threshold = input.threshold;
        this.tutorPoseSeries = new PoseSeries(input.tutorSeries, input.tutorStamps);
        this.animatedPoseSeries = new PoseSeries(input.animatedPoseSeries, input.animatedStamps);
        this.bodySize = input.bodySize;
        this.isTwoPlayers = input.isTwoPlayers;
    }
}

export class FitnessViewModel extends FitnessModel {
    constructor(input: FitnessViewModelInput) {
        const data = FitnessViewModel.preprocess(input.seriesRawData);
        let lastValue = 0;
        const animatedData = data.series.
            reduce<{ series: Float32Array[], stamps: number[] }>((acc, body, i) => {
                const stamp = data.stamps[i];
                if (stamp - lastValue >= input.animationIntervalSec) {
                    lastValue = stamp;
                    acc.series.push(body)
                    acc.stamps.push(stamp)
                }
                return acc
            }, { series: [], stamps: [] })
        super({
            animatedPoseSeries: animatedData.series,
            animatedStamps: animatedData.stamps,
            tutorSeries: data.series,
            tutorStamps: data.stamps,
            threshold: input.threshold,
            bodySize: input.bodySize,
            isTwoPlayers: input.isTwoPlayers,
        })
    }
    getPoseScore(lowestSimilarity: number): number {
        switch (true) {
            case (lowestSimilarity < 0.03):
                return 3;
            case (lowestSimilarity < 0.05):
                return 2;
            case (lowestSimilarity < 0.08):
                return 1;
        }
        return 0;
    }
    tutorPoseAt(timestamp: number): PoseModelOutput | null {
        const pose = this.tutorPoseSeries.extractPose(timestamp);
        const result = pose ? { poseID: this.tutorPoseSeries.i, pose: pose.body, stamp: pose.stamp } : null;
        if (result && this.tutorPoseID != this.tutorPoseSeries.i) {
            this.playerOneScore += Number.isNaN(this.lastPlayerOneClosestSimilarityValue) ? 0 : this.getPoseScore(this.lastPlayerOneClosestSimilarityValue);
            this.lastPlayerOneClosestSimilarityValue = NaN;
            this.playerTwoScore += Number.isNaN(this.lastPlayerTwoClosestSimilarityValue) ? 0 : this.getPoseScore(this.lastPlayerTwoClosestSimilarityValue);
            this.lastPlayerTwoClosestSimilarityValue = NaN;
            this.tutorPoseID = this.tutorPoseSeries.i;
        }
        return result;
    }
    tutorAnimationPoseAt(timestamp: number): PoseModelOutput | null {
        const pose = this.animatedPoseSeries.extractPose(timestamp);
        const result = pose ? { poseID: this.animatedPoseSeries.i, pose: pose.body, stamp: pose.stamp } : null;
        if (result && this.tutorAnimatedPoseID != this.animatedPoseSeries.i) {
            this.tutorAnimatedPoseID = this.animatedPoseSeries.i;
        }
        return result;
    }
    tutorAnimationPosePeekAt(timestamp: number, step: number): PoseModelOutput | null {
        const pose = this.animatedPoseSeries.peekPose(timestamp, step);
        const result = pose ? { poseID: this.animatedPoseSeries.i + 1, pose: pose.body, stamp: pose.stamp } : null;
        return result;
    }
    playerTwoCurrentPose(): PoseModelOutput | null {
        const pose = this.currentPlayerTwoPose;
        return pose ? { poseID: this.currentPlayerTwoPoseID, pose, stamp: 0 } : null;
    }
    setPlayerTwoCurrentPose(pose: Float32Array) {
        this.currentPlayerTwoPoseID++;
        this.currentPlayerTwoPose = pose;
    }
    playerOneCurrentPose(): PoseModelOutput | null {
        const pose = this.currentPlayerOnePose;
        return pose ? { poseID: this.currentPlayerOnePoseID, pose, stamp: 0 } : null;
    }
    setPlayerOneCurrentPose(pose: Float32Array) {
        this.currentPlayerOnePoseID++;
        this.currentPlayerOnePose = pose;
    }
    closestSimilarityValueAt(isPlayerTwo: boolean, timestamp: number): number {
        const player = isPlayerTwo ? this.playerTwoCurrentPose() : this.playerOneCurrentPose();
        const tutor = this.tutorPoseAt(timestamp);
        if (!player || !tutor) return NaN;
        const playerPose = isPlayerTwo ? this.playerTwoPoseGetter(player.poseID, player.pose, this.bodySize, this.threshold) : this.playerOnePoseGetter(player.poseID, player.pose, this.bodySize, this.threshold);
        const tutorPose = this.tutorPoseGetter(tutor.poseID, tutor.pose, this.bodySize, this.threshold);
        if (playerPose.keypoints.length != bodyParts.length || tutorPose.keypoints.length != bodyParts.length) {
            return NaN;
        }
        const similarity = Math.min(poseSimilarity(mirrorPose(playerPose, this.bodySize), tutorPose, /*{ strategy: 'cosineSimilarity' }*/) as number, poseSimilarity(playerPose, tutorPose, /*{ strategy: 'cosineSimilarity' }*/) as number);
        // if (similarity instanceof Error) {
        //     console.error(similarity)
        //     return NaN;
        // }
        const lastVal = isPlayerTwo ? this.lastPlayerTwoClosestSimilarityValue : this.lastPlayerOneClosestSimilarityValue;
        if (Number.isNaN(lastVal) || similarity <= lastVal) {
            if (isPlayerTwo) {
                this.lastPlayerTwoClosestSimilarityValue = similarity;
            } else {
                this.lastPlayerOneClosestSimilarityValue = similarity;
            }
        }
        return isPlayerTwo ? this.lastPlayerTwoClosestSimilarityValue : this.lastPlayerOneClosestSimilarityValue;
    }
    static preprocess(data: [number, number, number][][]): { series: Float32Array[], stamps: number[] } {
        const stamps: number[] = [];
        const series = data.reduce<Float32Array[]>((acc, keypoints) => {
            stamps.push(keypoints[0][0]);
            acc.push(new Float32Array(
                keypoints.reduce<number[]>((ac, k) => {
                    ac.push(k[2], k[1], 0.7);
                    return ac;
                }, [])
            ))
            return acc
        }, []);
        return { stamps, series }
    }
}

function getBodyWithMemo(): (id: number, list: Float32Array, size: number, threshold?: number) => Pose {
    let lastID = NaN;
    let body: Pose;
    return (id: number, list: Float32Array, size: number, threshold?: number): Pose => {
        if (id != lastID) {
            lastID = id;
            body = getPose(getBody(list, size, threshold));
        }
        return body;
    }
}

function getPose(body: { [key: string]: [number, number] }): Pose {
    return {
        keypoints: Object.entries(body).map(([partName, coordinates]) => ({
            position: {
                x: coordinates[0],
                y: coordinates[1]
            },
            part: partName,
            score: 0.7,
        }))
    }
}

function mirrorPose(pose: Pose, size: number): Pose {
    return {
        keypoints: pose.keypoints.map((p) => ({
            position: {
                y: p.position.y,
                x: size - p.position.x,
            },
            part: p.part,
            score: p.score,
        }))
    }
}
