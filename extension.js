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
            key: key
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
        const pattern = path.join(workspacePath, '**/*.{yml,yaml}');
        glob(pattern, { 
            ignore: ['**/node_modules/**', '**/.git/**', '**/target/**', '**/build/**'],
            nodir: true,
            absolute: true
        }, (err, files) => {
            if (err) {
                reject(err);
            } else {
                // Filter out any files that don't actually exist or have invalid paths
                const validFiles = files.filter(file => {
                    try {
                        return fs.existsSync(file) && (file.endsWith('.yml') || file.endsWith('.yaml'));
                    } catch (error) {
                        console.warn(`Invalid file path: ${file}`);
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
 */
function showSearchResults(results, searchKey) {
    if (results.length === 0) {
        vscode.window.showInformationMessage(`No matches found for key: ${searchKey}`);
        return;
    }

    const items = results.map(result => ({
        label: `$(file) ${path.basename(result.file)}`,
        description: result.path,
        detail: `Line ${result.line}: ${JSON.stringify(result.value)} ${result.isExactMatch ? '(Exact Match)' : '(Partial Match)'}`,
        result: result
    }));

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
            
            showSearchResults(allResults, searchKey);
            
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
    // Register the search command
    let searchCommand = vscode.commands.registerCommand('yamlKeySearch.searchKey', async () => {
        const searchKey = await vscode.window.showInputBox({
            prompt: 'Enter YAML key path (e.g., database.connection.timeout)',
            placeHolder: 'key.subkey.property'
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

    context.subscriptions.push(searchCommand, searchSelectedCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}; 