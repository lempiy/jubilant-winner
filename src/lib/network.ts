export interface NetworkTransport {
    awaitPeer(id: string):Promise<Link>;
}

export interface Link {
    id: string;
    connectionType: string;

    once<T>(event: string): Promise<T>;
    
    subscribe<T>(event: string, cb: (data: T) => void): () => void;

    reconnect(): Promise<void>;
    
    disconnect(): Promise<void>;
    
    listenBinary(cb: (data: ArrayBuffer) => void): () => void;
    
    maxMessageSize(): number;
    
    sendText(text: string):Promise<void>;
    
    sendBuffer(text: ArrayBuffer):Promise<void>;
}
