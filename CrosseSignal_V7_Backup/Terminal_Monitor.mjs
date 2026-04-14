import fs from 'fs';
import path from 'path';

const STICKY_FILE = path.join(process.cwd(), 'sticky_tokens.json');

if (!fs.existsSync(STICKY_FILE)) {
    console.log('\x1b[31m%s\x1b[0m', '❌ No active signals found yet. Keep the server running!');
    process.exit(0);
}

try {
    const tokens = JSON.parse(fs.readFileSync(STICKY_FILE, 'utf-8'));
    console.log('\n\x1b[36m%s\x1b[0m', '🎯 ACTIVE CROSSE-SIGNAL HUNTS:');
    console.log('--------------------------------------------------');
    
    if (tokens.length === 0) {
        console.log('No tokens tracked yet.');
    } else {
        tokens.forEach((t, i) => {
            const isGolden = t.status === 'golden';
            const statusColor = isGolden ? '\x1b[38;5;214m' : (t.status === 'cross' ? '\x1b[32m' : '\x1b[33m');
            const rangeVal = t.weeklyRange || 0;
            const volVal = t.volRatio || 1.0;
            const rangeColor = rangeVal < 0.07 ? '\x1b[36m' : '\x1b[90m'; // Cyan if tight
            const volColor = volVal >= 1.5 ? '\x1b[35m' : '\x1b[90m'; // Magenta if spike
            const timeStr = t.crossTime ? new Date(t.crossTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const label = isGolden ? 'GOLDEN' : (t.status || 'UNDER').toUpperCase();
            
            console.log(`${i + 1}. \x1b[1m${t.symbol.padEnd(12)}\x1b[0m | Range: ${rangeColor}${(rangeVal * 100).toFixed(1)}%\x1b[0m | Vol: ${volColor}${volVal.toFixed(1)}x\x1b[0m | Status: ${statusColor}${label.padEnd(7)}\x1b[0m | Time: ${timeStr}`);
        });
    }
    console.log('--------------------------------------------------\n');
} catch (e) {
    console.error('Error reading signals:', e);
}
