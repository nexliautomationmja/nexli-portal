import { NextRequest, NextResponse } from "next/server";

/**
 * ABA routing number → bank name lookup.
 *
 * Uses a comprehensive map of major US bank routing number ranges.
 * The first 4 digits of a routing number identify the Federal Reserve
 * district + office, and the remaining digits identify the institution.
 * We map known prefixes & exact numbers to bank names.
 */

// Exact routing numbers for major banks
const ROUTING_MAP: Record<string, { name: string; city?: string; state?: string }> = {
  // JPMorgan Chase
  "021000021": { name: "JPMorgan Chase", city: "New York", state: "NY" },
  "021202337": { name: "JPMorgan Chase", city: "New York", state: "NY" },
  "022300173": { name: "JPMorgan Chase", city: "New York", state: "NY" },
  "044000037": { name: "JPMorgan Chase", city: "Columbus", state: "OH" },
  "065400137": { name: "JPMorgan Chase", city: "Tampa", state: "FL" },
  "083000137": { name: "JPMorgan Chase", city: "Louisville", state: "KY" },
  "071000013": { name: "JPMorgan Chase", city: "Chicago", state: "IL" },
  "072000326": { name: "JPMorgan Chase", city: "Detroit", state: "MI" },
  "082000549": { name: "JPMorgan Chase", city: "St. Louis", state: "MO" },
  "101000019": { name: "JPMorgan Chase", city: "Kansas City", state: "MO" },
  "102001017": { name: "JPMorgan Chase", city: "Denver", state: "CO" },
  "111000614": { name: "JPMorgan Chase", city: "Dallas", state: "TX" },
  "112000661": { name: "JPMorgan Chase", city: "Houston", state: "TX" },
  "113000609": { name: "JPMorgan Chase", city: "San Antonio", state: "TX" },
  "121000248": { name: "JPMorgan Chase", city: "San Francisco", state: "CA" },
  "122100024": { name: "JPMorgan Chase", city: "Los Angeles", state: "CA" },
  "267084131": { name: "JPMorgan Chase", city: "Tampa", state: "FL" },
  "322271627": { name: "JPMorgan Chase", city: "Los Angeles", state: "CA" },
  // Bank of America
  "011000138": { name: "Bank of America", city: "Boston", state: "MA" },
  "011200365": { name: "Bank of America", city: "Hartford", state: "CT" },
  "011400495": { name: "Bank of America", city: "Providence", state: "RI" },
  "011500010": { name: "Bank of America", city: "Burlington", state: "VT" },
  "021000322": { name: "Bank of America", city: "New York", state: "NY" },
  "021200339": { name: "Bank of America", city: "New York", state: "NY" },
  "026009593": { name: "Bank of America", city: "Virginia Beach", state: "VA" },
  "051000017": { name: "Bank of America", city: "Richmond", state: "VA" },
  "051004004": { name: "Bank of America", city: "Washington", state: "DC" },
  "053000196": { name: "Bank of America", city: "Charlotte", state: "NC" },
  "053904483": { name: "Bank of America", city: "Charlotte", state: "NC" },
  "054001204": { name: "Bank of America", city: "Baltimore", state: "MD" },
  "063000047": { name: "Bank of America", city: "Jacksonville", state: "FL" },
  "063100277": { name: "Bank of America", city: "Jacksonville", state: "FL" },
  "071000505": { name: "Bank of America", city: "Chicago", state: "IL" },
  "081000032": { name: "Bank of America", city: "St. Louis", state: "MO" },
  "081904808": { name: "Bank of America", city: "Kansas City", state: "MO" },
  "101100045": { name: "Bank of America", city: "Kansas City", state: "KS" },
  "102003206": { name: "Bank of America", city: "Denver", state: "CO" },
  "102001388": { name: "Bank of America", city: "Albuquerque", state: "NM" },
  "107000327": { name: "Bank of America", city: "Oklahoma City", state: "OK" },
  "111000025": { name: "Bank of America", city: "Dallas", state: "TX" },
  "113000023": { name: "Bank of America", city: "Houston", state: "TX" },
  "121000358": { name: "Bank of America", city: "San Francisco", state: "CA" },
  "122000661": { name: "Bank of America", city: "Los Angeles", state: "CA" },
  "122400724": { name: "Bank of America", city: "Phoenix", state: "AZ" },
  "123000220": { name: "Bank of America", city: "Portland", state: "OR" },
  "125000024": { name: "Bank of America", city: "Seattle", state: "WA" },
  // Wells Fargo
  "011100106": { name: "Wells Fargo", city: "Hartford", state: "CT" },
  "021101108": { name: "Wells Fargo", city: "New York", state: "NY" },
  "031000503": { name: "Wells Fargo", city: "Philadelphia", state: "PA" },
  "041215032": { name: "Wells Fargo", city: "Cincinnati", state: "OH" },
  "051400549": { name: "Wells Fargo", city: "Winston-Salem", state: "NC" },
  "053000219": { name: "Wells Fargo", city: "Charlotte", state: "NC" },
  "053207766": { name: "Wells Fargo", city: "Columbia", state: "SC" },
  "054001220": { name: "Wells Fargo", city: "Baltimore", state: "MD" },
  "062000080": { name: "Wells Fargo", city: "Birmingham", state: "AL" },
  "063107513": { name: "Wells Fargo", city: "Jacksonville", state: "FL" },
  "064003768": { name: "Wells Fargo", city: "Nashville", state: "TN" },
  "071101307": { name: "Wells Fargo", city: "Chicago", state: "IL" },
  "072000010": { name: "Wells Fargo", city: "Minneapolis", state: "MN" },
  "073000228": { name: "Wells Fargo", city: "Des Moines", state: "IA" },
  "081002387": { name: "Wells Fargo", city: "St. Louis", state: "MO" },
  "091000019": { name: "Wells Fargo", city: "Minneapolis", state: "MN" },
  "091300010": { name: "Wells Fargo", city: "Sioux Falls", state: "SD" },
  "091400046": { name: "Wells Fargo", city: "Billings", state: "MT" },
  "092905278": { name: "Wells Fargo", city: "Rapid City", state: "SD" },
  "101089292": { name: "Wells Fargo", city: "Wichita", state: "KS" },
  "102000076": { name: "Wells Fargo", city: "Denver", state: "CO" },
  "102100918": { name: "Wells Fargo", city: "Salt Lake City", state: "UT" },
  "107002192": { name: "Wells Fargo", city: "Tulsa", state: "OK" },
  "111900659": { name: "Wells Fargo", city: "El Paso", state: "TX" },
  "112000066": { name: "Wells Fargo", city: "Houston", state: "TX" },
  "121042882": { name: "Wells Fargo", city: "San Francisco", state: "CA" },
  "122000247": { name: "Wells Fargo", city: "Los Angeles", state: "CA" },
  "122105278": { name: "Wells Fargo", city: "Scottsdale", state: "AZ" },
  "123006800": { name: "Wells Fargo", city: "Portland", state: "OR" },
  "124002971": { name: "Wells Fargo", city: "Boise", state: "ID" },
  // Citibank
  "021000089": { name: "Citibank", city: "New York", state: "NY" },
  "021001486": { name: "Citibank", city: "New York", state: "NY" },
  "021272655": { name: "Citibank", city: "New York", state: "NY" },
  "031100209": { name: "Citibank", city: "Philadelphia", state: "PA" },
  "052002166": { name: "Citibank", city: "Baltimore", state: "MD" },
  "066004367": { name: "Citibank", city: "Miami", state: "FL" },
  "067004764": { name: "Citibank", city: "Tampa", state: "FL" },
  "113193532": { name: "Citibank", city: "San Antonio", state: "TX" },
  "271070801": { name: "Citibank", city: "Chicago", state: "IL" },
  "321171184": { name: "Citibank", city: "San Francisco", state: "CA" },
  "322271724": { name: "Citibank", city: "Los Angeles", state: "CA" },
  // US Bank
  "042000013": { name: "US Bank", city: "Cincinnati", state: "OH" },
  "064000059": { name: "US Bank", city: "Nashville", state: "TN" },
  "073000545": { name: "US Bank", city: "Des Moines", state: "IA" },
  "081000210": { name: "US Bank", city: "St. Louis", state: "MO" },
  "091000022": { name: "US Bank", city: "Minneapolis", state: "MN" },
  "091300023": { name: "US Bank", city: "Fargo", state: "ND" },
  "091904164": { name: "US Bank", city: "Milwaukee", state: "WI" },
  "101200453": { name: "US Bank", city: "Omaha", state: "NE" },
  "102000175": { name: "US Bank", city: "Denver", state: "CO" },
  "102101645": { name: "US Bank", city: "Salt Lake City", state: "UT" },
  "111916857": { name: "US Bank", city: "Dallas", state: "TX" },
  "122235821": { name: "US Bank", city: "San Diego", state: "CA" },
  "123000848": { name: "US Bank", city: "Portland", state: "OR" },
  "125000105": { name: "US Bank", city: "Seattle", state: "WA" },
  // PNC Bank
  "031100089": { name: "PNC Bank", city: "Philadelphia", state: "PA" },
  "041000124": { name: "PNC Bank", city: "Cleveland", state: "OH" },
  "042000398": { name: "PNC Bank", city: "Cincinnati", state: "OH" },
  "043000096": { name: "PNC Bank", city: "Pittsburgh", state: "PA" },
  "051000010": { name: "PNC Bank", city: "Washington", state: "DC" },
  "054000030": { name: "PNC Bank", city: "Baltimore", state: "MD" },
  "071921891": { name: "PNC Bank", city: "Chicago", state: "IL" },
  "083000108": { name: "PNC Bank", city: "Louisville", state: "KY" },
  // TD Bank
  "011103093": { name: "TD Bank", city: "Lewiston", state: "ME" },
  "011400071": { name: "TD Bank", city: "Providence", state: "RI" },
  "011600033": { name: "TD Bank", city: "Burlington", state: "VT" },
  "021302567": { name: "TD Bank", city: "New York", state: "NY" },
  "031201360": { name: "TD Bank", city: "Philadelphia", state: "PA" },
  "036001808": { name: "TD Bank", city: "Wilmington", state: "DE" },
  "054001725": { name: "TD Bank", city: "Baltimore", state: "MD" },
  "067014822": { name: "TD Bank", city: "Tampa", state: "FL" },
  // Capital One
  "051405515": { name: "Capital One", city: "Glen Allen", state: "VA" },
  "056073502": { name: "Capital One", city: "Richmond", state: "VA" },
  "065000090": { name: "Capital One", city: "New Orleans", state: "LA" },
  "255071981": { name: "Capital One", city: "Glen Allen", state: "VA" },
  // Truist (BB&T + SunTrust)
  "053101121": { name: "Truist", city: "Winston-Salem", state: "NC" },
  "055002707": { name: "Truist", city: "Baltimore", state: "MD" },
  "061000104": { name: "Truist", city: "Atlanta", state: "GA" },
  "061000227": { name: "Truist", city: "Atlanta", state: "GA" },
  "063104668": { name: "Truist", city: "Orlando", state: "FL" },
  "064000017": { name: "Truist", city: "Nashville", state: "TN" },
  // Ally Bank
  "124003116": { name: "Ally Bank", city: "Sandy", state: "UT" },
  // Charles Schwab
  "121202211": { name: "Charles Schwab Bank", city: "Reno", state: "NV" },
  // Discover Bank
  "031100649": { name: "Discover Bank", city: "New Castle", state: "DE" },
  // USAA
  "314074269": { name: "USAA Federal Savings Bank", city: "San Antonio", state: "TX" },
  // Navy Federal Credit Union
  "256074974": { name: "Navy Federal Credit Union", city: "Vienna", state: "VA" },
  // Pentagon Federal Credit Union
  "256078446": { name: "Pentagon Federal Credit Union", city: "McLean", state: "VA" },
  // Goldman Sachs (Marcus)
  "124085066": { name: "Goldman Sachs Bank (Marcus)", city: "Salt Lake City", state: "UT" },
  // American Express National Bank
  "124085024": { name: "American Express National Bank", city: "Salt Lake City", state: "UT" },
  // Regions Bank
  "062000019": { name: "Regions Bank", city: "Birmingham", state: "AL" },
  "062005690": { name: "Regions Bank", city: "Orlando", state: "FL" },
  "082000109": { name: "Regions Bank", city: "St. Louis", state: "MO" },
  // Fifth Third Bank
  "042000314": { name: "Fifth Third Bank", city: "Cincinnati", state: "OH" },
  "071923909": { name: "Fifth Third Bank", city: "Chicago", state: "IL" },
  // KeyBank
  "041001039": { name: "KeyBank", city: "Cleveland", state: "OH" },
  // Huntington National Bank
  "044000024": { name: "Huntington National Bank", city: "Columbus", state: "OH" },
  // M&T Bank
  "022000046": { name: "M&T Bank", city: "Buffalo", state: "NY" },
  // Citizens Bank
  "011500120": { name: "Citizens Bank", city: "Providence", state: "RI" },
  "021313103": { name: "Citizens Bank", city: "New York", state: "NY" },
  "036076150": { name: "Citizens Bank", city: "Philadelphia", state: "PA" },
  // BMO Harris
  "071025661": { name: "BMO Harris Bank", city: "Chicago", state: "IL" },
  // SoFi
  "084106768": { name: "SoFi Bank", city: "Cottonwood Heights", state: "UT" },
  // Chime
  "031101279": { name: "Chime (Stride Bank)", city: "Enid", state: "OK" },
  "103100195": { name: "Chime (Stride Bank)", city: "Enid", state: "OK" },
  // Varo
  "091311229": { name: "Varo Bank", city: "Sioux Falls", state: "SD" },
  // Current
  "021214891": { name: "Current (Choice Financial)", city: "Fargo", state: "ND" },
  // First Republic → now JPMorgan Chase
  "321081669": { name: "JPMorgan Chase (First Republic)", city: "San Francisco", state: "CA" },
  // Silicon Valley Bank → now First Citizens
  "121140399": { name: "First Citizens Bank (SVB)", city: "Santa Clara", state: "CA" },
  // Fidelity
  "101205681": { name: "Fidelity Investments", city: "Cincinnati", state: "OH" },
  // E*TRADE
  "056073573": { name: "E*TRADE (Morgan Stanley)", city: "Arlington", state: "VA" },
  // Synchrony Bank
  "021213591": { name: "Synchrony Bank", city: "Draper", state: "UT" },
  // Popular Bank
  "021502011": { name: "Popular Bank", city: "New York", state: "NY" },
  // First National Bank of Omaha
  "104000016": { name: "First National Bank of Omaha", city: "Omaha", state: "NE" },
  // Comerica
  "072000096": { name: "Comerica Bank", city: "Detroit", state: "MI" },
  "111000753": { name: "Comerica Bank", city: "Dallas", state: "TX" },
  // Zions Bank
  "124000054": { name: "Zions Bank", city: "Salt Lake City", state: "UT" },
  // Webster Bank
  "011900571": { name: "Webster Bank", city: "Waterbury", state: "CT" },
  // Valley National Bank
  "021201383": { name: "Valley National Bank", city: "Wayne", state: "NJ" },
  // Frost Bank
  "114000093": { name: "Frost Bank", city: "San Antonio", state: "TX" },
  // BOK Financial
  "103900036": { name: "BOK Financial (BOKF)", city: "Tulsa", state: "OK" },
  // First Horizon
  "084000026": { name: "First Horizon Bank", city: "Memphis", state: "TN" },
  // Associated Bank
  "075900575": { name: "Associated Bank", city: "Green Bay", state: "WI" },
  // Old National Bank
  "086300012": { name: "Old National Bank", city: "Evansville", state: "IN" },
  // WaFd Bank
  "125000032": { name: "WaFd Bank", city: "Seattle", state: "WA" },
  // Banner Bank
  "125008013": { name: "Banner Bank", city: "Walla Walla", state: "WA" },
  // Columbia Banking
  "125008011": { name: "Columbia Bank", city: "Tacoma", state: "WA" },
  // Atlantic Union Bank
  "051403164": { name: "Atlantic Union Bank", city: "Richmond", state: "VA" },
  // Glacier Bank
  "092901683": { name: "Glacier Bank", city: "Kalispell", state: "MT" },
  // South State Bank
  "053208157": { name: "South State Bank", city: "Columbia", state: "SC" },
  // Independent Bank
  "072413847": { name: "Independent Bank", city: "Grand Rapids", state: "MI" },
  // Pinnacle Financial
  "064008970": { name: "Pinnacle Financial Partners", city: "Nashville", state: "TN" },
  // Culberson State Bank
  "111322994": { name: "Culberson State Bank", city: "Van Horn", state: "TX" },
  // Credit unions
  "211983335": { name: "Digital Federal Credit Union (DCU)", city: "Marlborough", state: "MA" },
  "211170101": { name: "State Employees' Credit Union (SECU)", city: "Raleigh", state: "NC" },
  "322281507": { name: "SchoolsFirst Federal Credit Union", city: "Santa Ana", state: "CA" },
  "321175261": { name: "Golden 1 Credit Union", city: "Sacramento", state: "CA" },
  "291973757": { name: "Alliant Credit Union", city: "Chicago", state: "IL" },
  "324079555": { name: "Mountain America Credit Union", city: "Sandy", state: "UT" },
  "211391825": { name: "Bethpage Federal Credit Union", city: "Bethpage", state: "NY" },
  "231381116": { name: "Suncoast Credit Union", city: "Tampa", state: "FL" },
};

// Validate ABA routing number using checksum algorithm
function isValidRoutingNumber(rn: string): boolean {
  if (!/^\d{9}$/.test(rn)) return false;
  const d = rn.split("").map(Number);
  const checksum =
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    1 * (d[2] + d[5] + d[8]);
  return checksum % 10 === 0;
}

export async function GET(req: NextRequest) {
  const rn = req.nextUrl.searchParams.get("rn");

  if (!rn || !/^\d{9}$/.test(rn)) {
    return NextResponse.json({ error: "Invalid routing number" }, { status: 400 });
  }

  if (!isValidRoutingNumber(rn)) {
    return NextResponse.json({ bankName: null, error: "Invalid routing number checksum" });
  }

  // Look up in our map
  const entry = ROUTING_MAP[rn];
  if (entry) {
    return NextResponse.json({
      bankName: entry.name,
      city: entry.city || null,
      state: entry.state || null,
    });
  }

  // Not found in our database
  return NextResponse.json({ bankName: null });
}
