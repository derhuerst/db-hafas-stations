import fs from 'node:fs';

const TMP_PATH = process.env.RIS_TMP_PATH || '/tmp/db-hafas-stations/';
const STADA_FILE = 'stada.json'

const exists = async (f) => {
    try {
        await fs.promises.stat(f);
        return true;
    } catch (_) {
        return false;
    }
}


export {
    TMP_PATH,
    STADA_FILE,
    exists
}