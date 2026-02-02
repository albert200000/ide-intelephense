/* global atom */

const { AutoLanguageClient } = require('atom-languageclient')
const { createHash } = require('crypto')
const os = require('os')
const querystring = require('querystring')
const path = require('path')
const fs = require('fs')

class IntelephenseLanguageClient extends AutoLanguageClient {
  getGrammarScopes () {
    return ['text.html.php']
  }

  getLanguageName () {
    return 'PHP'
  }

  getServerName () {
    return 'Intelephense'
  }

  startServerProcess () {
    const childProcess = super.spawn(path.resolve(path.join(
      __dirname,
      '../node_modules/.bin/intelephense'
    )), ['--stdio'])

    if (atom.config.get('core.debugLSP')) {
      this.enableLogging(childProcess)
    }

    return childProcess
  }

  getInitializeParams (projectPath, process) {
    const params = super.getInitializeParams(projectPath, process)

    if (atom.config.get('ide-intelephense.licenseKey')) {
      this.activateLicenseKey()
    }

    params.initializationOptions = {
      licenceKey: atom.config.get('ide-intelephense.licenseKey'),
      globalStoragePath: this.getGlobalStoragePath(),
      storagePath: atom.config.get('ide-intelephense.storagePath')
    }

    return params
  }

  getGlobalStoragePath () {
    return atom.config.get('ide-intelephense.globalStoragePath') || path.resolve(os.homedir(), './.ide-intelephense')
  }

  activateLicenseKey () {
    const licenseKey = atom.config.get('ide-intelephense.licenseKey')
    const licenseKeyPath = path.join(this.getGlobalStoragePath(), 'intelephense_licence_key_' + licenseKey)

    if (!licenseKey || fs.existsSync(licenseKeyPath)) {
      return
    }

    fetch('https://intelephense.com/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify({
        machineId: createHash('sha256').update(os.homedir(), 'utf8').digest('hex'),
        licenceKey: licenseKey
      })
    })
      .then(async res => {
        const text = await res.text()
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${text}`)
        }
        fs.writeFileSync(licenseKeyPath, text, 'utf8')
        atom.notifications.addSuccess('Your Intelephense license key was activated.')
      })
      .catch(err => {
        atom.notifications.addError('Your Intelephense license key could not be activated.')
        console.error(err)
      })
  }

  enableLogging (process) {
    const log = (std, chunk) => {
      chunk.toString().split('\n').forEach((line) => {
        try {
          console.log(std, JSON.parse(line))
        } catch {
          return false
        }
      })
    }

    process.stderr.on('data', chunk => log('err', chunk))
    process.stdout.on('data', chunk => log('out', chunk))
  }
}

module.exports = new IntelephenseLanguageClient()
