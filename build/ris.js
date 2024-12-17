'use strict'

const https = require('https');
const fs = require('fs');

const { PassThrough, pipeline } = require('stream')
const ndjson = require('ndjson')
const { stringify } = require('qs');

const bbox = { // should be approx. quadratic
    north: 70.0,
    west: -10.0,
    south: 35.0,
    east: 40.0,
}

const LIMIT_RESULTS = 10000;
const PADDING_RATIO = 1.1;
const MAX_DEPTH = 8;
const MAX_REQUESTS = 1000;
const TMP_PATH = 'tmp/';
const STADA_FILE = 'stada.json'

const DEFAULT_PRODUCTS = {
    nationalExpress: false,
    national: false,
    regionalExpress: false,
    regional: false,
    suburban: false,
    subway: false,
    tram: false,
    bus: false,
    taxi: false,
    ferry: false
};

const RIS_PRODUCTS_MAPPING = {
    HIGH_SPEED_TRAIN: { product: 'nationalExpress', weight: 30 },
    INTERCITY_TRAIN: { product: 'national', weight: 20 },
    INTER_REGIONAL_TRAIN: { product: 'regionalExpress', weight: 10 },
    REGIONAL_TRAIN: { product: 'regional', weight: 10 },
    CITY_TRAIN: { product: 'suburban', weight: 10 },
    SUBWAY: { product: 'subway', weight: 5 },
    TRAM: { product: 'tram:', weight: 1 },
    BUS: { product: 'bus', weight: 1 },
    TAXI: { product: 'taxi', weight: 1 },
    FERRY: { product: 'ferry', weight: 1 },
    SHUTTLE: { product: 'bus', weight: 1 }
}

const MEMBER_WEIGHT = 2;
const LOWEST_PRICE_CATEGORY = 8;
const PRICE_CATEGORY_WEIGHT = 5;

const DAY_MAPPING = {
    "monday": 'Mo',
    "tuesday": 'Di',
    "wednesday": 'Mi',
    "thursday": 'Do',
    "friday": 'Fr',
    "saturday": 'Sa',
    "sunday": 'So',
    "holiday": 'Feiertag'
}

const abortWithError = (err) => {
    console.error(err)
    process.exit(1)
}

const data = new PassThrough({
    objectMode: true,
})

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function exists(f) {
    try {
        await fs.promises.stat(f);
        return true;
    } catch (_) {
        return false;
    }
}

const doRequest = (options, data) => {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            res.setEncoding('utf8');
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                resolve(JSON.parse(responseBody));
            });
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.write(data)
        req.end();
    });
}

const doRisStationsRequest = async (latitude, longitude, radius, groupBy) => {
    const query = {
        latitude,
        longitude,
        radius,
        groupBy,
        onlyActive: false,
        limit: LIMIT_RESULTS
    }
    const options = {
        hostname: 'apis.deutschebahn.com',
        port: 443,
        path: '/db-api-marketplace/apis/ris-stations/v1/stop-places/by-position?' + stringify(query),
        method: 'GET',
        headers: {
            'DB-Client-Id': process.env.DB_CLIENT_ID,
            'DB-Api-Key': process.env.DB_API_KEY,
        },
    };
    console.error(options.path);
    return doRequest(options, '');
    /*return Promise.resolve({
        stopPlaces: new Array(Math.round(Math.random() * 15000)).fill(0)
    })*/
}

const doStadaRequest = async () => {
    const options = {
        hostname: 'apis.deutschebahn.com',
        port: 443,
        path: '/db-api-marketplace/apis/station-data/v2/stations',
        method: 'GET',
        headers: {
            'DB-Client-Id': process.env.DB_CLIENT_ID,
            'DB-Api-Key': process.env.DB_API_KEY,
            'Accept': 'application/json'
        },
    };
    console.error(options.path);
    return doRequest(options, '');
}

const geodist = (lat1, lon1, lat2, lon2) => {
    const l1 = lat1 * Math.PI / 180, l2 = lat2 * Math.PI / 180, delta = (lon2 - lon1) * Math.PI / 180, R = 6371e3;
    return Math.acos(Math.sin(l1) * Math.sin(l2) + Math.cos(l1) * Math.cos(l2) * Math.cos(delta)) * R;
}

const discoverRisStations = async (bbox, depth, num_requests) => {
    if (depth > MAX_DEPTH) {
        throw new Error('Emerg: Max depth reached');
    }
    await sleep(5000 * Math.random());
    const halfX = (bbox.east - bbox.west) / 2;
    const halfY = (bbox.north - bbox.south) / 2;
    const center = {
        lat: halfY + bbox.south,
        lon: halfX + bbox.west
    }
    const radius = Math.round(geodist(center.lat, center.lon, bbox.south, bbox.east) * PADDING_RATIO);
    const fileName = TMP_PATH + depth + '_' + Object.values(bbox).join('_') + '_single.json';
    const fileExists = await exists(fileName);

    const dx = geodist(center.lat, center.lon, center.lat, bbox.east), dy = geodist(center.lat, center.lon, bbox.south, center.lon);
    console.error('Descending to depth', depth, 'with bbox', bbox, 'and radius', radius, 'and center', center.lat, center.lon, 'and ratio', dx, dy, dx / dy);
    let single;
    if (!fileExists) {
        console.error(fileName);
        single = await doRisStationsRequest(center.lat, center.lon, radius, 'NONE');
        num_requests += 1;
        await fs.promises.writeFile(fileName, JSON.stringify(single), 'utf8', err => {
            if (err) throw err;
        });
        console.error(single.stopPlaces.length, 'stopPlaces found');
    } else {
        throw new Error('exists ' + fileName);
        //console.error('skipping, exists', fileName); continue where left off?
    }

    if (!fileExists && single.stopPlaces.length < LIMIT_RESULTS) {
        const grouped = await doRisStationsRequest(center.lat, center.lon, radius, 'SALES');
        await fs.promises.writeFile(TMP_PATH + depth + '_' + Object.values(bbox).join('_') + '_grouped.json', JSON.stringify(grouped), 'utf8', err => {
            if (err) throw err;
        });
        num_requests += 1;
    } else {
        for (let i = 0; i < 4; i++) {
            num_requests = await discoverRisStations({
                north: bbox.north - Math.floor(i / 2) * halfY,
                west: bbox.west + (i % 2) * halfX,
                south: bbox.south + (1 - Math.floor(i / 2)) * halfY,
                east: bbox.east - (1 - (i % 2)) * halfX,
            }, depth + 1, num_requests);
            if (num_requests > MAX_REQUESTS) {
                throw new Error('Emerg: Max requests reached');
            }
        }
    }
    console.error('Total requests so far', num_requests);
    return num_requests;
}

const discoverStadaStations = async () => {
    console.error('Fetching Stada...');
    const stada = await doStadaRequest();
    await fs.promises.writeFile(TMP_PATH + STADA_FILE, JSON.stringify(stada), 'utf8', err => {
        if (err) throw err;
    });
}

const calculateWeight = (stop) => {
    let sum = 1;
    for (let product of stop.availableTransports) {
        if (RIS_PRODUCTS_MAPPING[product]) {
            sum += RIS_PRODUCTS_MAPPING[product].weight;
        }
    }
    sum += stop.groupMembers.length * MEMBER_WEIGHT;
    if (stop.additionalInfo) {
        sum += Math.pow(2, Math.max(LOWEST_PRICE_CATEGORY+1-stop.additionalInfo.priceCategory, 0))*PRICE_CATEGORY_WEIGHT;
    }
    return Math.pow(sum, 3);
}

const mergeRisStations = async (stops) => {
    const files = await fs.promises.readdir(TMP_PATH);
    for (let file of files) {
        if (file == STADA_FILE) {
            continue;
        }
        const input = JSON.parse(await fs.promises.readFile(TMP_PATH + file));
        for (let stop of input.stopPlaces) {
            if (stops[stop.evaNumber]) {
                if (stops[stop.evaNumber].groupMembers.length == 0) {
                    stops[stop.evaNumber].groupMembers = stop.groupMembers;
                }
            } else {
                stops[stop.evaNumber] = stop;
            }
        }
    }
}

const enrichWithStada = async (stops) => {
    const input = JSON.parse(await fs.promises.readFile(TMP_PATH + STADA_FILE));
    for (let stadaStop of input.result) {
        stadaStop.evaNumbers.map(o => o.number.toString()).forEach(eva => {
            if (!stops[eva]) {
                console.error(eva, stadaStop.name, 'not found in stops');
                return;
            }
            if (stops[eva].stadaId && stops[eva].stadaId != stadaStop.number.toString()) {
                console.error('Differing stadaIds for', eva, stops[eva].stadaId, stadaStop.number);
            }
            stops[eva].additionalInfo = {};
            const s = stops[eva].additionalInfo;
            s.ril100Ids = stadaStop.ril100Identifiers.map(r => r.rilIdentifier); // TODO more precise mapping to evas?
            s.ifoptId = stadaStop.ifopt;
            s.priceCategory = stadaStop.priceCategory;
            if (stadaStop.aufgabentraeger) {
                s.transitAuthority = stadaStop.aufgabentraeger.shortName;
            }
            s.facilities = {
                '3SZentrale': stadaStop.szentrale ? stadaStop.szentrale.publicPhoneNumber : undefined,
                parkingLots: stadaStop.hasParking,
                bicycleParkingRacks: stadaStop.hasBicycleParking,
                localPublicTransport: stadaStop.hasLocalPublicTransport,
                toilets: stadaStop.hasPublicFacilities,
                lockers: stadaStop.hasLockerSystem,
                travelShop: stadaStop.hasTravelNecessities,
                stepFreeAccess: stadaStop.hasSteplessAccess,
                boardingAid: stadaStop.hasMobilityService,
                taxis: stadaStop.hasTaxiRank,
                wifi: stadaStop.hasWifi,
                travelCenter: stadaStop.hasTravelCenter,
                railwayMission: stadaStop.hasRailwayMission,
                dbLounge: stadaStop.hasDBLounge,
                lostAndFound: stadaStop.hasLostAndFound,
                carRental: stadaStop.hasCarRental
            };
            if (stadaStop.localServiceStaff) {
                s.reisezentrumOpeningHours = {};
                const avail = stadaStop.localServiceStaff.availability;
                for (let key in avail) {
                    s.reisezentrumOpeningHours[DAY_MAPPING[key]] = avail[key].fromTime+'-'+avail[key].toTime;
                }
            }
        });
    }
}

const applyGroups = (stops) => {
    let i = 0;
    for (let key in stops) {
        for (let member of stops[key].groupMembers) {
            if (!stops[member].group || calculateWeight(stops[stops[member].group]) < calculateWeight(stops[key])) {
                stops[member].group = key;
            }
        }
        i += 1;
    }
    console.error(i, 'stops found.');
}

const formatStop = (evaNumber, stops, addGroup) => {
    const s = stops[evaNumber];
    const isStop = addGroup && s.group && s.group != s.evaNumber;
    const out = {
        id: s.evaNumber,
        name: s.names.DE.nameLong,
        type: isStop ? 'stop' : 'station',
        location: {
            id: s.evaNumber,
            type: 'location',
            latitude: s.position.latitude,
            longitude: s.position.longitude
        },
        products: {
            ...DEFAULT_PRODUCTS
        },
        weight: calculateWeight(s),
        ...s.additionalInfo
    };
    for (let product of s.availableTransports) {
        if (RIS_PRODUCTS_MAPPING[product]) {
            out.products[RIS_PRODUCTS_MAPPING[product].product] = true;
        } else {
            console.error('Unknown product', product);
        }
    }
    if (isStop) {
        out.station = formatStop(s.group, stops, false);
    }
    if (s.stationID) {
        out.stadaId = s.stationID;
    }
    return out;
}

const verifyCompleteness = (stops) => {
    return new Promise((resolve, _) => {
        let missing = 0;
        fs.createReadStream('hafas-stations.ndjson')
            .pipe(ndjson.parse())
            .on('data', d => {
                if (!stops[d.id]) {
                    missing += 1;
                    if (d.products.nationalExpress || d.products.national || d.products.nationalRegional) {
                        console.error('missing', d.id, d.name);
                    }
                }
            })
            .on('end', () => {
                console.error(missing, 'stops missing in total.');
                resolve();
            });
    });
}

const mergeStations = async () => {
    const stops = {};
    console.error('Merging...');
    await mergeRisStations(stops);
    console.error('Enriching with Stada...');
    await enrichWithStada(stops);
    console.error('Grouping...');
    applyGroups(stops);
    //await verifyCompleteness(stops);
    console.error('Formatting...');
    for (let key in stops) {
        data.write(formatStop(key, stops, true));
    }
}

const run = async () => {
    await fs.promises.mkdir(TMP_PATH, { recursive: true }, err => {
        if (err) throw err;
    });
    await discoverRisStations(bbox, 0, 0);
    await discoverStadaStations();
    console.error('Discovering done.');
    mergeStations();
}
run();

return pipeline(
    data,
    ndjson.stringify(),
    process.stdout,
    abortWithError
)

