
const voiceLanguages = {
    English: "en",
    Telugu: "te",
    Hindi: "hi",
    Tamil: "ta",
    Kannada: "kn",
    Malayalam: "ml",
    Bengali: "bn",
    Marathi: "mr",
    Gujarati: "gu",
    Punjabi: "pa",
    Urdu: "ur",
    Spanish: "es",
    French: "fr"
};

let products = [];
let recognition = null;
let searchNumber = 0;

const $ = id => document.getElementById(id);

function createLanguageDropdown() {
    let dropdown = $("voiceLanguage");

    if (!dropdown) {
        const parent = $("product")?.parentElement;
        if (!parent) return;

        const label = document.createElement("label");
        label.htmlFor = "voiceLanguage";
        label.textContent = "Select Language";

        dropdown = document.createElement("select");
        dropdown.id = "voiceLanguage";

        parent.insertBefore(label, $("product"));
        parent.insertBefore(dropdown, $("product"));
    }

    dropdown.innerHTML = "";

    Object.entries(voiceLanguages).forEach(([name, code]) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = name;
        dropdown.appendChild(option);
    });

    dropdown.value = "en";
}

function getSelectedLanguage() {
    return $("voiceLanguage")?.value || "en";
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    function splitCSVLine(line) {
        const values = [];
        let value = "";
        let quotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (quotes && line[i + 1] === '"') {
                    value += '"';
                    i++;
                } else {
                    quotes = !quotes;
                }
            } else if (char === "," && !quotes) {
                values.push(value.trim());
                value = "";
            } else {
                value += char;
            }
        }

        values.push(value.trim());
        return values;
    }

    const headers = splitCSVLine(lines[0])
        .map(header => header.replace(/^\uFEFF/, "").toLowerCase());

    return lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values = splitCSVLine(line);
            const item = {};

            headers.forEach((header, index) => {
                item[header] = values[index] || "";
            });

            return item;
        });
}

async function loadProducts() {
    try {
        const response = await fetch("products.csv");

        if (!response.ok) {
            throw new Error("CSV file not found");
        }

        products = parseCSV(await response.text());
        showMessage(`Loaded ${products.length} products.`);
    } catch (error) {
        console.error(error);
        showMessage(
            "Cannot load products.csv. Check that it is in the same folder as index.html."
        );
    }
}

function showMessage(text) {
    if ($("message")) {
        $("message").textContent = text;
    }
}

function normalizeText(text) {
    return String(text || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getProductName(product) {
    return product.name || product.product || "";
}

function detectInputLanguage(text) {
    if (/[\u0C00-\u0C7F]/.test(text)) return "te";
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
    if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
    if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
    if (/[\u0980-\u09FF]/.test(text)) return "bn";
    if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
    if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
    if (/[\u0600-\u06FF]/.test(text)) return "ur";

    return "en";
}

async function translateText(text, from, to) {
    if (!text || from === to) return text;

    try {
        const url =
            "https://api.mymemory.translated.net/get?q=" +
            encodeURIComponent(text) +
            "&langpair=" +
            encodeURIComponent(from + "|" + to);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Translation request failed");
        }

        const data = await response.json();

        if (
            data.responseStatus === 200 &&
            data.responseData?.translatedText
        ) {
            return data.responseData.translatedText;
        }
    } catch (error) {
        console.error("Translation error:", error);
    }

    return text;
}

async function translateInputToEnglish(text) {
    const sourceLanguage = detectInputLanguage(text);

    if (sourceLanguage === "en") return text;

    return await translateText(text, sourceLanguage, "en");
}

function getSpeechLocale(language) {
    const locales = {
        en: "en-IN",
        te: "te-IN",
        hi: "hi-IN",
        ta: "ta-IN",
        kn: "kn-IN",
        ml: "ml-IN",
        bn: "bn-IN",
        mr: "mr-IN",
        gu: "gu-IN",
        pa: "pa-IN",
        ur: "ur-PK",
        es: "es-ES",
        fr: "fr-FR"
    };

    return locales[language] || language;
}

function speakText(text, language = getSelectedLanguage()) {
    if (!("speechSynthesis" in window) || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale(language);

    const voices = window.speechSynthesis.getVoices();

    const voice = voices.find(item =>
        item.lang.toLowerCase().startsWith(language.toLowerCase())
    );

    if (voice) {
        utterance.voice = voice;
    }

    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// Change floor wording only for Telugu voice announcements.
function translateFloorForVoice(floor, language) {
    if (language !== "te") return floor;

    const floors = {
        "ground floor": "గ్రౌండ్ ఫ్లోర్",
        "first floor": "మొదటి అంతస్తు",
        "second floor": "రెండవ అంతస్తు",
        "third floor": "మూడవ అంతస్తు",
        "fourth floor": "నాలుగవ అంతస్తు"
    };

    return floors[String(floor || "").trim().toLowerCase()] || floor;
}

async function displayProduct(product) {
    const language = getSelectedLanguage();

    const name = getProductName(product) || "Unknown product";
    const floor = product.floor || "Not specified";
    const row = product.row || "Not specified";
    const shelf = product.shelf || "Not specified";
    const price = product.price || "Not specified";

    const result = $("result");
    if (!result) return;

    result.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = await translateText(
        "Product Details",
        "en",
        language
    );
    result.appendChild(heading);

    const details = [
        ["Product", name],
        ["Floor", floor],
        ["Row", row],
        ["Shelf", shelf],
        ["Price", "₹" + price]
    ];

    for (const [label, value] of details) {
        const translatedLabel = await translateText(
            label,
            "en",
            language
        );

        const translatedValue = await translateText(
            value,
            "en",
            language
        );

        const line = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = translatedLabel + ": ";
        line.appendChild(strong);
        line.appendChild(document.createTextNode(translatedValue));

        result.appendChild(line);
    }

    showMessage(
        await translateText("Product found!", "en", language)
    );

    // Translate the announcement into the selected language.
    let announcement = await translateText(
        `Product name: ${name}. Location: ${floor}, ${row}, ${shelf}. Price: ${price} rupees.`,
        "en",
        language
    );

    // Only change the floor wording when Telugu is selected.
    if (language === "te") {
        const teluguFloor = translateFloorForVoice(floor, language);

        if (teluguFloor !== floor) {
            const translatedFloor = await translateText(
                floor,
                "en",
                "te"
            );

            if (
                translatedFloor &&
                announcement.includes(translatedFloor)
            ) {
                announcement = announcement.replace(
                    translatedFloor,
                    teluguFloor
                );
            } else {
                // Reliable fallback if automatic translation uses
                // different wording for the floor.
                const productPart = await translateText(
                    `Product name: ${name}.`,
                    "en",
                    "te"
                );

                const locationPart = await translateText(
                    `Location: ${row}, ${shelf}.`,
                    "en",
                    "te"
                );

                const pricePart = await translateText(
                    `Price: ${price} rupees.`,
                    "en",
                    "te"
                );

                announcement =
                    `${productPart} స్థానం: ${teluguFloor}. ` +
                    `${locationPart} ${pricePart}`;
            }
        }
    }

    speakText(announcement, language);
}

async function showRelatedProducts(matches) {
    const result = $("result");
    const language = getSelectedLanguage();

    if (!result) return;

    window.speechSynthesis?.cancel();
    result.replaceChildren();

    // Show only the first four matching products.
    const limitedProducts = matches.slice(0, 4);

    const heading = document.createElement("h3");
    heading.textContent = await translateText(
        "Available products. Please select one.",
        "en",
        language
    );

    result.appendChild(heading);

    const translatedNames = [];

    for (const product of limitedProducts) {
        const originalName = getProductName(product);

        const translatedName = await translateText(
            originalName,
            "en",
            language
        );

        translatedNames.push(translatedName);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = translatedName;

        button.addEventListener("click", () => {
            window.speechSynthesis?.cancel();
            displayProduct(product);
        });

        result.appendChild(button);
    }

    const announcement = await translateText(
        "Available products are: " +
        translatedNames.join(", ") +
        ". Please select one product.",
        "en",
        language
    );

    speakText(announcement, language);
}

async function searchProduct() {
    const input = $("product");
    if (!input) return;

    const originalQuery = input.value.trim();

    if (!originalQuery) {
        showMessage("Please enter a product name.");
        return;
    }

    const currentSearch = ++searchNumber;

    showMessage("Translating and searching...");

    const englishQuery = await translateInputToEnglish(originalQuery);

    if (currentSearch !== searchNumber) return;

    const query = normalizeText(englishQuery);

    if (!query) {
        showMessage("Please enter a valid product name.");
        return;
    }

    const exactMatches = products.filter(product =>
        normalizeText(getProductName(product)) === query
    );

    if (exactMatches.length > 0) {
        if (exactMatches.length === 1) {
            await displayProduct(exactMatches[0]);
        } else {
            await showRelatedProducts(exactMatches);
            showMessage("Choose your product.");
        }

        return;
    }

    const matches = products.filter(product => {
        const name = normalizeText(getProductName(product));

        return name && (
            name.includes(query) ||
            query.includes(name)
        );
    });

    if (currentSearch !== searchNumber) return;

    if (matches.length === 1) {
        await displayProduct(matches[0]);
    } else if (matches.length > 1) {
        await showRelatedProducts(matches);
        showMessage("Choose your product.");
    } else {
        const language = getSelectedLanguage();

        const notFound = await translateText(
            "Product not found. Please try another product name.",
            "en",
            language
        );

        showMessage(notFound);
        speakText(notFound, language);
    }
}

function startVoiceAssistant() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showMessage(
            "Voice input is unavailable. Try Google Chrome."
        );
        return;
    }

    if (recognition) recognition.stop();

    recognition = new SpeechRecognition();
    recognition.lang = getSpeechLocale(getSelectedLanguage());
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        showMessage("Listening... Say the product name.");
    };

    recognition.onresult = async event => {
        const spokenText = event.results[0][0].transcript;

        if ($("product")) {
            $("product").value = spokenText;
        }

        await searchProduct();
    };

    recognition.onerror = event => {
        showMessage("Voice search error: " + event.error);
    };

    recognition.onend = () => {
        recognition = null;
    };

    recognition.start();
}

function stopVoiceAssistant() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    showMessage("Voice stopped.");
}

document.addEventListener("DOMContentLoaded", async () => {
    createLanguageDropdown();

    await loadProducts();

    $("searchButton")?.addEventListener(
        "click",
        searchProduct
    );

    $("voiceButton")?.addEventListener(
        "click",
        startVoiceAssistant
    );

    $("stopButton")?.addEventListener(
        "click",
        stopVoiceAssistant
    );

    $("product")?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            searchProduct();
        }
    });

    $("voiceLanguage")?.addEventListener("change", () => {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }

        window.speechSynthesis?.cancel();
    });
});
