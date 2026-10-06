


async function testFetch(year: number, month: number) {
    const dateStr = `${year}${month.toString().padStart(2, '0')}01`;
    const code = '2330';
    const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${dateStr}&stockNo=${code}&response=json`;

    console.log(`Testing URL: ${url}`);

    try {
        const response = await fetch(url);
        const json = await response.json();
        console.log(`Response stat: ${json.stat}`);
        if (json.stat !== 'OK') {
            console.log('Error reason:', json);
        } else {
            console.log(`Success! Got ${json.data.length} records.`);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}


async function run_twse() {
    console.log('--- Testing Parallel Fetch (Simulating getHistorySeries) ---');
    const promises = [
        testFetch(2025, 12),
        testFetch(2025, 11),
        testFetch(2025, 10),
        testFetch(2025, 9)
    ];
    await Promise.all(promises);

    console.log('\n--- Testing Malformed Date ---');
    // Test what happens if date is weird
    const code = '2330';
    const badUrl = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=NaNNaN01&stockNo=${code}&response=json`;
    try {
        const res = await fetch(badUrl);
        const json = await res.json();
        console.log(`Bad Date Response: ${JSON.stringify(json)}`);
    } catch (e) { console.error(e); }
}

run_twse();
