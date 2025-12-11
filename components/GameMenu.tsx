import React from 'react';
import { GameStatus, Difficulty } from '../types';
import { RefreshCcw, User, Users, Play, XCircle, Maximize, Minimize } from 'lucide-react';

interface GameMenuProps {
  status: GameStatus;
  scoreP1: number;
  scoreP2: number;
  timeLeft: number;
  gameMode: 'single' | 'multi' | null;
  highScore: number;
  winner: string | null;
  isFullscreen: boolean;
  onStartSingle: () => void;
  onStartMulti: () => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onToggleFullscreen: () => void;
}

const MenuButton: React.FC<{ 
  onClick: () => void; 
  children: React.ReactNode; 
  variant?: 'primary' | 'danger' | 'success' | 'outline' | 'ghost';
  className?: string;
}> = ({ onClick, children, variant = 'primary', className = '' }) => {
  let bgClass = '';
  switch (variant) {
    case 'primary': bgClass = 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/50'; break;
    case 'danger': bgClass = 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-red-500/50'; break;
    case 'success': bgClass = 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/50'; break;
    case 'outline': bgClass = 'bg-transparent border-2 border-slate-500 text-slate-400 hover:border-slate-300 hover:text-slate-200'; break;
    case 'ghost': bgClass = 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white backdrop-blur-sm'; break;
  }

  return (
    <button
      onClick={onClick}
      className={`relative px-8 py-3 rounded-full font-bold uppercase tracking-wider text-lg shadow-lg transform transition-transform active:scale-95 flex items-center justify-center gap-2 w-64 ${bgClass} ${className}`}
    >
      {children}
    </button>
  );
};

export const GameMenu: React.FC<GameMenuProps> = ({
  status,
  scoreP1,
  scoreP2,
  // timeLeft, // Unused
  highScore,
  winner,
  isFullscreen,
  onStartSingle,
  onStartMulti,
  onSelectDifficulty,
  onResume,
  onRestart,
  onQuit,
  onToggleFullscreen
}) => {
  if (status === GameStatus.PLAYING) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-fade-in">
      
      {/* Absolute top right fullscreen toggle */}
      <button 
        onClick={onToggleFullscreen}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        title="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
      </button>

      <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
        NEON HOCKEY
      </h1>
      
      {status === GameStatus.MENU && (
        <>
          <div className="text-amber-400 font-bold text-xl mb-8 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
            Highscore: {highScore}
          </div>
          <div className="flex flex-col gap-4">
            <MenuButton onClick={onStartSingle} variant="danger">
              <User size={20} /> 1 Player
            </MenuButton>
            <MenuButton onClick={onStartMulti} variant="primary">
              <Users size={20} /> 2 Players
            </MenuButton>
            <MenuButton onClick={onToggleFullscreen} variant="ghost" className="mt-2 !w-auto !px-6 !py-2 !text-sm">
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />} 
                {isFullscreen ? ' Exit Fullscreen' : ' Fullscreen'}
            </MenuButton>
            
            <div className="mt-8 text-center text-slate-400 text-sm max-w-xs">
              <p className="font-semibold text-slate-300 mb-1">Arcade Mode</p>
              <p>Score as much as possible in 2 minutes.</p>
              <p className="mt-2 text-xs opacity-75">Double-tap center to pause.</p>
            </div>
          </div>
        </>
      )}

      {status === GameStatus.DIFFICULTY_SELECT && (
        <div className="flex flex-col gap-4 animate-slide-up">
          <h2 className="text-2xl text-white font-bold mb-4 text-center">Select Difficulty</h2>
          <MenuButton onClick={() => onSelectDifficulty(Difficulty.EASY)} variant="success">Easy</MenuButton>
          <MenuButton onClick={() => onSelectDifficulty(Difficulty.MEDIUM)} variant="primary" className="!bg-gradient-to-br !from-amber-500 !to-amber-700 !shadow-amber-500/50">Medium</MenuButton>
          <MenuButton onClick={() => onSelectDifficulty(Difficulty.HARD)} variant="danger">Hard</MenuButton>
          <MenuButton onClick={onQuit} variant="outline" className="mt-4">Back</MenuButton>
        </div>
      )}

      {status === GameStatus.PAUSED && (
        <div className="flex flex-col gap-4 animate-scale-in">
          <h2 className="text-3xl text-white font-bold mb-6 text-center">PAUSED</h2>
          <MenuButton onClick={onResume} variant="success">
            <Play size={20} /> Resume
          </MenuButton>
          <MenuButton onClick={onQuit} variant="outline">
            <XCircle size={20} /> Quit
          </MenuButton>
        </div>
      )}

      {status === GameStatus.GAME_OVER && (
        <div className="flex flex-col gap-4 animate-scale-in text-center">
          <h2 className={`text-4xl font-black mb-2 ${winner === 'P1' ? 'text-green-400' : winner === 'P2' ? 'text-red-400' : 'text-white'}`}>
            {winner === 'P1' ? 'YOU WIN!' : winner === 'P2' ? 'COMPUTER WINS' : winner === 'DRAW' ? 'DRAW!' : 'GAME OVER'}
          </h2>
          
          <div className="flex items-center justify-center gap-8 mb-6">
             <div className="text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Player 1</div>
                <div className="text-4xl font-mono font-bold text-blue-400">{scoreP1}</div>
             </div>
             <div className="text-2xl text-slate-600 font-bold">:</div>
             <div className="text-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest">Player 2</div>
                <div className="text-4xl font-mono font-bold text-red-400">{scoreP2}</div>
             </div>
          </div>

          <MenuButton onClick={onRestart} variant="primary">
             <RefreshCcw size={20} /> Play Again
          </MenuButton>
          <MenuButton onClick={onQuit} variant="outline">
             Main Menu
          </MenuButton>
        </div>
      )}
    </div>
  );
};