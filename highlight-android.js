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

window.addEventListener("load", function () {
    
    document.querySelectorAll(".screenshot-app").forEach(app => {
        const screenshotUpload = app.querySelector(".screenshot-upload");
        const xmlUpload = app.querySelector(".xml-upload");
        const submitButton = app.querySelector(".submit");
        
        submitButton.addEventListener("click", async function () {
            
            // TODO: separate multiple uploaded images/xml into pairs by common prefix
            const imageFile = screenshotUpload.files[0];
            const xmlFile = xmlUpload.files[0];
            
            const xmlString = await readTextFileContent(xmlFile);
            const xmlDoc = parseXmlString(xmlString);
            console.log(xmlDoc);
            
            const imageDataUrl = await readImageFileDataUrl(imageFile);
            const img = await loadImageFromDataUrl(imageDataUrl);
            
            const workCanvas = document.createElement("canvas");
            const ctx = workCanvas.getContext("2d");
            workCanvas.width = img.width;
            workCanvas.height = img.height;
            ctx.drawImage(img, 0, 0, workCanvas.width, workCanvas.height);
            
            const drawOutline = (topLeftX, topLeftY, bottomRightX, bottomRightY) => {
                ctx.setLineDash([25, 25]);
                ctx.lineWidth = 5;
                ctx.strokeStyle = "red";
                let shapeWidth = bottomRightX - topLeftX;
                let shapeHeight = bottomRightY - topLeftY;
                ctx.rect(topLeftX, topLeftY, shapeWidth, shapeHeight);
                ctx.stroke();
                ctx.setLineDash([]);
            };
            
            xmlDoc.querySelectorAll("node").forEach(node => {
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
                
                drawOutline(topLeftX, topLeftY, bottomRightX, bottomRightY);
            });
            
            
            app.appendChild(workCanvas);
        });
        
        // TODO: remove; convenience
        submitButton.click();
    });
    
    
});
