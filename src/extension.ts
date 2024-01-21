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
    darkStartTime: 19
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
        settings.update(WORKBENCH_COLOR_THEME, themeToChange)
    }
}

async function initialize(context: vscode.ExtensionContext) {
    const options = getOptions()
    const settings = vscode.workspace.getConfiguration()
    let intervalDisposable: Disposable | undefined

    if (options.autoToggle) {
        if (options.toggleSetting === 'custom') {
            await settings.update(WINDOW_AUTO_DETECT_COLOR_SCHEME, false)
            toggleTheme({ mode: 'auto' })
            const id = setInterval(() => toggleTheme({ mode: 'auto' }), 30 * 1000)
            intervalDisposable = new vscode.Disposable(() => clearInterval(id))
        } else if (options.toggleSetting === 'system') {
            const autoDetect = settings.get(WINDOW_AUTO_DETECT_COLOR_SCHEME)
            if (!autoDetect) {
                await settings.update(WORKBENCH_PREFERRED_LIGHT_COLOR_THEME, options.lightTheme)
                await settings.update(WORKBENCH_PREFERRED_DARK_COLOR_THEME, options.darkTheme)
                await settings.update(WINDOW_AUTO_DETECT_COLOR_SCHEME, true)
            }
        }
    }

    if (intervalDisposable) {
        context.subscriptions.push(intervalDisposable)
    }

    return intervalDisposable
}

export async function activate(context: vscode.ExtensionContext) {
    let intervalDisposable: Disposable | undefined

    intervalDisposable = await initialize(context)

    context.subscriptions.push(
        vscode.commands.registerCommand(`${EXTENSION_NAME}.toggleTheme`, () => {
            toggleTheme({ mode: 'manual' })
            intervalDisposable?.dispose()
            const settings = vscode.workspace.getConfiguration()
            settings.update(`${EXTENSION_NAME}.autoToggle`, false)
        }),
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            const options = getOptions()
            const settings = vscode.workspace.getConfiguration()
            if (e.affectsConfiguration(`${EXTENSION_NAME}.autoToggle`)) {
                intervalDisposable?.dispose()
                if (options.autoToggle) {
                    intervalDisposable = await initialize(context)
                } else {
                    if (settings.get(WINDOW_AUTO_DETECT_COLOR_SCHEME)) {
                        settings.update(WINDOW_AUTO_DETECT_COLOR_SCHEME, false)
                    }
                }
            } else {
                if (!options.autoToggle) return
                intervalDisposable?.dispose()
                intervalDisposable = await initialize(context)
            }
        })
    )
}
