import { ConnectionProvider } from "./connection-provider";
import { Signaller } from "./signaller";

class WebRtcTransport {
    private _signaller: Signaller;
    private _peers: {[key: string]: ConnectionProvider} = {};
    constructor(url: string) {
        this._signaller = new Signaller(url);
    }
    
    async awaitPeer(id: string):Promise<ConnectionProvider> {
        this._signaller.appPeer(id);
        const provider = await ConnectionProvider.create(id, this._signaller);
        this._peers[id] = provider;
        return provider;
    }
}

export const getWebrtcTransport = (url: string) => new WebRtcTransport(url);
