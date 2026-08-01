// Simplified data: 4 quarters (16 teams each) = 64-team traditional bracket.
// Train-line theme on main bracket, bus-route theme on consolation.

const QUARTERS = [
  { id: 'red',    name: 'RED LINE',    color: '#D63A3A', busNum: '50',  busName: 'DAMEN',     side: 'L', pos: 'top' },
  { id: 'blue',   name: 'BLUE LINE',   color: '#1E7FB8', busNum: '49',  busName: 'WESTERN',   side: 'L', pos: 'bottom' },
  { id: 'green',  name: 'GREEN LINE',  color: '#2D8C4C', busNum: '72',  busName: 'NORTH',     side: 'R', pos: 'top' },
  { id: 'orange', name: 'ORANGE LINE', color: '#E7741A', busNum: '56',  busName: 'MILWAUKEE', side: 'R', pos: 'bottom' },
];

const TEAM_POOL = [
  'Smith / Webster','Jones / Brady','Kim / Nina Ortiz','Reyes / Chen',
  'Novak / Park','Reilly / Diaz','Lutz / Kim','Cruz / Adams',
  'Grant / Wells','Fox / Lane','Hahn / Chan','Ortiz / Byrne',
  'Farley / Kane','Solis / Park','Combs / Ruiz','Torres / Sloan',
  'Vance / Hu','Reed / Munoz','Fenn / Ross','Gantt / Cole',
  'Doyle / Petrov','Frey / Voss','Boyle / Kessler','Hartman / Duncan',
  'Alvarado / Park','Renner / Osei','Marsh / Chan','Poulin / Vance',
  'Sander / Ash','Draper / Whitfield','Turnbull / Coleman','Chandler / Farris',
  'Brennan / Voight','Alden / Farr','Cordova / Gallo','Ellison / Mott',
  'Sorrento / Marsh','Bannon / Lund','Pruitt / Ford','Radley / Norwood',
  'Sharp / Byers','Vaughn / Trask','Dolan / Woodson','Crane / Holloway',
  'Purcell / Quinby','Ashby / Talbot','Merrick / Winslow','Bellamy / Castellan',
  'Colton / Snow','Marchetti / Kane','Whitlock / Marsh','Osgood / Callahan',
  'Lyle / Hollis','Finch / Marsh','Kellerman / Abernathy','Blythe / Whitmore',
  'Hargrove / Fontaine','Coyne / Solberg','Callahan / Munro','Wexler / Duquesne',
  'Voss / Aldrich','Bannister / Hays','Coldwell / Finch','Ashcroft / Lowry',
];

const ROUND_NAMES = { R1: 'BOARDING', R2: 'TRANSFER', R3: 'EXPRESS', R4: 'TERMINUS', SF: 'INNER LOOP', F: 'THE LOOP' };

window.QUARTERS = QUARTERS;
window.TEAM_POOL = TEAM_POOL;
window.ROUND_NAMES = ROUND_NAMES;
