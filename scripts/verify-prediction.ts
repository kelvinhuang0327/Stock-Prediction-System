import { predictionEngine } from '../src/lib/services/PredictionEngine';

async function testPredictions() {
    const symbols = ['2330', '2454', '2317', '2603', '2881'];

    console.log('--- Hybrid Prediction Results ---');

    for (const symbol of symbols) {
        try {
            const result = await predictionEngine.predict(symbol);
            if (result) {
                console.log(`\nStock: ${symbol}`);
                console.log(`Tech Score: ${result.technicalScore}`);
                console.log(`News Score: ${result.newsScore}`);
                console.log(`Total Score: ${result.totalScore}`);
                console.log(`Signal: ${result.signal}`);
                console.log(`Factors: ${JSON.stringify(result.factors)}`);
            } else {
                console.log(`No prediction for ${symbol}`);
            }
        } catch (error) {
            console.error(`Error predicting ${symbol}:`, error);
        }
    }
}

testPredictions();
