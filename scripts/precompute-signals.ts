
import { signalPrecalculationService } from '../src/lib/services/SignalPrecalculationService';
import { prisma } from '../src/lib/prisma';

async function main() {
    const args = process.argv.slice(2);
    const dayArg = args.find(a => a.startsWith('--days='));
    const days = dayArg ? parseInt(dayArg.split('=')[1]) : 30; // Default 30 days

    const strategyArg = args.find(a => a.startsWith('--strategy='));
    const strategy = strategyArg ? strategyArg.split('=')[1] : 'AssetDoubling';

    console.log(`🚀 Starting pre-computation for last ${days} days using ${strategy} strategy...`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    try {
        await signalPrecalculationService.precomputeRange(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            strategy
        );
        console.log('✅ Pre-computation complete!');
    } catch (e) {
        console.error('❌ Pre-computation failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
