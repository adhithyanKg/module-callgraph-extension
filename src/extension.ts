import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

interface FunctionDef {
    name: string;
    module: string;
    start: number;
}

interface Edge {
    fromModule: string;
    toModule: string;
    functions: string[];
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('moduleCallGraph.generate', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            vscode.window.showErrorMessage('Open a project first');
            return;
        }

        // Ask user to select folder to scan
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select folder to scan for modules'
        });

        if (!folderUri || folderUri.length === 0) {
            vscode.window.showErrorMessage('No folder selected');
            return;
        }

        const selectedFolder = folderUri[0].fsPath;
        const files = walkFiles(selectedFolder, ['.c', '.cpp', '.hpp', '.h']);
        if (files.length === 0) {
            vscode.window.showWarningMessage('No C/C++ source files found in selected folder');
            return;
        }

        const defs = new Map<string, FunctionDef>();
        const fileFuncMap = new Map<string, FunctionDef[]>();

        // Collect all function definitions
        for (const file of files) {
            const text = fs.readFileSync(file, 'utf8');
            const funcs: FunctionDef[] = [];
            const fileName = path.basename(file, path.extname(file));

            const funcRegex = /(?:void|int|float|double|char|bool|static)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:{)?/g;
            let match: RegExpExecArray | null;
            while ((match = funcRegex.exec(text)) !== null) {
                const funcDef: FunctionDef = { name: match[1], module: fileName, start: match.index };
                funcs.push(funcDef);
                defs.set(funcDef.name, funcDef);
            }

            fileFuncMap.set(file, funcs);
        }

        // Collect unique function call edges
        const edgesMap = new Map<string, Edge>();

        for (const file of files) {
            const text = fs.readFileSync(file, 'utf8');
            const noComments = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const funcsInFile = fileFuncMap.get(file)!;
            const moduleName = path.basename(file, path.extname(file));

            const callRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
            let match: RegExpExecArray | null;

            while ((match = callRegex.exec(noComments)) !== null) {
                const matchIndex = match.index;
                const calleeName = match[1];

                let callerFunc = funcsInFile.filter(f => f.start <= matchIndex).slice(-1)[0];
                if (!callerFunc) callerFunc = { name: '<module>', module: moduleName, start: 0 };

                const calleeDef = defs.get(calleeName);
                if (!calleeDef) continue;
                if (callerFunc.module === calleeDef.module) continue;

                const key = `${callerFunc.module}->${calleeDef.module}`;
                if (!edgesMap.has(key)) edgesMap.set(key, { fromModule: callerFunc.module, toModule: calleeDef.module, functions: [] });

                const edge = edgesMap.get(key)!;
                if (!edge.functions.includes(calleeName)) edge.functions.push(calleeName);
            }
        }

        // Build Mermaid diagram
        let mermaid = "flowchart LR\n";
        const moduleNames = Array.from(new Set(Array.from(defs.values()).map(d => d.module)));
        moduleNames.forEach(mod => { mermaid += `${mod}["${mod}"]\n`; });

        edgesMap.forEach(edge => {
            const stackedFunctions = edge.functions.join("\\n");
            mermaid += `${edge.fromModule} -->|${stackedFunctions}| ${edge.toModule}\n`;
        });

        const panel = vscode.window.createWebviewPanel(
            'moduleCallGraph',
            'Module Call Graph',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const mermaidLocal = panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(context.extensionPath, 'media', 'mermaid.min.js'))
        );

        panel.webview.html = getWebviewContent(mermaid, mermaidLocal);

        panel.webview.onDidReceiveMessage(async (message: any) => {
            if (!['exportPNG', 'exportJPEG', 'exportPDF'].includes(message.command)) return;
            const extMap: any = { exportPNG: 'png', exportJPEG: 'jpeg', exportPDF: 'pdf' };
            const type = extMap[message.command];

            const uri = await vscode.window.showSaveDialog({
                saveLabel: 'Save Module Call Graph',
                filters: { [type.toUpperCase()]: [type] }
            });
            if (!uri) return;

            const tmpHtmlPath = await createTempHtml(message.svg, context.extensionPath);
            await exportDiagramPuppeteer(tmpHtmlPath, uri.fsPath, type as 'png' | 'jpeg' | 'pdf');

            fs.unlinkSync(tmpHtmlPath);
            vscode.window.showInformationMessage(`Saved ${uri.fsPath}`);
        });
    });

    context.subscriptions.push(disposable);
}

// Walk folder and collect files
function walkFiles(dir: string, exts: string[]): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) results = results.concat(walkFiles(filePath, exts));
        else if (exts.includes(path.extname(file))) results.push(filePath);
    });
    return results;
}

// Generate temporary HTML with SVG for Puppeteer
async function createTempHtml(svgContent: string, contextPath: string): Promise<string> {
    const tmpHtmlPath = path.join(contextPath, 'tmp_diagram.html');
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
body { margin:0; padding:0; }
svg { width: 100%; height: 100%; }
</style>
</head>
<body>
${svgContent}
</body>
</html>`;
    fs.writeFileSync(tmpHtmlPath, htmlContent, 'utf8');
    return tmpHtmlPath;
}

// Puppeteer export function
async function exportDiagramPuppeteer(tmpHtmlPath: string, savePath: string, type: 'png' | 'jpeg' | 'pdf') {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('file://' + tmpHtmlPath, { waitUntil: 'networkidle0' });
    await page.waitForSelector('svg');

    if (type === 'pdf') {
        // Simply print the existing HTML with the SVG
        await page.pdf({
            path: savePath,
            format: 'A4',
            printBackground: true,
            margin: { top: 50, bottom: 50, left: 50, right: 50 }
        });
    } else {
        const element = await page.$('svg');
        if (element) {
            const box = await element.boundingBox();
            if (box) {
                const scale = 4;
                await page.setViewport({
                    width: Math.ceil(box.width * scale),
                    height: Math.ceil(box.height * scale),
                });
                const screenshotPath = (savePath.endsWith(`.${type}`) ? savePath : `${savePath}.${type}`) as `${string}.${"png" | "jpeg"}`;

                await element.screenshot({
                    path: screenshotPath,
                    type: type as "png" | "jpeg",
                    clip: { x: 0, y: 0, width: Math.ceil(box.width * scale), height: Math.ceil(box.height * scale) }
                });


            }
        }
    }

    await browser.close();
}

// Webview HTML
function getWebviewContent(mermaid: string, mermaidScript: vscode.Uri): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script src="${mermaidScript}"></script>
<script>
    const vscode = acquireVsCodeApi();
    mermaid.initialize({ startOnLoad: true, theme: "default", flowchart: { curve: "linear" } });
</script>
<style>
body { margin:0; padding:10px; }
.container { width: 100%; height: 100vh; overflow:auto; }
.mermaid { max-width:2000px; max-height:2000px; }
.button-container { position:fixed; top:10px; right:10px; z-index:10; }
.button-container button { display:block; margin-bottom:5px; }
</style>
</head>
<body>
<div class="button-container">
    <button onclick="zoom(1.2)">Zoom In</button>
    <button onclick="zoom(0.8)">Zoom Out</button>
    <button onclick="exportDiagram('exportPNG')">Export PNG</button>
    <button onclick="exportDiagram('exportJPEG')">Export JPEG</button>
    <button onclick="exportDiagram('exportPDF')">Export PDF</button>
</div>
<div class="container">
    <div class="mermaid">${mermaid}</div>
</div>
<script>
let scale = 1;
function zoom(factor) {
    scale *= factor;
    document.querySelector('.mermaid').style.transform = 'scale(' + scale + ')';
    document.querySelector('.mermaid').style.transformOrigin = '0 0';
}
function exportDiagram(type) {
    const svg = document.querySelector('.mermaid svg');
    if (!svg) return;
    const svgContent = new XMLSerializer().serializeToString(svg);
    vscode.postMessage({ command: type, svg: svgContent });
}
</script>
</body>
</html>
`;
}

export function deactivate() { }
