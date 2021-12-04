export enum Direction {
  up = 0,
  down = 1,
  right = 2,
  left = 3,
  none = 4,
}

export const degreesToButtonsNoCross = (degrees: number): Direction => {
  if (degrees >= 45 && degrees < 135) {
    return Direction.right;
  } else if (degrees >= 135 && degrees < 225) {
    return Direction.down;
  } else if (degrees >= 225 && degrees < 315) {
    return Direction.left;
  } else {
    return Direction.up;
  }
};
