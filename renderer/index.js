import functions from '@google-cloud/functions-framework'
import {Storage} from '@google-cloud/storage'

import * as dotenv from 'dotenv'
import ethers  from 'ethers'
import puppeteer  from 'puppeteer'

dotenv.config()

const config = {
  CONTRACT_ADDR: process.env.CONTRACT_ADDR,
  ENV: process.env.ENV || 'dev',
  FILE_NAME: process.env.FILE_NAME,
  BUCKET_NAME: process.env.BUCKET_NAME,
  INFURA_KEY: process.env.INFURA_KEY,
  PUPPETEER_BROWSERLESS_IO_KEY: process.env.PUPPETEER_BROWSERLESS_IO_KEY,
  STORAGE_KEYFILE_PATH: process.env.STORAGE_KEYFILE_PATH,
  SELECTOR: process.env.SELECTOR || '__RENDERER_SELECTOR',
  THUMBNAIL_WIDTH: process.env.THUMBNAIL_WIDTH || 2700,
  THUMBNAIL_HEIGHT: process.env.THUMBNAIL_HEIGHT || 2700,
}

console.log(config)

const uriContractABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function tokenIdToHash(uint256 tokenId) view returns (bytes32 hash)',
  'function projectScriptByIndex(uint256 projectId, uint256 index) view returns (string script)',
  'function projectScriptInfo(uint256 projectId) view returns (string memory scriptJSON, uint256 scriptCount, bool useHashString, string memory ipfsHash, bool locked, bool paused)',
]

const LIB_DEPS = [
  'https://cdn.jsdelivr.net/npm/p5@1.2.0/lib/p5.js'
]

const storage = new Storage(
  config.ENV === 'dev'
    ? { keyFilename: config.STORAGE_KEYFILE_PATH }
    : undefined
)

async function generateHtmlContent(contractAddr, tokenId) {
  const url = `https://mainnet.infura.io/v3/${config.INFURA_KEY}`
  const provider = new ethers.providers.JsonRpcProvider(url)

  const throwawayPrivateKeyThatsOnlyUsedForGetters = "0x0123456789012345678901234567890123456789012345678901234567890123";
  const signer = new ethers.Wallet(throwawayPrivateKeyThatsOnlyUsedForGetters, provider)
  const TokenURIContract = new ethers.Contract(contractAddr, uriContractABI, provider)
  const projectId = Math.floor(tokenId/1000000)

  const hash = await TokenURIContract.connect(signer).tokenIdToHash(tokenId)
  const projectScriptInfo = await TokenURIContract.connect(signer).projectScriptInfo(projectId)
  const scriptCount = projectScriptInfo.scriptCount.toNumber()

  let projectScript = ''

  for (let i = 0; i < scriptCount; i++) {
    projectScript += await TokenURIContract.connect(signer).projectScriptByIndex(projectId, i)
  }

  return `
    <html>
      <body id="${config.SELECTOR}"></body>
      ${LIB_DEPS.map(d => `<script src="${d}"></script>`)}
      <script>window.tokenData = { hash: "${hash}", tokenId: ${tokenId} }</script>
      <script>${projectScript}</script>
    </html>
  `
}


async function generateImage(htmlContent) {
  try {
    const start = Date.now()
    // const browser = await puppeteer.launch({ headless: true })
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${config.PUPPETEER_BROWSERLESS_IO_KEY}`,
    })
    const page = await browser.newPage()
    await page.setViewport({ width: config.THUMBNAIL_WIDTH, height: config.THUMBNAIL_HEIGHT })
    await page.setContent(htmlContent)
    await page.waitForSelector('#' + config.SELECTOR)
    const element = await page.$('#' + config.SELECTOR)
    const image = await element.screenshot()
    await browser.close()
    return image
  } catch (e) {
    throw new Error(e)
  }
}

async function retrieveOrSaveImage(tokenId) {
  const file = storage
    .bucket(config.BUCKET_NAME)
    .file(`${config.FILE_NAME}/${config.CONTRACT_ADDR}/${tokenId}.png`)

  const [cachedImageExists] = await file.exists()

  try {
    if (cachedImageExists) {
      const data = await file.download()
      return data[0]
    } else {
      const htmlContent = await generateHtmlContent(config.CONTRACT_ADDR, tokenId)
      const image = await generateImage(htmlContent)

      await file.save(image, {
        metadata: { contentType: 'text/png' },
      })
      return image
    }
  } catch (e) {
    throw new Error(e)
  }
}

async function render (req, res) {
  const { tokenId } = req.query

  try {
    const image = await retrieveOrSaveImage(tokenId)
    res.set('Content-Type', 'image/png')
    res.send(image)

  } catch (e) {
    throw new Error(e)
  }
}

functions.http('render', render)
