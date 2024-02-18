'use client';

import { Chess, Move, Square } from 'chess.js';
import { useContext, useEffect, useMemo, useState } from 'react';
import { PuzzleContext, RatingHolder } from './puzzle-mode';
import LoadingBoard from './loading-board';
import React from 'react';
import ChessboardWrapped from './chessboard-wrapped';
import ControlButtonBar, { PlaybackControllerContext } from './controls/control-bar-button';
import MoveViewer, { MoveNavigationContext } from './controls/move-viewer';
import ResetPuzzleButton, { ResetPuzzleButtonContext } from './controls/reset-puzzle-button';
import { Puzzle } from '@/types/lichess-api';

interface PuzzleBoardProps {
  puzzle?: Puzzle;
  initialRating: RatingHolder;
}
// set its props to be the puzzle object
const PuzzleBoard: React.FC<PuzzleBoardProps> = ({ puzzle, initialRating }) => {
  const { submitNextPuzzle: submitPuzzle, ..._ } = useContext(PuzzleContext);
  if (!puzzle) return < LoadingBoard />;
  const line = puzzle.Moves.split(' ');
  const side = puzzle.FEN.split(' ')[1] === 'w' ? 'b' : 'w';

  // game state
  const game = useMemo(() => new Chess(puzzle.FEN), [puzzle]);
  const [fen, setFen] = useState(game.fen());
  const [linePos, setLinePos] = useState(0);

  // mode related state
  const [rendered, setRendered] = useState(false);
  const [solved, setSolved] = useState<boolean>(false);
  const [playbackPos, setPlaybackPos] = useState(0);


  // extra playback state
  const [fens, setFens] = useState([game.fen()]);

  // user's rating
  const [rating, setRating] = useState<RatingHolder>(initialRating);

  // calculated modes
  const playbackMode = playbackPos !== linePos || solved;
  const inPlay = rendered && !playbackMode && !solved;
  const interactive = inPlay && linePos % 2 === 1;


  /** OVERALL RESET */
  const loadPuzzle = () => {
    console.log("loading puzzle");
    game.load(puzzle.FEN);
    setSolved(false);
    setFens([puzzle.FEN]);
    setFen(puzzle.FEN);
    setPlaybackPos(0);
    setLinePos(0);
  };

  useEffect(() => {
    loadPuzzle();
  }, [puzzle])

  // memoized functions for playback
  // playback
  const firstMove = useMemo(() => (() => setPlaybackPos(0)), [setPlaybackPos]);
  const lastMove = useMemo(() => (() => setPlaybackPos(linePos)), [setPlaybackPos, linePos]);
  const nextMove = useMemo(() => (() => setPlaybackPos(pos => Math.min(linePos, pos + 1))), [setPlaybackPos, linePos, playbackPos]);
  const prevMove = useMemo(() => (() => setPlaybackPos(pos => Math.max(0, pos - 1))), [setPlaybackPos, playbackPos]);

  /** PLAYBACK MODE */
  useEffect(() => {
    if (playbackMode) setFen(fens[playbackPos]);
    else setFen(game.fen());
  }, [playbackMode, playbackPos, fens, linePos]);

  /** PUZZLE LOGIC **/
  // RENDERED CALLBACK
  const renderedCallback = () => {
    if (!rendered) setRendered(true);
    return {};
  }

  // MOVEMENT
  // try the bot's first move after rendering
  useEffect(() => {
    if (rendered && linePos === 0) {
      const timeout = setTimeout(botMove, 400);
      return () => clearTimeout(timeout);
    };
  });

  // bot move
  function botMove() {
    if (inPlay && linePos < line.length) {
      game.move(line[linePos]);
      setFen(game.fen());
      setFens(prev => [...prev, game.fen()]);
      setLinePos((prev) => prev + 1);
      setPlaybackPos((prev) => prev + 1);
    }
  }

  const playerMoveCallback = (from: Square, to: Square, promotion?: string) => {
    game.move({ from: from, to: to, promotion: promotion });
    setFen(game.fen());
    setFens(prev => [...prev, game.fen()]);
    setLinePos(prev => prev + 1);
    setPlaybackPos((prev) => prev + 1);
  }

  /** HANDLE PLAYER MOVE VERIFICATION */
  // TODO: add events to these, so that other components can pick up
  // player moved incorrectly
  function undoWrongMove() {
    console.log("wrong move");
    if (submitPuzzle) {
      submitPuzzle(false, rating).then(r => setRating(r))
    }
    game.undo();
    setFen(game.fen());
    setFens(prev => prev.slice(0, -1));
    setLinePos(prev => prev - 1);
    setPlaybackPos(prev => prev - 1);
  }

  // player moved correctly
  function correctMove() {
    const timeout = setTimeout(botMove, 300); // start up the bot's move
    return () => clearTimeout(timeout);
  }

  // player finished puzzle
  function finishedGame() {
    if (submitPuzzle) {
      submitPuzzle(true, rating).then(r => setRating(r))
    }
    setSolved(true);
  }

  useEffect(() => {
    if (inPlay && !interactive && linePos > 0) {
      if (game.history({ verbose: true }).pop()?.lan !== line[linePos - 1])
        setTimeout(undoWrongMove, 300);
      else if (linePos >= line.length) finishedGame();
      else correctMove();
      return;
    }
  });

  // last move for highlighting
  const lastMoveToHighlight: Move | undefined = game.history({ verbose: true }).find((_, i) => i === playbackPos - 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ marginRight: '20px' }}>
          <ChessboardWrapped
            side={side}
            fen={fen}
            lastMove={lastMoveToHighlight}
            interactive={interactive}
            updateGame={interactive ? playerMoveCallback : (() => { })}
            renderedCallback={rendered ? (() => { return; }) : renderedCallback}
          />
        </div>
        <div>
          <span style={{ fontSize: '20px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', marginRight: '5px' }}>Rating:</span>
          <span style={{ fontSize: '24px', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: 'green' }}>{Math.round(rating.rating)}</span>
        </div>
      </div>
      <div>
        <ResetPuzzleButtonContext.Provider value={{ solved, reloadPuzzle: loadPuzzle }}>
          <ResetPuzzleButton />
        </ResetPuzzleButtonContext.Provider>
        <PlaybackControllerContext.Provider value={{ firstMove, prevMove, nextMove, lastMove }}>
          <ControlButtonBar />
        </PlaybackControllerContext.Provider>
        <MoveNavigationContext.Provider value={{ currentIndex: playbackPos, moves: game.history(), side }}>
          <MoveViewer />
        </MoveNavigationContext.Provider>
      </div>
    </div>
  );
};

export default React.memo(PuzzleBoard);
