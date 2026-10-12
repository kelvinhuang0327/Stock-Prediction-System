import { twseMisApi } from '../src/lib/api/twseMisApi';

// Extend class to test private method logic sim locally or just hack it via raw fetch
async function testOtcIndex() {
    console.log('Testing Real-time OTC Index (o00)...');
    try {
        // Direct fetch simulation since current API hardcodes 'tse'
        const baseUrl = 'https://mis.twse.com.tw/stock';
        const ch = 'otc_o00.tw';
        const ts = Date.now();
        const url = `${baseUrl}/api/getStockInfo.jsp?ex_ch=${ch}&json=1&delay=0&_=${ts}`;

        console.log(`Fetching: ${url}`);
        const response = await fetch(url);
        const json = await response.json();

        if (json.msgArray && json.msgArray.length > 0) {
            console.log('OTC Data Found:', json.msgArray[0]);
        } else {
            console.log('OTC Data NOT Found');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testOtcIndex();
