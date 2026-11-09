// Gambit — opening library.
// Every line is played from the starting position.
// Text in {braces} right after a move is the explanation shown for that move.
// side = the colour you learn the opening for. start = plies that define the opening.

export const OPENINGS = [
{
  id: 'italian', name: 'Italian Game', side: 'w', start: 5,
  players: 'Carlsen, Caruana, Giri',
  about: "White develops fast and points the bishop at f7 — the weakest square near Black's king. Today's GMs play it slowly with c3 and d3, then expand.",
  ideas: [
    'The c4 bishop eyes f7, Black\'s weak spot.',
    'Build with c3 + d3, castle, then Re1 and Nbd2–f1–g3.',
    'Push d4 only once you are fully developed.'
  ],
  lines: [
    { name: 'Main line: Giuoco Pianissimo', pgn: `1.e4 {Grab the centre and open lines for your queen and bishop.} e5 2.Nf3 {Develop with a threat: the knight attacks e5.} Nc6 {Black defends e5.} 3.Bc4 {The Italian! The bishop aims at f7, the weakest square near Black's king.} Bc5 {Black copies you — the Giuoco Piano ("quiet game").} 4.c3 {Prepares d4 later and gives your bishop a safe retreat on b3 or c2.} Nf6 {Attacks your e4 pawn.} 5.d3 {Just protect e4. Slow and solid — exactly how GMs play it today.} d6 6.O-O {King safety first.} O-O 7.Re1 {The rook backs up e4 and prepares d4.} a6 {Makes a safe home for the bishop on a7.} 8.a4 {Grab space on the queenside so ...b5 is harder.} Ba7 9.h3 {Stops ...Bg4 pinning your knight to the queen.} h6 10.Nbd2 {Plan: Nf1–g3, then push d4 or attack on the kingside.}` },
    { name: 'Two Knights: 3...Nf6', pgn: `1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 {Two Knights Defence: Black attacks e4 straight away.} 4.d3 {Simply protect e4. Calm, strong and what top GMs play. (After 4...Bc5, play 5.c3 and you are back in the main line.)} Be7 5.O-O O-O 6.Re1 {The rook supports e4.} d6 7.c3 {Same plan as always: c3, h3, Nbd2–f1–g3, then d4.} a6 8.a4 h6 9.h3 {Next Nbd2 — your set-up is complete.}` },
    { name: 'Trap: 3...Nd4?! — don\'t take e5', pgn: `1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 {A sneaky trap. Black leaves e5 hanging on purpose.} 4.Nxd4 {Take the knight! If 4.Nxe5?? Qg5! hits your knight and g2 — and after 5.Nxf7?? Qxg2 6.Rf1 Qxe4+ 7.Be2 Nf3 it's checkmate.} exd4 5.O-O {Castle — you are well ahead in development.} d6 6.c3 {Open the centre while Black's pieces are still at home.} dxc3 7.Nxc3 {Big lead in development: next d4, then Bg5 or Qb3 hitting f7.}` },
    { name: 'If Black plays 2...Nf6 (Petrov)', pgn: `1.e4 e5 2.Nf3 Nf6 {Petrov Defence: Black counter-attacks e4 instead of defending e5.} 3.Nxe5 {Take first!} d6 {Correct: kick your knight before grabbing e4.} 4.Nf3 Nxe4 5.d4 {Take the centre; Black's knight on e4 will soon be kicked.} d5 6.Bd3 {Develop and attack the knight.} Nc6 7.O-O Be7 8.c4 {Hit d5, the pawn that holds the e4 knight.}` },
    { name: 'Petrov trap: 3...Nxe4? 4.Qe2!', pgn: `1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4 {A very common mistake: copying you.} 4.Qe2 {Pin! The knight on e4 is stuck in front of the king. (Black's best is 4...Qe7, but you still win a pawn.)} Nf6 {Natural — and it loses the queen.} 5.Nc6+ {Discovered check! Your queen checks the king while the knight attacks the queen on d8.} Be7 6.Nxd8 {You win the queen.}` },
    { name: 'If Black plays 2...d6 (Philidor)', pgn: `1.e4 e5 2.Nf3 d6 {Philidor Defence: solid but passive.} 3.d4 {Passive play means you take the centre.} exd4 {Black gives up the centre.} 4.Nxd4 {Recapture with a strong central knight.} Nf6 5.Nc3 Be7 6.Be2 O-O 7.O-O {Easy development and more space for you.}` },
    { name: 'Philidor trap: 3...Bg4?!', pgn: `1.e4 e5 2.Nf3 d6 3.d4 Bg4 {Pins your knight — but here it's a mistake.} 4.dxe5 {Now e5 falls. (If 4...dxe5 5.Qxd8+ Kxd8 6.Nxe5 wins a pawn.)} Bxf3 5.Qxf3 dxe5 6.Bc4 {Threat: Qxf7 checkmate!} Nf6 7.Qb3 {Double attack on f7 and b7.} Qe7 8.Qxb7 {You win a pawn and threaten Qxa8.}` }
  ]
},
{
  id: 'ruy', name: 'Ruy Lopez', side: 'w', start: 5,
  players: 'Kasparov, Carlsen, Caruana',
  about: "The 'Spanish' — one of the oldest and most respected openings. The bishop pressures the knight that defends e5 and builds slow, long-lasting pressure.",
  ideas: [
    'Bb5 hits c6, the knight that defends e5.',
    'Castle fast, Re1, then c3 + d4 to own the centre.',
    'The bishop usually drops back to a4 and b3, aiming at f7.'
  ],
  lines: [
    { name: 'Main line: Closed Ruy Lopez', pgn: `1.e4 e5 2.Nf3 Nc6 3.Bb5 {The Ruy Lopez: attack the knight that defends e5.} a6 {Morphy Defence: Black asks your bishop what it wants.} 4.Ba4 {Keep the pressure — don't trade yet.} Nf6 5.O-O {Castle! e4 looks loose, but grabbing it opens lines against Black's own king.} Be7 6.Re1 {Now e4 is properly protected.} b5 {Kick the bishop.} 7.Bb3 {From b3 the bishop aims at f7.} d6 8.c3 {Prepares d4 and keeps a retreat on c2 for the bishop.} O-O 9.h3 {Stops ...Bg4, so your d4 push will be stable.} Na5 {Black chases the bishop.} 10.Bc2 c5 11.d4 {Your big centre is complete. Next: Nbd2–f1–g3.}` },
    { name: 'Berlin: 3...Nf6', pgn: `1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 {The Berlin Wall — Kramnik used it to beat Kasparov for the world title.} 4.d3 {Avoid the famous Berlin endgame: just protect e4.} Bc5 5.c3 {Prepares d4 and gives the bishop a retreat.} O-O 6.O-O d6 7.h3 {No ...Bg4 pins.} a6 8.Ba4 {Keep the bishop — it will drop back to c2 later.}` },
    { name: 'Open Ruy: 5...Nxe4', pgn: `1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 {Black grabs your e4 pawn.} 6.d4 {Hit back in the centre — you will regain the pawn.} b5 7.Bb3 d5 8.dxe5 {Material is level and your e5 pawn is a thorn.} Be6 9.c3 {Gives the bishop a retreat on c2. Next Nbd2 to challenge the e4 knight.}` }
  ]
},
{
  id: 'qg', name: "Queen's Gambit", side: 'w', start: 3,
  players: 'Nearly every world champion — Capablanca, Karpov, Kasparov, Carlsen',
  about: "White offers the c-pawn to pull Black's d-pawn away from the centre. It's not a real gambit — you can always win the pawn back.",
  ideas: [
    'c4 attacks d5 so you can control e4 and the centre.',
    'If Black takes on c4, play e3 and Bxc4 to win it back.',
    'In the Exchange structure, push b4–b5: the minority attack.'
  ],
  lines: [
    { name: 'QGD: Exchange variation', pgn: `1.d4 {Take the centre with the queen's pawn.} d5 2.c4 {The Queen's Gambit: challenge Black's d5 pawn.} e6 {Queen's Gambit Declined: rock solid.} 3.Nc3 Nf6 4.cxd5 {Exchange variation — it gives you a clear plan.} exd5 5.Bg5 {Pin the knight to the queen.} c6 6.e3 Be7 7.Bd3 Nbd7 8.Qc2 {Stops ...Bf5 and lines up on h7.} O-O 9.Nf3 Re8 10.O-O Nf8 11.Rab1 {Plan: b4 and b5 to give Black a weak pawn on c6 — the famous minority attack.}` },
    { name: 'QGA: 2...dxc4', pgn: `1.d4 d5 2.c4 dxc4 {Queen's Gambit Accepted: Black takes the pawn.} 3.e3 {Opens your bishop's path to c4.} Nf6 4.Bxc4 {Pawn back — and your bishop is developed.} e6 5.Nf3 c5 6.O-O a6 7.a4 {Stops ...b5 and keeps Black's queenside quiet.}` },
    { name: 'QGA trap: 3...b5?', pgn: `1.d4 d5 2.c4 dxc4 3.e3 b5 {Trying to keep the extra pawn — a common mistake.} 4.a4 {Undermine the b5 pawn.} c6 5.axb5 cxb5 6.Qf3 {Fork down the long diagonal: the rook on a8 is attacked and Black loses material.}` },
    { name: 'Slav: 2...c6', pgn: `1.d4 d5 2.c4 c6 {The Slav: defends d5 and keeps the light bishop free.} 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 {Stops ...b5, so you will win c4 back.} Bf5 6.e3 e6 7.Bxc4 Bb4 8.O-O O-O 9.Qe2 {Plan: e4 to take the whole centre.}` },
    { name: 'Albin Countergambit: 2...e5', pgn: `1.d4 d5 2.c4 e5 {Albin Countergambit — a popular trap at club level.} 3.dxe5 d4 {This pawn cramps you.} 4.Nf3 {Develop. Never 4.e3?? Bb4+ 5.Bd2 dxe3! 6.Bxb4?? exf2+ 7.Ke2 fxg1=N+! — the Lasker trap.} Nc6 5.g3 {Fianchetto: the bishop will hit Black's queenside.} Be6 6.Nbd2 Qd7 7.Bg2 {You are a pawn up — castle and keep it simple.}` }
  ]
},
{
  id: 'london', name: 'London System', side: 'w', start: 3,
  players: 'Carlsen, Kamsky',
  about: 'A system, not a race: you set up the same strong structure almost every game — d4, Bf4, e3, c3, Nf3, Bd3, Nbd2. Easy to learn, hard to beat.',
  ideas: [
    'Get the bishop to f4 BEFORE you play e3.',
    'Build the pyramid c3–d4–e3, then Bd3, Nbd2 and castle.',
    'If Black offers ...Bd6, drop back to g3 and keep your bishop.'
  ],
  lines: [
    { name: 'Main line vs ...d5', pgn: `1.d4 d5 2.Bf4 {The London bishop — get it out before e3 locks it in.} Nf6 3.e3 e6 4.Nf3 c5 5.c3 {Your pyramid: c3–d4–e3. Rock solid.} Nc6 6.Nbd2 Bd6 {Black wants to trade off your best bishop.} 7.Bg3 {Keep it! If ...Bxg3, recapture hxg3 and your rook uses the open h-file.} O-O 8.Bd3 {Next: castle, then Ne5 or e4.}` },
    { name: 'Early ...c5 and ...Qb6', pgn: `1.d4 d5 2.Bf4 c5 {Black hits d4 early.} 3.e3 Nc6 4.c3 {Support d4.} Qb6 {Attacks b2 — the London's weak spot.} 5.Qb3 {Defend and offer a queen trade.} c4 {Kicks your queen.} 6.Qc2 {Safe square. Next Nf3, Nbd2 and e4 to hit Black's centre.}` },
    { name: "Vs King's Indian set-up (...g6)", pgn: `1.d4 Nf6 2.Bf4 g6 {Black fianchettoes.} 3.e3 Bg7 4.Nf3 O-O 5.Be2 {Modest but smart: it covers g4 and h5, so no ...Nh5 or ...Ng4 tricks.} d6 6.h3 {Gives your bishop a retreat on h2.} Nbd7 7.O-O {Then c4 or c3 — solid and safe.}` }
  ]
},
{
  id: 'sicilian', name: 'Sicilian Defence', side: 'b', start: 2,
  players: 'Fischer, Kasparov, Vachier-Lagrave',
  about: "Black's most popular and aggressive answer to 1.e4. You swap your c-pawn for White's d-pawn and play for a win from move one. The Najdorf (5...a6) is the GM favourite.",
  ideas: [
    '...c5 fights for d4 without copying White.',
    'After d4 cxd4 you get an extra centre pawn and the half-open c-file.',
    '...a6 (Najdorf) stops Nb5 and Bb5 and prepares ...e5 or ...b5.'
  ],
  lines: [
    { name: 'Najdorf: English Attack (6.Be3)', pgn: `1.e4 c5 {The Sicilian: fight for d4 from the side.} 2.Nf3 d6 3.d4 cxd4 {Trade a side pawn for a centre pawn — a good deal.} 4.Nxd4 Nf6 {Attack e4 to force Nc3.} 5.Nc3 a6 {The Najdorf! Flexible, and it stops Nb5.} 6.Be3 e5 {Kick the knight and grab space.} 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O 10.O-O-O Nbd7 {Kings on opposite sides: it's a race. You attack with ...b5–b4.} 11.g4 b5` },
    { name: 'Najdorf: 6.Bg5', pgn: `1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 {Pins your knight.} e6 {Solid: covers d5 and prepares ...Be7.} 7.f4 Be7 8.Qf3 Qc7 9.O-O-O Nbd7 {Develop, then counter-attack with ...b5.}` },
    { name: 'Najdorf: 6.Be2', pgn: `1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2 {Quiet and classical.} e5 7.Nb3 Be7 8.O-O O-O 9.Be3 Be6 {Classic Najdorf set-up: next ...Nbd7, ...Rc8 and ...b5.}` },
    { name: 'Alapin: 2.c3', pgn: `1.e4 c5 2.c3 {Alapin: White wants to play d4 with a pawn.} d5 {Hit e4 straight away.} 3.exd5 Qxd5 {Your queen is safe here — White can't play Nc3 with a pawn on c3.} 4.d4 Nf6 5.Nf3 Bg4 {Pin the knight and pressure d4.} 6.Be2 e6 7.O-O Nc6 {Comfortable and equal.}` },
    { name: 'Closed Sicilian: 2.Nc3', pgn: `1.e4 c5 2.Nc3 {Closed Sicilian — slow and sneaky.} Nc6 3.g3 g6 {Copy the fianchetto.} 4.Bg2 Bg7 5.d3 d6 6.f4 e6 7.Nf3 Nge7 8.O-O O-O {Then ...Rb8 and ...b5: attack on the queenside.}` },
    { name: 'Grand Prix Attack: 3.f4', pgn: `1.e4 c5 2.Nc3 Nc6 3.f4 {Grand Prix Attack — very popular at club level.} g6 4.Nf3 Bg7 5.Bc4 e6 {Blunt the bishop's aim at f7.} 6.O-O Nge7 7.d3 O-O {Next ...d5 to break open the centre.}` },
    { name: 'Moscow: 3.Bb5+', pgn: `1.e4 c5 2.Nf3 d6 3.Bb5+ {Check! White avoids the big main lines.} Bd7 {Offer to trade bishops.} 4.Bxd7+ Qxd7 5.c4 {The Maroczy bind: a grip on d5.} Nc6 6.Nc3 g6 7.d4 cxd4 8.Nxd4 Bg7 {Your bishop pressures the long diagonal.}` },
    { name: 'Smith-Morra Gambit: 2.d4', pgn: `1.e4 c5 2.d4 cxd4 3.c3 {Smith-Morra Gambit: White gives a pawn for fast development.} dxc3 {Take it.} 4.Nxc3 Nc6 5.Nf3 d6 6.Bc4 e6 {Close the bishop's path to f7.} 7.O-O Nf6 8.Qe2 Be7 9.Rd1 e5 {Block the d-file. You keep the extra pawn safely.}` }
  ]
},
{
  id: 'caro', name: 'Caro-Kann', side: 'b', start: 4,
  players: 'Karpov, Anand, Carlsen',
  about: 'A rock-solid answer to 1.e4. You support ...d5 with ...c6, so your centre never collapses — and your light bishop gets out before ...e6.',
  ideas: [
    '...c6 then ...d5: a solid centre.',
    'Get the light bishop to f5 or g4 BEFORE you play ...e6.',
    'Safe, healthy positions — great for winning endgames.'
  ],
  lines: [
    { name: 'Classical: 3.Nc3', pgn: `1.e4 c6 {Prepares ...d5.} 2.d4 d5 {Challenge e4.} 3.Nc3 dxe4 4.Nxe4 Bf5 {Develop the bishop with a hit on the knight.} 5.Ng3 Bg6 6.h4 h6 {Keep a retreat square for your bishop.} 7.Nf3 Nd7 {Stops Ne5 from chasing your bishop.} 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3 e6 11.Bd2 Ngf6 12.O-O-O Be7 {Very solid. Castle, then strike with ...c5.}` },
    { name: 'Advance: 3.e5', pgn: `1.e4 c6 2.d4 d5 3.e5 {Advance: White grabs space.} Bf5 {Get the bishop out before ...e6!} 4.Nf3 e6 5.Be2 c5 {Hit the base of White's pawn chain.} 6.O-O Nc6 7.c3 cxd4 8.cxd4 Nge7 {Plan: ...Nc8, ...Be7 and ...Qb6 — pile up on d4.}` },
    { name: 'Exchange: 3.exd5', pgn: `1.e4 c6 2.d4 d5 3.exd5 cxd5 {Symmetrical centre.} 4.Bd3 Nc6 5.c3 Nf6 6.Bf4 Bg4 {Develop the bishop actively before ...e6.} 7.Qb3 Qd7 {Defend b7 — a queen trade is fine for you.} 8.Nd2 e6 {Solid. Next ...Bd6 and castle.}` },
    { name: 'Panov Attack: 4.c4', pgn: `1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4 {Panov Attack: White will get an isolated d-pawn.} Nf6 5.Nc3 e6 6.Nf3 Be7 7.cxd5 Nxd5 8.Bd3 Nc6 9.O-O O-O {Later, blockade and attack the lonely d4 pawn.}` },
    { name: 'Two Knights: 2.Nc3', pgn: `1.e4 c6 2.Nc3 d5 3.Nf3 Bg4 {Pin, and happily trade your bishop for the knight.} 4.h3 Bxf3 5.Qxf3 e6 6.d4 Nf6 {Next ...Nbd7 and ...Be7. Solid and equal.}` }
  ]
},
{
  id: 'french', name: 'French Defence', side: 'b', start: 4,
  players: 'Botvinnik, Korchnoi',
  about: "Black builds a solid pawn chain (e6–d5) and counter-attacks White's centre with ...c5 and ...f6. The light bishop is your problem piece — be patient with it.",
  ideas: [
    '...e6 + ...d5 attacks e4.',
    'If White pushes e5, hit the base of the chain with ...c5 (later ...f6).',
    'Pile up on d4 with ...Nc6, ...Qb6 and ...Nf5.'
  ],
  lines: [
    { name: 'Advance: 3.e5', pgn: `1.e4 e6 2.d4 d5 {Attack e4.} 3.e5 {Advance: White grabs space.} c5 {Hit d4, the base of White's pawn chain.} 4.c3 Nc6 5.Nf3 Qb6 {Pile up on d4 and eye b2.} 6.Be2 cxd4 7.cxd4 Nh6 {Heading for f5 to hit d4 again.} 8.Nc3 Nf5 {Three pieces now hit d4.}` },
    { name: 'Advance: 6.Bd3 — careful!', pgn: `1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.Bd3 {White offers d4 as bait (the Milner-Barry Gambit).} cxd4 7.cxd4 Bd7 {Careful! 7...Nxd4?? 8.Nxd4 Qxd4?? 9.Bb5+ wins your queen with a discovered attack.} 8.O-O Nxd4 {Now it's safe to take.} 9.Nxd4 Qxd4 10.Nc3 a6 {You are a pawn up. Keep Nb5 out, then ...Ne7 and develop.}` },
    { name: 'Tarrasch: 3.Nd2', pgn: `1.e4 e6 2.d4 d5 3.Nd2 c5 {Hit the centre at once.} 4.exd5 Qxd5 {Your queen is safe: no Nc3 possible.} 5.Ngf3 cxd4 6.Bc4 Qd6 7.O-O Nf6 8.Nb3 Nc6 9.Nbxd4 Nxd4 10.Nxd4 a6 {Equal and solid. Next ...Qc7 and ...Bd6.}` },
    { name: 'Classical: 3.Nc3 Nf6 4.e5', pgn: `1.e4 e6 2.d4 d5 3.Nc3 Nf6 {Classical French: develop and hit e4.} 4.e5 Nfd7 5.f4 c5 {Always hit the base of the chain.} 6.Nf3 Nc6 7.Be3 cxd4 8.Nxd4 Bc5 9.Qd2 O-O 10.O-O-O a6 {Opposite castling: race with ...b5–b4 and ...Qa5.}` },
    { name: 'Classical: 4.Bg5', pgn: `1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 {Pins your knight.} Be7 {Unpin calmly.} 5.e5 Nfd7 6.Bxe7 Qxe7 7.f4 O-O 8.Nf3 c5 {The French counter-punch: strike d4.}` },
    { name: 'Exchange: 3.exd5', pgn: `1.e4 e6 2.d4 d5 3.exd5 exd5 {Symmetrical and very safe — your light bishop is free now!} 4.Nf3 Nf6 5.Bd3 Bd6 6.O-O O-O 7.Bg5 Bg4 {Copying is fine here; just watch out for pins.} 8.Nbd2 Nbd7` }
  ]
},
{
  id: 'kid', name: "King's Indian Defence", side: 'b', start: 8,
  players: 'Fischer, Kasparov, Nakamura',
  about: "A fighting defence: let White build a big centre, then hit it with ...e5 and attack the king. Kasparov's and Fischer's favourite weapon.",
  ideas: [
    'Fianchetto the bishop on g7 and castle fast.',
    'Strike the centre with ...e5.',
    'When the centre locks (d5), storm the kingside: ...f5, ...f4, ...g5.'
  ],
  lines: [
    { name: 'Classical: Mar del Plata', pgn: `1.d4 Nf6 2.c4 g6 {Prepare the fianchetto.} 3.Nc3 Bg7 4.e4 d6 {Let White take the centre — you will hit it later.} 5.Nf3 O-O 6.Be2 e5 {The key strike in the centre.} 7.O-O Nc6 {More pressure on d4.} 8.d5 Ne7 {The centre is locked. Now go for the king!} 9.Ne1 Nd7 {Clear the way for the f-pawn.} 10.Be3 f5 11.f3 f4 12.Bf2 g5 {The famous King's Indian pawn storm.}` },
    { name: 'Exchange: 7.dxe5', pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.dxe5 {White swaps queens to kill your attack.} dxe5 8.Qxd8 Rxd8 9.Bg5 Re8 {Keep the rook guarding e5 and f7.} 10.Nd5 Nxd5 11.cxd5 c6 {Break up White's d5 pawn. The endgame is equal.}` },
    { name: 'Fianchetto: g3', pgn: `1.d4 Nf6 2.c4 g6 3.Nf3 Bg7 4.g3 O-O 5.Bg2 d6 6.O-O Nbd7 7.Nc3 e5 {Same strike in the centre.} 8.e4 c6 9.h3 Qb6 {Pressure on d4 and b2.}` },
    { name: 'Sämisch: 5.f3', pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 {Sämisch: White builds a wall and may attack your king.} O-O 6.Be3 Nc6 7.Nge2 a6 8.Qd2 Rb8 {Plan: ...b5 to open the queenside, where White's king may go.}` },
    { name: 'Vs the London (Bf4)', pgn: `1.d4 Nf6 2.Nf3 g6 3.Bf4 Bg7 4.e3 d6 {Prepare ...e5, hitting the London bishop.} 5.h3 O-O 6.Be2 Nbd7 7.O-O Qe8 {Supports ...e5.} 8.Bh2 e5 {Your King's Indian strike works here too.}` }
  ]
}
];
