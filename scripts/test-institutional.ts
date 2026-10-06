// Test script for TWSE Institutional Investors API with previous trading day
// 三大法人買賣超 API 測試（使用上個交易日）

async function testInstitutionalData() {
    // Try recent trading days (last Friday would be 20251213)
    const dates = ['20251213', '20251212', '20251211'];

    for (const dateStr of dates) {
        console.log(`\n=== Testing date: ${dateStr} ===`);

        try {
            const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${dateStr}&selectType=ALL&response=json`;
            console.log(`Fetching: ${url}`);

            const response = await fetch(url);
            const json = await response.json();

            console.log('Status:', json.stat);

            if (json.stat === 'OK' && json.data && json.data.length > 0) {
                console.log('✅ Data found!');
                console.log('Date:', json.date);
                console.log('Total stocks:', json.data.length);
                console.log('Fields:', json.fields);

                console.log('\nSample Data (First 3 stocks):');
                json.data.slice(0, 3).forEach((row: any[], idx: number) => {
                    console.log(`\n[${idx + 1}] ${row[0]} - ${row[1]}`);
                    console.log(`  外資買賣超: ${row[2]} 張`);
                    console.log(`  投信買賣超: ${row[3]} 張`);
                    console.log(`  自營商買賣超: ${row[4]} 張`);
                    console.log(`  三大法人合計: ${row[5]} 張`);
                });

                // Find 2330
                const tsmc = json.data.find((row: any[]) => row[0] === '2330');
                if (tsmc) {
                    console.log('\n=== 2330 台積電 三大法人 ===');
                    console.log(`外資買賣超: ${tsmc[2]} 張`);
                    console.log(`投信買賣超: ${tsmc[3]} 張`);
                    console.log(`自營商買賣超: ${tsmc[4]} 張`);
                    console.log(`三大法人合計: ${tsmc[5]} 張`);
                }

                break; // Found data, exit loop
            } else {
                console.log('❌ No data for this date');
            }

        } catch (error) {
            console.error('Error:', error);
        }
    }
}

testInstitutionalData();
