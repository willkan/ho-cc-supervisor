#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SESSION_LOG = 'session.log';
const PROOF_FILE = '.proof/latest.json';
const VERIFY_SCRIPT = './verify.sh';

// Keywords that trigger verification
const TRIGGER_KEYWORDS = [
    'test pass',
    'all tests pass',
    'completed',
    'done',
    'finished'
];

// Colors for console output
const colors = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Parse command from arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error(`${colors.red}Usage: node wrapper.js "command to run"${colors.reset}`);
    console.error('Example: node wrapper.js "npm test"');
    console.error('\nThis wrapper will:');
    console.error('  - Execute any command and capture output to session.log');
    console.error('  - Detect keywords: ' + TRIGGER_KEYWORDS.join(', '));
    console.error('  - Run verification when keywords are detected');
    console.error('  - Check for commit hash mismatches');
    process.exit(1);
}

// Get the command to execute
const commandString = args[0];
console.log(`${colors.cyan}[WRAPPER] Starting command: ${commandString}${colors.reset}`);

// Create or append to session log
const logStream = fs.createWriteStream(SESSION_LOG, { flags: 'a' });
logStream.write(`\n${'='.repeat(60)}\n`);
logStream.write(`[${new Date().toISOString()}] Command: ${commandString}\n`);
logStream.write(`${'='.repeat(60)}\n`);

// Spawn the subprocess with shell
const child = spawn(commandString, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe']
});

// Buffer to accumulate output for keyword detection
let outputBuffer = '';
let verificationTriggered = false;

// Function to check for trigger keywords
function checkForTriggers(text) {
    const lowerText = text.toLowerCase();
    for (const keyword of TRIGGER_KEYWORDS) {
        if (lowerText.includes(keyword)) {
            return keyword;
        }
    }
    return null;
}

// Function to get current git commit hash
function getCurrentCommitHash() {
    try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
        return 'none';
    }
}

// Function to run verification
function runVerification(triggeredBy) {
    if (verificationTriggered) {
        return; // Avoid duplicate verifications
    }
    verificationTriggered = true;
    
    console.log(`\n${colors.yellow}[WRAPPER] Keyword detected: "${triggeredBy}" - Running verification...${colors.reset}`);
    
    try {
        // Run verify.sh
        execSync(VERIFY_SCRIPT, { stdio: 'inherit' });
        
        // Read the proof file
        if (fs.existsSync(PROOF_FILE)) {
            const proof = JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8'));
            const currentHash = getCurrentCommitHash();
            
            console.log(`\n${colors.cyan}[WRAPPER] Verification complete:${colors.reset}`);
            console.log(`  Status: ${proof.status === 'PASS' ? colors.green : colors.red}${proof.status}${colors.reset}`);
            console.log(`  Tests: ${proof.tests.passed}/${proof.tests.total} passed`);
            console.log(`  Proof Hash: ${proof.commitHash}`);
            console.log(`  Current Hash: ${currentHash}`);
            
            // Check for commit mismatch
            if (proof.commitHash !== currentHash && currentHash !== 'none' && proof.commitHash !== 'none') {
                console.log(`\n${colors.red}${'⚠️ '.repeat(10)}${colors.reset}`);
                console.log(`${colors.red}⚠️ WARNING: COMMIT MISMATCH - CLAIMED COMPLETION WITHOUT EVIDENCE ⚠️${colors.reset}`);
                console.log(`${colors.red}${'⚠️ '.repeat(10)}${colors.reset}`);
                console.log(`${colors.yellow}Proof was generated for commit: ${proof.commitHash}${colors.reset}`);
                console.log(`${colors.yellow}But current HEAD is: ${currentHash}${colors.reset}`);
                console.log(`${colors.yellow}This indicates changes were committed without verification!${colors.reset}\n`);
                
                // Log warning to session file
                logStream.write(`\n⚠️ COMMIT MISMATCH DETECTED!\n`);
                logStream.write(`Proof commit: ${proof.commitHash}\n`);
                logStream.write(`Current commit: ${currentHash}\n\n`);
            }
        }
    } catch (error) {
        console.error(`${colors.red}[WRAPPER] Verification failed: ${error.message}${colors.reset}`);
        logStream.write(`[WRAPPER] Verification error: ${error.message}\n`);
    }
}

// Handle stdout
child.stdout.on('data', (data) => {
    const text = data.toString();
    
    // Display to console
    process.stdout.write(data);
    
    // Write to log file
    logStream.write(text);
    
    // Accumulate in buffer for keyword detection
    outputBuffer += text;
    
    // Check for triggers
    const trigger = checkForTriggers(outputBuffer);
    if (trigger && !verificationTriggered) {
        // Schedule verification after a short delay to ensure command completes
        setTimeout(() => runVerification(trigger), 1000);
    }
    
    // Keep buffer size reasonable (last 2000 chars)
    if (outputBuffer.length > 2000) {
        outputBuffer = outputBuffer.slice(-1000);
    }
});

// Handle stderr
child.stderr.on('data', (data) => {
    const text = data.toString();
    
    // Display to console
    process.stderr.write(data);
    
    // Write to log file
    logStream.write(`[STDERR] ${text}`);
    
    // Also check stderr for triggers
    outputBuffer += text;
    const trigger = checkForTriggers(outputBuffer);
    if (trigger && !verificationTriggered) {
        setTimeout(() => runVerification(trigger), 1000);
    }
});

// Handle process exit
child.on('exit', (code, signal) => {
    const exitMessage = `[WRAPPER] Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}\n`;
    console.log(`${colors.cyan}${exitMessage}${colors.reset}`);
    logStream.write(exitMessage);
    
    // Close log stream
    logStream.end();
    
    // Exit with same code as child process
    process.exit(code || 0);
});

// Handle errors
child.on('error', (error) => {
    const errorMessage = `[WRAPPER] Failed to start process: ${error.message}\n`;
    console.error(`${colors.red}${errorMessage}${colors.reset}`);
    logStream.write(errorMessage);
    logStream.end();
    process.exit(1);
});

// Handle interrupt signal
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}[WRAPPER] Received interrupt signal, terminating child process...${colors.reset}`);
    child.kill('SIGINT');
});