export const EVENT_TYPE_RESOLUTION_CHANGE = 0;
export const EVENT_TYPE_RESOLUTION_TOUCH_MOVE = 1;
export const EVENT_TYPE_RESOLUTION_TOUCH_TAP = 2;
export const EVENT_TYPE_RESOLUTION_JOYSTICK_CHANGE = 3;
export const EVENT_TYPE_RESOLUTION_PAD_BUTTON_TAP = 4;
export const EVENT_TYPE_RESOLUTION_GYROSCOPE_CHANGE = 5;
export const EVENT_TYPE_SHARE_MEDIA_DATA = 6;

export const FUNCTION_TOUCH = 'touch';
export const FUNCTION_GAMEPAD = 'gamepad';
export const FUNCTION_GYROSCOPE = 'gyroscope';
export const FUNCTION_GYROSCOPE_GAMEPAD = 'gyroscope_gamepad';
export const FUNCTION_MOVE = 'move';
export const FUNCTION_MEDIA_SHARE = 'media_share';

export const COMMAND_TYPE_START = 'start';
export const COMMAND_TYPE_START_CONFIRM = 'start_confirm';

export interface ControlEvent<T> {
    type: string;
    payload: T;
}

export interface StartPayload {
    isVertical: boolean,
    touch?: {
        enabled: boolean,
        aspectRatio: number,
    }
    gamepad?: {
        enabled: boolean,
    }
    gyroscope?: {
        enabled: boolean,
    }
    gyroscope_gamepad?: {
        enabled: boolean,
    }
    move?: {
        enabled: boolean,
    }
    media_share?: {
        enabled: boolean,
    }
}
