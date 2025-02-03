let originalDAFSA = null; // To store the original DAFSA before minimization

class DAFSA {
    constructor() {
        this.root = {};
        this.language = new Set();
        this.nodeId = 0;
        this.acceptingStates = new Set();
    }

    addString(string) {
        let currentNode = this.root;
        for (const char of string) {
            if (!currentNode[char]) {
                currentNode[char] = { id: ++this.nodeId };
                console.log(`Created state: ${currentNode[char].id} for char: ${char}`);
            }
            currentNode = currentNode[char];
        }
        if (!currentNode.isEnd) {
            currentNode.isEnd = true;
            this.language.add(string);
            this.acceptingStates.add(currentNode.id);
            console.log(`Marked state ${currentNode.id} as accepting.`);
        }
        this.visualize();
        this.updateLanguageDisplay();
    }

    search(string) {
        string = string.trim(); // Normalize input by trimming whitespace
        return this.language.has(string); // Check directly in the language set
    }

    minimize() {
        if (!originalDAFSA) {
            // Save the original DAFSA before minimization
            originalDAFSA = {
                root: JSON.parse(JSON.stringify(this.root)),
                language: new Set(this.language),
                nodeId: this.nodeId,
                acceptingStates: new Set(this.acceptingStates),
            };
        }
        const determineHeights = (node, heightMap, currentHeight) => {
            if (node.isEnd) currentHeight = 0;
            heightMap[node.id] = Math.max(heightMap[node.id] || 0, currentHeight);
            for (const char in node) {
                if (char !== 'id' && char !== 'isEnd') {
                    determineHeights(node[char], heightMap, currentHeight + 1);
                }
            }
        };
        const combineStates = (node, heightMap, stateMap, reverseMap) => {
            for (const char in node) {
                if (char !== 'id' && char !== 'isEnd') {
                    combineStates(node[char], heightMap, stateMap, reverseMap);
                }
            }
            const stateKey = JSON.stringify({
                isEnd: node.isEnd || false,
                transitions: Object.entries(node)
                    .filter(([key]) => key !== 'id' && key !== 'isEnd')
                    .map(([key, value]) => [key, reverseMap[value.id] || value.id])
                    .sort((a, b) => a[0].localeCompare(b[0])),
            });
            if (stateMap.has(stateKey)) {
                reverseMap[node.id] = stateMap.get(stateKey);
            } else {
                stateMap.set(stateKey, node.id);
            }
        };
        const mergeEquivalentStates = (node, reverseMap) => {
            for (const char in node) {
                if (char !== 'id' && char !== 'isEnd') {
                    if (reverseMap[node[char].id]) {
                        node[char] = { id: reverseMap[node[char].id] };
                    } else {
                        mergeEquivalentStates(node[char], reverseMap);
                    }
                }
            }
        };

        const heightMap = {};
        determineHeights(this.root, heightMap, 0);
        const stateMap = new Map();
        const reverseMap = new Map();
        combineStates(this.root, heightMap, stateMap, reverseMap);
        mergeEquivalentStates(this.root, reverseMap);
        this.visualize();
    }

    visualize() {
        const visualizationDiv = document.getElementById('visualization');
        visualizationDiv.innerHTML = ''; // Clear previous visualization

        const hierarchyData = {
            name: '0',
            children: this.convertToHierarchy(this.root),
        };

        const width = 800;
        const height = 600;

        const svg = d3
            .select(visualizationDiv)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background-color', '#f9f9f9');

        const margin = { top: 20, right: 90, bottom: 30, left: 90 };
        const gWidth = width - margin.left - margin.right;
        const gHeight = height - margin.top - margin.bottom;

        const g = svg
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const tree = d3.tree().size([gWidth, gHeight]);
        const root = d3.hierarchy(hierarchyData);

        tree(root);

        // Draw links (edges)
        g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
            .style('fill', 'none')
            .style('stroke', '#ccc')
            .style('stroke-width', 2);

        // Add edge labels (input characters)
        g.selectAll('.link-label')
            .data(root.links())
            .enter()
            .append('text')
            .attr('class', 'link-label')
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2 - 5)
            .attr('text-anchor', 'middle')
            .text(d => d.target.data.name.split(' → ')[0]) // Extract the edge label (character)
            .style('font-size', '12px')
            .style('fill', '#555');

        // Draw nodes (states)
        const nodes = g
            .selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        // Node circles
        nodes
            .append('circle')
            .attr('r', 20)
            .style('fill', d => {
                if (this.acceptingStates.has(d.data.id)) return 'green'; // Accepting states are green
                return d.data.name === '0' ? '#69b3a2' : '#ccc'; // Root node is highlighted
            })
            .style('stroke', 'black')
            .style('stroke-width', 2);

        // Node labels (state numbers)
        nodes
            .append('text')
            .attr('dy', '.35em')
            .attr('text-anchor', 'middle')
            .text(d => (d.data.name.includes('→') ? d.data.name.split(' → ')[1] : d.data.name)) // State ID
            .style('font-size', '12px')
            .style('fill', 'black');
    }

    convertToHierarchy(node) {
        const children = [];
        for (const char in node) {
            if (char !== 'id' && char !== 'isEnd') {
                children.push({
                    name: `${char} → ${node[char].id}`,
                    id: node[char].id,
                    children: this.convertToHierarchy(node[char]),
                });
            }
        }
        return children;
    }

    updateLanguageDisplay() {
        const languageDiv = document.getElementById('language');
        const languageArray = Array.from(this.language).sort();
        languageDiv.innerText = `L = { ${languageArray.join(', ')} }`;
    }
}

const dafsa = new DAFSA();

document.querySelector('#add').onclick = () => addString();
document.querySelector('#search').onclick = () => searchString();
document.querySelector('#minimize').onclick = () => minimizeDAFSA();

function addString() {
    const input = document.getElementById('input').value.trim();
    if (!input) {
        document.getElementById('result').innerText = 'Please enter a valid string.';
        return;
    }
    if (dafsa.search(input)) {
        document.getElementById('result').innerText = `"${input}" is already in the language.`;
    } else {
        dafsa.addString(input);
        document.getElementById('result').innerText = `"${input}" has been added to the language.`;
    }
    document.getElementById('input').value = '';
}

function searchString() {
    const input = document.getElementById('input').value.trim();
    if (!input) {
        document.getElementById('result').innerText = 'Please enter a valid string.';
        return;
    }
    if (dafsa.search(input)) {
        document.getElementById('result').innerText = `"${input}" is in the language.`;
    } else {
        document.getElementById('result').innerText = `"${input}" is not in the language.`;
    }
}

function minimizeDAFSA() {
    dafsa.minimize();
    document.getElementById('result').innerText = 'DAFSA has been minimized.';
    if (!document.getElementById('view-original')) {
        const button = document.createElement('button');
        button.id = 'view-original';
        button.innerText = 'View Original DAFSA';
        button.onclick = restoreOriginalDAFSA;
        document.getElementById('app').appendChild(button);
    }
}

function restoreOriginalDAFSA() {
    if (originalDAFSA) {
        dafsa.root = JSON.parse(JSON.stringify(originalDAFSA.root));
        dafsa.language = new Set(originalDAFSA.language);
        dafsa.nodeId = originalDAFSA.nodeId;
        dafsa.acceptingStates = new Set(originalDAFSA.acceptingStates);
        dafsa.visualize();
        document.getElementById('result').innerText = 'Restored original DAFSA.';
        const button = document.getElementById('view-original');
        if (button) button.remove();
        originalDAFSA = null;
    }
}
