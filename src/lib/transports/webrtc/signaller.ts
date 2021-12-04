import { Client } from "faye";

interface Resolver<T> {
  resolve(data: T): void;
}

export class Signaller {
  private client: any;
  private _once: { [key: string]: Resolver<unknown>[] } = {};
  private _all: { [key: string]: ((data: any) => void)[] } = {};
  private sub: any[] = [];

  constructor(url: string) {
    console.log('new client', url);
    this.client = new Client(url);
  }

  appPeer(id: string) {
    this.sub.push(this.client.subscribe("/" + id, (message: string) => {
      this.onMessage(id, message);
    }));
  }

  once<T>(id: string, event: string): Promise<T> {
    return new Promise((resolve) => {
      const resolver = {
        resolve(data: T) {
          resolve(data);
        },
      };
      if (!this._once[`${id}_${event}`]) this._once[`${id}_${event}`] = [resolver];
      else this._once[`${id}_${event}`].push(resolver);
    });
  }

  subscribe<T>(id: string, event: string, cb: (data: T) => void): () => void {
    if (!this._all[`${id}_${event}`]) this._all[`${id}_${event}`] = [cb];
    else this._all[`${id}_${event}`].push(cb);
    return () => {
      this._all[event] = this._all[`${id}_${event}`].filter((c) => c !== cb);
    };
  }

  kill() {
    this.sub.forEach(u => u());
  }

  publish(id: string, text: string) {
    this.client.publish("/" + id, text);
  }

  private onMessage(id: string, data: string) {
    const message = JSON.parse(data);
    console.log("message: ", message);
    if (message.type) {
      this._once[`${id}_${message.type}`]?.forEach((cb) => cb.resolve(message));
      this._all[`${id}_${message.type}`]?.forEach((cb) => cb(message));
    }
  }
}
