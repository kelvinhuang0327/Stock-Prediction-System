import { twseMisApi } from '../src/lib/api/twseMisApi';

async function testIndex() {
    console.log('Testing Real-time TAIEX Index (t00)...');
    try {
        // 't00' is commonly TAIEX code in MIS
        const result = await twseMisApi.getRealTimeQuote('t00');
        if (result) {
            console.log('Real-time TAIEX:', result);
        } else {
            console.log('Returned null for t00. Trying alternatives...');
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testIndex();
