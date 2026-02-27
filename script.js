document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const config = {
        editable: false, // Default to read-only mode for published versions
        defaultNotebook: 'notebook.json', // JSON file to load
        editModeKey: 'enableEditMode' // Local storage key to enable edit mode
    };

    // Check if edit mode is enabled in local storage
    if (localStorage.getItem(config.editModeKey) === 'true') {
        config.editable = true;
    }

    // Check for URL parameter to enable edit mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit') === 'true') {
        config.editable = true;
        localStorage.setItem(config.editModeKey, 'true');
    }

    const notebookContainer = document.getElementById('notebook-container');
    const tocList = document.getElementById('toc-list');
    
    const toggleEditBtn = document.getElementById('toggle-edit-btn');
    const addCodeBtn = document.getElementById('add-code-btn');
    const addMarkdownBtn = document.getElementById('add-markdown-btn');
    const addTocH1Btn = document.getElementById('add-toc-h1-btn');
    const addTocH2Btn = document.getElementById('add-toc-h2-btn');
    const exportBtn = document.getElementById('export-btn');
    const importInput = document.getElementById('import-input');
    
    let cellCounter = 0;

    // --- CORE UTILITIES ---

    function renderMarkdown(text) {
        if (!text) return '<p style="color: #999;">(Empty Markdown)</p>';
        
        // Standard Markdown rendering, excluding TOC markers
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        html = html.split('\n').map(p => p.trim() ? `<p>${p.trim()}</p>` : '').join('');
        return html || '<p style="color: #999;">(Empty Markdown)</p>';
    }

    function updateTOC() {
        tocList.innerHTML = '';

        const cells = notebookContainer.querySelectorAll('.cell');
        
        cells.forEach(cell => {
            if (cell.dataset.type === 'markdown') {
                const textarea = cell.querySelector('textarea');
                const content = textarea ? textarea.value.trim() : '';
                const outputDiv = cell.querySelector('.cell-markdown-output');

                if (content.startsWith('TOC_H1:')) {
                    const title = content.substring(7).trim();
                    const listItem = document.createElement('li');
                    listItem.textContent = title;
                    listItem.className = 'toc-level-1';
                    listItem.title = `Cell ID: ${cell.dataset.id}`;
                    
                    listItem.addEventListener('click', () => {
                        cell.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        toggleFocusMode(cell, true); // Focus the anchor cell
                    });
                    tocList.appendChild(listItem);
                    
                    // Ensure the output reflects the intent clearly
                    outputDiv.innerHTML = `<strong>[TOC H1 Anchor: ${title}]</strong>`;
                    
                } else if (content.startsWith('TOC_H2:')) {
                    const title = content.substring(7).trim();
                    const listItem = document.createElement('li');
                    listItem.textContent = title;
                    listItem.className = 'toc-level-2';
                    listItem.title = `Cell ID: ${cell.dataset.id}`;
                    
                    listItem.addEventListener('click', () => {
                        cell.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        toggleFocusMode(cell, true);
                    });
                    tocList.appendChild(listItem);
                    
                    outputDiv.innerHTML = `<em>[TOC H2 Anchor: ${title}]</em>`;
                    
                } else {
                    // Standard Markdown cell rendering
                    outputDiv.innerHTML = renderMarkdown(content);
                }
            }
        });
    }

    // --- CELL MANAGEMENT ---
    
    function createCellElement(type, content = '', options = {}) {
        const cellDiv = document.createElement('div');
        cellDiv.className = `cell ${type}-cell`;
        cellDiv.dataset.id = ++cellCounter;
        cellDiv.dataset.type = type;
        cellDiv.dataset.runCount = 0; 

        // Extract title for collapsed view
        let title = '';
        if (type === 'markdown') {
            if (content.startsWith('TOC_H1:')) {
                title = content.substring(7).trim() || 'Untitled Section';
            } else if (content.startsWith('TOC_H2:')) {
                title = content.substring(7).trim() || 'Untitled Subsection';
            } else {
                title = content.split('\n')[0].trim() || 'Empty Markdown';
                if (title.length > 30) {
                    title = title.substring(0, 27) + '...';
                }
            }
        } else { // code
            title = content.split('\n')[0].trim() || 'Empty Code';
            if (title.length > 30) {
                title = title.substring(0, 27) + '...';
            }
        }
        cellDiv.dataset.title = title;

        const indicatorChar = type === 'code' ? 'In' : 'MD';
        const indicator = `<div class="cell-indicator" title="Click to Focus/Unfocus">${indicatorChar}<div class="collapse-icon">▼</div></div>`;
        
        let contentArea;
        let controls;

        if (type === 'code') {
            contentArea = `
                <div class="cell-input"><textarea placeholder="Enter Python code here...">${content}</textarea></div>
                <div class="cell-output" style="display:none;"><pre>Output Placeholder</pre></div>
            `;
            controls = `<button class="run-btn" title="Run Cell">▶ Run</button>
                        <button class="switch-mode-btn" title="Switch to Markdown View">MD</button>
                        <span class="history-count" title="Previous runs: 0"></span>`;
        } else { // markdown
            contentArea = `
                <div class="cell-input" style="display:none;"><textarea placeholder="Enter Markdown here...">${content}</textarea></div>
                <div class="cell-markdown-output"></div>
            `;
             controls = `<button class="run-btn" title="Render Content">Render</button>
                        <button class="switch-mode-btn" title="Switch to Edit">Edit</button>`;
        }
        
        cellDiv.innerHTML = `
            ${indicator}
            <div class="cell-body">
                ${contentArea}
                <div class="cell-controls">
                    ${controls}
                    <button class="delete-btn" title="Delete Cell" style="margin-left: auto;">🗑️</button>
                </div>
            </div>
        `;
        return cellDiv;
    }

    function addCell(type, defaultContent = '', options = {}) {
        const newCell = createCellElement(type, defaultContent, options);
        notebookContainer.appendChild(newCell);
        updateTOC(); 
        
        const input = newCell.querySelector('textarea');
        if (input) input.focus();
    }

    // --- CONCEPT 1: Focus Mode ---
    function toggleFocusMode(cellElement, forceState = null) {
        const isFocused = cellElement.classList.toggle('focused', forceState === null ? !cellElement.classList.contains('focused') : forceState);
        
        const input = cellElement.querySelector('textarea');
        if (input && isFocused) {
            input.focus();
        }
        // When unfocusing, force rendering if it's a markdown cell (to update TOC if text changed)
        if (!isFocused && cellElement.dataset.type === 'markdown') {
            runMarkdownCell(cellElement);
        }
    }
    
    // --- Cell Operations ---
    
    function runCodeCell(cellElement) {
        const textarea = cellElement.querySelector('.cell-input textarea');
        const outputDiv = cellElement.querySelector('.cell-output pre');
        const historySpan = cellElement.querySelector('.history-count');
        
        let count = parseInt(cellElement.dataset.runCount) + 1;
        cellElement.dataset.runCount = count;
        
        outputDiv.textContent = `Result for Cell ${cellElement.dataset.id}: ${count * 42} (Simulated)`;
        historySpan.textContent = `(Runs: ${count})`;
        
        cellElement.querySelector('.cell-input').style.display = 'none';
        cellElement.querySelector('.cell-output').style.display = 'block';
    }
    
    function switchCellMode(cellElement) {
        const type = cellElement.dataset.type;
        const inputDiv = cellElement.querySelector('.cell-input');
        const outputDiv = cellElement.querySelector('.cell-output, .cell-markdown-output');
        const runBtn = cellElement.querySelector('.run-btn');
        const modeBtn = cellElement.querySelector('.switch-mode-btn');
        const indicator = cellElement.querySelector('.cell-indicator');
        const textarea = inputDiv.querySelector('textarea');

        if (type === 'code') {
            cellElement.dataset.type = 'markdown';
            indicator.textContent = 'MD';
            cellElement.classList.replace('code-cell', 'markdown-cell');
            inputDiv.style.display = 'none';
            outputDiv.style.display = 'block';
            runBtn.textContent = 'Render';
            modeBtn.textContent = 'Edit';
        } else {
            cellElement.dataset.type = 'code';
            indicator.textContent = 'In';
            cellElement.classList.replace('markdown-cell', 'code-cell');
            inputDiv.style.display = 'block';
            outputDiv.style.display = 'none';
            runBtn.textContent = '▶ Run';
            modeBtn.textContent = 'MD';
        }
        updateTOC(); 
        if (textarea) textarea.focus();
    }

    function runMarkdownCell(cellElement) {
        const textarea = cellElement.querySelector('.cell-input textarea');
        const outputDiv = cellElement.querySelector('.cell-markdown-output');
        outputDiv.innerHTML = renderMarkdown(textarea.value);
        updateTOC(); // Crucial: Rebuild TOC after rendering content
    }

    // --- EVENT DELEGATION ---
    
    notebookContainer.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;

        if (config.editable) {
            if (e.target.classList.contains('delete-btn')) {
                cell.remove();
                updateTOC();
            } 
            else if (e.target.classList.contains('cell-indicator') || e.target.closest('.cell-indicator') || (cell.classList.contains('collapsed') && !e.target.closest('.cell-body'))) {
                // Check if the click was on the collapse icon or collapsed title area
                if (e.target.classList.contains('collapse-icon') || e.target.closest('.collapse-icon') || cell.classList.contains('collapsed')) {
                    cell.classList.toggle('collapsed');
                } else {
                    // Regular click on cell indicator for focus mode
                    toggleFocusMode(cell);
                }
            }
            else if (e.target.classList.contains('run-btn')) {
                const type = cell.dataset.type;
                if (type === 'code') {
                    runCodeCell(cell);
                } else {
                    runMarkdownCell(cell);
                }
            }
            else if (e.target.classList.contains('switch-mode-btn')) {
                switchCellMode(cell);
            }
        } else {
            // In read-only mode, only allow collapsing/expanding
            if (e.target.classList.contains('collapse-icon') || e.target.closest('.collapse-icon') || cell.classList.contains('collapsed')) {
                cell.classList.toggle('collapsed');
            }
        }
    });

    // --- STORAGE FUNCTIONS ---

    function saveNotebook() {
        const cells = [];
        notebookContainer.querySelectorAll('.cell').forEach(cell => {
            const textarea = cell.querySelector('textarea');
            cells.push({
                type: cell.dataset.type,
                content: textarea ? textarea.value : '',
                id: cell.dataset.id,
                runCount: cell.dataset.runCount
            });
        });
        localStorage.setItem('scientificNotebook', JSON.stringify(cells));
    }

    function loadNotebook() {
        const saved = localStorage.getItem('scientificNotebook');
        if (saved) {
            const cells = JSON.parse(saved);
            notebookContainer.innerHTML = '';
            cellCounter = 0;
            cells.forEach(cellData => {
                addCell(cellData.type, cellData.content);
            });
            return true;
        }
        return false;
    }

    function exportNotebook() {
        const cells = [];
        notebookContainer.querySelectorAll('.cell').forEach(cell => {
            const textarea = cell.querySelector('textarea');
            cells.push({
                type: cell.dataset.type,
                content: textarea ? textarea.value : ''
            });
        });
        const dataStr = JSON.stringify(cells, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'notebook.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    function importNotebook(event) {
        if (!config.editable) return;
        
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const cells = JSON.parse(e.target.result);
                    notebookContainer.innerHTML = '';
                    cellCounter = 0;
                    cells.forEach(cellData => {
                        addCell(cellData.type, cellData.content);
                    });
                    saveNotebook();
                    alert('Notebook imported successfully!');
                } catch (error) {
                    alert('Error importing notebook: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    }

    // Load from JSON file
    function loadFromJsonFile() {
        fetch(config.defaultNotebook)
            .then(response => {
                if (!response.ok) {
                    throw new Error('No notebook.json found');
                }
                return response.json();
            })
            .then(cells => {
                notebookContainer.innerHTML = '';
                cellCounter = 0;
                cells.forEach(cellData => {
                    addCell(cellData.type, cellData.content);
                });
                if (config.editable) {
                    saveNotebook(); // Save to localStorage for future edits
                }
            })
            .catch(error => {
                console.log('No notebook.json found, using localStorage or default');
                if (config.editable && !loadNotebook()) {
                    // Load initial structure
                    addCell('markdown', 'TOC_H1: Introduction');
                    addCell('code', 'print("Startup")');
                    addCell('markdown', 'TOC_H2: Initial Setup');
                    addCell('markdown', 'This cell describes the environment.');
                    addCell('code', 'setup_complete = True');
                    addCell('markdown', 'TOC_H1: Results Analysis');
                    saveNotebook();
                }
            });
    }

    // --- EVENT LISTENERS FOR SAVING ---

    if (config.editable) {
        // Save when cells are added or modified
        notebookContainer.addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA') {
                saveNotebook();
            }
        });

        // Save when cells are deleted or modified
        notebookContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn') || 
                e.target.classList.contains('run-btn') || 
                e.target.classList.contains('switch-mode-btn')) {
                setTimeout(saveNotebook, 100);
            }
        });
    }

    // --- TOGGLE EDIT MODE FUNCTION ---    
    function toggleEditMode() {
        config.editable = !config.editable;
        
        // Store edit mode preference in local storage
        localStorage.setItem(config.editModeKey, config.editable.toString());
        
        if (!config.editable) {
            document.body.classList.add('read-only');
            toggleEditBtn.textContent = 'View Mode';
            // Hide all buttons except toggle
            addCodeBtn.style.display = 'none';
            addMarkdownBtn.style.display = 'none';
            addTocH1Btn.style.display = 'none';
            addTocH2Btn.style.display = 'none';
            exportBtn.style.display = 'none';
            importInput.parentElement.querySelector('label').style.display = 'none';
        } else {
            document.body.classList.remove('read-only');
            toggleEditBtn.textContent = 'Edit Mode';
            // Show all buttons
            addCodeBtn.style.display = 'inline-block';
            addMarkdownBtn.style.display = 'inline-block';
            addTocH1Btn.style.display = 'inline-block';
            addTocH2Btn.style.display = 'inline-block';
            exportBtn.style.display = 'inline-block';
            importInput.parentElement.querySelector('label').style.display = 'inline-block';
        }
    }

    // --- INITIALIZATION ---
    
    // Set initial mode
    if (!config.editable) {
        document.body.classList.add('read-only');
        // Hide toggle button in read-only mode for published versions
        toggleEditBtn.style.display = 'none';
        // Hide all other buttons
        addCodeBtn.style.display = 'none';
        addMarkdownBtn.style.display = 'none';
        addTocH1Btn.style.display = 'none';
        addTocH2Btn.style.display = 'none';
        exportBtn.style.display = 'none';
        importInput.parentElement.querySelector('label').style.display = 'none';
    } else {
        document.body.classList.remove('read-only');
        toggleEditBtn.textContent = 'Edit Mode';
        // Show all buttons in edit mode
        addCodeBtn.style.display = 'inline-block';
        addMarkdownBtn.style.display = 'inline-block';
        addTocH1Btn.style.display = 'inline-block';
        addTocH2Btn.style.display = 'inline-block';
        exportBtn.style.display = 'inline-block';
        importInput.parentElement.querySelector('label').style.display = 'inline-block';
    }
    
    // Add event listeners
    toggleEditBtn.addEventListener('click', toggleEditMode);

    // Add keyboard shortcut to toggle edit mode (Ctrl+E or Cmd+E)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            // Only allow toggling if edit mode is already enabled or if we're in a trusted context
            if (config.editable || localStorage.getItem(config.editModeKey) === 'true' || urlParams.get('edit') === 'true') {
                toggleEditMode();
            }
        }
    });
    
    addCodeBtn.addEventListener('click', () => {
        if (config.editable) {
            addCell('code', 'print("New Code Cell")');
            saveNotebook();
        }
    });
    
    addMarkdownBtn.addEventListener('click', () => {
        if (config.editable) {
            addCell('markdown', 'This is a standard markdown cell.');
            saveNotebook();
        }
    });
    
    // NEW: Explicit TOC Anchor Creators
    addTocH1Btn.addEventListener('click', () => {
        if (config.editable) {
            addCell('markdown', 'TOC_H1: New Main Topic');
            saveNotebook();
        }
    });
    
    addTocH2Btn.addEventListener('click', () => {
        if (config.editable) {
            addCell('markdown', 'TOC_H2: New Subtopic');
            saveNotebook();
        }
    });

    // Add event listeners for export/import
    exportBtn.addEventListener('click', () => {
        if (config.editable) {
            exportNotebook();
        }
    });
    
    importInput.addEventListener('change', importNotebook);

    // Load from JSON file
    loadFromJsonFile();
    
    updateTOC(); 
});
