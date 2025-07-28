# YAML Key Search & Replace Extension

A powerful VS Code/Cursor extension that helps you search, navigate, and replace YAML keys across all YAML files in your workspace using dot notation.

## Features

### 🔍 **Search & Navigation**
- **Search YAML keys using dot notation** (e.g., `database.connection.timeout`)
- **Search across all YAML files** in your workspace (`.yml` and `.yaml` files)
- **Multiple search methods**:
  - Manual key entry via command palette or keyboard shortcut
  - Right-click context menu (works with selected text or word under cursor)
- **Precise navigation** - Jump directly to the key location in the file
- **Smart matching** - Shows both exact matches and partial matches

### 🔄 **Find & Replace (NEW in v2.0)**
- **Professional UI** - Clean webview modal interface for complex operations
- **Bulk value replacement** - Replace values for the same key across multiple files
- **Interactive table view** - See all results with checkboxes for selective replacement
- **Preview functionality** - Click to preview each match in the editor
- **Smart value formatting** - Preserves original format (quoted, boolean, numeric)
- **Value grouping** - Shows summary of different values for the same key
- **Progress tracking** - Visual feedback during bulk operations
- **Error handling** - Graceful handling of file errors with detailed reporting

### 🛠️ **Advanced Features**
- **Smart keyboard workflow** - Auto-fills selected text when using keyboard shortcuts
- **Intelligent file naming** - Shows parent directory for duplicate filenames
- **Multi-document support** - Handles YAML files with multiple documents (separated by `---`)
- **Progress tracking** - Visual progress indicator during operations
- **Undo-friendly** - Works with VS Code's built-in undo system
- **File backup** - Original formatting and structure preserved
- **Safety features** - Confirmation dialogs and preview before bulk changes

### ⚙️ **File Exclusion & Filtering (NEW in v2.2)**
- **Configurable exclusion patterns** - Exclude directories like `test/`, `node_modules/`, etc.
- **Smart defaults** - Pre-configured to exclude common build and test directories
- **Custom include patterns** - Define which files to search
- **Performance optimization** - Avoid searching irrelevant files
- **Easy configuration** - Built-in command to open settings

## Usage

### 🔍 **Search Only**

#### Method 1: Manual Key Search (Enhanced in v2.1!)
1. **Select any text** in your editor (optional but recommended)
2. Press `Cmd+Shift+Y` (Mac) or `Ctrl+Shift+Y` (Windows/Linux)
3. **Selected text auto-fills** the search input - just press Enter to search!
4. Or modify the search term and press Enter
5. Select from the search results to navigate to the key location

**💡 Pro Tip**: Select `database.connection.timeout` → Press `Cmd+Shift+Y` → Press `Enter` = Instant search!

#### Method 2: Right-Click Search
**Option A: With Selected Text**
1. Select any text that represents a key path
2. Right-click and select "Search Selected YAML Key"
3. The extension will search for that selected text

**Option B: Word Under Cursor (No Selection)**
1. Place your cursor on any word (without selecting it)
2. Right-click and select "Search Selected YAML Key"  
3. The extension will automatically search for the word under cursor

### 🔄 **Find & Replace (NEW!)**

#### Method 3: Manual Find & Replace (Enhanced in v2.1!)
1. **Select any text** in your editor (optional but recommended)
2. Press `Cmd+Shift+H` (Mac) or `Ctrl+Shift+H` (Windows/Linux)
3. **Selected text auto-fills** the search input - press Enter or modify as needed
4. **Professional UI opens** with all results in a clean table view

**💡 Pro Tip**: Select `enabled` → Press `Cmd+Shift+H` → Press `Enter` = Instant find & replace!

#### Method 4: Right-Click Find & Replace
1. Select text or place cursor on a key
2. Right-click and select "Find and Replace Selected YAML Key"
3. **Interactive modal** opens with the webview interface

### 📊 **Replacement Workflow**

The **webview modal** provides a professional interface with:

1. **Search Results Summary**: See all occurrences grouped by current value
2. **Interactive Table**: 
   - ✅ **Checkboxes** - Select which items to replace
   - 👁️ **Preview buttons** - Click to view each match in the editor  
   - 📁 **Smart file names** - Shows parent directory when filenames are duplicated (NEW in v2.1!)
   - 📍 **File information** - Complete file path, line number
   - 🔧 **Current values** - See existing values before replacement
3. **Replacement Input**: Enter new value with smart formatting
4. **Action Buttons**:
   - **Replace Selected** - Replace only checked items
   - **Replace All** - Replace all occurrences  
   - **Review Each** - Step-by-step replacement (classic mode)
   - **Cancel** - Close without changes

## Key Path Format

The extension expects dot notation for nested YAML keys:

```yaml
# For this YAML structure:
database:
  connection:
    host: 'localhost'
    port: 5432
    timeout: 30
  pool:
    max-connections: 10
server:
  port: 8080
  ssl:
    enabled: true

# Search using these paths:
- database
- database.connection
- database.connection.host
- database.connection.port
- database.connection.timeout
- database.pool.max-connections
- server.port
- server.ssl.enabled
```

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open the folder in VS Code/Cursor
3. Run `npm install` to install dependencies
4. Press `F5` to launch a new Extension Development Host window
5. Test the extension in the new window

### Packaging for Distribution

1. Install `vsce` (Visual Studio Code Extension CLI):
   ```bash
   npm install -g vsce
   ```

2. Package the extension:
   ```bash
   vsce package
   ```

3. Install the generated `.vsix` file:
   ```bash
   code --install-extension yaml-key-search-1.0.0.vsix
   ```

## Commands

| Command | Keyboard Shortcut | Description |
|---------|------------------|-------------|
| `yamlKeySearch.searchKey` | `Cmd+Shift+Y` (Mac), `Ctrl+Shift+Y` (Win/Linux) | Search for key path (navigation only) |
| `yamlKeySearch.searchSelectedKey` | Available in right-click context menu | Search for selected text or word under cursor |
| `yamlKeySearch.findAndReplace` | `Cmd+Shift+H` (Mac), `Ctrl+Shift+H` (Win/Linux) | Find and replace key values across workspace |
| `yamlKeySearch.findAndReplaceSelected` | Available in right-click context menu | Find and replace selected text or word under cursor |

## Configuration

The extension works out of the box with no configuration needed. It automatically:

- Searches all `.yml` and `.yaml` files in your workspace
- Ignores `node_modules` and `.git` directories
- Handles multi-document YAML files
- Provides both exact and partial matches

## Supported File Types

- `.yml` files
- `.yaml` files
- Multi-document YAML files (with `---` separators)

## Search Results

Results are displayed in a Quick Pick menu showing:

- 📁 **File name** with file icon
- 🔗 **Full key path** in dot notation
- 📍 **Line number** and **value** of the key
- 🎯 **Match type** (Exact Match or Partial Match)

Results are sorted with exact matches first, followed by partial matches.

## Examples

### 🔍 **Search Examples**

#### Example 1: Exact Match
Search: `database.connection.timeout`
Result: Finds the exact key and shows its value (`30`)

#### Example 2: Partial Match
Search: `enabled`
Result: Finds all keys containing "enabled" like:
- `server.ssl.enabled`
- `api.auth.enabled`
- `features.notifications.enabled`

#### Example 3: Parent Key
Search: `database`
Result: Shows the parent key and all its nested children

### 🔄 **Find & Replace Examples**

#### Example 4: Environment Switch
**Scenario**: Change all database hosts from `localhost` to `production-db`
1. Find & Replace: `database.connection.host`
2. Current values: `localhost` (3 files), `dev-db` (1 file)  
3. New value: `production-db`
4. Choose "Replace All" → 4 files updated instantly

#### Example 5: Feature Flag Toggle
**Scenario**: Enable notifications across all services
1. Find & Replace: `enabled` (partial match)
2. Results: `features.notifications.enabled`, `api.alerts.enabled`, etc.
3. Review each occurrence individually
4. Replace only notification-related flags

#### Example 6: Configuration Update
**Scenario**: Update timeout values for better performance
1. Find & Replace: `timeout`
2. See current values: `30` (2 files), `60` (1 file), `120` (1 file)
3. Preview all locations before deciding
4. Replace selectively based on service requirements

### 🚀 **Workflow Examples (NEW in v2.1)**

#### Example 7: Lightning-Fast Search
**Old Workflow**: Right-click → Search Selected → Select result (3+ clicks)
**New Workflow**: Select text → `Cmd+Shift+Y` → `Enter` (2 keystrokes!)
```
1. Select "database.connection.timeout" in your code
2. Press Cmd+Shift+Y (auto-fills the search)
3. Press Enter (instant search)
4. Click result to navigate
```

#### Example 8: Smart File Disambiguation  
**Problem**: Multiple `config.yml` files in different services
**Before**: `config.yml`, `config.yml`, `config.yml` (confusing!)
**After**: `auth/config.yml`, `api/config.yml`, `database/config.yml` (clear!)

## Safety & Undo

### 🔒 **Built-in Safety Features**
- **Confirmation dialogs** before bulk operations
- **Preview mode** to see all changes before applying
- **Individual review** option for careful replacement
- **Error isolation** - Failed files don't stop the entire operation
- **Smart formatting** - Preserves original YAML structure and quotes

### ↩️ **Undo & Recovery**
- **VS Code Undo**: All changes work with `Cmd+Z` / `Ctrl+Z`
- **File-by-file undo**: Each file can be undone independently
- **Format preservation**: Original formatting, comments, and structure maintained
- **No data loss**: Extension never deletes or corrupts existing content

### ⚠️ **Best Practices**
1. **Test first**: Use "Show Details" or "Review Each" for critical changes
2. **Backup important files**: Consider version control before bulk operations
3. **Start small**: Test with a few files before workspace-wide replacements
4. **Verify results**: Check a few files after bulk replacement

## Development

### Project Structure

```
yaml-key-search-extension/
├── package.json          # Extension manifest
├── extension.js          # Main extension code
├── README.md            # This file
└── config.yml           # Example configuration file for testing
```

### Key Functions

- `extractKeyPaths()` - Recursively extracts all key paths from parsed YAML
- `findYamlFiles()` - Discovers all YAML files in workspace
- `searchKeyInFile()` - Searches for key patterns in a specific file
- `showSearchResults()` - Displays results in VS Code Quick Pick

### Dependencies

- `yaml` - YAML parsing library
- `glob` - File pattern matching
- `vscode` - VS Code extension API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Configuration

### ⚙️ **File Exclusion Settings**

The extension allows you to configure which files and directories to include or exclude from searches.

#### Quick Configuration
1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Search for "Configure File Exclusions" 
3. Click the command to open extension settings

#### Manual Configuration
Add these settings to your VS Code settings:

```json
{
  "yamlKeySearch.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/target/**",
    "**/build/**",
    "**/dist/**",
    "**/out/**",
    "**/.vscode/**",
    "**/test/**",
    "**/tests/**",
    "**/*test*.yml",
    "**/*test*.yaml"
  ],
  "yamlKeySearch.includePatterns": [
    "**/*.yml",
    "**/*.yaml"
  ]
}
```

#### Pattern Examples
- `**/test/**` - Exclude all files in any `test` directory
- `**/*test*.yml` - Exclude any YAML file with "test" in the name
- `**/config/*.yaml` - Include only YAML files in `config` directories
- `**/production/**` - Exclude production configuration files

**💡 Pro Tip**: Use exclusion patterns to improve search performance in large codebases!

## License

MIT License - feel free to use and modify as needed.

## Troubleshooting

### No results found
- Ensure your key path uses dot notation
- Check that YAML files exist in your workspace
- Verify the key exists in your YAML files

### Extension not activating
- Make sure you're working in a workspace with YAML files
- Try reloading the window (`Cmd+R` or `Ctrl+R`)

### Performance issues
- The extension searches all YAML files in large workspaces
- **NEW**: Use the "Configure File Exclusions" command to exclude test directories, build folders, etc.
- Configure `yamlKeySearch.excludePatterns` in settings to skip irrelevant files

## Changelog

### v2.2.0 (Latest) - File Exclusion & Performance
- 🚀 **NEW: Configurable File Exclusions**
  - Configure which files and directories to exclude from searches
  - Smart defaults exclude test directories, build folders, and test files
  - Custom include patterns for precise file targeting
  - Built-in "Configure File Exclusions" command for easy setup
- ⚡ **Performance Improvements**
  - Skip irrelevant files using exclusion patterns
  - Optimized search performance in large codebases
  - Better handling of generated and temporary files
- 🐛 **Bug Fixes**
  - Fixed critical replace functionality bug where `key` was undefined
  - Improved error handling and debugging capabilities
  - More robust key property propagation through search results

### v2.1.0 - Workflow & UX Improvements
- 🚀 **Enhanced Keyboard Workflow**
  - Auto-fills selected text in search inputs (`Cmd+Shift+Y` and `Cmd+Shift+H`)
  - Word under cursor detection when no text is selected
  - Streamlined workflow: Select → Shortcut → Enter = Instant search
- 🎯 **Smart File Disambiguation**
  - Shows parent directory name when multiple files have the same name
  - Easier identification of files in large projects with duplicate names
  - Consistent across both search results and webview interface
- 💡 **Improved User Experience**
  - Reduced clicks from 3+ to 2 for common workflows
  - Better visual distinction between similar files
  - More intuitive keyboard-first workflows

### v2.0.0
- 🚀 **NEW: Find & Replace functionality**
  - Professional webview modal interface
  - Bulk value replacement across multiple files
  - Interactive table with checkboxes for selective replacement
  - Click-to-preview functionality for each match
  - Smart value formatting preservation
  - Value grouping and summary display
  - Progress tracking for bulk operations
  - Comprehensive error handling
- 🎯 **Enhanced UI**
  - Clean, professional webview interface
  - Table-based results display with sorting
  - Real-time selection count updates
  - Intuitive action buttons and controls
  - Better context menus and keyboard shortcuts
- 🛠️ **Technical improvements**
  - More robust file handling and error suppression
  - Better YAML parsing and value detection
  - Improved glob pattern filtering
  - Enhanced error recovery and logging

### v1.0.0
- Initial release
- Basic YAML key search functionality
- Support for dot notation key paths
- Right-click context menu integration
- Multi-document YAML support 