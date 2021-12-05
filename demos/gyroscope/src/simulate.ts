interface SimulateOptions {
  pointerX?: number;
  pointerY?: number;
  button?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  bubbles?: boolean;
  cancelable?: boolean;
}

interface SimulateKeyOptions {
  code?: string;
  which?: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  bubbles?: boolean;
  cancelable?: boolean;
}

export function simulate(
  element: HTMLElement,
  eventName: string,
  opts?: SimulateOptions,
  view?: Window
) {
  const options = { ...(opts || {}) };
  const event = new MouseEvent(eventName, {
    view: view,
    bubbles: true,
    cancelable: true,
    clientX: options.pointerX,
    clientY: options.pointerY,
  });

  element.dispatchEvent(event);
}

export function simulateKeyBoard(
  element: Document,
  eventName: string,
  opts: SimulateKeyOptions,
  view?: Window
) {
  const eventObj: any = document.createEvent("Events");

  if (eventObj.initEvent) {
    eventObj.initEvent(eventName, true, true);
  }

  eventObj.keyCode = opts.which;
  eventObj.which = opts.which;

  element.dispatchEvent(eventObj);
}
