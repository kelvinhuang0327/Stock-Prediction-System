
import { SectorAnalysisService } from '../src/lib/services/SectorAnalysisService';

async function testSectorAnalysis() {
    console.log('--- Testing Sector Analysis Service ---');
    try {
        const sectors = await SectorAnalysisService.getSectorRotationData();

        console.log(`Found ${sectors.length} sectors.`);

        if (sectors.length === 0) {
            console.warn('No sectors found. Is the DB populated with industry data?');
            return;
        }

        console.table(sectors.map(s => ({
            Name: s.name,
            RS: s.relativeStrength.toFixed(1),
            Momentum: s.momentum.toFixed(2) + '%',
            Count: s.stockCount,
            TopStock: s.topStockId
        })));

        // Verification checks
        const strongSectors = sectors.filter(s => s.relativeStrength > 60);
        console.log(`Verified: ${strongSectors.length} sectors have RS > 60.`);

    } catch (error) {
        console.error('Error running sector analysis:', error);
    }
}

testSectorAnalysis();
