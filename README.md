# Module Call Graph for VS Code

Visualize function calls between C/C++ modules in your project directly in VS Code. Generate interactive call graphs with export options for **PNG, JPEG, and PDF**.

## Features

- **Automatic function parsing**: Scans `.c`, `.cpp`, `.hpp` and `.h` files to detect functions and their calls.  
- **Module-level call graph**: Visualizes cross-module function calls using **Mermaid** flowcharts.  
- **Interactive zoom**: Zoom in/out directly in the VS Code panel.  
- **Export support**: Export graphs to **PNG, JPEG, or PDF**.  
- **Clean UI**: Integrated buttons in a fixed panel for easy interactions.  

## Installation

1. Clone this repository:

```
git clone https://github.com/adhithyanKg/module-callgraph-extension
```

2. Open the folder in VS Code.

3. Install dependencies:

```
npm install
```

4. Compile TypeScript:

```
npm run compile
```

5. Press F5 to launch a new Extension Development Host and test the extension.

## Usage
1. Open a C/C++ project in VS Code.

2. Run the command:

```
Ctrl+Shift+P → Module Call Graph: Generate
```

3. Select the folder to scan for modules. 

4. Your module call graph will appear in a new panel.

5. Use the buttons to:
	Zoom In / Zoom Out
	Export PNG / JPEG / PDF

## Example

File Structure
```
    ├── module-callgraph-extension/
    │   ├── src/
    │   │   ├── extension.ts
    │   │   └── types
  	|		├──pdfkit.d.ts
    │   ├── media/
    │   │   ├── icon.png
    │   │   └── mermaid.min.js
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .gitignore
    |  	├── LICENSE
    │   └── README.md
```
## Dependencies

1. [VS Code Extension API](https://code.visualstudio.com/api)
2. [Mermaid](https://mermaid.js.org/) for graph rendering 
3. [Puppeteer](https://pptr.dev/) for exporting diagrams

## Contributing

1. Fork the repo.
2. Create a new branch:

```
git checkout -b <feature-name>
```

3. Make your changes.

4. Submit a pull request.

## License

Copyright © 2025 Adhithyan KG

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.