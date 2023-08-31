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
    ctx.setLineDash([25, 25]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "red";
    let shapeWidth = bottomRightX - topLeftX;
    let shapeHeight = bottomRightY - topLeftY;
    ctx.rect(topLeftX, topLeftY, shapeWidth, shapeHeight);
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

window.addEventListener("load", function () {
    
    document.querySelectorAll(".screenshot-app").forEach(app => {
        const screenshotUpload = app.querySelector(".screenshot-upload");
        const xmlUpload = app.querySelector(".xml-upload");
        const submitButton = app.querySelector(".submit");
        const gallery = app.querySelector(".gallery");
        
        submitButton.addEventListener("click", async function () {
            const xmlImagePairs = groupFileNames(xmlUpload.files, screenshotUpload.files);
            
            xmlImagePairs.forEach(async data => {
                const [ xmlFile, imageFile ] = data.files;
                
                const highlights = await generateHighlightsImage(xmlFile, imageFile);
                gallery.appendChild(highlights);
            });
            
        });
        
        // TODO: remove; convenience
        submitButton.click();
    });
    
    
});
