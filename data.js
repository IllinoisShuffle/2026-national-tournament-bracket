// Simplified data: 4 quarters (16 teams each) = 64-team traditional bracket.
// Train-line theme on main bracket, bus-route theme on consolation.

const QUARTERS = [
  { id: 'red',    name: 'RED LINE',    color: '#D63A3A', busNum: '50',  busName: 'DAMEN',     side: 'L', pos: 'top' },
  { id: 'blue',   name: 'BLUE LINE',   color: '#1E7FB8', busNum: '49',  busName: 'WESTERN',   side: 'L', pos: 'bottom' },
  { id: 'green',  name: 'GREEN LINE',  color: '#2D8C4C', busNum: '72',  busName: 'NORTH',     side: 'R', pos: 'top' },
  { id: 'orange', name: 'ORANGE LINE', color: '#E7741A', busNum: '56',  busName: 'MILWAUKEE', side: 'R', pos: 'bottom' },
];

const TEAM_POOL = [
  'Lauren Smith / Mike Webster','John Jones / Carol Brady','Dave Kim / Nina Ortiz','Paul Reyes / Amy Chen',
  'Steve Novak / Jill Park','Tom Reilly / Rosa Diaz','Frank Lutz / Grace Kim','Eddie Cruz / Beth Adams',
  'Marcus Grant / Dana Wells','Chris Fox / Nora Lane','Greg Hahn / Ivy Chan','Sam Ortiz / Tara Byrne',
  'Nick Farley / Zoe Kane','Ray Solis / June Park','Walt Combs / Lena Ruiz','Ben Torres / Mia Sloan',
  'Karl Vance / Peggy Hu','Alan Reed / Sara Munoz','Doug Fenn / Wendy Ross','Leo Gantt / Robin Cole',
  'Jack Doyle / Ana Petrov','Owen Frey / Claire Voss','Hank Boyle / Vera Kessler','Cole Hartman / Faye Duncan',
  'Rick Alvarado / Nicole Park','Todd Renner / Pam Osei','Vince Marsh / Lucy Chan','Gary Poulin / Erin Vance',
  'Kurt Sander / Robin Ash','Neil Draper / Jo Whitfield','Alex Turnbull / Iris Coleman','Miles Chandler / Dawn Farris',
  'Otto Brennan / Sadie Voight','Curt Alden / Nadia Farr','Pete Cordova / Wren Gallo','Duke Ellison / Sasha Mott',
  'Blake Sorrento / Ivy Marsh','Cole Bannon / Reese Lund','Wade Pruitt / Elena Ford','Gus Radley / Tessa Norwood',
  'Milo Sharp / Colleen Byers','Ezra Vaughn / Willa Trask','Rex Dolan / Piper Woodson','Silas Crane / Jade Holloway',
  'Nate Purcell / Hazel Quinby','Roman Ashby / Fern Talbot','Lucas Merrick / Opal Winslow','Grant Bellamy / Ruth Castellan',
  'Wyatt Colton / Marigold Snow','Leon Marchetti / Bridget Kane','Case Whitlock / Delia Marsh','Rafe Osgood / June Callahan',
  'Booker Lyle / Vesper Hollis','Sawyer Finch / Odette Marsh','Judd Kellerman / Nell Abernathy','Emmett Blythe / Susan Whitmore',
  'Otis Hargrove / Adele Fontaine','Barrett Coyne / Ingrid Solberg','Rhett Callahan / Georgia Munro','Deacon Wexler / Camille Duquesne',
  'Sterling Voss / Meredith Aldrich','Holt Bannister / Rosalind Hays','Jasper Coldwell / Adelaide Finch','Truman Ashcroft / Beatrice Lowry',
];

const ROUND_NAMES = { R1: 'BOARDING', R2: 'TRANSFER', R3: 'EXPRESS', R4: 'TERMINUS', SF: 'INNER LOOP', F: 'THE LOOP' };

window.QUARTERS = QUARTERS;
window.TEAM_POOL = TEAM_POOL;
window.ROUND_NAMES = ROUND_NAMES;
