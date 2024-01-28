import type { Disposable } from 'vscode'
import * as vscode from 'vscode'

const EXTENSION_NAME = 'vscode-auto-light-dark-theme'
const WORKBENCH_COLOR_THEME = 'workbench.colorTheme'
const WINDOW_AUTO_DETECT_COLOR_SCHEME = 'window.autoDetectColorScheme'
const WORKBENCH_PREFERRED_DARK_COLOR_THEME = 'workbench.preferredDarkColorTheme'
const WORKBENCH_PREFERRED_LIGHT_COLOR_THEME = 'workbench.preferredLightColorTheme'

const defaultOptions = {
    lightTheme: 'Light Modern',
    darkTheme: 'Dark Modern',
    autoToggle: true,
    toggleSetting: 'custom' as 'custom' | 'system',
    lightStartTime: 7,
    darkStartTime: 19,
    showToggleButton: true
}

function getOptions() {
    const userOptions = vscode.workspace.getConfiguration(EXTENSION_NAME)
    return {
        ...defaultOptions,
        ...userOptions
    }
}

function toggleTheme(meta: { mode: 'auto' | 'manual' }) {
    const options = getOptions()
    const settings = vscode.workspace.getConfiguration()
    let themeToChange: string | undefined
    if (meta.mode === 'auto') {
        const hour = new Date().getHours()
        if (hour >= +options.lightStartTime && hour < +options.darkStartTime) {
            themeToChange = options.lightTheme
        } else {
            themeToChange = options.darkTheme
        }
    } else {
        themeToChange =
            settings.get(WORKBENCH_COLOR_THEME) === options.darkTheme
                ? options.lightTheme
                : options.darkTheme
    }

    if (themeToChange) {
        settings.update(WORKBENCH_COLOR_THEME, themeToChange, true)
    }
}

async function initializeToggling(context: vscode.ExtensionContext) {
    const options = getOptions()
    const settings = vscode.workspace.getConfiguration()
    let intervalDisposable: Disposable | undefined

    if (options.autoToggle) {
        if (options.toggleSetting === 'custom') {
            if (settings.get(WINDOW_AUTO_DETECT_COLOR_SCHEME)) {
                await settings.update(WINDOW_AUTO_DETECT_COLOR_SCHEME, false, true)
            }
            toggleTheme({ mode: 'auto' })
            const id = setInterval(() => toggleTheme({ mode: 'auto' }), 30 * 1000)
            intervalDisposable = new vscode.Disposable(() => clearInterval(id))
        } else if (options.toggleSetting === 'system') {
            const autoDetect = settings.get(WINDOW_AUTO_DETECT_COLOR_SCHEME)
            if (!autoDetect) {
                await settings.update(
                    WORKBENCH_PREFERRED_LIGHT_COLOR_THEME,
                    options.lightTheme,
                    true
                )
                await settings.update(WORKBENCH_PREFERRED_DARK_COLOR_THEME, options.darkTheme, true)
                await settings.update(WINDOW_AUTO_DETECT_COLOR_SCHEME, true)
            }
        }
    }

    if (intervalDisposable) {
        context.subscriptions.push(intervalDisposable)
    }

    return intervalDisposable
}

function createStatusBarItem(context: vscode.ExtensionContext) {
    const options = getOptions()
    if (options.showToggleButton) {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
        statusBarItem.tooltip = 'Toggle light/dark theme'
        statusBarItem.text = '$(color-mode)'
        statusBarItem.command = `${EXTENSION_NAME}.toggleTheme`
        statusBarItem.show()
        context.subscriptions.push(statusBarItem)
        return statusBarItem
    } else {
        return undefined
    }
}

export async function activate(context: vscode.ExtensionContext) {
    let intervalDisposable: Disposable | undefined
    let statusBarItem: vscode.StatusBarItem | undefined

    intervalDisposable = await initializeToggling(context)
    statusBarItem = createStatusBarItem(context)

    context.subscriptions.push(
        vscode.commands.registerCommand(`${EXTENSION_NAME}.toggleTheme`, async () => {
            const settings = vscode.workspace.getConfiguration()
            await settings.update(`${EXTENSION_NAME}.autoToggle`, false, true)
            intervalDisposable?.dispose()
            toggleTheme({ mode: 'manual' })
        }),
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            const options = getOptions()
            const settings = vscode.workspace.getConfiguration()
            if (e.affectsConfiguration(`${EXTENSION_NAME}.autoToggle`)) {
                intervalDisposable?.dispose()
                if (options.autoToggle) {
                    intervalDisposable = await initializeToggling(context)
                } else {
                    if (settings.get(WINDOW_AUTO_DETECT_COLOR_SCHEME)) {
                        settings.update(WINDOW_AUTO_DETECT_COLOR_SCHEME, false, true)
                    }
                }
            } else {
                if (!options.autoToggle) return
                intervalDisposable?.dispose()
                intervalDisposable = await initializeToggling(context)
            }

            if (e.affectsConfiguration(`${EXTENSION_NAME}.showToggleButton`)) {
                const showToggleButton = settings.get(`${EXTENSION_NAME}.showToggleButton`)
                if (showToggleButton) {
                    if (statusBarItem) {
                        statusBarItem.show()
                    } else {
                        statusBarItem = createStatusBarItem(context)
                    }
                } else {
                    if (statusBarItem) {
                        statusBarItem.hide()
                    }
                }
            }
        })
    )
}
