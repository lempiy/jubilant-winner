import { getWebrtcTransport } from "./transports/webrtc/webrtc_transport";
import { makeId } from "./utils/make_id";
import { NetworkTransport, Link } from './network';
import { COMMAND_TYPE_START, COMMAND_TYPE_START_CONFIRM, COMMAND_TYPE_CONFIG, COMMAND_TYPE_CONFIG_CONFIRM, ConfigPayload, ControlEvent, StartPayload } from "./events";
import { Device } from "./link-provider";


export enum TransportType {
    webrtc = "webrtc",
}

export class Slowbro {
    private transport: NetworkTransport;
    
    devices: {[key: string]: Device} = {};
    devicesUnsub: {[key: string]: ()=>void} = {};
    linkIds: string[] = [];


    constructor(transportType: TransportType, url: string) {
        switch(transportType) {
            case TransportType.webrtc:
                this.transport = getWebrtcTransport(url);
                break;
            default:
                throw transportType
        }
    }

    async awaitRandomLink():Promise<Link> {
        const id = makeId(10);
        return this.awaitLink(id);
    }

    async awaitLink(id: string):Promise<Link> {
        console.log(id);
        const l = await this.transport.awaitPeer(id);
        this.devices[id] = new Device(l);
        this.linkIds.push(id);
        return l;
    }

    async removeLink(id: string) {
        const l = this.devices[id];
        if (!l) return;
        delete this.devices[id];
        l.destroy();
        this.linkIds = this.linkIds.filter(v => v != id);
        this.devicesUnsub[id]();
        delete this.devicesUnsub[id];
    }

    async startCheck(payload: StartPayload): Promise<ControlEvent<void>[]> {
        const devices = Object.values(this.devices);
        devices.forEach((l) => {
            l.sendText(
                JSON.stringify({
                    type: COMMAND_TYPE_START,
                    payload: payload,
                })
            );
        })
        return await Promise.all(devices.map((l) => {
            return l.once<ControlEvent<void>>(COMMAND_TYPE_START_CONFIRM);
        }))
    }

    async setConfig(payload: ConfigPayload): Promise<ControlEvent<void>[]> {
        const devices = Object.values(this.devices);
        devices.forEach((l) => {
            l.sendText(
                JSON.stringify({
                    type: COMMAND_TYPE_CONFIG,
                    payload: payload,
                })
            );
        })
        return await Promise.all(devices.map((l) => {
            return l.once<ControlEvent<void>>(COMMAND_TYPE_CONFIG_CONFIRM);
        }))
    }
}
