
async function testMisFetch(code: string) {
    const ts = Date.now();
    const ch = `tse_${code}.tw`;
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ch}&json=1&delay=0&_=${ts}`;

    console.log(`Testing URL: ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://mis.twse.com.tw/stock/fibest.jsp?stock=2330',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (!response.ok) {
            console.error(`Status: ${response.status}`);
            return;
        }

        const text = await response.text();
        console.log(`Raw Response: ${text.substring(0, 500)}...`);

        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON msgArray:', JSON.stringify(json.msgArray, null, 2));
        } catch (e) {
            console.error('JSON Parse Error:', e);
        }

    } catch (e) {
        console.error('Fetch error:', e);
    }
}

async function run_mis() {
    console.log('--- Testing MIS API for 2330 ---');
    await testMisFetch('2330');
}

run_mis();
