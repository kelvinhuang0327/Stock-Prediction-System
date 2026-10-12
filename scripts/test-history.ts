import { twseApi } from '../src/lib/api/twseApi';

async function testHistory() {
    console.log('Testing getMonthlyHistory for 2330...');
    try {
        const result = await twseApi.getMonthlyHistory('2330', 2024, 11);
        console.log(`Fetch result count: ${result.length}`);
        if (result.length > 0) {
            console.log('First record:', result[0]);
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testHistory();
