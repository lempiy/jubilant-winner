import { makeId } from "../../utils/make_id";
import { Signaller } from "./signaller";

const SCTP_DEFAULT_MESSAGE_SIZE = 262144;

export const options: RTCConfiguration = {
  iceServers: [],
  iceCandidatePoolSize: 5,
};

interface Candidate {
  type: "candidate";
  mark: string;
  data: RTCIceCandidate;
}

export class Connection {
  private connection: RTCPeerConnection;
  private channel: RTCDataChannel;
  private mark: string = makeId(10);
  private delayedCandidates: Candidate[] = [];
  private sendQueue: ((ok: boolean) => void)[] = []
  private isBufferingSupported = false;
  constructor(private id: string, private signaller: Signaller) {
    this.connection = new RTCPeerConnection(options);
    this.channel = this.connection.createDataChannel("data", {
      ordered: false,
    });
    this.isBufferingSupported = this.channel.onbufferedamountlow !== undefined;
    this.channel.onmessage = (msg) => {
      this.channel.send(msg.data);
    };
    this.channel.onopen = () => {
      console.log("Channel opened: "+ this.id);
    };
    this.channel.onclose = () => console.log("closed");
    this.connection.onsignalingstatechange = () => {
      console.log(this.connection.iceConnectionState);
    };
    this.connection.onicecandidate = (e) => this.onCandidate(e.candidate);
    this.signaller.subscribe<Candidate>(this.id, "candidate", async (data) =>
      this.onSignalCandidate(data)
    );
    this.connection.ondatachannel = (e) => {
      this.isBufferingSupported = this.channel.onbufferedamountlow !== undefined;
      const onClose = this.channel.onclose;
      const onOpen = this.channel.onopen;
      const onMessage = this.channel.onmessage;
      this.channel = e.channel;
      this.channel.onbufferedamountlow = () => {
        this.sendQueue.forEach((cb) => cb(true));
        this.sendQueue = [];
      };
      this.channel.onclose = onClose;
      this.channel.onopen = onOpen;
      this.channel.onmessage = onMessage;
    };
  }

  async sendText(data: string) {
    this.channel.send(data);
  }

  get maxMessageSize() {
    const conn = this.connection as any;
    return conn &&
      conn.sctp &&
      conn.sctp.maxMessageSize
      ? conn.sctp.maxMessageSize
      : SCTP_DEFAULT_MESSAGE_SIZE;
  }

  private onChannelFree(callback: (ok: boolean) => void) {
    this.sendQueue.push(callback)
  }

  private async waitFreeBuffer() {
    return new Promise((resolve) => {
      this.onChannelFree(resolve);
    });
  }

  private async waitFreeChannel(ch: RTCDataChannel): Promise<void> {
    while (ch.bufferedAmount > this.maxMessageSize * 24) {
      await this.waitFreeBuffer();
    }
  }

  async sendBuffer(data: ArrayBuffer) {
    if (!this.isBufferingSupported) return this.channel.send(data);
    await this.waitFreeChannel(this.channel);
    this.channel.send(data);
  }

  onClose(cb: () => void) {
    this.channel.onclose = cb;
  }

  onMessage(cb: (e: MessageEvent) => void) {
    this.channel.onmessage = cb;
  }

  async onSignalCandidate(payload: Candidate): Promise<void> {
    const { mark, data } = payload;
    if (this.mark === mark) return;
    if (!this.connection.remoteDescription) {
      this.delayedCandidates.push(payload);
      return;
    }
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: data.sdpMLineIndex,
      sdpMid: data.sdpMid,
      candidate: data.candidate,
    });
    this.connection.addIceCandidate(candidate);
  }

  async offer(): Promise<RTCSessionDescription> {
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    this.signaller.publish(this.id, JSON.stringify(this.connection.localDescription!));
    const sdp = await this.signaller.once<RTCSessionDescription>(this.id, "answer");
    await this.connection.setRemoteDescription(sdp);
    return this.connection.localDescription!;
  }

  onCandidate(candidate: RTCIceCandidate | null) {
    if (!candidate) return;
    this.signaller.publish(this.id, 
      JSON.stringify({ mark: this.mark, type: "candidate", data: candidate })
    );
  }

  async waitConnection(): Promise<void> {
    const offer = await this.signaller.once<RTCSessionDescription>(this.id, "offer");
    console.log("Got offer: ", offer);
    await this.connection.setRemoteDescription(offer);
    this.delayedCandidates.forEach((c) => this.onSignalCandidate(c));
    const answer = await this.connection.createAnswer({ iceRestart: true });
    await this.connection.setLocalDescription(answer);
    this.signaller.publish(this.id, JSON.stringify(answer));
    return new Promise((resolve, reject) => {
      this.channel.onopen = () => {
        console.log("Channel opened");
        resolve();
      };
      this.channel.onerror = (e) => reject(e);
    });
  }

  destroy() {
    this.connection.close();
  }
}
