'use strict'

import fs from 'node:fs';
import {pipeline} from 'node:stream/promises'
import ndjson from 'ndjson'
import {TMP_PATH, STADA_FILE, exists} from './util.js';

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
    HIGH_SPEED_TRAIN: {product: 'nationalExpress', weight: 3},
    INTERCITY_TRAIN: {product: 'national', weight: 2},
    INTER_REGIONAL_TRAIN: {product: 'regionalExpress', weight: 1},
    REGIONAL_TRAIN: {product: 'regional', weight: 1},
    CITY_TRAIN: {product: 'suburban', weight: 1},
    SUBWAY: {product: 'subway', weight: 0.5},
    TRAM: {product: 'tram', weight: 0.2},
    BUS: {product: 'bus', weight: 0.1},
    TAXI: {product: 'taxi', weight: 0.1},
    FERRY: {product: 'ferry', weight: 0.2},
    SHUTTLE: {product: 'taxi', weight: 0.1}
}

const MEMBER_WEIGHT = 0.2;
const LOWEST_PRICE_CATEGORY = 8;
const PRICE_CATEGORY_WEIGHT = 0.5;

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

const data = ndjson.stringify();

const calculateWeight = (stop) => {
    let sum = 0.1;
    for (let product of stop.availableTransports) {
        if (RIS_PRODUCTS_MAPPING[product]) {
            sum += RIS_PRODUCTS_MAPPING[product].weight;
        }
    }
    sum += stop.groupMembers.length * MEMBER_WEIGHT;
    if (stop.additionalInfo) {
        sum += Math.pow(2, Math.max(LOWEST_PRICE_CATEGORY + 1 - stop.additionalInfo.priceCategory, 0)) * PRICE_CATEGORY_WEIGHT;
    }
    return Math.max(0.1, Math.round(Math.pow(sum, 3) * 10) / 10);
}

const mergeRisStations = (stops, input) => {
    for (let stop of input.stopPlaces) {
        if (stops[stop.evaNumber]) {
            /* A group station should never have different `groupMembers` in different API responses,
                but it may appear in multiple different API responses
                (due to overlapping bounding boxes and the "zooming" logic),
                so you only want to add the group members once.
                And for simplicity, both grouped and simple files are read at the same time,
                so we need to add the group members in case the single result for this station was read first. */
            if (stops[stop.evaNumber].groupMembers.length == 0) {
                stops[stop.evaNumber].groupMembers = stop.groupMembers;
            }
        } else {
            stops[stop.evaNumber] = stop;
        }
    }
}

const mergeRisStationsFiles = async (stops) => {
    const files = await fs.promises.readdir(TMP_PATH);
    for (let file of files) {
        if (file == STADA_FILE) {
            continue;
        }
        const input = JSON.parse(await fs.promises.readFile(TMP_PATH + file));
        mergeRisStations(stops, input);
    }
}

const formatAdditionalStadaInfo = (stadaStop) => {
    const s = {};
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
            s.reisezentrumOpeningHours[DAY_MAPPING[key]] = avail[key].fromTime + '-' + avail[key].toTime;
        }
    }
    return s;
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
            stops[eva].additionalInfo = formatAdditionalStadaInfo(stadaStop);
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

const verifyCompleteness = async (stops) => {
    const fileToCompare = 'full.ndjson';
    if (!exists(fileToCompare)) {
        console.error('Skipping completeness verification since file to compare with does not exist.');
        return;
    }
    console.error('Verifying completeness...');
    let missing = 0;
    const stations = fs.createReadStream(fileToCompare)
        .pipe(ndjson.parse());
    for await (const d of stations) {
        if (!stops[d.id]) {
            missing += 1;
            if (d.products.nationalExpress || d.products.national || d.products.regionalExpress || d.products.regional || d.products.suburban) {
                console.error('missing', d.id, d.name);
            }
        }
    }
    console.error(missing, 'stops missing in total.');
}

const mergeStations = async () => {
    const stops = {};
    console.error('Merging...');
    await mergeRisStationsFiles(stops);
    console.error('Enriching with Stada...');
    await enrichWithStada(stops);
    console.error('Grouping...');
    applyGroups(stops);
    await verifyCompleteness(stops);
    console.error('Formatting...');
    for (let key in stops) {
        data.write(formatStop(key, stops, true));
    }
}

mergeStations();

pipeline(
    data,
    process.stdout
)
