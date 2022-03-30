export type ActionLogo = "none" | "down" | "move" | "up";

export type ControlPoint = {
  offsetY: number;
  name: string;
};

export type ControlPointMutated = {
  offsetY: number;
  name: string;
  active: boolean;
};

export type StepsProps = {
  controlPoints: (ControlPoint | undefined)[];
  currentPositionLogo: number;
  onActionLogo: (vodue: ActionLogo) => void;
  activeLogo: ActionLogo;
  setScroll: (trackWidth: number, logoOffset: number) => void;
};

export type StepperPointProps = {
  active: boolean;
  name: string;
  indexItem: number;
  actionLogo: ActionLogo;
  positinLogo: number;
  onLogoOnDots: (value: boolean) => void;
};
