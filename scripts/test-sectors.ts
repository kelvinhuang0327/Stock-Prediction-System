import { twseMisApi } from '../src/lib/api/twseMisApi';

async function testSectors() {
    // Potential Sector Codes (TSE)
    // t01: Cement, t02: Food, t03: Plastic, t11: Textile
    // t13: Electronic, t17: Finance, t26: Shipping (Wait, Shipping might be different or sub-sector)
    // Official TWSE Indicies often used:
    // t00: TAIEX
    // t01: Cement (水泥)
    // t02: Food (食品)
    // t03: Plastics (塑膠)
    // t04: Textile (紡織)
    // t05: Electric Machinery (電機)
    // t06: Electrical Appliance (電器)
    // t07: Chemical & Biotech (化生) -> or Glass? No.
    // t08: Glass & Ceramic (玻陶)
    // t09: Paper (造紙)
    // t10: Steel (鋼鐵)
    // t11: Rubber (橡膠)
    // t12: Auto (汽車)
    // t13: Electronic (電子)
    // t14: Construction (建材)
    // t15: Shipping (航運) -> Let's check t15
    // t16: Tourism (觀光)
    // t17: Finance (金融)
    // t18: Trade (貿易)
    // t23: Oil/Gas/Elec (油電)
    // t28: Semiconductor (半導體) -> Usually popular

    // Let's test a batch of likely ones
    const codes = ['t01', 't02', 't13', 't15', 't17', 't28', 't26'];

    console.log('Testing Sector Codes...');

    for (const code of codes) {
        try {
            const result = await twseMisApi.getRealTimeQuote(code);
            if (result) {
                console.log(`[${code}] ${result.name}: Now=${result.close}, Prev=${result.prevClose}, Chg=${(result.close - result.prevClose).toFixed(2)}`);
            } else {
                console.log(`[${code}] No Data`);
            }
        } catch (error) {
            console.error(`[${code}] Error:`, error);
        }
        // Small delay
        await new Promise(r => setTimeout(r, 500));
    }
}

testSectors();
