const MESSAGES = {
    PROMPT_GENERATE: "Press “Generate Highlights” to view results",
    IN_PROGRESS: "Generating highlights…",
    DONE: "Done!",
    PROMPT_XML: "Please upload corresponding XML file(s) to view results",
    PROMPT_SCREENSHOT: "Please upload corresponding Screenshot(s) to view results",
    PROMPT_XML_AND_SCREENSHOT: "Please upload Screenshot(s) and XML file(s) to view results",
    TITLE_MISMATCH: "Error: Not every provided Screenshot had a corresponding XML, or vice-versa. Please double check the file names and try again.",
    FILE_COUNT_MISMATCH: "Error: Different amounts of Screenshots and XMLs provided. Please ensure all files were uploaded.",
    Loading(name) {
        return `Loading ${name}…`;
    },
    NO_MESSAGE: "",
    // NO_MESSAGE: Symbol("MESSAGES.NO_MESSAGE"),
};
const MESSAGE_TIMEOUT = 2 * 1000;

const readTextFileContent = file => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", ev => {
        const textContent = ev.target.result;
        resolve(textContent);
    });
    reader.addEventListener("error", err => {
        console.error("Error reading text file content:", err);
        console.error(err.target.error);
        reject(err);
    });

    reader.readAsText(file);
});

const readImageFileDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.addEventListener("load", ev => {
        const imageDataUrl = ev.target.result;
        resolve(imageDataUrl);
    });
    reader.addEventListener("error", err => {
        console.error("Error reading file data url:", err);
        reject(err);
    });
    
    reader.readAsDataURL(file);
});

const parseXmlString = xmlString => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    return xmlDoc;
};

const loadImageFromDataUrl = imageDataUrl => new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", err => {
        console.error("Error reading image data from url:", err);
        reject(err);
    });
    img.src = imageDataUrl;
});

const parseBoolean = boolString => {
    if(typeof boolString !== "string") {
        throw new Error(`Cannot parse non-string ${boolString} as boolean`);
    }
    if(boolString === "false") {
        return false;
    }
    if(boolString === "true") {
        return true;
    }
    throw new Error(`Malformed boolean: ${boolean}`);
};
    
const drawHighlightBox = (ctx, topLeftX, topLeftY, bottomRightX, bottomRightY) => {
    let shapeWidth = bottomRightX - topLeftX;
    let shapeHeight = bottomRightY - topLeftY;
    ctx.rect(topLeftX, topLeftY, shapeWidth, shapeHeight);
    // line style information
    ctx.setLineDash([25, 25]);
    ctx.lineWidth = 15;
    ctx.strokeStyle = "#ffff00";
    ctx.stroke();
    ctx.setLineDash([]);
};

const addHighlightBoxes = (xmlDoc, img) => {
    const workCanvas = document.createElement("canvas");
    const ctx = workCanvas.getContext("2d");
    workCanvas.width = img.width;
    workCanvas.height = img.height;
    ctx.drawImage(img, 0, 0, workCanvas.width, workCanvas.height);
    
    xmlDoc.querySelectorAll("node").forEach(node => {
        const isLeaf = node.childElementCount === 0;
        if(!isLeaf) {
            return;
        }
        
        const bounds = node.getAttribute("bounds");
        if(!bounds) {
            return;
        }
        
        const matchData = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if(!matchData) {
            console.error("Malformed bounds data: ", bounds);
            return;
        }
        const [ topLeftX, topLeftY, bottomRightX, bottomRightY ] = matchData
            .slice(1)
            .map(datum => parseInt(datum, 10));
        
        drawHighlightBox(ctx, topLeftX, topLeftY, bottomRightX, bottomRightY);
    });
    
    const outputDataUrl = workCanvas.toDataURL("image/png");
    
    return outputDataUrl;
};

const ONLY_EXTENSION = /^\.[^.]+$/;
const groupFileNames = (...fileGroups) => {
    fileGroups = fileGroups.map(group => Array.from(group));
    let names = [...fileGroups[0]]
        .map(file => file.name)
        // https://stackoverflow.com/a/47956767/4119004
        .map(fileName => fileName.substring(0, fileName.lastIndexOf(".")) || fileName);
    
    let fileCollection = {};
    for(let name of names) {
        fileCollection[name] = [];
        for(let group of fileGroups) {
            let targetFile = group.find(file => file.name.startsWith(name)
                && ONLY_EXTENSION.test(file.name.slice(name.length))
            );
            targetFile ??= null;
            fileCollection[name].push(targetFile);
        }
    }
    
    return names.map(name => ({
        name,
        files: fileCollection[name],
    }));
};

const generateHighlightsImage = async (xmlFile, imageFile) => {
    const xmlString = await readTextFileContent(xmlFile);
    const xmlDoc = parseXmlString(xmlString);

    const imageDataUrl = await readImageFileDataUrl(imageFile);
    const img = await loadImageFromDataUrl(imageDataUrl);

    const outputUrl = addHighlightBoxes(xmlDoc, img);
    const outputImage = document.createElement("img");
    outputImage.src = outputUrl;

    return outputImage;
};

const clearChildren = parent => {
    while(parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
};

const initializeApp = app => {
    const screenshotUpload = app.querySelector(".screenshot-upload");
    const xmlUpload = app.querySelector(".xml-upload");
    const submitButton = app.querySelector(".submit");
    const gallery = app.querySelector(".gallery");
    const downloadButton = app.querySelector(".download");
    const statusIndicator = app.querySelector(".status");
    
    const appState = {
        files: [],
        removeStatusTimeout: null,
    };
    
    const updateStatus = (message) => {
        if(appState.removeStatusTimeout) {
            clearTimeout(appState.removeStatusTimeout);
        }
        statusIndicator.textContent = message;
    };
    
    const updateDefaultStatus = () => {
        let message;
        submitButton.disabled = true;
        downloadButton.disabled = true;
        const hasScreenshot = screenshotUpload.files.length > 0;
        const hasXml = xmlUpload.files.length > 0;
        const hasFiles = hasScreenshot && hasXml;
        if(hasFiles) {
            if(xmlUpload.files.length !== screenshotUpload.files.length) {
                message = MESSAGES.FILE_COUNT_MISMATCH;
            }
            else {
                message = MESSAGES.PROMPT_GENERATE;
                submitButton.disabled = false;
            }
        }
        else if(hasScreenshot) {
            message = MESSAGES.PROMPT_XML;
        }
        else if(hasXml) {
            message = MESSAGES.PROMPT_SCREENSHOT;
        }
        else {
            message = MESSAGES.PROMPT_XML_AND_SCREENSHOT;
        }
        updateStatus(message);
    };
    
    updateDefaultStatus();
    
    screenshotUpload.addEventListener("change", updateDefaultStatus);
    xmlUpload.addEventListener("change", updateDefaultStatus);
    
    downloadButton.addEventListener("click", function () {
        console.log(appState);
    });
    
    submitButton.addEventListener("click", async function () {
        clearChildren(gallery);
        updateStatus(MESSAGES.IN_PROGRESS);
        downloadButton.disabled = true;
        
        const xmlImagePairs = groupFileNames(xmlUpload.files, screenshotUpload.files)
            .filter(data => data.files.every(file => !!file))
            .map(data => {
                const placeholder = document.createElement("div");
                placeholder.classList.add("placeholder");
                placeholder.textContent = MESSAGES.Loading(data.name);
                gallery.appendChild(placeholder);
                
                return Object.assign({ placeholder }, data);
            });
        
        if(xmlImagePairs.length !== xmlUpload.files.length) {
            updateStatus(MESSAGES.TITLE_MISMATCH);
            return;
        }
        
        const promises = xmlImagePairs.map(data => {
            const [ xmlFile, imageFile ] = data.files;
            
            const highlightsPromise = generateHighlightsImage(xmlFile, imageFile);
            return highlightsPromise.then(highlights => {
                data.placeholder.textContent = data.name;
                data.placeholder.appendChild(highlights);
                data.placeholder.classList.add("complete");
                return Object.assign({ highlights }, data);
            });
        });
        
        Promise.all(promises).then(files => {
            appState.files = files;
            downloadButton.disabled = false;
            updateStatus(MESSAGES.DONE);
            appState.removeStatusTimeout = setTimeout(() => updateStatus(MESSAGES.NO_MESSAGE), MESSAGE_TIMEOUT);
        });
    });
};

window.addEventListener("load", function () {
    
    document.querySelectorAll(".screenshot-app").forEach(initializeApp);
    
});
