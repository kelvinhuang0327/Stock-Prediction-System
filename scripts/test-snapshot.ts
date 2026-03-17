import { twseApi } from '../src/lib/api/twseApi';

async function testSnapshot() {
    console.log('Testing getFullStockData for 2330...');
    try {
        const result = await twseApi.getFullStockData('2330');
        if (result) {
            console.log('Snapshot found:', result);
        } else {
            console.log('Snapshot returned null/undefined');
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testSnapshot();
