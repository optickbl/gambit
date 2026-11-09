// Endgame lessons. Every position was checked with Stockfish:
// mates are forced, wins are wins, and the defensive positions are draws with correct play.
// goal: mate | promote | win | draw. side = the colour you play. cp = how strict the win/loss check is.
export const ENDGAMES = [
  {
    id: 'kq', group: 'Basic checkmates', name: 'Queen checkmate', side: 'w', goal: 'mate',
    about: 'King and queen against a lone king is the first ending every player must win. The queen does the squeezing and your king helps finish.',
    steps: [
      'Put your queen a knight’s jump away from the enemy king. That boxes it in.',
      'Keep shrinking the box as the king steps back, until it is stuck on the edge.',
      'Never leave the king with no legal move unless it is in check. That is stalemate, a draw.',
      'Bring your king up, then mate with the queen beside the enemy king, protected by your king.'
    ],
    fens: ['8/8/8/3k4/8/8/8/KQ6 w - - 0 1', '8/8/4k3/8/8/8/8/3QK3 w - - 0 1', '8/8/8/8/8/2k5/8/4K2Q w - - 0 1']
  },
  {
    id: 'kr', group: 'Basic checkmates', name: 'Rook checkmate', side: 'w', goal: 'mate',
    about: 'King and rook also beat a lone king, but your king has to work much harder. It can take up to 16 moves.',
    steps: [
      'Use the rook to cut the enemy king off along a rank or file.',
      'Walk your king toward it. Aim to stand directly opposite the enemy king with one square between them.',
      'When the kings face each other, check with the rook to push the king back one row.',
      'When they don’t, make a waiting move with the rook along its row. Repeat until the king is mated on the edge.'
    ],
    fens: ['8/8/8/4k3/8/8/8/R3K3 w - - 0 1', '8/8/3k4/8/8/8/8/4K2R w - - 0 1']
  },
  {
    id: 'krr', group: 'Basic checkmates', name: 'Two rooks: the ladder', side: 'w', goal: 'mate',
    about: 'With two rooks you don’t even need your king. The rooks take turns giving check, like climbing a ladder.',
    steps: [
      'Put one rook on the row next to the king to cut it off.',
      'Check with the other rook on the row the king stands on, pushing it back.',
      'Keep alternating. Every check pushes the king back one row.',
      'If the king attacks a rook, move that rook far away along its row, then carry on.'
    ],
    fens: ['8/8/8/4k3/8/8/8/R3K2R w - - 0 1', '8/8/8/8/3k4/8/8/RR4K1 w - - 0 1']
  },
  {
    id: 'square', group: 'King and pawn', name: 'The square rule', side: 'w', goal: 'promote',
    about: 'Can the enemy king catch your pawn? Picture a square from the pawn to its promotion square. If the king can step into it, it catches the pawn. If not, the pawn queens.',
    steps: [
      'Count the squares from your pawn to the last rank. That is one side of the square.',
      'If the defending king can’t step into the square on its move, just push the pawn.',
      'A pawn on its starting square can move two, so count from the square in front of it.',
      'Don’t waste time with your king. Push and promote.'
    ],
    fens: ['8/8/8/1P6/8/5k2/8/7K w - - 0 1', '8/8/8/8/P7/8/5k2/K7 w - - 0 1']
  },
  {
    id: 'opp', group: 'King and pawn', name: 'Opposition: winning', side: 'w', goal: 'promote',
    about: 'With king and pawn against king, the kings fight for the squares in front of the pawn. Taking the opposition, facing the enemy king with one square between you when it is their move, forces it to give way.',
    steps: [
      'Lead with your king, not your pawn. Get your king in front of the pawn.',
      'Take the opposition: stand opposite the enemy king with one square between, with them to move.',
      'If you lose the opposition, a pawn move can give you the spare tempo to win it back.',
      'With the enemy king on the back rank, watch out for stalemate.'
    ],
    fens: ['4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', '4k3/8/3K4/4P3/8/8/8/8 w - - 0 1', '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1']
  },
  {
    id: 'defend', group: 'King and pawn', name: 'Opposition: holding the draw', side: 'b', goal: 'draw', target: 10,
    about: 'When you are the side without the pawn, you can often draw by standing in front of it and keeping the opposition. In each position here, only one move holds.',
    steps: [
      'Keep your king in front of the pawn.',
      'When the enemy king steps forward, step straight in front of it to take the opposition.',
      'When you are pushed back, retreat straight back, not to the side.',
      'Reach the back rank in front of the pawn and it is a draw.'
    ],
    fens: ['8/8/3k4/8/3PK3/8/8/8 b - - 0 1', '8/4k3/8/3PK3/8/8/8/8 b - - 0 1', '8/8/4k3/8/4PK2/8/8/8 b - - 0 1']
  },
  {
    id: 'lucena', group: 'Rook endings', name: 'Lucena: building a bridge', side: 'w', goal: 'win', cp: 200,
    about: 'The most important winning position in rook endings. Your king is in front of your pawn on the seventh rank and the enemy king is cut off. The winning plan is called building a bridge.',
    steps: [
      'Check the enemy king to push it one more file away.',
      'Put your rook on the fourth rank. That is the bridge.',
      'Bring your king out. When the enemy rook checks, walk toward your own rook.',
      'Block the last check with your rook. Then the pawn promotes.'
    ],
    fens: ['1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', '3K4/3P2k1/8/8/8/8/2r5/4R3 w - - 0 1']
  },
  {
    id: 'philidor', group: 'Rook endings', name: 'Philidor: the safe draw', side: 'b', goal: 'draw', target: 12, cp: 250,
    about: 'The most important drawing position in rook endings. Keep the enemy king out with your rook on your third rank, then check from behind once the pawn advances.',
    steps: [
      'Keep your king on the square in front of the pawn.',
      'Put your rook on your third rank (the sixth rank) so the enemy king can’t come forward.',
      'When the pawn steps onto that rank, drop your rook all the way to the first rank.',
      'Then check the king from behind. It has nowhere to hide.'
    ],
    fens: ['4k3/7R/8/4PK2/8/8/8/1r6 b - - 0 1', '3k4/R7/8/3PK3/8/8/8/7r b - - 0 1']
  }
];
