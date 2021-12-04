import { getWebrtcTransport } from "./transports/webrtc/webrtc_transport";
import { makeId } from "./utils/make_id";
import { NetworkTransport, Link } from './network';
import { COMMAND_TYPE_START, COMMAND_TYPE_START_CONFIRM, ControlEvent, StartPayload } from "./events";


export enum TransportType {
    webrtc = "webrtc",
}

export class Slowbro {
    private transport: NetworkTransport;
    
    links: {[key: string]: Link} = {};

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
        this.links[id] = l;
        return l;
    }

    async removeLink(id: string) {
        const l = this.links[id];
        if (!l) return;
        delete this.links[id];
        l.disconnect();
    }

    async start(payload: StartPayload) {
        const links = Object.values(this.links);
        links.forEach((l) => {
            l.sendText(
                JSON.stringify({
                    type: COMMAND_TYPE_START,
                    payload: payload,
                })
            );
        })
        return Promise.all(links.map((l) => {
            return l.once<ControlEvent<void>>(COMMAND_TYPE_START_CONFIRM);
        }))
    }
}
