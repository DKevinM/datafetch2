// Save this as fetchAQHI.js

const axios = require('axios');
const dayjs = require('dayjs');
const { Parser } = require('json2csv');
const fs = require('fs');

const stationList = [
      "Edmonton McCauley", "St. Albert", "Woodcroft", "Edmonton East", "Edmonton Lendrum",
      "Ardrossan", "Sherwood Park", "O’Morrow Station 1", "Poacher’s Landing Station 2", "Leduc Sensor",
      "Breton", "Carrot Creek", "Drayton Valley", "Edson", "Genesee", "Hinton-Drinnan", "Meadows", 
      "Powers", "Steeper", "Wagner2", "Hinton-Hillcrest", "Jasper", "Enoch"
];

async function fetchAndProcessWeek(stationName) {
  // Date 7 days ago in required format: "YYYY-MM-DDTHH:MM:SS-06:00"
  const now = dayjs().tz("America/Edmonton");
  const sevenDaysAgo = now.subtract(7, 'day');
  // GitHub Actions use UTC; "-06:00" hardcoded for Edmonton
  const dtStr = sevenDaysAgo.format("YYYY-MM-DDTHH:mm:ss-06:00");

  const apiUrl = 'https://data.environment.alberta.ca/EdwServices/aqhi/odata/StationMeasurements?$format=json';
  const filter = encodeURIComponent(`StationName eq '${stationName}' AND ReadingDate gt ${dtStr}`);
  const url = `${apiUrl}&$filter=${filter}&$orderby=ReadingDate desc&$select=StationName,ParameterName,ReadingDate,Value`;

  try {
    const response = await axios.get(url, { timeout: 15000 });
    let data = response.data.value;
    // Parse and fix
    data = data.map(d => ({
      ...d,
      // Parse numbers, convert AQHI >10 to "10+"
      Value: d.ParameterName === "AQHI" && Number(d.Value) > 10 ? "10+" : Number(d.Value),
      // Attach units
      Units: (() => {
        switch (d.ParameterName) {
          case "AQHI": return "AQHI";
          case "Ozone": case "Total Oxides of Nitrogen":
          case "Hydrogen Sulphide": case "Total Reduced Sulphur":
          case "Sulphur Dioxide": case "Nitric Oxide":
          case "Nitrogen Dioxide": return "ppb";
          case "Fine Particulate Matter": return "µg/m³";
          case "Total Hydrocarbons": case "Non-methane Hydrocarbons": return "ppm";
          case "Carbon Monoxide": return "ppm";
          case "Wind Direction": return "degrees";
          case "Relative Humidity": return "%";
          case "Outdoor Temperature": return "°C";
          case "Wind Speed": return "km/hr";
          case "Methane": return "ppm";
          default: return null;
        }
      })()
    }));
    return data;
  } catch (e) {
    console.error(`Fetch failed for ${stationName}:`, e.message);
    return [];
  }
}

// Main function to fetch all stations and save results
async function main() {
  let allData = [];
  for (let station of stationList) {
    console.log(`Fetching for ${station}...`);
    const result = await fetchAndProcessWeek(station);
    allData = allData.concat(result);
  }

  // Save as JSON
  fs.writeFileSync('all_stations_aqhi.json', JSON.stringify(allData, null, 2));

  // Save as CSV
  const parser = new Parser();
  fs.writeFileSync('all_stations_aqhi.csv', parser.parse(allData));

  console.log('Saved all_stations_aqhi.json and .csv');
}

main();
