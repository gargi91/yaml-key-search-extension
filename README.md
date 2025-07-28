# YAML Key Search Extension

A VS Code/Cursor extension that helps you quickly locate YAML keys across all YAML files in your workspace using dot notation.

## Features

- 🔍 **Search YAML keys using dot notation** (e.g., `database.connection.timeout`)
- 📁 **Search across all YAML files** in your workspace (`.yml` and `.yaml` files)
- 🎯 **Multiple search methods**:
  - Manual key entry via command palette or keyboard shortcut
  - Right-click context menu (works with selected text or word under cursor)
- 📍 **Precise navigation** - Jump directly to the key location in the file
- 🏷️ **Smart matching** - Shows both exact matches and partial matches
- 📖 **Multi-document support** - Handles YAML files with multiple documents (separated by `---`)
- 🚀 **Progress tracking** - Visual progress indicator during search

## Usage

### Method 1: Manual Key Entry

1. Press `Cmd+Shift+Y` (Mac) or `Ctrl+Shift+Y` (Windows/Linux)
2. Or open Command Palette (`Cmd+Shift+P`) and search for "Search YAML Key"
3. Enter your key path using dot notation (e.g., `database.connection.timeout`)
4. Select from the search results to navigate to the key location

### Method 2: Right-Click Search

**Option A: With Selected Text**
1. Select any text that represents a key path
2. Right-click and select "Search Selected YAML Key"
3. The extension will search for that selected text

**Option B: Word Under Cursor (No Selection)**
1. Place your cursor on any word (without selecting it)
2. Right-click and select "Search Selected YAML Key"  
3. The extension will automatically search for the word under cursor

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
| `yamlKeySearch.searchKey` | `Cmd+Shift+Y` (Mac), `Ctrl+Shift+Y` (Win/Linux) | Open input box to enter key path manually |
| `yamlKeySearch.searchSelectedKey` | Available in right-click context menu | Search for selected text or automatically pick word under cursor |

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

### Example 1: Exact Match
Search: `database.connection.timeout`
Result: Finds the exact key and shows its value (`30`)

### Example 2: Partial Match
Search: `enabled`
Result: Finds all keys containing "enabled" like:
- `server.ssl.enabled`
- `api.auth.enabled`
- `features.notifications.enabled`

### Example 3: Parent Key
Search: `database`
Result: Shows the parent key and all its nested children

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
- Consider excluding large directories if needed

## Changelog

### v1.0.0
- Initial release
- Basic YAML key search functionality
- Support for dot notation key paths
- Right-click context menu integration
- Multi-document YAML support 