'use client';

import { Puzzle } from '@/types/lichess-api';
import { Chess, Square, Piece as ChessjsPiece } from 'chess.js';
import { useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { CustomPieces, CustomSquareStyles, Piece } from 'react-chessboard/dist/chessboard/types';

const buttonStyle = {
  cursor: "pointer",
  padding: "10px 20px",
  margin: "10px 10px 0px 0px",
  borderRadius: "6px",
  backgroundColor: "#f0d9b5",
  border: "none",
  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.5)",
};

const inputStyle = {
  padding: "10px 20px",
  margin: "10px 0 10px 0",
  borderRadius: "6px",
  border: "none",
  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.5)",
};

const boardWrapper = {
  width: `70vw`,
  maxWidth: "70vh",
  margin: "3rem auto",
};

const chessjs_piece_convert = (piece: ChessjsPiece) => (piece.color + piece.type.toUpperCase()) as Piece;

export default function PuzzleBoard({ puzzle }: { puzzle: Puzzle }) {
  const game = useMemo(() => new Chess(puzzle.fen), []);
  const [fen, setFen] = useState(game.fen());
  const [rightClickedSquares, setRightClickedSquares] = useState<CustomSquareStyles>({});
  const [optionSquares, setOptionSquares] = useState<CustomSquareStyles>({});
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);

  const line = puzzle.line.split(' ');
  const side = puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w';

  const [linePos, setLinePos] = useState(0);

  const pieces: Piece[] = [
    "wP",
    "wN",
    "wB",
    "wR",
    "wQ",
    "wK",
    "bP",
    "bN",
    "bB",
    "bR",
    "bQ",
    "bK",
  ];

  const customPieces = useMemo(() => {
    const pieceComponents: CustomPieces = {};
    pieces.forEach((piece) => {
      pieceComponents[piece] = ({ squareWidth }: { squareWidth: number }) => (
        <div
          style={{
            width: squareWidth,
            height: squareWidth,
            backgroundImage: `url(https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${piece.toLowerCase()}.png)`,
            backgroundSize: "100%",
          }}
        />
      );
    });
    return pieceComponents;
  }, []);

  // move bot after user
  useEffect(() => {
    if (linePos === 0) {
      const timeout = setTimeout(botMove, 500);
      return () => clearTimeout(timeout);
    } else if (linePos % 2 === 0) {
      return verifyPlayerMove(() => {
        const timeout = setTimeout(botMove, 300);
        return () => clearTimeout(timeout);
      });
    }
  }, [linePos])

  function verifyPlayerMove(successCallback?: () => (() => void)) {
    // callback only executed if the move was correct
    // verify last move by user was correct according to line.
    // if it was incorrect then undo the move
    console.log('verifyPlayerMove');
    if (linePos > 0 && game.history({ verbose: true }).pop()?.lan !== line[linePos - 1]) {
        const timeout = setTimeout(() => {
          game.undo();
          setFen(game.fen());
          setLinePos(prev => prev - 1);
        }, 300);
        return ()=>{ clearTimeout(timeout) };
    }
    if (successCallback) successCallback();
    return ()=>{};
  }

  function botMove() {
    console.log('botMove');
    // if it was correct bot move the next move in the line
    if (linePos < line.length) {
      game.move(line[linePos]);
      setFen(game.fen());
      setLinePos(prev => prev + 1);
    } else {
      console.log('puzzle solved');
    }
  }

  function lastMoveHighlight() {
    const moves = game.history({ verbose: true });
    const lastMove = moves[moves.length - 1];
    if (lastMove) {
      return {
        [lastMove.from]: {
          background: "rgba(0, 255, 0, 0.4)",
        },
        [lastMove.to]: {
          background: "rgba(0, 255, 0, 0.4)",
        },
      };
    }
  }

  function onDrop(sourceSquare: Square, targetSquare: Square, piece: Piece) {
    try {
      game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece[1].toLowerCase() ?? "q",
      });
      setFen(game.fen());
      setOptionSquares({});
      setLinePos(prev => prev + 1);
      return true;
    } catch {
      return false;
    }
  }

  function getMoveOptions(square: Square) {
    if (!game.get(square) || game.get(square).color !== side) {
      setOptionSquares({});
      return false;
    }

    const moves = game.moves({
      square,
      verbose: true,
    });

    const newSquares: { [key: string]: { background: string; borderRadius?: string } } = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) &&
            game.get(move.to).color !== game.get(square).color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
      return move;
    });
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
    };
    setOptionSquares(newSquares);
    return true;
  }

  function onPieceDragBegin(_: Piece, sourceSquare: Square) {
    setRightClickedSquares({});
    getMoveOptions(sourceSquare);
  }

  function onSquareClick(square: Square) {
    if (moveFrom && onDrop(moveFrom, square, chessjs_piece_convert(game.get(moveFrom)))) {
      setMoveFrom(null);
    } else {
      setRightClickedSquares({});
      getMoveOptions(square);
      if (game.get(square) && game.get(square).color === side) setMoveFrom(square);
    }
  }

  function onSquareRightClick(square: Square) {
    const colour = "rgba(0, 0, 255, 0.4)";

    if (square in rightClickedSquares) {
      delete rightClickedSquares[square];
      setRightClickedSquares({ ...rightClickedSquares });
    } else {
      setRightClickedSquares({
        ...rightClickedSquares,
        [square]: { backgroundColor: colour },
      });
    }
  }

  function onPromotionCheck(sourceSquare: Square, targetSquare: Square, piece: Piece) {
    const moves = game.moves({
      square: sourceSquare,
      verbose: true,
    });
    const foundMove = moves.find(
      (m) => m.from === sourceSquare && m.to === targetSquare
    );
    // not a valid move
    if (!foundMove) {
      return false;
    }

    // valid, check if promotion move
    return (
      (foundMove.color === "w" &&
        foundMove.piece === "p" &&
        targetSquare[1] === "8") ||
      (foundMove.color === "b" &&
        foundMove.piece === "p" &&
        targetSquare[1] === "1")
    )
  }

  return (
    <div style={boardWrapper}>
      <Chessboard
        animationDuration={200}
        boardOrientation={side === "w" ? "white" : "black"}
        position={fen}
        isDraggablePiece={({ piece }) => piece[0] === side}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDrop={onDrop}
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        onPromotionCheck={onPromotionCheck}
        customBoardStyle={{
          borderRadius: "4px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
        }}
        customSquareStyles={{
          ...optionSquares,
          ...lastMoveHighlight(),
          ...rightClickedSquares,
        }}
        customPieces={customPieces}
      />
      <button
        style={buttonStyle}
        onClick={() => {
          game.load(puzzle.fen);
          setFen(game.fen());
          setLinePos(0);
          setOptionSquares({});
          setRightClickedSquares({});
        }}
      >
        reset
      </button>
      <button
        style={buttonStyle}
        onClick={() => {
          game.undo();
          setFen(game.fen());
          setLinePos(prev => prev - 1);
          setOptionSquares({});
          setRightClickedSquares({});
        }}
      >
        undo
      </button>
    </div>
  );
};

