const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Path to your Chrome executable
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// List of profile directories and names
const profiles = [
    { name: "Profile 1", dir: "Profile 1" },
    { name: "Profile 2", dir: "Profile 2" },
    { name: "Profile 3", dir: "Profile 3" },
    { name: "Profile 4", dir: "Profile 4" },
    { name: "Profile 5", dir: "Profile 5" },
    { name: "Profile 6", dir: "Profile 6" },
    { name: "Profile 9", dir: "Profile 9" },
    { name: "Profile 10", dir: "Profile 10" },
    { name: "Profile 12", dir: "Profile 12" },
    { name: "Profile 13", dir: "Profile 13" },
    { name: "Profile 17", dir: "Profile 17" },
    { name: "Profile 20", dir: "Profile 20" }
];

// Function to read URLs from file
function readUrlsFromFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            const lines = data.trim().split('\n').map(line => line.trim());
            resolve(lines);
        });
    });
}

// Utility function to add delays with countdown logging
const delay = async (ms) => {
    const seconds = ms / 1000;
    for (let i = seconds; i > 0; i--) {
        process.stdout.write(`Waiting for ${i} seconds...\r`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();  // Newline after countdown
};

// Clear the contents of a file
function clearFile(fileName) {
    fs.writeFileSync(fileName, '', (err) => {
        if (err) {
            console.error(`Failed to clear contents of ${fileName}:`, err);
        } else {
            console.log(`Cleared contents of ${fileName}.`);
        }
    });
}

// Close all Chrome instances
async function closeChrome() {
    try {
        execSync('taskkill /F /IM chrome.exe /T');
        console.log("Closed all Chrome instances.");
        await delay(2000); // Add a delay after closing Chrome
    } catch (err) {
        console.log("No Chrome instance running to close.");
    }
}

// Launch Puppeteer using your Chrome with the specified profile
async function openChromeWithProfile(telegramUrl, profile) {
    console.log(`Opening Chrome with profile: ${profile.name}`);

    // Launch Puppeteer controlling your existing Chrome
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        args: [
            `--profile-directory=${profile.dir}`,
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        userDataDir: path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data'),
        timeout: 3000
    });

    const page = await browser.newPage();
    await page.goto(telegramUrl);

    return page;
}

// Save value to a file
function saveToFile(fileName, value) {
    if (!value) return;
    fs.appendFile(fileName, `${value}\n`, (err) => {
        if (err) {
            console.error("Failed to save to file:", err);
        } else {
            console.log(`Saved to ${fileName}!`);
        }
    });
}

// Function to search for button by text content
async function clickButtonByText(page, buttonTexts) {
    for (const text of buttonTexts) {
        const button = await page.evaluateHandle(
            (text) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn => btn.innerText.includes(text));
            },
            text
        );

        if (button) {
            const buttonText = await page.evaluate(el => el.innerText, button);
            console.log(`Button found: ${buttonText}`);
            await button.click(); // Click the found button
            console.log(`Clicked the '${buttonText}' button!`);
            return true; // Button clicked, return true
        }
    }

    console.log("No button found.");
    return false; // No button clicked
}

// Function to search for button by selectors and handle errors
async function clickButtonBySelectors(page, selectors) {
    try {
        for (const selector of selectors) {
            const button = await page.$(selector); // Try to select the button using Puppeteer's $()
            if (button) {
                const buttonText = await page.evaluate(el => el.innerText, button);
                console.log(`Button found: ${buttonText}`);
                await button.click(); // Click the found button
                console.log(`Clicked the '${buttonText}' button!`);
                return true; // Button clicked, return true
            }
        }
    } catch (err) {
        console.error("Error during button search or click:", err);
        return false; // Return false if error occurred
    }

    console.log("No button found.");
    return false; // No button clicked
}

// Function to interact with Telegram, perform button search, and scrape Query ID
async function interactWithTelegram(page, fileName) {
    console.log("Waiting 7 seconds for the page to load...");
    await delay(7000);

    // Button selectors for the possible options
    const buttonSelectors = [
        'button.Button.bot-menu.open.default.translucent.round[title="Open bot command keyboard"]',
        'button:has(span.inline-button-text:contains("Play!"))',
        'button:has(span.inline-button-text:contains("Play"))',
        'button:has(span.inline-button-text:contains("Start"))',
        'button:has(span.inline-button-text:contains("start"))',
        'button:has(span.inline-button-text:contains("Open"))',
        'button.reply-markup-button:has(span.reply-markup-button-text:contains("Open App"))',
        'button:has(span.inline-button-text:contains("Buka Aplikasi"))',
        'div.row > button:has(span.inline-button-text:contains("Buka Aplikasi"))',
        'div.row > button:has(span.inline-button-text:contains("Open App"))'
    ];

    console.log("Searching for buttons...");
    const buttonClicked = await clickButtonBySelectors(page, buttonSelectors);

    if (!buttonClicked) {
        console.log("No button was clicked.");
    }

    await delay(7000);

    try {
        const queryID = await getQueryID(page);
        if (queryID) {
            console.log(`Query ID: ${queryID}`);
            saveToFile(fileName, queryID);
        } else {
            console.log("Query ID not found.");
        }
    } catch (err) {
        console.error("Error during Query ID scraping:", err);
    }
}

// Function to scrape Query ID from Telegram Web
async function getQueryID(page) {
    try {
        // Try to locate the iframe
        const iframeElement = await page.$('iframe');
        if (iframeElement) {
            // Extract the src attribute from the iframe
            const src = await page.evaluate(iframe => iframe.src, iframeElement);
            const decodedSrc = decodeURIComponent(src);
            
            // Extract query parameters from the URL
            const query = decodedSrc.split('#')[1] || '';
            const queryParams = query.split('tgWebAppData=')[1] || '';
            const paramsArray = queryParams.split('&');
            const paramsObj = {};
            
            // Map query parameters into an object
            paramsArray.forEach(param => {
                const [key, value] = param.split('=');
                if (key && value) {
                    paramsObj[key] = value;
                }
            });

            // Construct the queryID from relevant parameters
            const queryID = Object.keys(paramsObj)
                .filter(key => !key.includes('tgWebApp'))
                .map(key => `${key}=${paramsObj[key]}`)
                .join('&');

            return queryID; // Return the constructed queryID
        }
    } catch (error) {
        console.error("Error scraping Query ID:", error);
        return null; // Return null if error occurs
    }
    return null; // Return null if no iframe found
}


// Main execution: Open Chrome with each profile and run the process
async function main() {
    clearFile('data.txt'); // Clear the contents of data.txt at the start
    clearFile('seed.txt'); // Clear the contents of seed.txt at the start

    // Read URLs from url.txt
    const urlLines = await readUrlsFromFile('url.txt');

    for (const line of urlLines) {
        const [prefix, rest] = line.split(': ');
        const [url, saveFile] = rest.split(' save ');

        console.log(`Processing ${prefix} with URL: ${url} to save in ${saveFile}`);

        for (let i = 0; i < profiles.length; i++) {
            const profile = profiles[i];

            await closeChrome(); // Close any existing Chrome instances

            try {
                const page = await openChromeWithProfile(url.trim(), profile);
                await interactWithTelegram(page, saveFile.trim()); // Interact with Telegram Web
            } catch (err) {
                console.error(`Error during interaction with profile ${profile.name}:`, err);
                // Skip to the next profile if an error occurs
            }
        }
    }

    console.log("All profiles have been processed.");
    console.log("Repeat the whole process every 15 minutes...");
    await delay(15 * 60 * 1000); // Delay for 15 minutes
    main(); // Restart the process
}

main().catch(console.error);
