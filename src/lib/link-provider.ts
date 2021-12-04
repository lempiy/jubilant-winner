import { Link } from "./network";
import {
    EVENT_TYPE_RESOLUTION_TOUCH_MOVE,
    EVENT_TYPE_RESOLUTION_TOUCH_TAP,
    EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE,
    EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP,
    EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE,
    EVENT_TYPE_SHARE_MEDIA_DATA,
} from "./events"



export class Device {
    private _sub: () => void;
    [EVENT_TYPE_RESOLUTION_TOUCH_MOVE]:((xRatio: number, yRatio: number)=>void)[] = [];
    [EVENT_TYPE_RESOLUTION_TOUCH_TAP]:((xRatio: number, yRatio: number)=>void)[] = [];
    [EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE]:((degree: number, distance: number)=>void)[] = [];
    [EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP]:((index: number, gesture: number)=>void)[] = [];
    [EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE]:((azimuth: number, patch: number, roll: number)=>void)[] = [];

    constructor(private link: Link) {
        this._sub = this.link.listenBinary((buff) => {
            return this.onEvent(buff);
        });
    }
    get id() {
        return this.link.id;
    }

    get connectionType() {
        return this.link.connectionType;
    }

    async once<T>(event: string): Promise<T> {
        return this.link.once(event);
    }
    
    subscribe<T>(event: string, cb: (data: T) => void): () => void {
        return this.link.subscribe(event, cb);
    }

    async reconnect(): Promise<void> {
        return this.link.reconnect();
    }
    
    async disconnect(): Promise<void> {
        return this.link.disconnect();
    }
    
    listenBinary(cb: (data: ArrayBuffer) => void): () => void {
        return this.link.listenBinary(cb);
    }
    
    maxMessageSize(): number {
        return this.link.maxMessageSize();
    }
    
    async sendText(text: string):Promise<void> {
        return this.link.sendText(text);
    }
    
    async sendBuffer(text: ArrayBuffer):Promise<void> {
        return this.link.sendBuffer(text);
    }

    private _onTouchMove(view: DataView) {
        const xRatio = view.getFloat32(Uint16Array.BYTES_PER_ELEMENT, true);
        const yRatio = view.getFloat32(
          Uint16Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT,
          true
        );
        this[EVENT_TYPE_RESOLUTION_TOUCH_MOVE].forEach((cb) => cb(xRatio, yRatio));
    }

    onTouchMove(cb: (xRatio: number, yRatio: number)=>void): () => void {
        this[EVENT_TYPE_RESOLUTION_TOUCH_MOVE].push(cb);
        return () => {
            this[EVENT_TYPE_RESOLUTION_TOUCH_MOVE] = this[EVENT_TYPE_RESOLUTION_TOUCH_MOVE].filter((v) => v != cb);
        }
    }

    private _onTouchTap(view: DataView) {
        const xRatio = view.getFloat32(Uint16Array.BYTES_PER_ELEMENT, true);
        const yRatio = view.getFloat32(
          Uint16Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT,
          true
        );
        this[EVENT_TYPE_RESOLUTION_TOUCH_TAP].forEach((cb) => cb(xRatio, yRatio));
    }


    onTouchTap(cb: (xRatio: number, yRatio: number)=>void): () => void {
        this[EVENT_TYPE_RESOLUTION_TOUCH_TAP].push(cb);
        return () => {
            this[EVENT_TYPE_RESOLUTION_TOUCH_TAP] = this[EVENT_TYPE_RESOLUTION_TOUCH_TAP].filter((v) => v != cb);
        }
    }

    private _onJoystickChange(view: DataView) {
        const degree = view.getFloat32(Uint16Array.BYTES_PER_ELEMENT, true);
        const distance = view.getFloat32(
          Uint16Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT,
          true
        ); 
        this[EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE].forEach((cb) => cb(degree, distance));
    }

    onJoystickChange(cb: (degree: number, distance: number)=>void): () => void {
        this[EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE].push(cb);
        return () => {
            this[EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE] = this[EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE].filter((v) => v != cb);
        }
    }

    private _onPadButtonTap(view: DataView) {
        const index = view.getUint16(Uint16Array.BYTES_PER_ELEMENT, true);
        const gesture = view.getUint16(Uint16Array.BYTES_PER_ELEMENT * 2, true);
        this[EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP].forEach((cb) => cb(index, gesture));
    }

    onPadButtonTap(cb: (index: number, gesture: number)=>void): () => void {
        this[EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP].push(cb);
        return () => {
            this[EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP] = this[EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP].filter((v) => v != cb);
        }
    }

    private _onGyroscopeChange(view: DataView) {
        const azimuth = view.getFloat32(Uint16Array.BYTES_PER_ELEMENT, true);
        const pitch = view.getFloat32(
            Uint16Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT,
            true
        );
        const roll = view.getFloat32(
            Uint16Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT * 2,
            true
        );
        this[EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE].forEach((cb) => cb(azimuth, pitch, roll));
    }

    onGyroscopeChange(cb: (azimuth: number, pitch: number, roll: number)=>void): () => void {
        this[EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE].push(cb);
        return () => {
            this[EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE] = this[EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE].filter((v) => v != cb);
        }
    }

    async sendMediaData(buff: ArrayBuffer) {
        const header = new DataView(buff);
        const t = header.getUint16(0);
        if (t != EVENT_TYPE_SHARE_MEDIA_DATA) {
            throw 'wrong event type '+ t;
        }
        return this.link.sendBuffer(buff);
    }

    onEvent(buffer: ArrayBuffer) {
        const view = new DataView(buffer);
        switch (view.getUint16(0, true)) {
          case EVENT_TYPE_RESOLUTION_TOUCH_MOVE:
            return this._onTouchMove(view);
          case EVENT_TYPE_RESOLUTION_TOUCH_TAP:
            return this._onTouchTap(view);
          case EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE:
            return this._onJoystickChange(view);
          case EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP:
            return this._onPadButtonTap(view);
          case EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE:
            return this._onGyroscopeChange(view);
          default:
            console.warn("unknown event received");
        }
    };

    destroy():void {
        this.link.disconnect();
        this._sub();
    }
}
