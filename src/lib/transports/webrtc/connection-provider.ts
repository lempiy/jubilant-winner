import { Signaller } from "./signaller";
import { Connection } from "./connection";

interface Resolver<T> {
  resolve(data: T): void;
}

export class ConnectionProvider {
  public connectionType = 'webrtc';
  private connection?: Connection;
  private _once: { [key: string]: Resolver<unknown>[] } = {};
  private _all: { [key: string]: ((data: any) => void)[] } = {};
  private _binaryListeners: ((data: ArrayBuffer) => void)[] = [];

  constructor(public id: string, private signaller: Signaller) { }

  static async create(
    id: string,
    signaller: Signaller
  ): Promise<ConnectionProvider> {
    const provider = new ConnectionProvider(id, signaller);
    provider.id = id;
    await provider.reconnect();
    return provider;
  }

  once<T>(event: string): Promise<T> {
    return new Promise((resolve) => {
      const resolver = {
        resolve(data: T) {
          resolve(data);
        },
      };
      if (!this._once[event]) this._once[event] = [resolver];
      else this._once[event].push(resolver);
    });
  }

  subscribe<T>(event: string, cb: (data: T) => void): () => void {
    if (!this._all[event]) this._all[event] = [cb];
    else this._all[event].push(cb);
    return () => {
      this._all[event] = this._all[event].filter((c) => c !== cb);
    };
  }

  private async onMessage(e: MessageEvent) {
    if (typeof e.data === "string") {
      const message = JSON.parse(e.data);
      console.log("message: ", message);
      if (message.type) {
        this._once[message.type]?.forEach((cb) => cb.resolve(message));
        this._all[message.type]?.forEach((cb) => cb(message));
      }
    } else {
      const data: ArrayBuffer =
        e.data instanceof Blob ? await e.data.arrayBuffer() : e.data;
      this._binaryListeners.forEach((cb) => cb(data));
    }
  }

  listenBinary(cb: (data: ArrayBuffer) => void): () => void {
    this._binaryListeners.push(cb);
    return () => {
      this._binaryListeners = this._binaryListeners.filter((v) => v !== cb);
    };
  }

  maxMessageSize(): number {
    return this.connection?.maxMessageSize || 0;
  }

  async sendText(text: string) {
    await this.connection?.sendText(text);
  }

  async sendBuffer(text: ArrayBuffer) {
    await this.connection?.sendBuffer(text);
  }

  async disconnect(): Promise<void> {
      return this.connection?.destroy();
  }

  async reconnect(): Promise<void> {
    if (this.connection) {
      this.connection.destroy();
    }
    console.log('new conn', this.signaller);
    this.connection = new Connection(this.id, this.signaller);
    await this.connection.waitConnection();
    this.connection.onClose(() => {
      return this.reconnect();
    });
    this.connection?.onMessage(this.onMessage.bind(this));
  }
}
