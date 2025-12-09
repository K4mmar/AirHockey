export type Vector = {
  x: number;
  y: number;
};

export type Player = {
  pos: Vector;
  prevPos: Vector;
  velocity: Vector;
  score: number;
};

export type Puck = {
  pos: Vector;
  velocity: Vector;
};

export enum GameMode {
  SINGLE_PLAYER = 'SINGLE_PLAYER',
  MULTI_PLAYER = 'MULTI_PLAYER',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum GameStatus {
  MENU = 'MENU',
  DIFFICULTY_SELECT = 'DIFFICULTY_SELECT',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface DifficultySettings {
  baseSpeed: number;
  shotSpeed: number;
  reactionBase: number; // frames to wait before updating target
  errorMargin: number; // max pixels to offset target
  label: string;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultySettings> = {
  [Difficulty.EASY]: {
    baseSpeed: 0.035,
    shotSpeed: 0.15,
    reactionBase: 25,
    errorMargin: 35,
    label: "Easy",
  },
  [Difficulty.MEDIUM]: {
    baseSpeed: 0.07,
    shotSpeed: 0.22,
    reactionBase: 18,
    errorMargin: 12,
    label: "Medium",
  },
  [Difficulty.HARD]: {
    baseSpeed: 0.12,
    shotSpeed: 0.30,
    reactionBase: 8,
    errorMargin: 2,
    label: "Hard",
  },
};