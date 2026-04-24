
import { twseApi } from '../src/lib/api/twseApi';

async function test() {
    const data = await twseApi.getMonthlyHistory('0052', 2026, 1);
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
}

test();
