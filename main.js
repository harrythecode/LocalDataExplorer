let currentData = null;
let currentPath = [];
let treeViewState = new Map();

const $ = (id) => document.getElementById(id);

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

const wrapTextClass = 'whitespace-pre-wrap break-words overflow-auto';

const parseInput = () => {
    const input = $('textInput').value.trim();
    const errorMessage = $('errorMessage');
    errorMessage.textContent = '';

    if (!input) {
        currentData = null;
        currentPath = [];
        updateView();
        return;
    }

    try {
        currentData = input.startsWith('<') ? parseXML(input) : JSON.parse(input);
        currentPath = [];
        updateView();
    } catch (error) {
        console.error('Parsing error:', error);
        errorMessage.textContent = `Error: ${error.message}`;
        currentData = null;
        currentPath = [];
        updateView();
    }
};

const parseXML = (input) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(input, "text/xml");
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Invalid XML");
    }
    return xmlToJson(xmlDoc.documentElement);
};

const xmlToJson = (xml) => {
    if (xml.nodeType === 3) return xml.nodeValue.trim();

    let obj = {};
    if (xml.attributes) {
        for (let attr of xml.attributes) {
            obj[`@${attr.nodeName}`] = attr.nodeValue;
        }
    }

    for (let child of xml.childNodes) {
        if (child.nodeType === 3) {
            const text = child.nodeValue.trim();
            if (text) {
                return xml.childNodes.length === 1 ? text : { '#text': text };
            }
        } else {
            const childJson = xmlToJson(child);
            if (obj[child.nodeName]) {
                if (!Array.isArray(obj[child.nodeName])) {
                    obj[child.nodeName] = [obj[child.nodeName]];
                }
                obj[child.nodeName].push(childJson);
            } else {
                obj[child.nodeName] = childJson;
            }
        }
    }

    return obj;
};

const updateView = () => {
    updateBreadcrumb();
    renderCurrentLevel();
    updateTreeView();
    updatePathDisplay();
    
    // Clear Hierarchical View when input is empty
    if (!currentData) {
        $('treeView').innerHTML = '';
        $('currentLevel').innerHTML = '';
        $('breadcrumb').innerHTML = '';
    }
};

const updateBreadcrumb = () => {
    const breadcrumb = $('breadcrumb');
    breadcrumb.innerHTML = '';
    
    const createBreadcrumbItem = (text, path) => {
        const span = document.createElement('span');
        span.textContent = text;
        span.className = 'cursor-pointer hover:underline';
        span.onclick = () => {
            currentPath = path;
            updateView();
        };
        return span;
    };

    breadcrumb.appendChild(createBreadcrumbItem('root', []));
    currentPath.forEach((key, index) => {
        breadcrumb.appendChild(document.createTextNode(' > '));
        breadcrumb.appendChild(createBreadcrumbItem(key, currentPath.slice(0, index + 1)));
    });
};

const renderCurrentLevel = () => {
    const currentLevel = $('currentLevel');
    currentLevel.innerHTML = '';

    if (!currentData) return;

    let currentObj = getCurrentObject();
    
    if (typeof currentObj !== 'object' || currentObj === null) {
        const valueElem = document.createElement('pre');
        valueElem.className = `text-sm bg-gray-100 dark:bg-gray-700 p-3 rounded-md ${wrapTextClass}`;
        valueElem.textContent = formatValue(currentObj);
        currentLevel.appendChild(valueElem);
        return;
    }

    for (const [key, value] of Object.entries(currentObj)) {
        const section = document.createElement('details');
        section.className = 'bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-2';
        section.open = true;

        const summary = document.createElement('summary');
        summary.className = 'font-semibold cursor-pointer';

        const summaryContent = document.createElement('div');
        summaryContent.className = `${wrapTextClass}`;
        summaryContent.textContent = `${key}`;
        summary.appendChild(summaryContent);

        section.appendChild(summary);

        const content = document.createElement('div');
        content.className = 'mt-2';

        if (typeof value !== 'object' || value === null) {
            const valueElem = document.createElement('pre');
            valueElem.className = `text-sm ${wrapTextClass}`;
            valueElem.textContent = formatValue(value);
            content.appendChild(valueElem);
        } else {
            const exploreButton = document.createElement('button');
            exploreButton.className = 'bg-blue-500 dark:bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-opacity-80 transition duration-150 ease-in-out';
            exploreButton.textContent = Array.isArray(value) ? `Explore Array(${value.length})` : 'Explore Object';
            exploreButton.onclick = () => {
                currentPath.push(key);
                updateView();
            };
            content.appendChild(exploreButton);
        }

        section.appendChild(content);
        currentLevel.appendChild(section);
    }
};

const formatValue = (value) => {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value, null, 2)
            .replace(/"([^"]+)":/g, '$1:')
            .replace(/^/gm, '  ');
    }
    return String(value);
};

const updateTreeView = () => {
    const treeView = $('treeView');
    treeView.innerHTML = '';

    if (!currentData) return;

    const renderTree = (obj, path = []) => {
        const ul = document.createElement('ul');
        ul.className = 'pl-4 space-y-2';

        for (const [key, value] of Object.entries(obj)) {
            const li = document.createElement('li');
            const currentPathString = path.concat(key).join('.');
            const isCurrentPath = JSON.stringify(path.concat(key)) === JSON.stringify(currentPath);
            
            if (typeof value === 'object' && value !== null) {
                const itemContainer = document.createElement('div');
                itemContainer.className = 'flex items-center space-x-2';

                const toggleButton = document.createElement('button');
                toggleButton.className = 'w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded';
                toggleButton.innerHTML = treeViewState.get(currentPathString) !== false ? '▼' : '▶';
                toggleButton.onclick = (event) => {
                    event.stopPropagation();
                    const isOpen = treeViewState.get(currentPathString) !== false;
                    treeViewState.set(currentPathString, !isOpen);
                    updateTreeView();
                };

                const label = document.createElement('span');
                label.className = `cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-md flex-grow ${isCurrentPath ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''}`;
                label.textContent = key;
                label.onclick = () => {
                    currentPath = path.concat(key);
                    updateView();
                };
                label.ondblclick = (event) => {
                    event.stopPropagation();
                    const isOpen = treeViewState.get(currentPathString) !== false;
                    treeViewState.set(currentPathString, !isOpen);
                    updateTreeView();
                };

                itemContainer.appendChild(toggleButton);
                itemContainer.appendChild(label);
                li.appendChild(itemContainer);

                if (treeViewState.get(currentPathString) !== false) {
                    li.appendChild(renderTree(value, path.concat(key)));
                }
            } else {
                const button = document.createElement('button');
                // Note: We don't use wrapTextClass here to maintain the tree structure
                button.className = `w-full text-left px-2 py-1 rounded-md transition-colors duration-200 ease-in-out 
                           hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300
                           ${isCurrentPath ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''}`;
                button.textContent = `${key}: ${formatValue(value)}`;
                button.onclick = () => {
                    currentPath = path.concat(key);
                    updateView();
                };

                li.appendChild(button);
            }

            ul.appendChild(li);
        }

        return ul;
    };

    treeView.appendChild(renderTree(currentData));
};

const getCurrentObject = () => {
    return currentPath.reduce((obj, key) => 
        (obj && typeof obj === 'object') ? (Array.isArray(obj) ? obj[parseInt(key)] : obj[key]) : obj,
        currentData
    );
};

const updatePathDisplay = () => {
    const currentObj = getCurrentObject();
    const pathString = currentPath.join(' > ');
    const valueString = formatValue(currentObj);
    
    const pathDisplay = document.createElement('div');
    pathDisplay.className = 'mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-md';
    pathDisplay.innerHTML = `
        <div class="font-semibold">Current Path:</div>
        <div class="text-sm text-blue-600 dark:text-blue-400 ${wrapTextClass}">${pathString}</div>
        <div class="font-semibold mt-3">Current Value:</div>
        <pre class="text-sm overflow-auto bg-white dark:bg-gray-800 p-2 rounded-md mt-1 ${wrapTextClass}">${valueString}</pre>
    `;
    
    const currentLevel = $('currentLevel');
    const existingPathDisplay = currentLevel.querySelector('.mt-6.p-4');
    if (existingPathDisplay) {
        currentLevel.removeChild(existingPathDisplay);
    }
    currentLevel.appendChild(pathDisplay);
};

const copyToClipboard = () => {
    const currentObj = getCurrentObject();
    const pathString = currentPath.join(' > ');
    const copyText = `Path: ${pathString}\nValue: ${JSON.stringify(currentObj, null, 2)}`;
    
    navigator.clipboard.writeText(copyText).then(() => {
        showStatus('Copied to clipboard!', 'text-green-500 dark:text-green-400');
    }).catch(err => {
        showStatus('Failed to copy: ' + err, 'text-red-500 dark:text-red-400');
    });
};

const showStatus = (message, className) => {
    const statusMessage = $('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = `mt-2 text-sm ${className}`;
    setTimeout(() => {
        statusMessage.textContent = '';
    }, 3000);
};

const setTheme = (theme) => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
};

const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    $('themeSelector').value = savedTheme || (prefersDark ? 'dark' : 'light');
};

const toggleAllTreeItems = (expand) => {
    const setAllState = (obj, path = []) => {
        for (const key of Object.keys(obj)) {
            const newPath = path.concat(key);
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                treeViewState.set(newPath.join('.'), expand);
                setAllState(obj[key], newPath);
            }
        }
    };
    if (!expand) setAllState(currentData);
    else treeViewState.clear();
    updateTreeView();
};

const jumpToSelected = () => {
    const selectedElement = $('treeView').querySelector('.bg-blue-100.dark\\:bg-blue-900');
    if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    $('textInput').addEventListener('input', debounce(parseInput, 300));
    $('themeSelector').addEventListener('change', (e) => setTheme(e.target.value));
    $('copyButton').addEventListener('click', copyToClipboard);
    $('expandAll').addEventListener('click', () => toggleAllTreeItems(true));
    $('collapseAll').addEventListener('click', () => toggleAllTreeItems(false));
    $('jumpToSelected').addEventListener('click', jumpToSelected);

    initTheme();
    parseInput();
});