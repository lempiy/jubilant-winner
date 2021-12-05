import { EVENT_TYPE_SHARE_MEDIA_DATA } from "slowbro";

export interface ShareRequestPayload {
    timestamp: number;
}

export interface ShareRequestAnswerPayload {
    ok: boolean;
    reason?: string;
    offset: number;
    duration: number;
    length: number;
}

export interface ShareRequestStopAnswerPayload {
    ok: boolean;
    reason?: string;
    keep: number;
    keep_id: number;
    keep_full_length: number;
    keep_full_duration: number;
}

export const encodeShareChunk = (id: number, from: number, to: number, duration: number, source: Uint8Array): ArrayBuffer => {
    const bodyLength = to - from;
    // event_type(uint16)|id(uint16)|from(uint32)|to(uint32)|total(uint32)|duration(uint16)|payload(uint8list)
    const headerLength = Uint16Array.BYTES_PER_ELEMENT * 2 + Uint32Array.BYTES_PER_ELEMENT * 3 + Float32Array.BYTES_PER_ELEMENT;
    // TODO: reuse buffer
    const buff = new ArrayBuffer(headerLength + bodyLength);
    const header = new DataView(buff, 0, headerLength)
    const body = new Uint8Array(buff, headerLength, bodyLength);
    header.setUint16(0, EVENT_TYPE_SHARE_MEDIA_DATA, true);
    header.setUint16(Uint16Array.BYTES_PER_ELEMENT, id, true);
    header.setUint32(Uint16Array.BYTES_PER_ELEMENT * 2, from, true);
    header.setUint32(Uint16Array.BYTES_PER_ELEMENT * 2 + Uint32Array.BYTES_PER_ELEMENT, to, true);
    header.setUint32(Uint16Array.BYTES_PER_ELEMENT * 2 + Uint32Array.BYTES_PER_ELEMENT * 2, source.byteLength, true);
    header.setFloat32(Uint16Array.BYTES_PER_ELEMENT * 2 + Uint32Array.BYTES_PER_ELEMENT * 3, duration, true);
    body.set(source.subarray(from, to));
    return buff;
}
