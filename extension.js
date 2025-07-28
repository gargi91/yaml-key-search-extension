const vscode = require('vscode');
const yaml = require('yaml');
const glob = require('glob');
const fs = require('fs');
const path = require('path');

/**
 * Parses a YAML object and extracts all possible key paths with their locations
 * @param {Object} obj - The parsed YAML object
 * @param {string} prefix - Current key path prefix
 * @param {Array} paths - Array to store found paths
 * @param {Array} lines - Array of file lines for location tracking
 * @returns {Array} Array of {path, line, column, value} objects
 */
function extractKeyPaths(obj, prefix = '', paths = [], lines = []) {
    if (typeof obj !== 'object' || obj === null) {
        return paths;
    }

    Object.keys(obj).forEach(key => {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        // Try to find the line number where this key appears
        let lineNumber = -1;
        let columnNumber = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for the key at the appropriate indentation level
            const regex = new RegExp(`^\\s*${key}\\s*:`, 'g');
            const match = regex.exec(line);
            if (match) {
                lineNumber = i + 1; // 1-indexed
                columnNumber = match.index + 1; // 1-indexed
                break;
            }
        }
        
        paths.push({
            path: currentPath,
            line: lineNumber,
            column: columnNumber,
            value: value,
            key: key,
            fullPath: currentPath // Keep full path for better matching
        });
        
        if (typeof value === 'object' && value !== null) {
            extractKeyPaths(value, currentPath, paths, lines);
        }
    });
    
    return paths;
}

/**
 * Searches for YAML files in the workspace
 * @param {string} workspacePath - The workspace root path
 * @returns {Promise<Array>} Array of YAML file paths
 */
function findYamlFiles(workspacePath) {
    return new Promise((resolve, reject) => {
        // Get configuration settings
        const config = vscode.workspace.getConfiguration('yamlKeySearch');
        const excludePatterns = config.get('excludePatterns', [
            '**/node_modules/**',
            '**/.git/**',
            '**/target/**',
            '**/build/**',
            '**/dist/**',
            '**/out/**',
            '**/.vscode/**',
        ]);
        const includePatterns = config.get('includePatterns', ['**/*.yml', '**/*.yaml']);
        
        // Use the configured include patterns
        const patterns = includePatterns.map(pattern => path.join(workspacePath, pattern));
        
        // If multiple patterns, use the first one for now (could be enhanced to merge results)
        const pattern = patterns[0] || path.join(workspacePath, '**/*.{yml,yaml}');
        
        glob(pattern, { 
            ignore: excludePatterns,
            nodir: true,
            absolute: true,
            silent: true  // Suppress glob warnings
        }, (err, files) => {
            if (err) {
                console.warn('Glob search error:', err.message);
                resolve([]); // Don't fail completely, just return empty results
            } else {
                // Filter out any files that don't actually exist or have invalid paths
                const validFiles = files.filter(file => {
                    try {
                        // Additional validation to prevent .java.git type errors
                        if (file.includes('.java.git') || file.includes('.class.yaml') || file.includes('.tmp.')) {
                            return false;
                        }
                        
                        const stats = fs.statSync(file);
                        return stats.isFile() && (file.endsWith('.yml') || file.endsWith('.yaml'));
                    } catch (error) {
                        // File doesn't exist or can't be accessed
                        return false;
                    }
                });
                resolve(validFiles);
            }
        });
    });
}

/**
 * Searches for a specific key path in a YAML file
 * @param {string} filePath - Path to the YAML file
 * @param {string} searchKey - The dot-notation key to search for
 * @returns {Promise<Array>} Array of matches
 */
async function searchKeyInFile(filePath, searchKey) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Handle multi-document YAML files (separated by ---)
        const documents = content.split(/^---\s*$/m);
        let matches = [];
        let documentStartLine = 0;
        
        for (let docIndex = 0; docIndex < documents.length; docIndex++) {
            const docContent = documents[docIndex].trim();
            if (!docContent) {
                documentStartLine += documents[docIndex].split('\n').length;
                continue;
            }
            
            try {
                const parsed = yaml.parse(docContent);
                if (parsed) {
                    const docLines = docContent.split('\n');
                    const keyPaths = extractKeyPaths(parsed, '', [], docLines);
                    
                    // Find exact matches and partial matches
                    keyPaths.forEach(keyPath => {
                        if (keyPath.path === searchKey || keyPath.path.includes(searchKey)) {
                            matches.push({
                                file: filePath,
                                path: keyPath.path,
                                line: keyPath.line + documentStartLine,
                                column: keyPath.column,
                                value: keyPath.value,
                                key: keyPath.key,
                                fullPath: keyPath.fullPath,
                                isExactMatch: keyPath.path === searchKey
                            });
                        }
                    });
                }
            } catch (parseError) {
                console.warn(`Failed to parse YAML document ${docIndex + 1} in ${filePath}:`, parseError.message);
            }
            
            documentStartLine += documents[docIndex].split('\n').length + 1; // +1 for the --- separator
        }
        
        return matches;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return [];
    }
}

/**
 * Shows search results in a Quick Pick
 * @param {Array} results - Array of search results
 * @param {string} searchKey - The searched key
 * @param {boolean} isReplace - Whether this is for replace functionality
 */
function showSearchResults(results, searchKey, isReplace = false) {
    if (results.length === 0) {
        vscode.window.showInformationMessage(`No matches found for key: ${searchKey}`);
        return;
    }

    const items = results.map(result => ({
        label: `$(file) ${getSmartDisplayName(result.file, results)}`,
        description: result.path,
        detail: `Line ${result.line}: ${JSON.stringify(result.value)} ${result.isExactMatch ? '(Exact Match)' : '(Partial Match)'}`,
        result: result
    }));

    if (isReplace) {
        // Show replace options instead of just navigation
        showReplaceOptions(results, searchKey);
    } else {
        vscode.window.showQuickPick(items, {
            placeHolder: `Found ${results.length} matches for "${searchKey}"`,
            matchOnDescription: true
        }).then(selection => {
            if (selection) {
                // Open the file and go to the line
                vscode.workspace.openTextDocument(selection.result.file).then(doc => {
                    vscode.window.showTextDocument(doc).then(editor => {
                        const position = new vscode.Position(selection.result.line - 1, selection.result.column - 1);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position));
                    });
                });
            }
        });
    }
}

/**
 * Shows replace options using a webview modal
 * @param {Array} results - Array of search results
 * @param {string} searchKey - The searched key
 */
async function showReplaceOptions(results, searchKey) {
    const panel = vscode.window.createWebviewPanel(
        'yamlReplaceModal',
        'YAML Find & Replace',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Group results by value for better display
    const valueGroups = {};
    results.forEach(result => {
        const valueKey = JSON.stringify(result.value);
        if (!valueGroups[valueKey]) {
            valueGroups[valueKey] = [];
        }
        valueGroups[valueKey].push(result);
    });

    // Set the webview content
    panel.webview.html = getWebviewContent(results, searchKey, valueGroups);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'replaceAll':
                    panel.dispose();
                    await performBatchReplace(results, message.newValue);
                    break;
                case 'reviewEach':
                    panel.dispose();
                    await performReviewReplace(results, message.newValue);
                    break;
                case 'replaceSelected':
                    const selectedResults = results.filter((_, index) => 
                        message.selectedIndices.includes(index)
                    );
                    panel.dispose();
                    await performBatchReplace(selectedResults, message.newValue);
                    break;
                case 'preview':
                    const result = results[message.index];
                    await previewResult(result);
                    break;
                case 'cancel':
                    panel.dispose();
                    break;
            }
        },
        undefined
    );
}

/**
 * Generates the HTML content for the webview modal
 * @param {Array} results - Search results
 * @param {string} searchKey - The search key
 * @param {Object} valueGroups - Grouped results by value
 * @returns {string} HTML content
 */
function getWebviewContent(results, searchKey, valueGroups) {
    const resultRows = results.map((result, index) => {
        const smartDisplayName = getSmartDisplayName(result.file, results);
        const relativePath = result.file.split('/').slice(-3).join('/');
        return `
            <tr>
                <td><input type="checkbox" checked data-index="${index}"></td>
                <td><button class="preview-btn" data-index="${index}">👁️</button></td>
                <td class="file-name">${smartDisplayName}</td>
                <td class="file-path">${relativePath}</td>
                <td class="key-path">${result.path}</td>
                <td class="line-num">${result.line}</td>
                <td class="current-value">${JSON.stringify(result.value)}</td>
                <td class="match-type">${result.isExactMatch ? '✓ Exact' : '~ Partial'}</td>
            </tr>
        `;
    }).join('');

    const valueSummary = Object.keys(valueGroups).map(valueKey => {
        return `<div class="value-group">
            <span class="value">${valueKey}</span>
            <span class="count">${valueGroups[valueKey].length} occurrence(s)</span>
        </div>`;
    }).join('');

    const defaultValue = results.length > 0 ? 
        (typeof results[0].value === 'string' ? results[0].value : JSON.stringify(results[0].value)) : '';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>YAML Find & Replace</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                margin: 0;
                padding: 20px;
            }
            .header {
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            .search-info {
                font-size: 16px;
                font-weight: bold;
                color: var(--vscode-textLink-foreground);
            }
            .summary {
                margin: 15px 0;
                padding: 10px;
                background-color: var(--vscode-textBlockQuote-background);
                border-left: 3px solid var(--vscode-textLink-foreground);
            }
            .value-group {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
            }
            .value {
                font-family: var(--vscode-editor-font-family);
                background-color: var(--vscode-textPreformat-background);
                padding: 2px 6px;
                border-radius: 3px;
            }
            .count {
                color: var(--vscode-descriptionForeground);
            }
            .replace-section {
                margin: 20px 0;
                padding: 15px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 5px;
            }
            .input-group {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
            }
            .input-group label {
                min-width: 100px;
                font-weight: bold;
            }
            .input-group input {
                flex: 1;
                padding: 6px 10px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 3px;
            }
            .results-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 12px;
            }
            .results-table th, .results-table td {
                padding: 8px 12px;
                text-align: left;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .results-table th {
                background-color: var(--vscode-editor-lineHighlightBackground);
                font-weight: bold;
                position: sticky;
                top: 0;
            }
            .results-table tr:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            .file-name {
                font-weight: bold;
                color: var(--vscode-textLink-foreground);
            }
            .file-path {
                color: var(--vscode-descriptionForeground);
                font-size: 11px;
            }
            .key-path {
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-symbolIcon-keywordForeground);
            }
            .current-value {
                font-family: var(--vscode-editor-font-family);
                background-color: var(--vscode-textPreformat-background);
                padding: 2px 4px;
                border-radius: 2px;
            }
            .line-num {
                color: var(--vscode-editorLineNumber-foreground);
                text-align: center;
            }
            .match-type {
                text-align: center;
                font-size: 11px;
            }
            .preview-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                color: var(--vscode-textLink-foreground);
            }
            .preview-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
                border-radius: 3px;
            }
            .actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid var(--vscode-panel-border);
            }
            .btn {
                padding: 8px 16px;
                border: 1px solid var(--vscode-button-border);
                border-radius: 3px;
                cursor: pointer;
                font-size: 13px;
                transition: background-color 0.2s;
            }
            .btn-primary {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .btn-primary:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            .btn-secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .btn-secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }
            .selection-info {
                margin: 10px 0;
                padding: 8px;
                background-color: var(--vscode-editorInfo-background);
                border-radius: 3px;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="search-info">Find & Replace: "${searchKey}"</div>
            <div>Found ${results.length} occurrences across ${new Set(results.map(r => r.file)).size} files</div>
        </div>

        <div class="summary">
            <strong>Current Values:</strong>
            ${valueSummary}
        </div>

        <div class="replace-section">
            <div class="input-group">
                <label for="newValue">New Value:</label>
                <input type="text" id="newValue" value="${defaultValue}" placeholder="Enter replacement value">
            </div>
            <div class="selection-info">
                <span id="selectionCount">${results.length}</span> items selected for replacement
            </div>
        </div>

        <div style="max-height: 400px; overflow-y: auto;">
            <table class="results-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAll" checked></th>
                        <th>Preview</th>
                        <th>File</th>
                        <th>Path</th>
                        <th>Key</th>
                        <th>Line</th>
                        <th>Current Value</th>
                        <th>Match</th>
                    </tr>
                </thead>
                <tbody>
                    ${resultRows}
                </tbody>
            </table>
        </div>

        <div class="actions">
            <button class="btn btn-primary" id="replaceSelected">Replace Selected</button>
            <button class="btn btn-primary" id="replaceAll">Replace All</button>
            <button class="btn btn-secondary" id="reviewEach">Review Each</button>
            <button class="btn btn-secondary" id="cancel">Cancel</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            
            // Handle select all checkbox
            document.getElementById('selectAll').addEventListener('change', function(e) {
                const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
                updateSelectionCount();
            });

            // Handle individual checkboxes
            document.querySelectorAll('tbody input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', updateSelectionCount);
            });

            // Update selection count
            function updateSelectionCount() {
                const checked = document.querySelectorAll('tbody input[type="checkbox"]:checked').length;
                document.getElementById('selectionCount').textContent = checked;
            }

            // Handle preview buttons
            document.querySelectorAll('.preview-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.dataset.index);
                    vscode.postMessage({
                        command: 'preview',
                        index: index
                    });
                });
            });

            // Handle action buttons
            document.getElementById('replaceSelected').addEventListener('click', function() {
                const newValue = document.getElementById('newValue').value;
                const selectedIndices = Array.from(document.querySelectorAll('tbody input[type="checkbox"]:checked'))
                    .map(cb => parseInt(cb.dataset.index));
                
                if (selectedIndices.length === 0) {
                    alert('Please select at least one item to replace.');
                    return;
                }
                
                vscode.postMessage({
                    command: 'replaceSelected',
                    newValue: newValue,
                    selectedIndices: selectedIndices
                });
            });

            document.getElementById('replaceAll').addEventListener('click', function() {
                const newValue = document.getElementById('newValue').value;
                vscode.postMessage({
                    command: 'replaceAll',
                    newValue: newValue
                });
            });

            document.getElementById('reviewEach').addEventListener('click', function() {
                const newValue = document.getElementById('newValue').value;
                vscode.postMessage({
                    command: 'reviewEach',
                    newValue: newValue
                });
            });

            document.getElementById('cancel').addEventListener('click', function() {
                vscode.postMessage({ command: 'cancel' });
            });
        </script>
    </body>
    </html>`;
}

/**
 * Preview a specific result by opening the file and highlighting the line
 * @param {Object} result - The search result to preview
 */
async function previewResult(result) {
    try {
        const doc = await vscode.workspace.openTextDocument(result.file);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        const position = new vscode.Position(result.line - 1, result.column - 1);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
        vscode.window.showErrorMessage(`Could not preview ${path.basename(result.file)}: ${error.message}`);
    }
}



/**
 * Debug function to log replace operation details
 * @param {Array} results - Array of search results
 * @param {string} newValue - The replacement value
 */
function debugReplaceOperation(results, newValue) {
    console.log('=== REPLACE OPERATION DEBUG ===');
    console.log(`New value: "${newValue}"`);
    console.log(`Total results: ${results.length}`);
    
    results.forEach((result, index) => {
        console.log(`Result ${index + 1}:`);
        console.log(`  File: ${result.file}`);
        console.log(`  Path: ${result.path}`);
        console.log(`  Key: "${result.key}"`);
        console.log(`  Line: ${result.line}`);
        console.log(`  Current value: ${JSON.stringify(result.value)}`);
        console.log(`  Full path: ${result.fullPath || 'N/A'}`);
    });
    console.log('=== END DEBUG ===');
}

/**
 * Performs batch replacement of all results
 * @param {Array} results - Array of search results
 * @param {string} newValue - The replacement value
 */
async function performBatchReplace(results, newValue) {
    // Debug the operation
    debugReplaceOperation(results, newValue);
    
    const changesByFile = {};
    
    // Group changes by file
    results.forEach(result => {
        if (!changesByFile[result.file]) {
            changesByFile[result.file] = [];
        }
        changesByFile[result.file].push(result);
    });

    let totalChanges = 0;
    const errors = [];

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Replacing YAML values...',
        cancellable: false
    }, async (progress) => {
        const files = Object.keys(changesByFile);
        
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            const fileResults = changesByFile[filePath];
            
            progress.report({
                message: `Processing ${path.basename(filePath)} (${i + 1}/${files.length})`,
                increment: (100 / files.length)
            });

            try {
                const changes = await replaceInFile(filePath, fileResults, newValue);
                totalChanges += changes;
            } catch (error) {
                errors.push(`${path.basename(filePath)}: ${error.message}`);
            }
        }
    });

    // Show results
    if (errors.length > 0) {
        vscode.window.showWarningMessage(
            `Replaced ${totalChanges} occurrences. ${errors.length} files had errors.`,
            'Show Errors'
        ).then(choice => {
            if (choice === 'Show Errors') {
                vscode.window.showErrorMessage(errors.join('\n'));
            }
        });
    } else {
        vscode.window.showInformationMessage(`Successfully replaced ${totalChanges} occurrences across ${Object.keys(changesByFile).length} files.`);
    }
}

/**
 * Performs replacement with individual review
 * @param {Array} results - Array of search results
 * @param {string} newValue - The replacement value
 */
async function performReviewReplace(results, newValue) {
    // Debug the operation
    debugReplaceOperation(results, newValue);
    
    let totalChanges = 0;
    let currentIndex = 0;

    for (const result of results) {
        currentIndex++;
        
        // Open the file and show the location
        const doc = await vscode.workspace.openTextDocument(result.file);
        const editor = await vscode.window.showTextDocument(doc);
        const position = new vscode.Position(result.line - 1, result.column - 1);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));

        // Ask user for action
        const action = await vscode.window.showWarningMessage(
            `Replace "${result.path}" in ${path.basename(result.file)}?\nCurrent: ${JSON.stringify(result.value)}\nNew: ${JSON.stringify(newValue)}\n\n(${currentIndex}/${results.length})`,
            'Replace', 'Skip', 'Replace All Remaining', 'Cancel'
        );

        if (action === 'Replace') {
            try {
                const changes = await replaceInFile(result.file, [result], newValue);
                totalChanges += changes;
            } catch (error) {
                vscode.window.showErrorMessage(`Error replacing in ${path.basename(result.file)}: ${error.message}`);
            }
        } else if (action === 'Replace All Remaining') {
            // Replace current and all remaining
            const remaining = results.slice(currentIndex - 1);
            const changesByFile = {};
            remaining.forEach(r => {
                if (!changesByFile[r.file]) {
                    changesByFile[r.file] = [];
                }
                changesByFile[r.file].push(r);
            });

            for (const [filePath, fileResults] of Object.entries(changesByFile)) {
                try {
                    const changes = await replaceInFile(filePath, fileResults, newValue);
                    totalChanges += changes;
                } catch (error) {
                    vscode.window.showErrorMessage(`Error replacing in ${path.basename(filePath)}: ${error.message}`);
                }
            }
            break;
        } else if (action === 'Cancel') {
            break;
        }
        // Skip continues to next iteration
    }

    if (totalChanges > 0) {
        vscode.window.showInformationMessage(`Successfully replaced ${totalChanges} occurrences.`);
    }
}

/**
 * Replaces values in a specific file
 * @param {string} filePath - Path to the file
 * @param {Array} results - Array of search results for this file
 * @param {string} newValue - The replacement value
 * @returns {Promise<number>} Number of changes made
 */
async function replaceInFile(filePath, results, newValue) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let changes = 0;

        console.log(`Replacing in file: ${filePath}, ${results.length} results, new value: "${newValue}"`);

        // Sort results by line number in descending order to avoid offset issues
        results.sort((a, b) => b.line - a.line);

        // Process each replacement
        for (const result of results) {
            try {
                const lineIndex = result.line - 1;
                console.log(`Processing result: line ${result.line}, key: "${result.key}", value: ${JSON.stringify(result.value)}`);
                
                // Validate line index
                if (lineIndex < 0 || lineIndex >= lines.length) {
                    console.warn(`Line index ${lineIndex} out of bounds for file ${filePath} (${lines.length} lines)`);
                    continue;
                }

                const line = lines[lineIndex];
                
                // Validate line content
                if (typeof line !== 'string') {
                    console.warn(`Line ${result.line} is not a string: ${typeof line}`);
                    continue;
                }

                console.log(`Original line ${result.line}: "${line}"`);
                
                // Create a more flexible pattern to match the key
                const keyName = result.key || '';
                if (!keyName) {
                    console.warn(`No key name found for result at line ${result.line}`);
                    continue;
                }

                // Escape the key name for regex
                const escapedKey = escapeRegExp(keyName);
                
                // Try multiple patterns to find the key
                const patterns = [
                    // Standard YAML: "key: value"
                    new RegExp(`^(\\s*${escapedKey}\\s*:)\\s*(.*)$`),
                    // With quotes: "key": "value" or 'key': 'value'
                    new RegExp(`^(\\s*['"']?${escapedKey}['"']?\\s*:)\\s*(.*)$`),
                    // More flexible: any whitespace around key and colon
                    new RegExp(`^(\\s*.*${escapedKey}.*\\s*:)\\s*(.*)$`)
                ];

                let match = null;
                let matchedPattern = null;

                for (const pattern of patterns) {
                    match = line.match(pattern);
                    if (match) {
                        matchedPattern = pattern;
                        break;
                    }
                }
                
                if (match) {
                    console.log(`Found match with pattern, groups:`, match);
                    
                    // Determine the appropriate format for the new value
                    let formattedNewValue = newValue;
                    
                    // Try to preserve the original format (quoted/unquoted, etc.)
                    const originalValue = match[2] ? match[2].trim() : '';
                    
                    if (originalValue.startsWith("'") && originalValue.endsWith("'")) {
                        // Single quoted
                        formattedNewValue = `'${newValue.replace(/'/g, "''")}'`;
                    } else if (originalValue.startsWith('"') && originalValue.endsWith('"')) {
                        // Double quoted
                        formattedNewValue = `"${newValue.replace(/"/g, '\\"')}"`;
                    } else if (originalValue === 'true' || originalValue === 'false') {
                        // Boolean values
                        formattedNewValue = ['true', 'yes', '1'].includes(newValue.toLowerCase()) ? 'true' : 'false';
                    } else if (!isNaN(originalValue) && !isNaN(newValue)) {
                        // Numeric values
                        formattedNewValue = newValue;
                    } else {
                        // Default format - add quotes if needed
                        if (newValue.includes(' ') || newValue.includes(':') || newValue.includes('#') || newValue.includes('\n')) {
                            formattedNewValue = `'${newValue.replace(/'/g, "''")}'`;
                        }
                    }
                    
                    const newLine = line.replace(matchedPattern, `$1 ${formattedNewValue}`);
                    console.log(`New line ${result.line}: "${newLine}"`);
                    
                    lines[lineIndex] = newLine;
                    changes++;
                } else {
                    console.warn(`No pattern matched for key "${keyName}" on line ${result.line}: "${line}"`);
                }
            } catch (resultError) {
                console.error(`Error processing result at line ${result.line}:`, resultError);
                continue;
            }
        }

        if (changes > 0) {
            console.log(`Writing ${changes} changes to ${filePath}`);
            fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        } else {
            console.log(`No changes made to ${filePath}`);
        }

        return changes;
        
    } catch (error) {
        console.error(`Error in replaceInFile for ${filePath}:`, error);
        throw new Error(`Failed to replace in ${path.basename(filePath)}: ${error.message}`);
    }
}

/**
 * Escapes special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates smart display names for files, showing parent directory when there are duplicates
 * @param {Array} results - Array of search results
 * @returns {Object} Map of file paths to display names
 */
function createSmartDisplayNames(results) {
    const fileNames = {};
    const displayNames = {};
    
    // First pass: count occurrences of each filename
    results.forEach(result => {
        const fileName = path.basename(result.file);
        if (!fileNames[fileName]) {
            fileNames[fileName] = [];
        }
        fileNames[fileName].push(result.file);
    });
    
    // Second pass: create display names
    Object.keys(fileNames).forEach(fileName => {
        const filePaths = fileNames[fileName];
        
        if (filePaths.length === 1) {
            // No duplicates, just use filename
            displayNames[filePaths[0]] = fileName;
        } else {
            // Multiple files with same name, show parent directory
            filePaths.forEach(filePath => {
                const pathParts = filePath.split(path.sep);
                const parentDir = pathParts[pathParts.length - 2] || '';
                displayNames[filePath] = parentDir ? `${parentDir}/${fileName}` : fileName;
            });
        }
    });
    
    return displayNames;
}

/**
 * Gets a smart display name for a file path, considering duplicates in the result set
 * @param {string} filePath - The full file path
 * @param {Array} allResults - All search results for context
 * @returns {string} Smart display name
 */
function getSmartDisplayName(filePath, allResults) {
    const displayNames = createSmartDisplayNames(allResults);
    return displayNames[filePath] || path.basename(filePath);
}

/**
 * Main search function
 * @param {string} searchKey - The key to search for
 */
async function searchYamlKey(searchKey) {
    if (!searchKey || !searchKey.trim()) {
        vscode.window.showErrorMessage('Please provide a key to search for');
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Searching for YAML key: ${searchKey}`,
        cancellable: true
    }, async (progress, token) => {
        try {
            let allResults = [];
            
            for (const folder of workspaceFolders) {
                try {
                    const yamlFiles = await findYamlFiles(folder.uri.fsPath);
                    console.log(`Found ${yamlFiles.length} YAML files in ${folder.uri.fsPath}`);
                    
                    for (let i = 0; i < yamlFiles.length; i++) {
                        if (token.isCancellationRequested) {
                            return;
                        }
                        
                        try {
                            progress.report({
                                message: `Searching ${path.basename(yamlFiles[i])} (${i + 1}/${yamlFiles.length})`,
                                increment: (100 / yamlFiles.length)
                            });
                            
                            const results = await searchKeyInFile(yamlFiles[i], searchKey);
                            allResults = allResults.concat(results);
                        } catch (fileError) {
                            console.warn(`Error searching file ${yamlFiles[i]}:`, fileError.message);
                            // Continue with next file instead of failing completely
                        }
                    }
                } catch (folderError) {
                    console.warn(`Error searching folder ${folder.uri.fsPath}:`, folderError.message);
                    // Continue with next folder
                }
            }
            
            // Sort results: exact matches first, then by file name
            allResults.sort((a, b) => {
                if (a.isExactMatch && !b.isExactMatch) return -1;
                if (!a.isExactMatch && b.isExactMatch) return 1;
                return a.file.localeCompare(b.file);
            });
            
            showSearchResults(allResults, searchKey, false);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching YAML files: ${error.message}`);
        }
    });
}

/**
 * Main find and replace function
 * @param {string} searchKey - The key to search for
 */
async function findAndReplaceYamlKey(searchKey) {
    if (!searchKey || !searchKey.trim()) {
        vscode.window.showErrorMessage('Please provide a key to search for');
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Searching for YAML key: ${searchKey}`,
        cancellable: true
    }, async (progress, token) => {
        try {
            let allResults = [];
            
            for (const folder of workspaceFolders) {
                try {
                    const yamlFiles = await findYamlFiles(folder.uri.fsPath);
                    console.log(`Found ${yamlFiles.length} YAML files in ${folder.uri.fsPath}`);
                    
                    for (let i = 0; i < yamlFiles.length; i++) {
                        if (token.isCancellationRequested) {
                            return;
                        }
                        
                        try {
                            progress.report({
                                message: `Searching ${path.basename(yamlFiles[i])} (${i + 1}/${yamlFiles.length})`,
                                increment: (100 / yamlFiles.length)
                            });
                            
                            const results = await searchKeyInFile(yamlFiles[i], searchKey);
                            allResults = allResults.concat(results);
                        } catch (fileError) {
                            console.warn(`Error searching file ${yamlFiles[i]}:`, fileError.message);
                        }
                    }
                } catch (folderError) {
                    console.warn(`Error searching folder ${folder.uri.fsPath}:`, folderError.message);
                }
            }
            
            // Sort results: exact matches first, then by file name
            allResults.sort((a, b) => {
                if (a.isExactMatch && !b.isExactMatch) return -1;
                if (!a.isExactMatch && b.isExactMatch) return 1;
                return a.file.localeCompare(b.file);
            });
            
            showSearchResults(allResults, searchKey, true);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error searching YAML files: ${error.message}`);
        }
    });
}

/**
 * Activates the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Enhanced telemetry error suppression
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.error = (...args) => {
        const message = args.join(' ');
        if (message.includes('instrumentation key') || 
            message.includes('telemetry') || 
            message.includes('ApplicationInsights')) {
            return; // Suppress telemetry errors completely
        }
        originalConsoleError.apply(console, args);
    };
    
    console.warn = (...args) => {
        const message = args.join(' ');
        if (message.includes('instrumentation key') || 
            message.includes('telemetry') || 
            message.includes('ApplicationInsights')) {
            return; // Suppress telemetry warnings
        }
        originalConsoleWarn.apply(console, args);
    };

    try {
        // Register the search command with enhanced keyboard workflow
        let searchCommand = vscode.commands.registerCommand('yamlKeySearch.searchKey', async () => {
        const editor = vscode.window.activeTextEditor;
        let selectedText = '';
        
        // Check if there's selected text to pre-fill
        if (editor && !editor.selection.isEmpty) {
            selectedText = editor.document.getText(editor.selection).trim();
        } else if (editor) {
            // If no selection, try to get word under cursor
            const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
            if (wordRange) {
                selectedText = editor.document.getText(wordRange).trim();
            }
        }
        
        const searchKey = await vscode.window.showInputBox({
            prompt: 'Enter YAML key path (e.g., database.connection.timeout)',
            placeHolder: 'key.subkey.property',
            value: selectedText, // Pre-fill with selected text
            valueSelection: selectedText ? [0, selectedText.length] : undefined // Select all pre-filled text
        });
        
        if (searchKey) {
            await searchYamlKey(searchKey.trim());
        }
    });

    // Register the search selected key command
    let searchSelectedCommand = vscode.commands.registerCommand('yamlKeySearch.searchSelectedKey', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            // No need to check file type - user knows they want to search YAML keys

            const selection = editor.selection;
            let searchKey = editor.document.getText(selection);
            
            if (!searchKey) {
                // If no selection, try to get the word under cursor
                const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
                if (wordRange) {
                    searchKey = editor.document.getText(wordRange);
                }
            }
            
            if (searchKey && searchKey.trim()) {
                await searchYamlKey(searchKey.trim());
            } else {
                vscode.window.showErrorMessage('No text selected or word under cursor');
            }
        } catch (error) {
            console.error('Error in searchSelectedKey command:', error);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    // Register the find and replace command with enhanced keyboard workflow
    let findReplaceCommand = vscode.commands.registerCommand('yamlKeySearch.findAndReplace', async () => {
        const editor = vscode.window.activeTextEditor;
        let selectedText = '';
        
        // Check if there's selected text to pre-fill
        if (editor && !editor.selection.isEmpty) {
            selectedText = editor.document.getText(editor.selection).trim();
        } else if (editor) {
            // If no selection, try to get word under cursor
            const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
            if (wordRange) {
                selectedText = editor.document.getText(wordRange).trim();
            }
        }
        
        const searchKey = await vscode.window.showInputBox({
            prompt: 'Enter YAML key path to find and replace (e.g., database.connection.timeout)',
            placeHolder: 'key.subkey.property',
            value: selectedText, // Pre-fill with selected text
            valueSelection: selectedText ? [0, selectedText.length] : undefined // Select all pre-filled text
        });
        
        if (searchKey) {
            await findAndReplaceYamlKey(searchKey.trim());
        }
    });

    // Register the find and replace selected key command
    let findReplaceSelectedCommand = vscode.commands.registerCommand('yamlKeySearch.findAndReplaceSelected', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            // No need to check file type - user knows they want to search YAML keys

            const selection = editor.selection;
            let searchKey = editor.document.getText(selection);
            
            if (!searchKey) {
                // If no selection, try to get the word under cursor
                const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
                if (wordRange) {
                    searchKey = editor.document.getText(wordRange);
                }
            }
            
            if (searchKey && searchKey.trim()) {
                await findAndReplaceYamlKey(searchKey.trim());
            } else {
                vscode.window.showErrorMessage('No text selected or word under cursor');
            }
        } catch (error) {
            console.error('Error in findAndReplaceSelected command:', error);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    // Register the configure exclusions command
    let configureExclusionsCommand = vscode.commands.registerCommand('yamlKeySearch.configureExclusions', async () => {
        try {
            // Open the settings UI focused on YAML Key Search extension
            await vscode.commands.executeCommand('workbench.action.openSettings', 'yamlKeySearch');
            
            // Show an information message with guidance
            vscode.window.showInformationMessage(
                'Configure "Exclude Patterns" and "Include Patterns" to customize which YAML files are searched.',
                'Open Settings JSON'
            ).then(selection => {
                if (selection === 'Open Settings JSON') {
                    vscode.commands.executeCommand('workbench.action.openSettingsJson');
                }
            });
        } catch (error) {
            console.error('Error opening settings:', error);
            vscode.window.showErrorMessage(`Error opening settings: ${error.message}`);
        }
    });

        context.subscriptions.push(searchCommand, searchSelectedCommand, findReplaceCommand, findReplaceSelectedCommand, configureExclusionsCommand);
        
        // Restore original console methods on deactivation
        context.subscriptions.push({
            dispose: () => {
                console.error = originalConsoleError;
                console.warn = originalConsoleWarn;
            }
        });
        
    } catch (error) {
        console.error('Error activating YAML Key Search extension:', error);
        vscode.window.showErrorMessage(
            `YAML Key Search: Extension activation failed. ${error.message}. Try reloading the window (Cmd+R).`
        );
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}; 