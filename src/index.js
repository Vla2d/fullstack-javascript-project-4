import path from 'path';
import fs from 'fs/promises';
import debug from 'debug';
import axios from 'axios';
import 'axios-debug-log';
import Listr from 'listr';
import {
  slugifyDirName,
  slugifyFileName,
  extractAssets,
  writeFile,
  downloadAsset,
} from './utils.js';

const log = debug('page-loader');

const loadPage = (url, outputDirPath = process.cwd()) => {
  log(`Page loader has started with url: ${url}, outputDirpath: ${outputDirPath}`);

  const pageUrl = new URL(url);
  const pageName = slugifyFileName(pageUrl);
  const dirName = slugifyDirName(pageUrl);
  const pagePath = path.join(outputDirPath, pageName);
  const dirPath = path.join(outputDirPath, dirName);

  return axios.get(url)
    .then(({ data: html }) => {
      log(`Assets directory path: '${dirPath}'`);

      return fs.access(dirPath)
        .catch(() => fs.mkdir(dirPath))
        .then(() => html);
    })
    .then((html) => extractAssets(html, pageUrl, dirName))
    .then(({ html, assets }) => {
      log(`HTML page path: '${pagePath}'`);

      return writeFile(pagePath, html)
        .then(() => assets);
    })
    .then((assets) => {
      const tasks = assets.map(({ assetUrl, name }) => {
        const assetPath = path.resolve(dirPath, name);
        return {
          title: `Downloading asset: ${assetUrl.toString()}`,
          task: () => downloadAsset(assetUrl.toString(), assetPath),
        };
      });

      return new Listr(tasks, { concurrent: true }).run();
    })
    .then(() => `Page was successfully downloaded into '${pagePath}'`);
};

export default loadPage;
